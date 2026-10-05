import { useEffect, useRef, useState } from "react";
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
  const { selectedLanguage, setSelectedLanguage } = useLanguage();
  // The language the database currently holds for this person ("" = none yet). The save effect only
  // writes once the load has finished, so a fresh device never overwrites a language chosen elsewhere.
  const dbLanguage = useRef<string | null>(null);
  const [dbLoaded, setDbLoaded] = useState(false);

  // Load saved language from DB when user is available
  useEffect(() => {
    if (!user?.id) { dbLanguage.current = null; setDbLoaded(false); return; }

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
      dbLanguage.current = code ?? "";
      setDbLoaded(true);
      if (!code) return;

      const lang = supportedLanguages.find((l) => l.code === code);
      if (lang) setSelectedLanguage(lang);
    };

    loadFromDb();
    return () => {
      cancelled = true;
    };
  }, [user?.id, setSelectedLanguage]);

  // Save the language when it differs from what the database holds — on first open (everyone's is
  // empty), and whenever they change it. Pushes written by other people's phones and by server
  // functions (a friend joined via your invite, your plan got popular) read it to pick a language.
  useEffect(() => {
    if (!user?.id || !dbLoaded) return;
    const code = selectedLanguage.code;
    if (!code || code === dbLanguage.current) return;
    dbLanguage.current = code;
    supabase
      .from("profiles_private")
      .update({ preferred_language: code })
      .eq("user_id", user.id)
      .then(({ error }) => { if (error) logPostgrestError("LanguageSync profiles_private update", error); });
  }, [user?.id, dbLoaded, selectedLanguage.code]);

  return null;
}
