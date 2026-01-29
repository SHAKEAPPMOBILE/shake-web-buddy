import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import fr from './locales/fr.json';
import de from './locales/de.json';

// Get saved language from localStorage or default to English
const getSavedLanguage = (): string => {
  try {
    const saved = localStorage.getItem('shake-language');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (['en', 'es', 'pt', 'fr', 'de'].includes(parsed.code)) {
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
