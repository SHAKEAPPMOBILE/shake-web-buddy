import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useCallback, useEffect } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselApi,
} from "@/components/ui/carousel";
import { Check, Clock } from "lucide-react";
import { getOrderedActivities, getTodayDefaultIndex } from "@/data/activityTypes";
import { useUserActivities } from "@/hooks/useUserActivities";
import { PremiumDialog } from "@/components/PremiumDialog";
import { ActivityConfirmationDialog } from "@/components/ActivityConfirmationDialog";
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
  const { user, isPremium } = useAuth();
  const { createActivity, remainingActivities } = useUserActivities(city);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingActivity, setPendingActivity] = useState<{ id: string; label: string; emoji: string } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [api, setApi] = useState<CarouselApi>();
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successActivity, setSuccessActivity] = useState<{ id: string; label: string; emoji: string } | null>(null);
  const isMobile = useIsMobile();
  
  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile && !isCreatingPlan && !showConfirmation,
  });

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

  // Get ordered activities (consistent with HomeTab)
  const orderedActivities = getOrderedActivities();

  // Handle activity selection - shows confirmation dialog
  const handleActivityClick = useCallback((activityId: string) => {
    if (!user) {
      onSelectActivity(activityId);
      return;
    }

    // Check if user has remaining activities (unless premium)
    if (!isPremium && remainingActivities <= 0) {
      setShowPremiumDialog(true);
      return;
    }

    // Find the activity and show confirmation
    const activity = orderedActivities.find(a => a.id === activityId);
    if (activity) {
      setPendingActivity({ id: activity.id, label: activity.label, emoji: activity.emoji });
      setShowConfirmation(true);
    }
  }, [user, isPremium, remainingActivities, onSelectActivity, orderedActivities]);

  // Actually create the plan after confirmation
  const handleConfirmActivity = useCallback(async (selectedCity: string) => {
    if (!pendingActivity) return;

    setShowConfirmation(false);
    triggerHaptic('heavy');
    setSelectingId(pendingActivity.id);
    setIsCreatingPlan(true);
    
    // Save as favorite activity
    localStorage.setItem('favoriteActivity', pendingActivity.id);
    
    // Create the plan with scheduled time (2 hours from now)
    const scheduledFor = new Date();
    scheduledFor.setHours(scheduledFor.getHours() + 2);
    
    const success = await createActivity(pendingActivity.id, scheduledFor);
    
    if (success) {
      setSuccessActivity(pendingActivity);
      setShowSuccess(true);
      playDingDingSound();
      triggerConfettiWaterfall();
      
      toast.success("Plan created! 🎉", {
        description: `Your ${pendingActivity.label} plan in ${selectedCity} is now visible on the map`,
        icon: <Check className="w-4 h-4" />,
      });
      
      setTimeout(() => {
        setShowSuccess(false);
        setSuccessActivity(null);
        setSelectingId(null);
        setIsCreatingPlan(false);
        setPendingActivity(null);
        onOpenChange(false);
        
        if (onPlanCreated) {
          onPlanCreated(pendingActivity.id);
        }
      }, 1500);
    } else {
      setSelectingId(null);
      setIsCreatingPlan(false);
      setPendingActivity(null);
    }
  }, [pendingActivity, triggerHaptic, createActivity, onOpenChange, onPlanCreated]);

  // Handle "just exploring" action
  const handleExplore = useCallback(() => {
    setShowConfirmation(false);
    setPendingActivity(null);
  }, []);

  // Set up the carousel API callback and scroll to today's default on open
  useEffect(() => {
    if (!api) return;
    
    // Start at today's default activity (index 0 since list is reordered)
    const startIndex = getTodayDefaultIndex();
    
    api.scrollTo(startIndex, false);
    setCurrentIndex(startIndex);
    
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onSelect]);


  // Success celebration view with activity confirmation
  if (showSuccess && successActivity) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            {/* Activity emoji with animation */}
            <div 
              className="animate-scale-in"
              style={{ animationDuration: '0.4s' }}
            >
              <div className="w-28 h-28 rounded-full bg-white shadow-lg flex items-center justify-center">
                <span className="text-6xl">{successActivity.emoji}</span>
              </div>
            </div>
            
            {/* Activity name confirmation */}
            <div className="text-center animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <h2 className="text-2xl font-display font-bold text-foreground">
                {successActivity.label} Plan Created! 🎉
              </h2>
              <p className="text-lg text-muted-foreground mt-2">
                Ding Ding! It's time to shake!
              </p>
            </div>
            
            {/* Shaking clock */}
            <div 
              className="animate-shake"
              style={{ animation: 'shake 0.5s ease-in-out infinite' }}
            >
              <Clock className="w-10 h-10 text-shake-yellow" />
            </div>
            
            <p className="text-sm text-muted-foreground/70 text-center max-w-xs animate-fade-in" style={{ animationDelay: '0.4s' }}>
              Your <span className="font-semibold text-foreground">{successActivity.label}</span> plan is now visible on the map. Others can join!
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
    <Dialog open={open} onOpenChange={isCreatingPlan ? () => {} : onOpenChange}>
      <DialogContent 
        className="sm:max-w-md bg-transparent border-none shadow-none"
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
              {orderedActivities.map((activity, index) => {
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
                          handleActivityClick(activity.id);
                        } else {
                          triggerHaptic('light');
                          api?.scrollTo(index);
                        }
                      }}
                      className="flex flex-col items-center justify-center gap-2 transition-all duration-300 relative group py-2 disabled:opacity-50"
                    >
                      <div className="relative">
                        {/* White circular background for all icons */}
                        <div 
                          className={`
                            rounded-full flex items-center justify-center transition-all duration-300 overflow-hidden relative bg-white
                            ${isCenter ? 'w-24 h-24 scale-100' : 'w-16 h-16 scale-90 opacity-80'}
                            ${selectingId === activity.id ? 'animate-pulse scale-110' : ''}
                            ${isCenter && !selectingId ? 'active:scale-95 shadow-lg' : 'shadow-md'}
                          `}
                        >
                          {activity.icon ? (
                            <img 
                              src={activity.icon} 
                              alt={activity.label} 
                              className={`object-contain transition-all duration-300 relative z-10 ${isCenter ? 'w-14 h-14' : 'w-9 h-9'}`}
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
            {orderedActivities.map((_, index) => (
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
        {user && !isPremium && remainingActivities > 0 && (
          <p className="text-center text-xs text-muted-foreground/70">
            {remainingActivities} free {remainingActivities === 1 ? 'plan' : 'plans'} left this month
          </p>
        )}
      </DialogContent>
    </Dialog>
    
    <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />
    
    <ActivityConfirmationDialog
      open={showConfirmation}
      onOpenChange={setShowConfirmation}
      activity={pendingActivity}
      currentCity={city}
      onConfirm={handleConfirmActivity}
      onExplore={handleExplore}
    />
    </>
  );
}
