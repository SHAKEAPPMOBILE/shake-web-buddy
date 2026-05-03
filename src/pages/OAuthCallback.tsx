import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/app-toast";
import logoShake from "@/assets/shake-logo-new.png";

const STORAGE_SIGNUP_EMAIL = "shake_signup_magic_link_sent";
const STORAGE_NEED_PASSWORD = "shake_post_signup_set_password";

/** After email signup magic link, send user to /auth to create a password before the main app. */
function resolveDestinationAfterAuth(session: { user?: { email?: string | null } } | null): string {
  if (!session?.user) return "/auth";
  const params = new URLSearchParams(window.location.search);
  const intent = params.get("intent");
  const signupIntent = intent === "signup";
  const resetIntent = intent === "reset";
  let pendingEmailMatch = false;
  try {
    const sent = sessionStorage.getItem(STORAGE_SIGNUP_EMAIL);
    const em = session.user.email?.toLowerCase()?.trim() ?? "";
    pendingEmailMatch = !!(sent && em && sent === em);
  } catch {
    /* ignore */
  }
  if (resetIntent) {
    return "/auth?intent=reset";
  }
  if (signupIntent || pendingEmailMatch) {
    try {
      sessionStorage.removeItem(STORAGE_SIGNUP_EMAIL);
      sessionStorage.setItem(STORAGE_NEED_PASSWORD, "1");
    } catch {
      /* ignore */
    }
    return "/auth?intent=signup";
  }
  return "/";
}

type EmailOtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";

function otpTypesToTry(typeParam: string | null): EmailOtpType[] {
  const raw = (typeParam || "").toLowerCase().trim();
  const out: EmailOtpType[] = [];

  const push = (t: EmailOtpType) => {
    if (!out.includes(t)) out.push(t);
  };

  if (raw === "signup") {
    push("signup");
  } else if (raw === "magiclink") {
    push("magiclink");
    push("email");
  } else if (raw === "recovery") {
    push("recovery");
  } else if (raw === "email_change") {
    push("email_change");
  } else if (raw === "invite") {
    push("invite");
  } else if (raw === "email") {
    push("email");
    push("magiclink");
  } else {
    push("email");
    push("magiclink");
  }

  return out;
}

/**
 * Poll the profiles table until avatar_url is populated or the timeout expires.
 *
 * The DB trigger (handle_new_user) and ensureProfilesExist both write the
 * profile row asynchronously after the session is established. If we navigate
 * before the row is ready, IOSAppLayout's completeness check fires against a
 * partial/missing row, retries up to 6 times, and may still show
 * MandatoryPhotoScreen or redirect back to /auth unnecessarily.
 *
 * Polling here — in the callback page that the user never sees — is the right
 * place to absorb that latency before handing control to the app shell.
 */
async function waitForProfile(
  userId: string,
  { intervalMs = 500, timeoutMs = 3000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      // Don't block navigation on a DB error — just proceed.
      console.warn("[OAuthCallback] waitForProfile: profiles query failed", error.message);
      return;
    }

    if (data?.avatar_url) {
      console.log("[OAuthCallback] waitForProfile: profile ready with avatar_url");
      return;
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  console.warn("[OAuthCallback] waitForProfile: timed out waiting for avatar_url");
}

async function verifyEmailLinkWithTokenHash(
  tokenHash: string,
  typeParam: string | null
): Promise<{ ok: boolean; error?: Error }> {
  const types = otpTypesToTry(typeParam);
  let lastErr: Error | undefined;

  for (const type of types) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error && data?.session) {
      return { ok: true };
    }
    if (error) {
      lastErr = error as Error;
    }
  }

  return { ok: false, error: lastErr };
}

export default function OAuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    const callbackStartTime = performance.now();

    const run = async () => {
      try {
        const { data: { session: earlySession } } = await supabase.auth.getSession();
        if (earlySession && !cancelled) {
          console.log("[OAuthCallback] Session already established on entry, redirecting", {
            userId: earlySession.user?.id,
            timestamp: new Date().toISOString(),
          });
          navigate(resolveDestinationAfterAuth(earlySession), { replace: true });
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const hash = window.location.hash?.replace(/^#/, "") || "";
        const hashParams = new URLSearchParams(hash);

        console.log("[OAuthCallback] Callback initiated", {
          fullUrl: window.location.href,
          search: window.location.search,
          hash: window.location.hash,
          timestamp: new Date().toISOString(),
        });

        const error = params.get("error") || hashParams.get("error");
        const errorDescription =
          params.get("error_description") || hashParams.get("error_description");

        if (error) {
          const message =
            errorDescription?.replace(/\+/g, " ") || "Sign-in was cancelled or failed.";
          // Log every detail so we can diagnose exactly what Google returned
          const allQueryParams: Record<string, string> = {};
          params.forEach((v, k) => { allQueryParams[k] = v; });
          const allHashParams: Record<string, string> = {};
          hashParams.forEach((v, k) => { allHashParams[k] = v; });
          console.error("[OAuthCallback] Auth error detected — FULL DETAILS", {
            error,
            errorCode: error,
            errorDescription: message,
            rawErrorDescription: errorDescription,
            source: params.get("error") ? "query" : "hash",
            fullUrl: window.location.href,
            origin: window.location.origin,
            pathname: window.location.pathname,
            allQueryParams,
            allHashParams,
            timestamp: new Date().toISOString(),
          });
          toast.error(message);
          navigate("/auth", { replace: true });
          return;
        }

        const rawCode = params.get("code") || hashParams.get("code");
        const code = rawCode && rawCode !== "undefined" && rawCode !== "null" ? rawCode : null;

        const rawTokenHash = params.get("token_hash") || hashParams.get("token_hash") || null;
        const tokenHash =
          rawTokenHash && rawTokenHash !== "undefined" && rawTokenHash !== "null"
            ? rawTokenHash
            : null;
        const linkType = params.get("type") || hashParams.get("type");

        const rawAccessToken = hashParams.get("access_token") || params.get("access_token");
        const rawRefreshToken = hashParams.get("refresh_token") || params.get("refresh_token");
        const accessToken =
          rawAccessToken && rawAccessToken !== "undefined" && rawAccessToken !== "null"
            ? rawAccessToken
            : null;
        const refreshToken =
          rawRefreshToken && rawRefreshToken !== "undefined" && rawRefreshToken !== "null"
            ? rawRefreshToken
            : null;

        console.log("[OAuthCallback] Auth tokens parsed", {
          hasCode: !!code,
          hasTokenHash: !!tokenHash,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          accessTokenSource: rawAccessToken ? (hashParams.get("access_token") ? "hash" : "query") : "none",
          refreshTokenSource: rawRefreshToken ? (hashParams.get("refresh_token") ? "hash" : "query") : "none",
          timestamp: new Date().toISOString(),
        });

        const hasTokenPair = !!(accessToken && refreshToken);
        if (!code && !tokenHash && !hasTokenPair) {
          const { data: { session: lateSession } } = await supabase.auth.getSession();
          if (lateSession && !cancelled) {
            console.log("[OAuthCallback] No tokens in URL but session found on late check, redirecting", {
              userId: lateSession.user?.id,
              timestamp: new Date().toISOString(),
            });
            navigate(resolveDestinationAfterAuth(lateSession), { replace: true });
            return;
          }
          console.warn("[OAuthCallback] No auth payload detected", {
            reason: "Neither code, token_hash, nor token pair found",
            timestamp: new Date().toISOString(),
          });
          navigate("/auth", { replace: true });
          return;
        }

        if (code) {
          // Guard against double-exchange: back button, React Strict Mode, or effect re-run
          // can call exchangeCodeForSession on an already-consumed PKCE code, causing a 409.
          const { data: { session: preExchangeSession } } = await supabase.auth.getSession();
          if (preExchangeSession) {
            console.log("[OAuthCallback] Session already exists before code exchange, skipping exchange", {
              userId: preExchangeSession.user?.id,
              timestamp: new Date().toISOString(),
            });
            if (!cancelled) navigate(resolveDestinationAfterAuth(preExchangeSession), { replace: true });
            return;
          }

          console.log("[OAuthCallback] Exchanging OAuth code for session", {
            codeLength: code.length,
            timestamp: new Date().toISOString(),
          });
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error("[OAuthCallback] Code exchange failed", {
              error: exchangeError.message,
              code: (exchangeError as { code?: string })?.code,
              timestamp: new Date().toISOString(),
            });
            throw exchangeError;
          }

          // Wait for the DB trigger to populate the profile row before we
          // navigate, so IOSAppLayout's completeness check sees a ready profile.
          const exchangedUserId = exchangeData?.session?.user?.id;
          if (exchangedUserId) {
            if (cancelled) return;
            await waitForProfile(exchangedUserId);
          }
        } else if (tokenHash) {
          const { ok, error: verifyError } = await verifyEmailLinkWithTokenHash(tokenHash, linkType);
          if (!ok) {
            console.error("[OAuthCallback] token_hash verify failed:", verifyError);
            throw verifyError ?? new Error("Invalid or expired email link");
          }
        } else if (accessToken && refreshToken) {
          console.log("[OAuthCallback] Setting session from magic link tokens", {
            accessTokenLength: accessToken.length,
            refreshTokenLength: refreshToken.length,
            timestamp: new Date().toISOString(),
          });
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessionError) {
            console.error("[OAuthCallback] Session set failed", {
              error: setSessionError.message,
              code: (setSessionError as { code?: string })?.code,
              timestamp: new Date().toISOString(),
            });
            throw setSessionError;
          }
        }

        if (cancelled) return;

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("[OAuthCallback] Get session failed", {
            error: sessionError.message,
            code: (sessionError as { code?: string })?.code,
            timestamp: new Date().toISOString(),
          });
          throw sessionError;
        }

        const callbackDuration = performance.now() - callbackStartTime;
        console.log("[OAuthCallback] Callback completed successfully", {
          sessionExists: !!session,
          userId: session?.user?.id,
          durationMs: Math.round(callbackDuration),
          timestamp: new Date().toISOString(),
        });

        navigate(session ? resolveDestinationAfterAuth(session) : "/auth", { replace: true });
      } catch (e: unknown) {
        const callbackDuration = performance.now() - callbackStartTime;
        const err = e as { message?: string; code?: string; status?: number; name?: string };
        console.error("[OAuthCallback] Callback error — FULL DETAILS", {
          message: err?.message,
          code: err?.code,
          status: err?.status,
          name: err?.name,
          rawError: e,
          fullUrl: window.location.href,
          search: window.location.search,
          hash: window.location.hash,
          durationMs: Math.round(callbackDuration),
          timestamp: new Date().toISOString(),
        });
        toast.error("Sign-in failed. Please try again.");
        navigate("/auth", { replace: true });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate, location]);

  return (
    <div className="h-screen w-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center">
        <img
          src={logoShake}
          alt="SHAKE"
          className="h-20 w-20 object-contain animate-pulse"
        />
        <div className="mt-5 h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    </div>
  );
}
