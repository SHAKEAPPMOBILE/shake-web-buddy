import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, supportedLanguages } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { logPostgrestError } from "@/lib/supabaseErrorLog";

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
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        logPostgrestError("LanguageSync profiles_private select", error);
        return;
      }

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

  return null;
}
