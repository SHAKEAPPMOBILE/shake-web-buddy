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
  const signupIntent = params.get("intent") === "signup";
  let pendingEmailMatch = false;
  try {
    const sent = sessionStorage.getItem(STORAGE_SIGNUP_EMAIL);
    const em = session.user.email?.toLowerCase()?.trim() ?? "";
    pendingEmailMatch = !!(sent && em && sent === em);
  } catch {
    /* ignore */
  }
  if (signupIntent || pendingEmailMatch) {
    try {
      sessionStorage.removeItem(STORAGE_SIGNUP_EMAIL);
      sessionStorage.setItem(STORAGE_NEED_PASSWORD, "1");
    } catch {
      /* ignore */
    }
    return "/auth?setPassword=1";
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
          console.error("[OAuthCallback] Auth error detected", {
            error,
            errorDescription: message,
            source: params.get("error") ? "query" : "hash",
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
          console.log("[OAuthCallback] Exchanging OAuth code for session", {
            codeLength: code.length,
            timestamp: new Date().toISOString(),
          });
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error("[OAuthCallback] Code exchange failed", {
              error: exchangeError.message,
              code: (exchangeError as { code?: string })?.code,
              timestamp: new Date().toISOString(),
            });
            throw exchangeError;
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

        await new Promise((r) => setTimeout(r, 300));

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
        const err = e as { message?: string; code?: string; status?: number };
        console.error("[OAuthCallback] Callback error", {
          message: err?.message,
          code: err?.code,
          status: err?.status,
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
