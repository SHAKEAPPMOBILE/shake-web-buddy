import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/app-toast";
import logoShake from "@/assets/shake-logo-new.png";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    let cancelled = false;
    const callbackStartTime = performance.now();

    const run = async () => {
      try {
        // 0) Fast-path: if a session is already established (e.g. the user navigated
        //    back here while already logged in, or an older SDK auto-processed the URL)
        //    there is nothing to exchange — just send them into the app.
        const { data: { session: earlySession } } = await supabase.auth.getSession();
        if (earlySession && !cancelled) {
          console.log("[OAuthCallback] Session already established on entry, redirecting to app", {
            userId: earlySession.user?.id,
            timestamp: new Date().toISOString(),
          });
          navigate("/", { replace: true });
          return;
        }

        // 1) Parse query/hash params once
        const params = new URLSearchParams(window.location.search);
        const hash = window.location.hash?.replace(/^#/, "") || "";
        const hashParams = new URLSearchParams(hash);

        // Log the full URL and params for debugging
        console.log("[OAuthCallback] Callback initiated", {
          fullUrl: window.location.href,
          search: window.location.search,
          hash: window.location.hash,
          timestamp: new Date().toISOString(),
        });

        // 2) Check for provider errors
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

        // 3) Support OAuth code in query OR hash
        const rawCode = params.get("code") || hashParams.get("code");
        const code = rawCode && rawCode !== "undefined" && rawCode !== "null" ? rawCode : null;

        // 4) Support magic-link tokens in hash OR query
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

        // Log token presence and source
        console.log("[OAuthCallback] Auth tokens parsed", {
          hasCode: !!code,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          accessTokenSource: rawAccessToken ? (hashParams.get("access_token") ? "hash" : "query") : "none",
          refreshTokenSource: rawRefreshToken ? (hashParams.get("refresh_token") ? "hash" : "query") : "none",
          timestamp: new Date().toISOString(),
        });

        // 5) If callback URL has no auth payload, do one final session check before
        //    giving up — covers any edge case where the session was set between the
        //    early check and now (e.g. very tight race with SDK auto-detection).
        if (!code && !(accessToken && refreshToken)) {
          const { data: { session: lateSession } } = await supabase.auth.getSession();
          if (lateSession && !cancelled) {
            console.log("[OAuthCallback] No tokens in URL but session found on late check, redirecting", {
              userId: lateSession.user?.id,
              timestamp: new Date().toISOString(),
            });
            navigate("/", { replace: true });
            return;
          }
          console.warn("[OAuthCallback] No auth payload detected", {
            reason: "Neither code nor token pair found",
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
              code: (exchangeError as any)?.code,
              timestamp: new Date().toISOString(),
            });
            throw exchangeError;
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
              code: (setSessionError as any)?.code,
              timestamp: new Date().toISOString(),
            });
            throw setSessionError;
          }
        }

        // 6) Give Supabase a moment to settle state
        await new Promise((r) => setTimeout(r, 300));

        if (cancelled) return;

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("[OAuthCallback] Get session failed", {
            error: sessionError.message,
            code: (sessionError as any)?.code,
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

        navigate(session ? "/" : "/auth", { replace: true });
      } catch (e: any) {
        const callbackDuration = performance.now() - callbackStartTime;
        console.error("[OAuthCallback] Callback error", {
          message: e?.message,
          code: e?.code,
          status: (e as any)?.status,
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
