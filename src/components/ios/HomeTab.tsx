import { useState, useEffect, useMemo, useRef, useCallback, TouchEvent, MouseEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { GlobalParticipantsSection } from "../GlobalParticipantsSection";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getActivitiesWithDates, DAY_NAMES } from "@/data/activityTypes";
import { useNavigate, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import shakeLogo from "@/assets/shake-logo-new.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LandingCarousel } from "@/components/LandingCarousel";
import { useCity } from "@/contexts/CityContext";
import { useTranslation } from "react-i18next";

interface HomeTabProps {
  onSelectActivity?: (activity: { id: string; label: string; emoji: string }) => void;
  showActivities?: boolean;
  onCloseActivities?: () => void;
  isShaking?: boolean;
}

export function HomeTab({ onSelectActivity, showActivities = false, onCloseActivities, isShaking = false }: HomeTabProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Rotating text for "Meet new..." phrases
  const meetPhrases = useMemo(() => [
    t('home.meetPeople', 'Meet new people.'),
    t('home.meetFriends', 'Meet new friends.'),
    t('home.meetBuddy', 'Meet a new buddy.'),
    t('home.meetPartner', 'Meet a partner.'),
    t('home.meetLove', 'Meet a new love.')
  ], [t]);
  
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0); // Always start at 0 (first by date)
  const phraseIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const tappedActivityRef = useRef<{ id: string; label: string; emoji: string } | null>(null);

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

  // Get activities sorted by next occurrence date (chronological)
  const orderedActivities = useMemo(() => getActivitiesWithDates(), []);

  // Reset to first item when activities are shown
  useEffect(() => {
    if (showActivities) {
      setCurrentActivityIndex(0);
    }
  }, [showActivities]);

  const handleActivitySelect = () => {
    // On iOS Safari, `onClick` can fire after touch handlers and state updates.
    // So we lock the chosen activity on pointer/touch start and use it here.
    const activityToSelect = tappedActivityRef.current ?? orderedActivities[currentActivityIndex];

    if (activityToSelect) {
      onSelectActivity?.({
        id: activityToSelect.id,
        label: activityToSelect.label,
        emoji: activityToSelect.emoji,
      });
    }

    tappedActivityRef.current = null;
    onCloseActivities?.();
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

  // Handle backdrop click to close activities
  // IMPORTANT: must be declared before any conditional returns to keep hook order stable.
  const handleBackdropClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      // Only close if clicking the backdrop itself, not the carousel
      if (e.target === e.currentTarget) {
        onCloseActivities?.();
      }
    },
    [onCloseActivities]
  );

  // Landing page for logged out users
  if (!user) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center bg-background pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] overflow-hidden">
        {/* Background carousel */}
        <LandingCarousel />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center">
          {/* SHAKE Logo */}
          <img
            src={shakeLogo}
            alt="SHAKE"
            className="w-32 h-32 object-contain mb-4 animate-fade-in opacity-0"
            style={{ animationDelay: "0ms", animationFillMode: "forwards" }}
          />

          {/* SHAKE-SOCIAL text */}
          <div
            className="mb-6 text-center animate-fade-in opacity-0"
            style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
          >
            <h1 className="text-3xl font-display font-bold text-foreground tracking-wider">SHAKE</h1>
            <p className="text-lg font-display font-medium text-muted-foreground tracking-[0.3em] mt-1">
              SOCIAL
            </p>
          </div>

          {/* Tagline */}
          <p
            className="text-2xl text-foreground/80 mb-8 animate-fade-in opacity-0"
            style={{ 
              animationDelay: "250ms", 
              animationFillMode: "forwards",
              fontFamily: "'Sue Ellen Francisco', cursive"
            }}
          >
            {t('home.tagline', 'Connection happens offline.')}
          </p>

          {/* Let's Shake! button */}
          <button
            onClick={() => navigate("/auth")}
            className="px-8 py-3 rounded-full text-white font-medium transition-all hover:opacity-90 hover:scale-105 animate-fade-in opacity-0"
            style={{
              animationDelay: "300ms",
              animationFillMode: "forwards",
              background: "linear-gradient(to right, rgba(88, 28, 135, 0.9), rgba(67, 56, 202, 0.8))",
            }}
          >
            {t('home.letsShake', "Let's Shake!")}
          </button>

          {/* Terms and Privacy disclaimer */}
          <div
            className="text-sm text-muted-foreground mt-6 animate-fade-in opacity-0"
            style={{ animationDelay: "450ms", animationFillMode: "forwards" }}
          >
            <p>{t('auth.byContinuing', 'By continuing, you agree to our')}</p>
            <p>
              <Link to="/terms-of-service" className="underline hover:text-foreground">
                {t('common.terms', 'terms')}
              </Link>{" "}
              {t('common.and', 'and')}{" "}
              <Link to="/privacy-policy" className="underline hover:text-foreground">
                {t('common.privacyPolicy', 'privacy policy')}
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Full home tab for logged in users
  return (
    <>
      {/* Carousel Overlay - Fixed fullscreen, no scroll, perfectly centered */}
      {showActivities && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md"
          onClick={handleBackdropClick}
        >
          <div 
            className="flex flex-col items-center justify-center w-full px-6"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Date display - Above the circle */}
            <div className="mb-8 animate-fade-in text-center">
              <div className="text-5xl md:text-6xl font-handwritten text-foreground">
                {currentActivity?.dayNumber}, {currentActivity?.nextDate ? DAY_NAMES[currentActivity.nextDate.getDay()] : ''}
              </div>
            </div>

            {/* Activity circle with arrows on sides */}
            <div className="flex items-center justify-center w-full max-w-sm mx-auto">
              {/* Left Arrow */}
              <button
                onClick={goToPrevious}
                className="flex w-12 h-12 rounded-full bg-card border border-border items-center justify-center shadow-lg hover:bg-muted transition-colors shrink-0"
              >
                <ChevronLeft className="w-6 h-6 text-foreground" />
              </button>

              {/* Circle with float animation */}
              <div 
                className="w-40 h-40 mx-6 rounded-full bg-gradient-to-br from-primary/30 via-accent/20 to-secondary/30 border-2 border-primary/50 flex items-center justify-center shadow-2xl cursor-pointer transition-transform hover:scale-105 shrink-0 animate-float"
                onTouchStart={(e) => {
                  e.stopPropagation();
                  const a = orderedActivities[currentActivityIndex];
                  tappedActivityRef.current = a
                    ? { id: a.id, label: a.label, emoji: a.emoji }
                    : null;
                }}
                onPointerDown={() => {
                  const a = orderedActivities[currentActivityIndex];
                  tappedActivityRef.current = a
                    ? { id: a.id, label: a.label, emoji: a.emoji }
                    : null;
                }}
                onClick={handleActivitySelect}
              >
                <span className="text-6xl animate-scale-in">{currentActivity?.emoji}</span>
              </div>

              {/* Right Arrow */}
              <button
                onClick={goToNext}
                className="flex w-12 h-12 rounded-full bg-card border border-border items-center justify-center shadow-lg hover:bg-muted transition-colors shrink-0"
              >
                <ChevronRight className="w-6 h-6 text-foreground" />
              </button>
            </div>

            {/* Activity Label - Below the circle */}
            <div className="mt-8 animate-fade-in text-center">
              <div className="text-xl font-semibold text-foreground">{currentActivity?.label}</div>
            </div>


            {/* Dot Indicators */}
            <div className="flex justify-center gap-2 mt-6">
              {orderedActivities.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentActivityIndex(index)}
                  className={cn(
                    "h-2.5 rounded-full transition-all",
                    index === currentActivityIndex 
                      ? "bg-primary w-5" 
                      : "bg-muted-foreground/30 w-2.5"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main content - hidden when carousel is active */}
      <div className={cn(
        "flex flex-col h-full px-6 text-center pt-[calc(env(safe-area-inset-top,0px)+4rem)] overflow-y-auto pb-24 relative",
        showActivities && "overflow-hidden"
      )}>
        {/* Welcome Message */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border mb-6">
            <span className="w-2 h-2 rounded-full bg-shake-green animate-pulse" />
            <span className="text-sm text-muted-foreground">
              {t('home.realConnections', 'Real connections, real life.')}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-display font-bold leading-tight mb-4">
            <span className="transition-opacity duration-500 block">
              {meetPhrases[currentPhraseIndex]}
            </span>
            <span className="text-gradient block mt-2">{t('home.shakeUpYourLife', 'SHAKE up your life.')}</span>
          </h1>
        </div>

        {/* Center Area - Circle with Handshake */}
        <div className="relative mb-8 flex flex-col items-center justify-center">
          <div 
            className={cn(
              "w-32 h-32 rounded-full bg-gradient-to-br from-primary/30 via-accent/20 to-secondary/30 border-2 border-primary/50 flex items-center justify-center shadow-lg cursor-pointer transition-all hover:scale-105",
              isShaking && "animate-shake-center"
            )}
          >
            <span className="text-5xl">🤝</span>
          </div>
        </div>

        {/* Global participants */}
        <div className="mb-3">
          <GlobalParticipantsSection />
        </div>

        {/* Theme toggle */}
        <div className="flex justify-center mb-6">
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}
