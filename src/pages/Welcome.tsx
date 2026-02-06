import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { User } from "lucide-react";
import { useTranslation } from "react-i18next";

type PublicProfile = {
  name: string | null;
  avatar_url: string | null;
};

export default function Welcome() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const displayName = useMemo(() => profile?.name?.trim() || "Friend", [profile?.name]);

  // Redirect if user is not logged in
  useEffect(() => {
    if (!authLoading && !user) navigate("/");
  }, [authLoading, user, navigate]);

  // Load profile (avatar + name)
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user) return;
      setIsLoadingProfile(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (!error) setProfile(data ?? null);
      setIsLoadingProfile(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Auto-redirect after 3 seconds
  useEffect(() => {
    if (!user) return;
    const t = window.setTimeout(() => {
      navigate("/");
    }, 3000);
    return () => window.clearTimeout(t);
  }, [user, navigate]);

  const isLoading = authLoading || isLoadingProfile;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6 safe-area-top safe-area-bottom">
      <section className="w-full max-w-md bg-card border border-border rounded-2xl p-6 text-center animate-enter">
        {isLoading ? (
          <div className="py-10 flex flex-col items-center gap-4">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-muted-foreground">{t("welcome.settingUp")}</p>
          </div>
        ) : (
          <>
            <div className="mx-auto mb-4 w-24 h-24 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={`${displayName}'s profile picture`}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              ) : (
                <User className="w-12 h-12 text-muted-foreground" />
              )}
            </div>

            <h1 className="text-2xl font-display font-bold text-foreground">{t("welcome.greeting", { name: displayName })}</h1>
            <p className="mt-2 text-base text-muted-foreground">
              {t("welcome.message")}
            </p>

            <div className="mt-6 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ animation: "welcome-progress 3s linear forwards" }}
              />
            </div>

            <style>{`
              @keyframes welcome-progress { from { width: 0%; } to { width: 100%; } }
            `}</style>
          </>
        )}
      </section>
    </main>
  );
}
