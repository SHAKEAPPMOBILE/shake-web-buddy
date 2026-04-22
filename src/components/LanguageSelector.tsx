import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage, supportedLanguages, Language } from "@/contexts/LanguageContext";
import { useTranslation } from "react-i18next";

interface LanguageSelectorProps {
  className?: string;
  showLabel?: boolean;
}

export function LanguageSelector({ className, showLabel = true }: LanguageSelectorProps) {
  const { t } = useTranslation();
  const { selectedLanguage, setSelectedLanguage, isDetecting } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({
    top: "auto",
    transform: "translateX(-50%)",
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter to only translated languages
  const translatedLanguagesList = supportedLanguages.filter(l => 
    ['en', 'es', 'pt', 'fr', 'de', 'it', 'nl', 'ja', 'zh', 'uk', 'pl'].includes(l.code)
  );

  // Center the selected language on mount
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      const selectedIndex = translatedLanguagesList.findIndex(l => l.code === selectedLanguage.code);
      const itemWidth = 56; // 48px width + 8px gap
      const containerWidth = scrollRef.current.clientWidth;
      const scrollPosition = (selectedIndex * itemWidth) - (containerWidth / 2) + (itemWidth / 2);
      scrollRef.current.scrollLeft = Math.max(0, scrollPosition);
    }
  }, [isOpen, selectedLanguage.code, translatedLanguagesList]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keep dropdown visible even when selector is fixed near screen bottom
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updateDropdownPosition = () => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const estimatedDropdownHeight = 200;
      const spaceBelow = window.innerHeight - rect.bottom;

      if (spaceBelow < estimatedDropdownHeight) {
        setDropdownStyle({
          bottom: `${window.innerHeight - rect.top + 8}px`,
          top: "auto",
          transform: "translateX(-50%)",
        });
      } else {
        setDropdownStyle({
          top: `${rect.bottom + 8}px`,
          bottom: "auto",
          transform: "translateX(-50%)",
        });
      }
    };

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [isOpen]);

  const handleLanguageSelect = (language: Language) => {
    setSelectedLanguage(language);
    // Small delay before closing to show the selection
    setTimeout(() => setIsOpen(false), 150);
  };

  if (isDetecting) {
    return (
      <div className={cn("flex items-center justify-center gap-2 text-muted-foreground", className)}>
        <Globe className="h-4 w-4 animate-pulse" />
        <span className="text-sm">{t('languageSelector.detecting')}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-full",
          "bg-gray-900 border border-gray-900",
          "transition-all duration-200",
          isOpen && "ring-2 ring-primary/30"
        )}
      >
        <span className="text-xl">{selectedLanguage.flag}</span>
        {showLabel && (
          <span className="text-sm font-medium text-white">
            {selectedLanguage.nativeName}
          </span>
        )}
        <Globe className="h-4 w-4 text-white" />
      </button>

      {/* Carousel Dropdown */}
      {isOpen && (
        <div
          className="fixed left-1/2 z-50"
          style={dropdownStyle}
        >
          <div
            className={cn(
              "bg-card border border-border rounded-2xl shadow-xl",
              "p-3 animate-scale-in",
              "w-[280px]"
            )}
          >
            <p className="text-xs text-muted-foreground text-center mb-2">
              {t('languageSelector.swipeToSelect')}
            </p>
            
            {/* Scrollable Flag Carousel - Native iOS scrolling */}
            <div
              ref={scrollRef}
              className={cn(
                "flex gap-2 overflow-x-auto scrollbar-hide",
                "py-2 px-1",
                "-mx-1",
                "touch-pan-x" // Enable native touch scrolling on iOS
              )}
              style={{ 
                WebkitOverflowScrolling: 'touch', // Smooth momentum scrolling on iOS
                scrollSnapType: 'x mandatory' // Snap to items
              }}
            >
              {translatedLanguagesList.map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleLanguageSelect(language)}
                  className={cn(
                    "flex-shrink-0 flex flex-col items-center gap-1",
                    "w-12 p-2 rounded-xl transition-all duration-200",
                    "hover:bg-primary/10",
                    selectedLanguage.code === language.code
                      ? "bg-primary/20 ring-2 ring-primary scale-110"
                      : "bg-muted/30"
                  )}
                  style={{ scrollSnapAlign: 'center' }}
                >
                  <span className="text-2xl">{language.flag}</span>
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                    {language.code.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>

            {/* Selected Language Display */}
            <div className="mt-2 pt-2 border-t border-border/50 text-center">
              <span className="text-sm font-medium text-foreground">
                {selectedLanguage.flag} {selectedLanguage.nativeName}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
