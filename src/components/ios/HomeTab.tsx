import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { GlobalParticipantsSection } from "../GlobalParticipantsSection";

interface HomeTabProps {
  onShakeClick: () => void;
}

export function HomeTab({ onShakeClick }: HomeTabProps) {
  const { user } = useAuth();
  const { selectedCity } = useCity();

  // Rotating text for "Meet new..." phrases
  const meetPhrases = useMemo(() => [
    "Meet new people.",
    "Meet new friends.",
    "Meet a new buddy.",
    "Meet a partner.",
    "Meet a new love."
  ], []);
  
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const phraseIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    phraseIntervalRef.current = setInterval(() => {
      setCurrentPhraseIndex(prev => (prev + 1) % meetPhrases.length);
    }, 2500);
    return () => {
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
      }
    };
  }, [meetPhrases.length]);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      {/* Welcome Message */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border mb-6">
          <span className="w-2 h-2 rounded-full bg-shake-green animate-pulse" />
          <span className="text-sm text-muted-foreground">
            Real connections, real life.
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-display font-bold leading-tight mb-4">
          <span className="transition-opacity duration-500 block">
            {meetPhrases[currentPhraseIndex]}
          </span>
          <span className="text-gradient block mt-2">SHAKE up your life.</span>
        </h1>
      </div>

      {/* Tap to Shake CTA */}
      <button
        onClick={onShakeClick}
        className="relative mb-8 group"
      >
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/30 via-accent/20 to-shake-coral/30 border-2 border-primary/50 flex items-center justify-center group-hover:scale-105 transition-transform shadow-lg group-active:scale-95">
          <span className="text-5xl">🤝</span>
        </div>
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-card border border-border rounded-full">
          <span className="text-xs font-medium text-foreground">Tap to Shake</span>
        </div>
      </button>

      {/* Global participants */}
      <div className="mb-8">
        <GlobalParticipantsSection />
      </div>

      {/* Stats */}
      <div className="text-center">
        <div className="text-2xl font-display font-bold text-foreground">50+</div>
        <div className="text-sm text-muted-foreground">Cities</div>
      </div>

      {/* Note */}
      <p className="text-xs text-muted-foreground/70 mt-8">
        Previously, we operated on Luma, now here.
      </p>
    </div>
  );
}
