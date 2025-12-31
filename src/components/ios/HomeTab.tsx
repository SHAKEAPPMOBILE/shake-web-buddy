import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { GlobalParticipantsSection } from "../GlobalParticipantsSection";
import { X } from "lucide-react";
import { ACTIVITY_TYPES } from "@/data/activityTypes";

interface HomeTabProps {
  onSelectActivity?: (activityType: string) => void;
  showActivities?: boolean;
  onCloseActivities?: () => void;
}

export function HomeTab({ onSelectActivity, showActivities = false, onCloseActivities }: HomeTabProps) {
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

  const handleActivitySelect = (activityId: string) => {
    onCloseActivities?.();
    onSelectActivity?.(activityId);
  };

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

      {/* Center Area - Handshake Icon or Activity Selection */}
      <div className="relative mb-8">
        {!showActivities ? (
          /* Static Handshake Icon (not clickable) */
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/30 via-accent/20 to-shake-coral/30 border-2 border-primary/50 flex items-center justify-center shadow-lg">
            <span className="text-5xl">🤝</span>
          </div>
        ) : (
          <div className="animate-fade-in">
            {/* Close Button */}
            <button
              onClick={() => onCloseActivities?.()}
              className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-muted flex items-center justify-center z-10"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
            
            {/* Activity Grid */}
            <div className="grid grid-cols-4 gap-3 p-4 bg-card/50 backdrop-blur-sm rounded-2xl border border-border">
              {ACTIVITY_TYPES.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => handleActivitySelect(activity.id)}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-muted/50 transition-colors active:scale-95"
                >
                  <span className="text-2xl">{activity.emoji}</span>
                  <span className="text-xs text-muted-foreground">{activity.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Global participants */}
      <div className="mb-8">
        <GlobalParticipantsSection />
      </div>

      {/* Stats */}
      <div className="text-center">
        <div className="text-2xl font-display font-bold text-foreground">50+</div>
        <div className="text-sm text-muted-foreground">Cities</div>
      </div>
    </div>
  );
}
