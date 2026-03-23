import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, supportedLanguages } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Syncs language preference with the database when the user is logged in.
 * - On login: loads preferred_language from profiles_private and applies it.
 * - When user changes language: persists preferred_language to profiles_private.
 */
export function LanguageSync() {
  const { user } = useAuth();
  const { setSelectedLanguage } = useLanguage();

  // Load saved language from DB when user is available
  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const loadFromDb = async () => {
      const { data, error } = await supabase
        .from("profiles_private")
        .select("preferred_language")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled || error) return;

      const code = data?.preferred_language?.trim();
      if (!code) return;

      const lang = supportedLanguages.find((l) => l.code === code);
      if (lang) setSelectedLanguage(lang);
    };

    loadFromDb();
    return () => {
      cancelled = true;
    };
  }, [user?.id, setSelectedLanguage]);

  // NOTE: Disabled DB persistence for preferred_language because some deployed
  // environments do not yet have this column in `profiles_private`, causing
  // 400 PATCH errors on page load.

  return null;
}
