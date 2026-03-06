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
  const { selectedLanguage, setSelectedLanguage } = useLanguage();

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

  // Persist language to DB when user changes it (and we're logged in)
  useEffect(() => {
    if (!user?.id || !selectedLanguage?.code) return;

    // Avoid writing back immediately after we just loaded from DB (same tick)
    const code = selectedLanguage.code;
    supabase
      .from("profiles_private")
      .update({ preferred_language: code })
      .eq("user_id", user.id)
      .then(({ error }) => {
        if (error) console.warn("LanguageSync: failed to save preferred_language", error);
      });
  }, [user?.id, selectedLanguage?.code]);

  return null;
}
