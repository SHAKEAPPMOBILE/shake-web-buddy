import React, { createContext, useContext, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

export interface Language {
  code: string;
  name: string;
  flag: string;
  nativeName: string;
}

// Languages with full translation support
export const translatedLanguages = ["en", "es", "pt", "fr", "de"];

export const supportedLanguages: Language[] = [
  { code: "en", name: "English", flag: "🇺🇸", nativeName: "English" },
  { code: "es", name: "Spanish", flag: "🇪🇸", nativeName: "Español" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹", nativeName: "Português" },
  { code: "fr", name: "French", flag: "🇫🇷", nativeName: "Français" },
  { code: "de", name: "German", flag: "🇩🇪", nativeName: "Deutsch" },
  { code: "it", name: "Italian", flag: "🇮🇹", nativeName: "Italiano" },
  { code: "nl", name: "Dutch", flag: "🇳🇱", nativeName: "Nederlands" },
  { code: "pl", name: "Polish", flag: "🇵🇱", nativeName: "Polski" },
  { code: "ru", name: "Russian", flag: "🇷🇺", nativeName: "Русский" },
  { code: "uk", name: "Ukrainian", flag: "🇺🇦", nativeName: "Українська" },
  { code: "tr", name: "Turkish", flag: "🇹🇷", nativeName: "Türkçe" },
  { code: "ar", name: "Arabic", flag: "🇸🇦", nativeName: "العربية" },
  { code: "zh", name: "Chinese", flag: "🇨🇳", nativeName: "中文" },
  { code: "ja", name: "Japanese", flag: "🇯🇵", nativeName: "日本語" },
  { code: "ko", name: "Korean", flag: "🇰🇷", nativeName: "한국어" },
  { code: "hi", name: "Hindi", flag: "🇮🇳", nativeName: "हिन्दी" },
  { code: "th", name: "Thai", flag: "🇹🇭", nativeName: "ไทย" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳", nativeName: "Tiếng Việt" },
  { code: "id", name: "Indonesian", flag: "🇮🇩", nativeName: "Bahasa Indonesia" },
  { code: "sv", name: "Swedish", flag: "🇸🇪", nativeName: "Svenska" },
  { code: "no", name: "Norwegian", flag: "🇳🇴", nativeName: "Norsk" },
  { code: "da", name: "Danish", flag: "🇩🇰", nativeName: "Dansk" },
  { code: "fi", name: "Finnish", flag: "🇫🇮", nativeName: "Suomi" },
  { code: "el", name: "Greek", flag: "🇬🇷", nativeName: "Ελληνικά" },
  { code: "cs", name: "Czech", flag: "🇨🇿", nativeName: "Čeština" },
  { code: "hu", name: "Hungarian", flag: "🇭🇺", nativeName: "Magyar" },
  { code: "ro", name: "Romanian", flag: "🇷🇴", nativeName: "Română" },
  { code: "bg", name: "Bulgarian", flag: "🇧🇬", nativeName: "Български" },
  { code: "hr", name: "Croatian", flag: "🇭🇷", nativeName: "Hrvatski" },
  { code: "sr", name: "Serbian", flag: "🇷🇸", nativeName: "Српски" },
];

// Map country codes to language codes
const countryToLanguage: Record<string, string> = {
  US: "en", GB: "en", AU: "en", CA: "en", NZ: "en", IE: "en",
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es",
  PT: "pt", BR: "pt",
  FR: "fr", BE: "fr", CH: "fr",
  DE: "de", AT: "de",
  IT: "it",
  NL: "nl",
  PL: "pl",
  RU: "ru",
  UA: "uk",
  TR: "tr",
  SA: "ar", AE: "ar", EG: "ar",
  CN: "zh", TW: "zh", HK: "zh",
  JP: "ja",
  KR: "ko",
  IN: "hi",
  TH: "th",
  VN: "vi",
  ID: "id",
  SE: "sv",
  NO: "no",
  DK: "da",
  FI: "fi",
  GR: "el",
  CZ: "cs",
  HU: "hu",
  RO: "ro",
  BG: "bg",
  HR: "hr",
  RS: "sr",
};

interface LanguageContextType {
  selectedLanguage: Language;
  setSelectedLanguage: (language: Language) => void;
  detectedLanguage: Language | null;
  isDetecting: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  
  const [selectedLanguage, setSelectedLanguageState] = useState<Language>(
    () => {
      // Try to load from localStorage
      const saved = localStorage.getItem("shake-language");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const found = supportedLanguages.find(l => l.code === parsed.code);
          if (found) return found;
        } catch {}
      }
      return supportedLanguages[0]; // Default to English
    }
  );
  const [detectedLanguage, setDetectedLanguage] = useState<Language | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);

  // Auto-detect language based on browser settings and location
  useEffect(() => {
    const detectLanguage = async () => {
      // Check if user already has a saved preference
      if (localStorage.getItem("shake-language")) {
        setIsDetecting(false);
        return;
      }

      // Get browser language as primary source (most reliable)
      const browserLang = navigator.language.split('-')[0];
      const browserLanguage = supportedLanguages.find(l => l.code === browserLang);
      
      // Also check navigator.languages for additional context
      const browserLanguages = navigator.languages || [navigator.language];
      let bestMatch: typeof supportedLanguages[0] | null = null;
      
      for (const lang of browserLanguages) {
        const langCode = lang.split('-')[0];
        const match = supportedLanguages.find(l => l.code === langCode);
        if (match) {
          bestMatch = match;
          break;
        }
      }

      // Use browser language immediately (fast, reliable)
      if (bestMatch) {
        setDetectedLanguage(bestMatch);
        setSelectedLanguageState(bestMatch);
      } else if (browserLanguage) {
        setDetectedLanguage(browserLanguage);
        setSelectedLanguageState(browserLanguage);
      }

      // Try IP-based detection as secondary confirmation
      try {
        const response = await fetch('https://ipapi.co/json/', {
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.country_code) {
            const langCode = countryToLanguage[data.country_code];
            const ipLanguage = supportedLanguages.find(l => l.code === langCode);
            
            // If IP detection gives a different result than browser, prefer IP
            // (user might be traveling but phone language unchanged)
            if (ipLanguage && (!bestMatch || ipLanguage.code !== bestMatch.code)) {
              setDetectedLanguage(ipLanguage);
              setSelectedLanguageState(ipLanguage);
            }
          }
        }
      } catch (error) {
        // IP detection failed, browser language already set above
        console.log('IP detection unavailable, using browser language');
      } finally {
        setIsDetecting(false);
      }
    };

    detectLanguage();
  }, []);

  const setSelectedLanguage = (language: Language) => {
    setSelectedLanguageState(language);
    localStorage.setItem("shake-language", JSON.stringify({ code: language.code }));
    
    // Update i18n language - use the language if translated, otherwise fallback to English
    const i18nLang = translatedLanguages.includes(language.code) ? language.code : 'en';
    i18n.changeLanguage(i18nLang);
  };

  return (
    <LanguageContext.Provider
      value={{
        selectedLanguage,
        setSelectedLanguage,
        detectedLanguage,
        isDetecting,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
