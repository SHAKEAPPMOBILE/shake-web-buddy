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
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.touches[0].pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !scrollRef.current) return;
    const x = e.touches[0].pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

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
          "bg-card/50 hover:bg-card/80 border border-border/50",
          "transition-all duration-200",
          isOpen && "ring-2 ring-primary/30"
        )}
      >
        <span className="text-xl">{selectedLanguage.flag}</span>
        {showLabel && (
          <span className="text-sm font-medium text-foreground">
            {selectedLanguage.nativeName}
          </span>
        )}
        <Globe className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Carousel Dropdown */}
      {isOpen && (
        <div
          className="fixed left-1/2 z-50"
          style={{
            top: containerRef.current
              ? containerRef.current.getBoundingClientRect().bottom + 8
              : "auto",
            transform: "translateX(-50%)",
          }}
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
          
          {/* Scrollable Flag Carousel */}
          <div
            ref={scrollRef}
            className={cn(
              "flex gap-2 overflow-x-auto scrollbar-hide",
              "cursor-grab active:cursor-grabbing",
              "py-2 px-1",
              "-mx-1"
            )}
            style={{ 
              scrollBehavior: isDragging ? 'auto' : 'smooth',
              WebkitOverflowScrolling: 'touch'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
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
