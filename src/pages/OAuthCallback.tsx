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

    const run = async () => {
      try {
        // 1) Parse query/hash params once
        const params = new URLSearchParams(window.location.search);
        const hash = window.location.hash?.replace(/^#/, "") || "";
        const hashParams = new URLSearchParams(hash);

        // 2) Check for provider errors
        const error = params.get("error") || hashParams.get("error");
        const errorDescription =
          params.get("error_description") || hashParams.get("error_description");

        if (error) {
          const message =
            errorDescription?.replace(/\+/g, " ") || "Sign-in was cancelled or failed.";
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

        // 5) If callback URL has no auth payload, fail soft to /auth
        if (!code && !(accessToken && refreshToken)) {
          navigate("/auth", { replace: true });
          return;
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }
        } else if (accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessionError) {
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
          throw sessionError;
        }

        navigate(session ? "/" : "/auth", { replace: true });
      } catch (e: any) {
        console.error("OAuth callback error:", e);
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
