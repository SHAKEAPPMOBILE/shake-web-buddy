import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/app-toast";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // 1) Check for OAuth error in query or hash (Supabase sends error/error_description)
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash?.replace(/^#/, "") || "";
      const hashParams = new URLSearchParams(hash);
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

      // 2) Handle OAuth code exchange (for Apple and Google OAuth flows)
      const code = params.get("code");
      if (code) {
        try {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }
        } catch (e: any) {
          console.error("Code exchange error:", e);
          toast.error("Sign-in failed. Please try again.");
          navigate("/auth", { replace: true });
          return;
        }
      }

      // 3) Handle magic link tokens in hash (for email OTP flow)
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        try {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessionError) {
            throw setSessionError;
          }
        } catch (e: any) {
          console.error("Session set error:", e);
          toast.error("Sign-in failed. Please try again.");
          navigate("/auth", { replace: true });
          return;
        }
      }

      // 4) Give Supabase a moment to process the redirect (hash or query tokens)
      await new Promise((r) => setTimeout(r, 400));

      if (cancelled) return;

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        toast.error("Sign-in didn’t complete. Please try again.");
        navigate("/auth", { replace: true });
        return;
      }

      if (session) {
        navigate("/", { replace: true });
        return;
      }

      // No error in URL but no session (e.g. user closed provider window)
      toast.error("Sign-in didn’t complete. Please try again.");
      navigate("/auth", { replace: true });
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate, location]);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-white">
      <LoadingSpinner />
    </div>
  );
}
