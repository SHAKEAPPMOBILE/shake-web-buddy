import { useState, useEffect, useMemo, useRef, useCallback, TouchEvent, MouseEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { GlobalParticipantsSection } from "../GlobalParticipantsSection";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getActivitiesWithDates, getStartingIndexByProximity, DAY_NAMES } from "@/data/activityTypes";
import { useNavigate, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import shakeLogo from "@/assets/shake-logo-new.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LandingCarousel } from "@/components/LandingCarousel";
import { useCity } from "@/contexts/CityContext";
import { useTranslation } from "react-i18next";
import { CreateActivityDialog } from "@/components/CreateActivityDialog";
interface HomeTabProps {
  onSelectActivity?: (activity: { id: string; label: string; emoji: string }) => void;
  showActivities?: boolean;
  onCloseActivities?: () => void;
  isShaking?: boolean;
}

// Separate dialog state for "Propose a plan" flow

export function HomeTab({ onSelectActivity, showActivities = false, onCloseActivities, isShaking = false }: HomeTabProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { selectedCity } = useCity();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  // Rotating text for "Meet new..." phrases
  const meetPhrases = useMemo(() => [
    t('home.meetPeople', 'Meet new people.'),
    t('home.meetFriends', 'Meet new friends.'),
    t('home.meetBuddy', 'Meet a new buddy.'),
    t('home.meetPartner', 'Meet a partner.'),
    t('home.meetLove', 'Meet a new love.')
  ], [t]);
  
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [showTapInstruction, setShowTapInstruction] = useState(false);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(() => getStartingIndexByProximity());
  const phraseIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const tappedActivityRef = useRef<CarouselItem | null>(null);

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

  // Extended type for carousel items including "propose plan"
  type CarouselItem = {
    id: string;
    label: string;
    emoji: string;
    dayNumber: number | null;
    nextDate: Date | null;
    isProposePlan?: boolean;
  };

  // FIXED ORDER - This order NEVER changes: Lunch → Drinks → Dinner → Hike → Brunch → Propose a plan
  const CAROUSEL_ITEMS: CarouselItem[] = useMemo(() => {
    const activities = getActivitiesWithDates();
    
    // Map in strict fixed order
    const fixedOrder = ['lunch', 'drinks', 'dinner', 'hike', 'brunch'];
    const orderedItems: CarouselItem[] = fixedOrder.map(id => {
      const activity = activities.find(a => a.id === id)!;
      return {
        id: activity.id,
        label: activity.label,
        emoji: activity.emoji,
        dayNumber: activity.dayNumber,
        nextDate: activity.nextDate,
        isProposePlan: false,
      };
    });
    
    // Always add "Propose a plan" as the LAST item
    orderedItems.push({
      id: 'propose-plan',
      label: t('home.proposePlan', 'Propose a plan'),
      emoji: '😎',
      dayNumber: null,
      nextDate: null,
      isProposePlan: true,
    });
    
    return orderedItems;
  }, [t]);

  // Reset to closest-by-proximity when activities are shown
  useEffect(() => {
    if (showActivities) {
      setCurrentActivityIndex(getStartingIndexByProximity());
    }
  }, [showActivities]);

  const handleHandshakeClick = () => {
    setShowTapInstruction(true);
    setTimeout(() => {
      setShowTapInstruction(false);
    }, 4000);
  };

  const handleActivitySelect = () => {
    // On iOS Safari, `onClick` can fire after touch handlers and state updates.
    // So we lock the chosen activity on pointer/touch start and use it here.
    const activityToSelect = tappedActivityRef.current ?? CAROUSEL_ITEMS[currentActivityIndex];

    if (activityToSelect?.isProposePlan) {
      // Open the create activity dialog for "Propose a plan"
      onCloseActivities?.();
      tappedActivityRef.current = null;
      setShowCreateDialog(true);
      return;
    }

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
      prev === 0 ? CAROUSEL_ITEMS.length - 1 : prev - 1
    );
  }, [CAROUSEL_ITEMS.length]);

  const goToNext = useCallback(() => {
    setCurrentActivityIndex(prev => 
      prev === CAROUSEL_ITEMS.length - 1 ? 0 : prev + 1
    );
  }, [CAROUSEL_ITEMS.length]);

  const currentActivity = CAROUSEL_ITEMS[currentActivityIndex];

  // Swipe handlers — track whether a real move occurred to prevent tap-induced skips
  const didSwipe = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX; // Reset so taps don't use stale value
    didSwipe.current = false;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
    didSwipe.current = true;
  }, []);

  const handleTouchEnd = useCallback(() => {
    // Only process if user actually swiped (moved finger), not just tapped
    if (!didSwipe.current) return;

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
          {/* SHAKE Logo - clickable to show instruction */}
          <img
            src={shakeLogo}
            alt="SHAKE"
            onClick={handleHandshakeClick}
            className="w-32 h-32 object-contain mb-4 animate-fade-in opacity-0 cursor-pointer hover:scale-105 transition-transform"
            style={{ animationDelay: "0ms", animationFillMode: "forwards" }}
          />

          {/* SHAKE-SOCIAL text - shows instruction when tapped */}
          <div
            className="mb-6 text-center animate-fade-in opacity-0"
            style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
          >
            <h1 className="text-3xl font-display font-bold text-foreground tracking-wider">
              {showTapInstruction 
                ? t('home.tapInstruction', 'Tap on the blue + below to start shaking.') 
                : 'SHAKE'}
            </h1>
            {!showTapInstruction && (
              <p className="text-lg font-display font-medium text-muted-foreground tracking-[0.3em] mt-1">
                SOCIAL
              </p>
            )}
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
            {/* Date display - Above the circle (or "Propose a plan" text) */}
            <div className="mb-8 animate-fade-in text-center">
              {currentActivity?.isProposePlan ? (
                <div className="text-5xl md:text-6xl font-handwritten text-foreground">
                  {t('home.proposePlan', 'Propose a plan')}
                </div>
              ) : (
                <div className="text-5xl md:text-6xl font-handwritten text-foreground">
                  {currentActivity?.dayNumber}, {currentActivity?.nextDate ? DAY_NAMES[currentActivity.nextDate.getDay()] : ''}
                </div>
              )}
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
                  tappedActivityRef.current = CAROUSEL_ITEMS[currentActivityIndex] ?? null;
                }}
                onPointerDown={() => {
                  tappedActivityRef.current = CAROUSEL_ITEMS[currentActivityIndex] ?? null;
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
              <div className="text-xl font-semibold text-foreground">
                {currentActivity?.isProposePlan 
                  ? t('home.anytimeAnywhere', 'Anytime, Anywhere.')
                  : currentActivity?.label}
              </div>
            </div>


            {/* Dot Indicators */}
            <div className="flex justify-center gap-2 mt-6">
              {CAROUSEL_ITEMS.map((_, index) => (
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
              {showTapInstruction ? (
                <span className="flex items-center justify-center gap-2 flex-wrap">
                  {t('home.tapOnThe', 'Tap on')} 
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-foreground text-background text-lg font-bold">+</span> 
                  {t('home.toStartShaking', 'to start shaking!')}
                </span>
              ) : meetPhrases[currentPhraseIndex]}
            </span>
            {!showTapInstruction && (
              <span className="text-gradient block mt-2">{t('home.shakeUpYourLife', 'SHAKE up your life.')}</span>
            )}
          </h1>
        </div>

        {/* Center Area - Circle with Handshake */}
        <div className="relative mb-8 flex flex-col items-center justify-center">
          <div 
            onClick={handleHandshakeClick}
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

      {/* Create Activity Dialog for "Propose a plan" */}
      <CreateActivityDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        city={selectedCity}
      />
    </>
  );
}
