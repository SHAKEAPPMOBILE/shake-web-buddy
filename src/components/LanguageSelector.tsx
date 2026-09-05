import { useState, useRef, useEffect, useCallback } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage, supportedLanguages, Language } from "@/contexts/LanguageContext";
import { useTranslation } from "react-i18next";

const ITEM_HEIGHT = 44; // px per item in the drum picker
const VISIBLE_ITEMS = 5; // total rows visible (center row = selected)
const PADDING_ITEMS = Math.floor(VISIBLE_ITEMS / 2); // 2 rows above and below center

interface LanguageSelectorProps {
  className?: string;
  showLabel?: boolean;
  /** Renders the drum picker directly, always open, with no toggle button or
   * fixed-position dropdown — for use as its own full-page step. */
  inline?: boolean;
  /** Called when the user taps Done. Only meaningful with `inline`. */
  onDone?: () => void;
}

export function LanguageSelector({ className, showLabel = true, inline = false, onDone }: LanguageSelectorProps) {
  const { t } = useTranslation();
  const { selectedLanguage, setSelectedLanguage, isDetecting } = useLanguage();
  const [isOpen, setIsOpen] = useState(inline);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);

  const translatedLanguagesList = supportedLanguages.filter(l =>
    ['en', 'es', 'pt', 'fr', 'de', 'it', 'nl', 'ja', 'zh', 'uk', 'pl'].includes(l.code)
  );

  // Scroll the drum to a given index
  const scrollToIndex = useCallback((index: number, smooth = true) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: index * ITEM_HEIGHT,
      behavior: smooth ? 'smooth' : 'instant' as ScrollBehavior,
    });
  }, []);

  // Scroll to selected language when dropdown opens
  useEffect(() => {
    if (!isOpen) return;
    // Use a tiny delay so the DOM is ready
    const raf = requestAnimationFrame(() => {
      const idx = translatedLanguagesList.findIndex(l => l.code === selectedLanguage.code);
      if (idx >= 0) scrollToIndex(idx, false);
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen]); // intentionally only on isOpen change

  // Read whichever item is centered and update selectedLanguage
  const pickCenteredItem = useCallback(() => {
    if (!scrollRef.current) return;
    const index = Math.round(scrollRef.current.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(index, translatedLanguagesList.length - 1));
    const lang = translatedLanguagesList[clamped];
    if (lang) setSelectedLanguage(lang);
  }, [translatedLanguagesList, setSelectedLanguage]);

  // Debounced scroll handler — settles 150 ms after the last scroll event
  const handleScroll = useCallback(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(pickCenteredItem, 150);
  }, [pickCenteredItem]);

  // Also use the native scrollend event where available
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isOpen) return;
    el.addEventListener('scrollend', pickCenteredItem);
    return () => el.removeEventListener('scrollend', pickCenteredItem);
  }, [isOpen, pickCenteredItem]);

  // Click outside to close — not applicable to the always-open inline mode
  useEffect(() => {
    if (inline) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Position dropdown above or below the toggle button
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const update = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownH = ITEM_HEIGHT * VISIBLE_ITEMS + 100;
      if (window.innerHeight - rect.bottom < dropdownH) {
        setDropdownStyle({ bottom: `${window.innerHeight - rect.top + 8}px`, top: 'auto', transform: 'translateX(-50%)' });
      } else {
        setDropdownStyle({ top: `${rect.bottom + 8}px`, bottom: 'auto', transform: 'translateX(-50%)' });
      }
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen]);

  if (isDetecting) {
    return (
      <div className={cn("flex items-center justify-center gap-2 text-muted-foreground", className)}>
        <Globe className="h-4 w-4 animate-pulse" />
        <span className="text-sm">{t('languageSelector.detecting')}</span>
      </div>
    );
  }

  const pickerBody = (
    <div className={cn("bg-card border border-border rounded-2xl shadow-xl p-3 w-[272px]", !inline && "animate-scale-in")}>
            <p className="text-xs text-muted-foreground text-center mb-2 select-none">
              {t('languageSelector.swipeToSelect', 'Scroll to choose language')}
            </p>

            {/* Drum picker */}
            <div className="relative" style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}>
              {/* Center highlight band */}
              <div
                className="absolute left-2 right-2 pointer-events-none z-10 rounded-xl border border-primary/25 bg-primary/8"
                style={{ top: ITEM_HEIGHT * PADDING_ITEMS, height: ITEM_HEIGHT }}
              />

              {/* Top gradient fade */}
              <div
                className="absolute top-0 left-0 right-0 z-10 pointer-events-none rounded-t-xl"
                style={{
                  height: ITEM_HEIGHT * PADDING_ITEMS,
                  background: 'linear-gradient(to bottom, hsl(var(--card)) 0%, transparent 100%)',
                }}
              />
              {/* Bottom gradient fade */}
              <div
                className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none rounded-b-xl"
                style={{
                  height: ITEM_HEIGHT * PADDING_ITEMS,
                  background: 'linear-gradient(to top, hsl(var(--card)) 0%, transparent 100%)',
                }}
              />

              {/* Scrollable column */}
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="absolute inset-0 overflow-y-scroll scrollbar-hide"
                style={{
                  scrollSnapType: 'y mandatory',
                  overscrollBehavior: 'contain',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {/* Top spacer so first item can reach center */}
                <div style={{ height: ITEM_HEIGHT * PADDING_ITEMS, flexShrink: 0 }} />

                {translatedLanguagesList.map((language, index) => (
                  <div
                    key={language.code}
                    onClick={() => {
                      setSelectedLanguage(language);
                      scrollToIndex(index);
                    }}
                    className={cn(
                      "flex items-center justify-center gap-3 cursor-pointer select-none transition-all duration-200",
                      selectedLanguage.code === language.code
                        ? "opacity-100 scale-100"
                        : "opacity-35 scale-95"
                    )}
                    style={{
                      height: ITEM_HEIGHT,
                      scrollSnapAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span className="text-xl leading-none">{language.flag}</span>
                    <span className="text-sm font-bold w-8 text-foreground">{language.code.toUpperCase()}</span>
                    <span className="text-sm text-muted-foreground flex-1">{language.nativeName}</span>
                  </div>
                ))}

                {/* Bottom spacer so last item can reach center */}
                <div style={{ height: ITEM_HEIGHT * PADDING_ITEMS, flexShrink: 0 }} />
              </div>
            </div>

      {/* Done button */}
      <button
        onClick={() => { setIsOpen(false); onDone?.(); }}
        className="mt-3 w-full py-2 rounded-full bg-black text-white text-sm font-semibold transition-opacity hover:opacity-90 active:opacity-75"
      >
        {t('languageSelector.done', 'Done')}
      </button>
    </div>
  );

  if (inline) {
    return <div ref={containerRef} className={className}>{pickerBody}</div>;
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-full",
          "bg-gray-100 border border-gray-100 transition-all duration-200",
          isOpen && "ring-2 ring-primary/30"
        )}
      >
        <span className="text-xl">{selectedLanguage.flag}</span>
        {showLabel && (
          <span className="text-sm font-medium text-gray-700">{selectedLanguage.nativeName}</span>
        )}
        <Globe className="h-4 w-4 text-gray-700" />
      </button>

      {/* Drum picker dropdown */}
      {isOpen && (
        <div className="fixed left-1/2 z-50" style={dropdownStyle}>
          {pickerBody}
        </div>
      )}
    </div>
  );
}
