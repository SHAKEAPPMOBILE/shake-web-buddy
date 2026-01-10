import { useState, useEffect, useMemo, useRef, useCallback, TouchEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { GlobalParticipantsSection } from "../GlobalParticipantsSection";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DAY_NAMES, getTodayDefaultIndex, getOrderedActivities, getActivityEmoji, getActivityLabel } from "@/data/activityTypes";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { WorldMap } from "../WorldMap";
import { useAllActivities } from "@/hooks/useAllActivities";
import { useUserActivities, UserActivity } from "@/hooks/useUserActivities";
import { PlanGroupChatDialog } from "../PlanGroupChatDialog";
import { PremiumDialog } from "../PremiumDialog";
import { toast } from "sonner";

interface HomeTabProps {
  onSelectActivity?: (activityType: string) => void;
  showActivities?: boolean;
  onCloseActivities?: () => void;
  isShaking?: boolean;
}

export function HomeTab({ onSelectActivity, showActivities = false, onCloseActivities, isShaking = false }: HomeTabProps) {
  const { user, isPremium } = useAuth();
  const { selectedCity } = useCity();
  const navigate = useNavigate();
  
  // Fetch all activities for the map
  const { activities: allActivities } = useAllActivities();
  const { joinActivity, hasJoinedActivity } = useUserActivities(selectedCity);
  
  // State for map interactions
  const [selectedActivity, setSelectedActivity] = useState<UserActivity | null>(null);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);

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

  // Map activity click handler
  const handleMapActivityClick = async (activity: UserActivity) => {
    if (!user) {
      setSelectedActivity(activity);
      return;
    }

    const isCreator = activity.user_id === user.id;
    const hasJoined = await hasJoinedActivity(activity.id);

    if (isCreator || hasJoined) {
      setSelectedActivity(activity);
      setShowChatDialog(true);
    } else {
      setSelectedActivity(activity);
    }
  };

  // Join activity from map
  const handleJoinFromMap = async (activity: UserActivity) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const result = await joinActivity(activity.id, isPremium);
    if (result.requiresPremium) {
      setShowPremiumDialog(true);
      return;
    }
    if (result.success) {
      toast.success(`Joined ${getActivityLabel(activity.activity_type)}!`);
      setSelectedActivity(activity);
      setShowChatDialog(true);
    }
  };

  return (
    <div className="flex flex-col h-full px-6 text-center pt-16 overflow-y-auto pb-24">
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
        className="relative mb-8 flex items-center justify-center"
        onTouchStart={showActivities ? handleTouchStart : undefined}
        onTouchMove={showActivities ? handleTouchMove : undefined}
        onTouchEnd={showActivities ? handleTouchEnd : undefined}
      >
        <div 
          className={cn(
            "w-32 h-32 rounded-full bg-gradient-to-br from-primary/30 via-accent/20 to-shake-coral/30 border-2 border-primary/50 flex items-center justify-center shadow-lg cursor-pointer transition-all hover:scale-105",
            isShaking && "animate-shake-center"
          )}
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
          <div className="mt-4 animate-fade-in absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
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
          <div className="flex justify-center gap-2 mt-4 absolute -bottom-20 left-1/2 -translate-x-1/2">
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

      {/* Extra spacing when activities are shown */}
      {showActivities && <div className="h-16" />}

      {/* Global participants */}
      <div className="mb-6">
        <GlobalParticipantsSection />
      </div>

      {/* World Map with Activities */}
      {allActivities.length > 0 && (
        <div className="mb-8 w-full">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-display font-semibold text-foreground">
              Plans around the world
            </h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              {allActivities.length} {allActivities.length === 1 ? "plan" : "plans"}
            </span>
          </div>
          <div className="h-[250px] w-full rounded-xl overflow-hidden border border-border shadow-lg">
            <WorldMap
              activities={allActivities}
              onActivityClick={handleMapActivityClick}
              selectedActivityId={selectedActivity?.id}
              initialCity={selectedCity}
            />
          </div>
          
          {/* Selected Activity Preview */}
          {selectedActivity && !showChatDialog && (
            <div 
              className="mt-3 p-4 rounded-xl text-left animate-fade-in"
              style={{
                background: "linear-gradient(to right, rgba(88, 28, 135, 0.6), rgba(67, 56, 202, 0.5))",
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0 bg-white shadow-md">
                  {getActivityEmoji(selectedActivity.activity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">
                    {getActivityLabel(selectedActivity.activity_type)}
                  </p>
                  <p className="text-sm text-white/70">
                    by {selectedActivity.creator_name || "Anonymous"} • {selectedActivity.city}
                  </p>
                  {selectedActivity.note && (
                    <p className="text-xs text-white/60 italic mt-1 line-clamp-1">
                      "{selectedActivity.note}"
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleJoinFromMap(selectedActivity)}
                  className="px-4 py-2 rounded-full text-sm font-medium text-white hover:opacity-90 transition-all shrink-0"
                  style={{
                    background: "linear-gradient(to right, rgba(34, 197, 94, 0.8), rgba(16, 185, 129, 0.7))",
                  }}
                >
                  {selectedActivity.user_id === user?.id ? "Open Chat" : "Join"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="text-center mb-8">
        <div className="text-2xl font-display font-bold text-foreground">50+</div>
        <div className="text-sm text-muted-foreground">Cities</div>
      </div>

      {/* Get Started button for logged out users */}
      {!user && (
        <button
          onClick={() => navigate("/auth")}
          className="px-8 py-3 rounded-full text-white font-medium transition-all hover:opacity-90"
          style={{
            background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
          }}
        >
          Get Started
        </button>
      )}

      {/* Plan Chat Dialog */}
      {selectedActivity && (
        <PlanGroupChatDialog
          open={showChatDialog}
          onOpenChange={(open) => {
            setShowChatDialog(open);
            if (!open) setSelectedActivity(null);
          }}
          activity={{
            ...selectedActivity,
            created_at: selectedActivity.scheduled_for,
            updated_at: selectedActivity.scheduled_for,
          }}
          onBack={() => {
            setShowChatDialog(false);
            setSelectedActivity(null);
          }}
        />
      )}

      {/* Premium Dialog */}
      <PremiumDialog 
        open={showPremiumDialog} 
        onOpenChange={setShowPremiumDialog} 
      />
    </div>
  );
}
