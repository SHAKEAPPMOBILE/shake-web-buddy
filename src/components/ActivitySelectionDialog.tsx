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
import iconLunch from "@/assets/icon-lunch.png";
import iconDinner from "@/assets/icon-dinner.png";
import iconDrinks from "@/assets/icon-drinks.png";
import iconHike from "@/assets/icon-hike.png";

interface ActivitySelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectActivity: (activity: string) => void;
  city: string;
}

const activities = [
  { id: "lunch", label: "Lunch", icon: iconLunch, color: "bg-shake-coral/20 hover:bg-shake-coral/30" },
  { id: "dinner", label: "Dinner", icon: iconDinner, color: "bg-shake-purple/20 hover:bg-shake-purple/30" },
  { id: "drinks", label: "Drinks", icon: iconDrinks, color: "bg-shake-teal/20 hover:bg-shake-teal/30" },
  { id: "hike", label: "Hike", icon: iconHike, color: "bg-shake-green/20 hover:bg-shake-green/30" },
];

export function ActivitySelectionDialog({ open, onOpenChange, onSelectActivity, city }: ActivitySelectionDialogProps) {
  const { getActivityJoinCount } = useActivityJoins(city);
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(1); // Start with dinner (index 1)
  const [api, setApi] = useState<CarouselApi>();
  const [selectingId, setSelectingId] = useState<string | null>(null);

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

  // Handle activity selection with animation
  const handleSelectActivity = useCallback((activityId: string) => {
    triggerHaptic('heavy');
    setSelectingId(activityId);
    
    // Save last selected activity to localStorage
    localStorage.setItem('lastSelectedActivity', activityId);
    
    // Small delay for animation before closing
    setTimeout(() => {
      onSelectActivity(activityId);
      setSelectingId(null);
    }, 200);
  }, [onSelectActivity, triggerHaptic]);

  // Set up the carousel API callback and scroll to last selected activity on open
  useEffect(() => {
    if (!api) return;
    
    // Get last selected activity from localStorage, default to dinner (index 1)
    const lastActivity = localStorage.getItem('lastSelectedActivity');
    const defaultIndex = lastActivity 
      ? activities.findIndex(a => a.id === lastActivity)
      : 1; // Default to dinner
    const startIndex = defaultIndex >= 0 ? defaultIndex : 1;
    
    api.scrollTo(startIndex, false);
    setCurrentIndex(startIndex);
    
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onSelect]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-display">What's calling you today?</DialogTitle>
          <p className="text-center text-sm text-muted-foreground mt-2">
            Swipe to choose. Your choice is recorded for 24 hours!
          </p>
        </DialogHeader>
        <div className="py-6">
          <Carousel
            setApi={setApi}
            opts={{
              align: "center",
              loop: true,
              containScroll: false,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-2 md:-ml-4">
              {activities.map((activity, index) => {
                const joinCount = getActivityJoinCount(activity.id);
                const isCenter = currentIndex === index;
                
                return (
                  <CarouselItem 
                    key={activity.id} 
                    className="pl-2 md:pl-4 basis-1/3 flex justify-center min-w-0"
                  >
                    <button
                      onClick={() => {
                        if (isCenter) {
                          handleSelectActivity(activity.id);
                        } else {
                          triggerHaptic('light');
                          api?.scrollTo(index);
                        }
                      }}
                      className="flex flex-col items-center justify-center gap-2 transition-all duration-300 relative group"
                    >
                      <div 
                        className={`
                          rounded-full flex items-center justify-center transition-all duration-300 overflow-hidden
                          ${activity.color}
                          ${isCenter ? 'w-24 h-24 scale-100' : 'w-16 h-16 scale-90 opacity-60'}
                          ${selectingId === activity.id ? 'animate-pulse scale-110 ring-4 ring-primary/50' : ''}
                          ${isCenter && !selectingId ? 'active:scale-95' : ''}
                        `}
                      >
                        <img 
                          src={activity.icon} 
                          alt={activity.label} 
                          className={`object-cover rounded-full transition-all duration-300 ${isCenter ? 'w-16 h-16' : 'w-10 h-10'}`} 
                        />
                      </div>
                      <span 
                        className={`
                          font-semibold text-foreground transition-all duration-300
                          ${isCenter ? 'opacity-100 text-lg' : 'opacity-0 text-sm h-0'}
                          ${selectingId === activity.id ? 'text-primary font-bold' : ''}
                        `}
                      >
                        {activity.label}
                      </span>
                      {joinCount > 0 && isCenter && (
                        <span className="absolute -top-1 -right-1 bg-shake-yellow text-background text-xs font-bold px-2 py-0.5 rounded-full animate-fade-in">
                          {joinCount} today
                        </span>
                      )}
                    </button>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>
          
          {/* Dots indicator */}
          <div className="flex justify-center gap-2 mt-4">
            {activities.map((_, index) => (
              <button
                key={index}
                onClick={() => api?.scrollTo(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  currentIndex === index ? 'bg-primary w-4' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
        </div>
        {!user && (
          <p className="text-center text-xs text-muted-foreground/70">
            Sign in to join activities and get notified!
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
