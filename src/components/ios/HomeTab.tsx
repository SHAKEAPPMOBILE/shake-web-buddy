import { useState, useEffect, useMemo, useRef, useCallback, TouchEvent, MouseEvent } from "react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { GlobalParticipantsSection } from "../GlobalParticipantsSection";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getActivitiesWithDates, getStartingIndexByProximity } from "@/data/activityTypes";
import { getTranslatedActivityLabel, getTranslatedDayName } from "@/lib/activity-translations";
import { useNavigate, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import shakeLogo from "@/assets/shake-logo-new.png";
import { LandingCarousel } from "@/components/LandingCarousel";
import { useCity } from "@/contexts/CityContext";
import { useTranslation } from "react-i18next";
import { CitySelector } from "@/components/CitySelector";
import { CityPickerModal } from "@/components/CityPickerModal";
import { LocationPinEmoji } from "@/components/LocationPinEmoji";
import { REGIONS, SHAKE_CITIES } from "@/data/cities";
import { useVenueContext } from "@/contexts/VenueContext";
interface HomeTabProps {
  onSelectActivity?: (activity: { id: string; label: string; emoji: string }) => void;
  onConfirmActivity?: (activity: { id: string; label: string; emoji: string }, cityOverride?: string) => void | Promise<void>;
  showActivities?: boolean;
  onCloseActivities?: () => void;
  onOpenActivities?: () => void;
  isShaking?: boolean;
  onOpenEvents?: () => void;
  onUpgradeClick?: () => void;
}

// Separate dialog state for "Propose a plan" flow

export function HomeTab({ onSelectActivity, onConfirmActivity, showActivities = false, onCloseActivities, onOpenActivities, isShaking = false, onOpenEvents, onUpgradeClick }: HomeTabProps) {
  const { t } = useTranslation();
  const { user, isPremium } = useAuth();
  const navigate = useNavigate();
  const { selectedCity, isLoading: isCityLoading, isCityOutOfRange } = useCity();
  const [isCitySelectorOpen, setIsCitySelectorOpen] = useState(false);
  const [showActivityDetails, setShowActivityDetails] = useState(false);
  const [selectedJoinCity, setSelectedJoinCity] = useState<string | null>(null);
  const [showCityChoices, setShowCityChoices] = useState(false);
  const { getVenueForActivity, isLoading: venuesLoading } = useVenueContext();
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

  useEffect(() => {
    ['/icons/activities/drinks-icon.jpg', '/icons/activities/dinner-icon.jpg', '/icons/activities/brunch-icon.jpg'].forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Extended type for carousel items including "propose plan"
  type CarouselItem = {
    id: string;
    label: string;
    emoji: string;
    icon?: string;
    dayNumber: number | null;
    nextDate: Date | null;
    isProposePlan?: boolean;
  };

  // FIXED ORDER - This order NEVER changes: Drinks → Dinner → Brunch → Propose a plan
  const CAROUSEL_ITEMS: CarouselItem[] = useMemo(() => {
    const activities = getActivitiesWithDates();

    // Map in strict fixed order
    const fixedOrder = ['drinks', 'dinner', 'brunch'];
    const orderedItems: CarouselItem[] = fixedOrder.map(id => {
      const activity = activities.find(a => a.id === id)!;
      return {
        id: activity.id,
        label: getTranslatedActivityLabel(t, activity.id),
        emoji: activity.emoji,
        icon: activity.icon,
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
      setShowActivityDetails(false);
      setSelectedJoinCity(null);
      setShowCityChoices(false);
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

    if (activityToSelect) {
      setShowActivityDetails(true);
    }

    tappedActivityRef.current = null;
  };

  const handleConfirmSelection = async () => {
    console.log('[Carousel] handleConfirmSelection fired', {
      currentActivityIndex,
      activityId: currentActivity?.id,
      isProposePlan: currentActivity?.isProposePlan,
      hasNoVenue,
      venuesLoading,
      joinCity,
      selectedJoinCity,
      hasOnConfirmActivity: !!onConfirmActivity,
      hasOnSelectActivity: !!onSelectActivity,
    });

    if (!currentActivity) {
      console.warn('[Carousel] handleConfirmSelection — currentActivity is null, aborting');
      return;
    }
    if (currentActivity.isProposePlan) {
      console.log('[Carousel] → isProposePlan item selected — navigating to /propose-plan');
      onCloseActivities?.();
      navigate("/propose-plan");
      return;
    }
    if (onConfirmActivity) {
      console.log('[Carousel] → JOIN path via onConfirmActivity', {
        activityId: currentActivity.id,
        city: selectedJoinCity || selectedCity,
      });
      await onConfirmActivity(
        {
          id: currentActivity.id,
          label: currentActivity.label,
          emoji: currentActivity.emoji,
        },
        selectedJoinCity || selectedCity || undefined,
      );
      return;
    }

    console.log('[Carousel] → JOIN path via onSelectActivity (fallback)', { activityId: currentActivity.id });
    onSelectActivity?.({
      id: currentActivity.id,
      label: currentActivity.label,
      emoji: currentActivity.emoji,
    });
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
  const currentDayName = currentActivity?.nextDate
    ? getTranslatedDayName(t, currentActivity.nextDate.getDay())
    : "";
  const currentTime = currentActivity?.id === "dinner"
    ? "7:00 PM"
    : currentActivity?.id === "drinks"
      ? "8:00 PM"
      : null;
  const joinCity = selectedJoinCity || selectedCity || "";
  const VENUE_ACTIVITY_IDS = ['dinner', 'drinks', 'brunch', 'lunch'];
  const currentActivityNeedsVenue = VENUE_ACTIVITY_IDS.includes(currentActivity?.id || '');
  const hasNoVenue =
    currentActivityNeedsVenue &&
    !venuesLoading &&
    !!joinCity &&
    !getVenueForActivity(joinCity, currentActivity?.id || '');
  const groupedCities = useMemo(
    () =>
      REGIONS.reduce((acc, region) => {
        acc[region] = SHAKE_CITIES.filter((city) => city.region === region && city.name !== joinCity);
        return acc;
      }, {} as Record<string, typeof SHAKE_CITIES>),
    [joinCity],
  );

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
      if (showActivityDetails) {
        setShowActivityDetails(false);
        setShowCityChoices(false);
        return;
      }

      // Only close if clicking the backdrop itself, not the carousel
      if (e.target === e.currentTarget) {
        onCloseActivities?.();
      }
    },
    [onCloseActivities, showActivityDetails]
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
            type="button"
            onClick={() => navigate("/auth")}
            className="px-8 py-3 rounded-full text-white font-medium transition-transform hover:scale-105 animate-gradient-shift"
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
          className="fixed inset-x-0 top-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-40 flex items-center justify-center bg-background/95 backdrop-blur-md"
          onClick={handleBackdropClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: 'pan-y' }}
        >
          <div
            className="flex flex-col items-center justify-center w-full px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full max-w-sm">
              <div className={cn("transition-opacity duration-200", showActivityDetails ? "opacity-0 pointer-events-none" : "opacity-100")}>
                {/* Date display - Above the circle (or "Propose a plan" text) */}
                <div className="mb-8 animate-fade-in text-center">
                  {currentActivity?.isProposePlan ? (
                    <div className="text-5xl md:text-6xl font-handwritten text-foreground">
                      {t('home.proposePlan', 'Propose a plan')}
                    </div>
                  ) : (
                    <div className="text-5xl md:text-6xl font-handwritten text-foreground">
                      {currentActivity?.dayNumber}{currentActivity?.nextDate ? ` ${format(currentActivity.nextDate, 'MMM')}` : ''}, {currentDayName}
                    </div>
                  )}
                </div>

                {/* Activity circle with arrows on sides */}
                <div className="flex items-center justify-center w-full max-w-sm mx-auto">
                  <button
                    onClick={goToPrevious}
                    className="flex w-12 h-12 rounded-full bg-card border border-border items-center justify-center shadow-lg hover:bg-muted transition-colors shrink-0"
                  >
                    <ChevronLeft className="w-6 h-6 text-foreground" />
                  </button>

                  <div
                    className="w-32 h-32 mx-6 rounded-full bg-card overflow-hidden flex items-center justify-center border-2 border-blue-400 shadow-2xl cursor-pointer transition-transform hover:scale-105 shrink-0 animate-float"
                    onPointerDown={() => {
                      tappedActivityRef.current = CAROUSEL_ITEMS[currentActivityIndex] ?? null;
                    }}
                    onClick={handleActivitySelect}
                  >
                    {currentActivity?.icon ? (
                      <div
                        className="w-full h-full rounded-full bg-cover bg-center bg-no-repeat"
                        style={{ backgroundImage: `url(${currentActivity.icon})` }}
                      />
                    ) : (
                      <span className="text-5xl flex items-center justify-center w-full h-full">
                        {currentActivity?.emoji}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={goToNext}
                    className="flex w-12 h-12 rounded-full bg-card border border-border items-center justify-center shadow-lg hover:bg-muted transition-colors shrink-0"
                  >
                    <ChevronRight className="w-6 h-6 text-foreground" />
                  </button>
                </div>

                <div className="mt-8 animate-fade-in text-center">
                  <div className="text-xl font-semibold text-foreground">
                    {currentActivity?.isProposePlan 
                      ? t('home.anytimeAnywhere', 'Anytime, Anywhere.')
                      : currentActivity?.label}
                  </div>
                </div>

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

              <div
                className={cn(
                  "absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-200",
                  showActivityDetails ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={() => {
                  setShowActivityDetails(false);
                  setShowCityChoices(false);
                }}
              >
                <div className="w-full p-5 text-center space-y-3 bg-transparent border-0 shadow-none">
                  <div className="w-24 h-24 mx-auto rounded-full bg-white shadow-lg flex items-center justify-center overflow-hidden">
                    {currentActivity?.icon ? (
                      <img src={currentActivity.icon} alt={currentActivity.label} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span className="text-5xl">{currentActivity?.emoji}</span>
                    )}
                  </div>

                  <p className="text-2xl font-display font-bold text-foreground">{currentActivity?.label}</p>
                  {!!currentDayName && <p className="text-xl font-semibold text-primary">{currentDayName}</p>}
                  {!!currentTime && <p className="text-lg font-semibold text-primary">{currentTime}</p>}
                  <p className="text-base text-muted-foreground">
                    {t('activityDialog.inCity', 'in {{city}}', { city: joinCity })}
                  </p>

                  <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    {/* BUG FIX: hasNoVenue must NEVER replace "Yes!" with "Propose a Plan".
                        Joining an activity does not require a venue — the venue is just
                        displayed as extra info. Routing to /propose-plan here was causing
                        the carousel join to intermittently navigate to the create-plan flow
                        whenever the venue data hadn't loaded or the city had no venue entry. */}
                    {hasNoVenue && (
                      // Log when hasNoVenue is true so we can track it in the console
                      // (expression evaluates to null, renders nothing)
                      (() => { console.log('[Carousel] hasNoVenue=true for', currentActivity?.id, 'in', joinCity, '— still allowing join (venue not required to join)'); return null; })()
                    )}
                    <>
                        <button
                          type="button"
                          onClick={handleConfirmSelection}
                          className="w-full rounded-full px-4 py-2.5 text-white font-semibold bg-[hsl(210,100%,50%)] hover:bg-[hsl(210,100%,45%)] transition-colors"
                        >
                          {t('home.yesBtn', 'Yes!')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowActivityDetails(false);
                            setShowCityChoices(false);
                          }}
                          className="w-full rounded-full px-4 py-2.5 font-medium border border-border bg-background hover:bg-muted/60 transition-colors"
                        >
                          {t('home.humBtn', 'Hum!')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isPremium) {
                              onUpgradeClick?.();
                              return;
                            }
                            setShowCityChoices((prev) => !prev);
                          }}
                          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                        >
                          {t('activityDialog.joinDifferentCity', 'Join in a different city')}
                        </button>
                      </>
                  </div>

                  {showCityChoices && (
                    <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-background p-2 text-left">
                      {Object.entries(groupedCities).map(([region, cities]) => (
                        cities.length > 0 && (
                          <div key={region} className="mb-2 last:mb-0">
                            <p className="px-1 pb-1 text-[10px] font-semibold uppercase text-muted-foreground">{region}</p>
                            <div className="space-y-1">
                              {cities.map((city) => (
                                <button
                                  key={city.name}
                                  type="button"
                                  onClick={() => {
                                    setSelectedJoinCity(city.name);
                                    setShowCityChoices(false);
                                  }}
                                  className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted transition-colors"
                                >
                                  {city.name}, {city.country}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content - hidden when carousel is active */}
      <div className={cn(
        "flex flex-col h-full px-6 text-center pt-[calc(env(safe-area-inset-top,0px)+4rem)] overflow-hidden pb-24 relative",
        showActivities && "overflow-hidden"
      )}>
        {/* Welcome Message */}
        <div className="mb-8">
          {/* City pill under the shakers row */}
          {isCityLoading ? (
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 animate-pulse">
                <LocationPinEmoji className="text-xl" />
                <div className="h-4 w-[140px] rounded-xl bg-muted/60" />
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-6">
              <button
                type="button"
                onClick={() => setIsCitySelectorOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border text-sm text-foreground hover:border-primary/40 transition-colors"
              >
                <LocationPinEmoji className="text-xl" />
                <span className="truncate">
                  {selectedCity && selectedCity.trim() !== "" && selectedCity !== "Loading..."
                    ? selectedCity
                    : isCityOutOfRange
                      ? t('home.comingToYourCity', 'Coming to your city soon')
                      : t('home.selectYourCity', 'Select your city')}
                </span>
              </button>
            </div>
          )}
          <h1 className="text-4xl md:text-5xl font-display font-bold leading-tight mb-4">
            <span className="transition-opacity duration-500 block">
              {showTapInstruction ? (
                <span className="flex items-center justify-center gap-2 flex-wrap text-5xl md:text-6xl font-handwritten text-foreground">
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
            onClick={onOpenActivities}
            className={cn(
              "w-32 h-32 rounded-full bg-card border-2 border-blue-400 flex items-center justify-center shadow-lg cursor-pointer transition-all hover:scale-105",
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

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onOpenEvents}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border text-sm text-foreground hover:border-primary/40 transition-colors"
          >
            <span>⚡️</span>
            {t('home.eventsNearYou', 'Events near you')}
          </button>
        </div>

      </div>
      <CityPickerModal open={isCitySelectorOpen} onOpenChange={setIsCitySelectorOpen} title="Choose your city">
        <CitySelector
          variant="picker"
          autoFocusSearch={isCitySelectorOpen}
          onPickerClose={() => setIsCitySelectorOpen(false)}
        />
      </CityPickerModal>
    </>
  );
}
