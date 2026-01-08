import { useState, useEffect, useMemo, useRef, useCallback, TouchEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { GlobalParticipantsSection } from "../GlobalParticipantsSection";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DAY_NAMES, getTodayDefaultIndex, getOrderedActivities } from "@/data/activityTypes";
import { useNavigate } from "react-router-dom";

interface HomeTabProps {
  onSelectActivity?: (activityType: string) => void;
  showActivities?: boolean;
  onCloseActivities?: () => void;
}

export function HomeTab({ onSelectActivity, showActivities = false, onCloseActivities }: HomeTabProps) {
  const { user } = useAuth();
  const { selectedCity } = useCity();
  const navigate = useNavigate();

  // Rotating text for "Meet new..." phrases
  const meetPhrases = useMemo(() => [
    "Meet new people.",
    "Meet new friends.",
    "Meet a new buddy.",
    "Meet a partner.",
    "Meet a new love."
  ], []);
  
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(getTodayDefaultIndex());
  const phraseIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

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

  // Get ordered activities starting from today
  const orderedActivities = useMemo(() => getOrderedActivities(), []);

  // Reset to first item when activities are shown
  useEffect(() => {
    if (showActivities) {
      setCurrentActivityIndex(0);
    }
  }, [showActivities]);

  const handleActivitySelect = (activityId: string) => {
    onCloseActivities?.();
    onSelectActivity?.(activityId);
  };

  const goToPrevious = useCallback(() => {
    setCurrentActivityIndex(prev => 
      prev === 0 ? orderedActivities.length - 1 : prev - 1
    );
  }, [orderedActivities.length]);

  const goToNext = useCallback(() => {
    setCurrentActivityIndex(prev => 
      prev === orderedActivities.length - 1 ? 0 : prev + 1
    );
  }, [orderedActivities.length]);

  const currentActivity = orderedActivities[currentActivityIndex];
  const dayName = currentActivity?.defaultDay !== undefined 
    ? DAY_NAMES[currentActivity.defaultDay] 
    : '';

  // Swipe handlers
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50; // minimum swipe distance
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        goToNext(); // Swiped left
      } else {
        goToPrevious(); // Swiped right
      }
    }
  }, [goToNext, goToPrevious]);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center pt-16">
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

      {/* Center Area - Circle with Handshake or Activity Carousel */}
      <div 
        className="relative mb-8"
        onTouchStart={showActivities ? handleTouchStart : undefined}
        onTouchMove={showActivities ? handleTouchMove : undefined}
        onTouchEnd={showActivities ? handleTouchEnd : undefined}
      >
        <div 
          className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/30 via-accent/20 to-shake-coral/30 border-2 border-primary/50 flex items-center justify-center shadow-lg cursor-pointer transition-all hover:scale-105"
          onClick={() => showActivities && handleActivitySelect(currentActivity.id)}
        >
          {!showActivities ? (
            <span className="text-5xl">🤝</span>
          ) : (
            <span className="text-5xl animate-scale-in">{currentActivity?.emoji}</span>
          )}
        </div>

        {/* Activity Label & Day */}
        {showActivities && (
          <div className="mt-4 animate-fade-in">
            <div className="text-lg font-semibold text-foreground">{currentActivity?.label}</div>
            <div className="text-sm text-muted-foreground">{dayName}</div>
          </div>
        )}

        {/* Navigation Arrows - Hidden on mobile, visible on larger screens */}
        {showActivities && (
          <>
            <button
              onClick={goToPrevious}
              className="hidden md:flex absolute left-[-60px] top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card border border-border items-center justify-center shadow-md hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <button
              onClick={goToNext}
              className="hidden md:flex absolute right-[-60px] top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card border border-border items-center justify-center shadow-md hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          </>
        )}

        {/* Dot Indicators */}
        {showActivities && (
          <div className="flex justify-center gap-2 mt-4">
            {orderedActivities.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentActivityIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentActivityIndex 
                    ? 'bg-primary w-4' 
                    : 'bg-muted-foreground/30'
                }`}
              />
            ))}
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

      {/* Get Started button for logged out users */}
      {!user && (
        <button
          onClick={() => navigate("/auth")}
          className="mt-6 px-8 py-3 rounded-full text-white font-medium transition-all hover:opacity-90"
          style={{
            background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
          }}
        >
          Get Started
        </button>
      )}
    </div>
  );
}
