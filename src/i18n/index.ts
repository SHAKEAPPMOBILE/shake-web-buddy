import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';
import uk from './locales/uk.json';
import pl from './locales/pl.json';

// Get saved language from localStorage or default to English
const getSavedLanguage = (): string => {
  try {
    const saved = localStorage.getItem('shake-language');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (['en', 'es', 'pt', 'fr', 'de', 'it', 'nl', 'ja', 'zh', 'uk', 'pl'].includes(parsed.code)) {
        return parsed.code;
      }
    }
  } catch {
    // Ignore parsing errors
  }
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      pt: { translation: pt },
      fr: { translation: fr },
      de: { translation: de },
      it: { translation: it },
      nl: { translation: nl },
      ja: { translation: ja },
      zh: { translation: zh },
      uk: { translation: uk },
      pl: { translation: pl },
    },
    lng: getSavedLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Prevent suspense issues during initial load
    },
  });

export default i18n;
