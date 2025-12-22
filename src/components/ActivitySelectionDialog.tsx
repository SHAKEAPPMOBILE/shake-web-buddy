import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselApi,
} from "@/components/ui/carousel";
import { Star, Check, Clock } from "lucide-react";
import { ACTIVITY_TYPES, getTimeBasedDefaultActivity } from "@/data/activityTypes";
import { useUserActivities } from "@/hooks/useUserActivities";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { playDingDingSound } from "@/lib/notification-sound";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";

interface ActivitySelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectActivity: (activity: string) => void;
  onPlanCreated?: (activityId: string) => void;
  city: string;
}

export function ActivitySelectionDialog({ open, onOpenChange, onSelectActivity, onPlanCreated, city }: ActivitySelectionDialogProps) {
  const { getActivityJoinCount } = useActivityJoins(city);
  const { user } = useAuth();
  const { createActivity } = useUserActivities(city);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [api, setApi] = useState<CarouselApi>();
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const isMobile = useIsMobile();
  
  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile && !isCreatingPlan,
  });
  
  // Get favorite activity from localStorage
  const favoriteActivity = useMemo(() => {
    return localStorage.getItem('favoriteActivity');
  }, [open]); // Re-check when dialog opens

  // Haptic feedback helper
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'medium') => {
    if ('vibrate' in navigator) {
      const duration = type === 'light' ? 10 : type === 'medium' ? 20 : 30;
      navigator.vibrate(duration);
    }
  }, []);

  const onSelect = useCallback(() => {
    if (!api) return;
    setCurrentIndex(api.selectedScrollSnap());
    triggerHaptic('light');
  }, [api, triggerHaptic]);

  // Handle activity selection - creates a plan
  const handleSelectActivity = useCallback(async (activityId: string) => {
    if (!user) {
      onSelectActivity(activityId);
      return;
    }

    triggerHaptic('heavy');
    setSelectingId(activityId);
    setIsCreatingPlan(true);
    
    // Save as favorite activity
    localStorage.setItem('favoriteActivity', activityId);
    
    // Create the plan with scheduled time (2 hours from now)
    const scheduledFor = new Date();
    scheduledFor.setHours(scheduledFor.getHours() + 2);
    
    const success = await createActivity(activityId, scheduledFor);
    
    if (success) {
      // Show success state
      setShowSuccess(true);
      
      // Play ding-ding sound
      playDingDingSound();
      
      // Trigger confetti waterfall
      triggerConfettiWaterfall();
      
      // Show toast
      toast.success("Plan created! 🎉", {
        description: "Your plan is now visible on the map",
        icon: <Check className="w-4 h-4" />,
      });
      
      // Close after a delay and open map
      setTimeout(() => {
        setShowSuccess(false);
        setSelectingId(null);
        setIsCreatingPlan(false);
        onOpenChange(false);
        
        // Notify parent to show map with the plan
        if (onPlanCreated) {
          onPlanCreated(activityId);
        }
      }, 1500);
    } else {
      setSelectingId(null);
      setIsCreatingPlan(false);
    }
  }, [user, onSelectActivity, triggerHaptic, createActivity, onOpenChange, onPlanCreated]);

  // Quick select favorite activity
  const handleSelectFavorite = useCallback(() => {
    if (favoriteActivity) {
      handleSelectActivity(favoriteActivity);
    }
  }, [favoriteActivity, handleSelectActivity]);

  // Set up the carousel API callback and scroll to time-based default on open
  useEffect(() => {
    if (!api) return;
    
    // Get time-based default activity
    const defaultActivity = getTimeBasedDefaultActivity();
    const defaultIndex = ACTIVITY_TYPES.findIndex(a => a.id === defaultActivity);
    const startIndex = defaultIndex >= 0 ? defaultIndex : 1;
    
    api.scrollTo(startIndex, false);
    setCurrentIndex(startIndex);
    
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onSelect]);

  // Get favorite activity details for the star button
  const favoriteActivityDetails = useMemo(() => {
    if (!favoriteActivity) return null;
    return ACTIVITY_TYPES.find(a => a.id === favoriteActivity);
  }, [favoriteActivity]);

  // Success celebration view
  if (showSuccess) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div 
              className="animate-shake"
              style={{
                animation: 'shake 0.5s ease-in-out infinite'
              }}
            >
              <Clock className="w-20 h-20 text-shake-yellow" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground text-center">
              Ding Ding! 🔔
            </h2>
            <p className="text-lg text-muted-foreground text-center">
              It's time to shake!
            </p>
            <p className="text-sm text-muted-foreground/70 text-center max-w-xs">
              Your plan is now visible on the map. Others can join!
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={isCreatingPlan ? () => {} : onOpenChange}>
      <DialogContent 
        className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50"
        {...(isMobile && !isCreatingPlan ? swipeHandlers : {})}
      >
        {isMobile && (
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-display">What's calling you today?</DialogTitle>
          <p className="text-center text-sm text-muted-foreground mt-2">
            {user ? "Tap to create your plan!" : "Swipe to choose. Sign in to create plans!"}
          </p>
        </DialogHeader>
        
        <div className="py-6 relative overflow-hidden">
          {/* Favorite quick access - positioned in top right */}
          {favoriteActivityDetails && user && (
            <button
              onClick={handleSelectFavorite}
              disabled={isCreatingPlan}
              className="absolute top-0 right-2 z-10 p-2 rounded-full bg-shake-yellow/20 hover:bg-shake-yellow/30 hover:scale-105 transition-all duration-200 group animate-[pulse_1s_ease-in-out_3] hover:animate-none shadow-[0_0_12px_rgba(255,215,0,0.3)] disabled:opacity-50"
            >
              <Star className="w-4 h-4 text-shake-yellow fill-shake-yellow group-hover:scale-110 transition-transform" />
            </button>
          )}
          <Carousel
            setApi={setApi}
            opts={{
              align: "center",
              loop: true,
              containScroll: false,
            }}
            className="w-full overflow-hidden"
          >
            <CarouselContent className="-ml-2 md:-ml-4">
              {ACTIVITY_TYPES.map((activity, index) => {
                const joinCount = getActivityJoinCount(activity.id);
                const isCenter = currentIndex === index;
                
                return (
                  <CarouselItem 
                    key={activity.id} 
                    className="pl-2 md:pl-4 basis-1/3 flex justify-center min-w-0"
                  >
                    <button
                      disabled={isCreatingPlan}
                      onClick={() => {
                        if (isCenter) {
                          handleSelectActivity(activity.id);
                        } else {
                          triggerHaptic('light');
                          api?.scrollTo(index);
                        }
                      }}
                      className="flex flex-col items-center justify-center gap-2 transition-all duration-300 relative group py-2 disabled:opacity-50"
                    >
                      <div className="relative">
                        <div 
                          className={`
                            rounded-full flex items-center justify-center transition-all duration-300 overflow-hidden relative
                            ${activity.color}
                            ${isCenter ? 'w-24 h-24 scale-100' : 'w-16 h-16 scale-90 opacity-60'}
                            ${selectingId === activity.id ? 'animate-pulse scale-110 ring-4 ring-primary/50' : ''}
                            ${isCenter && !selectingId ? 'active:scale-95' : ''}
                          `}
                        >
                          {activity.bgImage && (
                            <img 
                              src={activity.bgImage} 
                              alt="" 
                              className="absolute inset-0 w-full h-full object-cover opacity-30"
                            />
                          )}
                          {activity.icon ? (
                            <img 
                              src={activity.icon} 
                              alt={activity.label} 
                              className={`object-cover rounded-full transition-all duration-300 relative z-10 ${isCenter ? 'w-16 h-16' : 'w-10 h-10'}`}
                            />
                          ) : (
                            <span className={`transition-all duration-300 relative z-10 ${isCenter ? 'text-4xl' : 'text-2xl'}`}>
                              {activity.emoji}
                            </span>
                          )}
                        </div>
                        {joinCount > 0 && isCenter && (
                          <span className="absolute -top-1 right-0 bg-shake-yellow text-background text-xs font-bold px-1.5 py-0.5 rounded-full animate-fade-in whitespace-nowrap">
                            {joinCount}
                          </span>
                        )}
                      </div>
                      <span 
                        className={`
                          font-semibold text-foreground transition-all duration-300 truncate max-w-[80px]
                          ${isCenter ? 'opacity-100 text-base' : 'opacity-0 text-sm h-0'}
                          ${selectingId === activity.id ? 'text-primary font-bold' : ''}
                        `}
                      >
                        {activity.label}
                      </span>
                    </button>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>
          
          {/* Dots indicator */}
          <div className="flex justify-center gap-2 mt-4">
            {ACTIVITY_TYPES.map((_, index) => (
              <button
                key={index}
                onClick={() => api?.scrollTo(index)}
                disabled={isCreatingPlan}
                className={`w-2 h-2 rounded-full transition-all duration-300 disabled:opacity-50 ${
                  currentIndex === index ? 'bg-primary w-4' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
        </div>
        {!user && (
          <p className="text-center text-xs text-muted-foreground/70">
            Sign in to create plans and meet others!
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
