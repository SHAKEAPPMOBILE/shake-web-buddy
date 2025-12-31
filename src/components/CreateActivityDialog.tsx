import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useEffect } from "react";
import { format, startOfDay, isSameDay, addDays } from "date-fns";
import { CalendarIcon, Plus, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTIVITY_TYPES, getActivityColor, getActivityEmoji, getActivityLabel, getActivityById } from "@/data/activityTypes";
import { useUserActivities, UserActivity } from "@/hooks/useUserActivities";
import { useAuth } from "@/contexts/AuthContext";
import { PremiumDialog } from "@/components/PremiumDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { PlanGroupChatDialog } from "@/components/PlanGroupChatDialog";
import { SuperHumanIcon } from "./SuperHumanIcon";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { toast } from "sonner";

interface CreateActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  city: string;
}


export function CreateActivityDialog({ open, onOpenChange, city }: CreateActivityDialogProps) {
  const { user, isPremium } = useAuth();
  const { createActivity, isLoading, remainingActivities, myActivities } = useUserActivities(city);
  
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [existingActivity, setExistingActivity] = useState<UserActivity | null>(null);
  const [showPlanChat, setShowPlanChat] = useState(false);
  const isMobile = useIsMobile();
  
  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });
  
  const canCreate = remainingActivities > 0;
  const today = startOfDay(new Date());
  
  const isValid = selectedType && selectedDate && selectedDate >= today;

  // Default to "Today" when opening the dialog
  useEffect(() => {
    if (open && !selectedDate) setSelectedDate(today);
  }, [open]);

  // Check if user already has a plan for this activity type on the selected date
  useEffect(() => {
    if (!selectedType || !selectedDate || !myActivities.length) {
      setExistingActivity(null);
      return;
    }

    const existing = myActivities.find(activity => 
      activity.activity_type === selectedType &&
      isSameDay(new Date(activity.scheduled_for), selectedDate)
    );

    setExistingActivity(existing || null);
  }, [selectedType, selectedDate, myActivities]);

  // Calculate the next occurrence of a given day of week (0=Sun, 6=Sat)
  const getNextOccurrence = (dayOfWeek: number): Date => {
    const todayDayOfWeek = today.getDay();
    let daysUntil = dayOfWeek - todayDayOfWeek;
    if (daysUntil < 0) {
      daysUntil += 7; // Next week
    }
    return addDays(today, daysUntil);
  };

  const handleActivityClick = (activityType: string) => {
    setSelectedType(activityType);

    // Auto-select the next occurrence of the activity's default day
    const activity = getActivityById(activityType);
    if (activity?.defaultDay !== undefined) {
      const nextDate = getNextOccurrence(activity.defaultDay);
      setSelectedDate(nextDate);
      
      // Check if user already has this activity type for that date
      const existingPlan = myActivities.find(a => 
        a.activity_type === activityType &&
        isSameDay(new Date(a.scheduled_for), nextDate)
      );

      if (existingPlan) {
        setExistingActivity(existingPlan);
        setShowPlanChat(true);
      }
    } else {
      // Fallback to today if no default day
      setSelectedDate(today);
    }
  };

  const handleCreate = async () => {
    if (!isValid || !selectedDate) return;

    // Check again for existing activity
    if (existingActivity) {
      setShowPlanChat(true);
      return;
    }

    const success = await createActivity(selectedType!, selectedDate);
    if (success) {
      triggerConfettiWaterfall();
      toast.success("Plan created!", {
        description: "Your plan is now visible in Explore Plans",
      });

      // Reset form
      setSelectedType(null);
      setSelectedDate(today);
      onOpenChange(false);
    }
  };

  const resetForm = () => {
    setSelectedType(null);
    setSelectedDate(today);
    setExistingActivity(null);
  };

  const handleBackFromChat = () => {
    setShowPlanChat(false);
    setExistingActivity(null);
  };

  // Show the plan group chat if there's an existing activity
  if (showPlanChat && existingActivity) {
    return (
      <PlanGroupChatDialog
        open={true}
        onOpenChange={(open) => {
          if (!open) {
            setShowPlanChat(false);
            setExistingActivity(null);
            onOpenChange(false);
          }
        }}
        activity={existingActivity}
        onBack={handleBackFromChat}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
        <DialogContent 
          className="sm:max-w-lg bg-card/95 backdrop-blur-xl border-border/50 max-h-[90vh] overflow-y-auto [&>button.dialog-close]:text-white [&>button.dialog-close]:bg-black/50 [&>button.dialog-close]:hover:bg-black/70"
          {...(isMobile ? swipeHandlers : {})}
      >
        {isMobile && (
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-display flex items-center justify-center gap-2">
            <Plus className="w-6 h-6" />
            Propose a Plan
          </DialogTitle>
          <p className="text-center text-sm text-muted-foreground mt-2">
            {isPremium ? (
              <span className="text-shake-yellow">Unlimited plans as a Super-Human ✨</span>
            ) : canCreate ? (
              <>You have <span className="font-bold text-primary">{remainingActivities}</span> plans left this month</>
            ) : (
              <span className="text-destructive">You have used all 10 plans this month</span>
            )}
          </p>
        </DialogHeader>

        {!user ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Please sign in to create activities</p>
          </div>
        ) : !canCreate ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-shake-yellow/10 flex items-center justify-center">
              <SuperHumanIcon size={32} />
            </div>
            <div>
              <p className="font-semibold text-foreground">You've used all 10 free plans this month</p>
              <p className="text-sm text-muted-foreground mt-1">
                Become a Super-Human for unlimited plans
              </p>
            </div>
            <Button 
              onClick={() => setShowPremiumDialog(true)}
              className="bg-shake-yellow text-background hover:bg-shake-yellow/90"
            >
              <SuperHumanIcon size={16} className="mr-2" />
              Become a Super-Human
            </Button>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Activity Type Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">What type of activity?</label>
              <div className="grid grid-cols-5 gap-2">
                {ACTIVITY_TYPES.map((activity) => {
                  // Check if user has this activity type for today
                  const hasTodayPlan = myActivities.some(a => 
                    a.activity_type === activity.id &&
                    isSameDay(new Date(a.scheduled_for), today)
                  );
                  
                  return (
                    <button
                      key={activity.id}
                      onClick={() => handleActivityClick(activity.id)}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-xl transition-all relative",
                        activity.color,
                        selectedType === activity.id 
                          ? "ring-2 ring-primary scale-105" 
                          : "hover:scale-105"
                      )}
                    >
                      <span className="text-2xl">{activity.emoji}</span>
                      <span className="text-xs mt-1 font-medium truncate w-full text-center">
                        {activity.label}
                      </span>
                      {hasTodayPlan && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <MessageCircle className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">When?</label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedDate(today)}
                  className={cn(
                    "flex-shrink-0",
                    selectedDate?.getTime() === today.getTime() && "border-primary bg-primary/10 text-primary"
                  )}
                >
                  Today
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < today}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Preview or Existing Activity Notice */}
            {existingActivity ? (
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 space-y-2">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-primary" />
                  You already have this plan!
                </p>
                <div className="flex items-center gap-3">
                  <span className={cn("text-3xl p-2 rounded-lg", getActivityColor(existingActivity.activity_type))}>
                    {getActivityEmoji(existingActivity.activity_type)}
                  </span>
                  <div>
                    <p className="font-semibold">{getActivityLabel(existingActivity.activity_type)} in {city}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(existingActivity.scheduled_for), "EEEE, MMMM d")}
                    </p>
                  </div>
                </div>
              </div>
            ) : isValid && selectedDate && (
              <div className="p-4 rounded-xl bg-muted/50 space-y-2">
                <p className="text-sm font-medium text-foreground">Preview:</p>
                <div className="flex items-center gap-3">
                  <span className={cn("text-3xl p-2 rounded-lg", getActivityColor(selectedType!))}>
                    {getActivityEmoji(selectedType!)}
                  </span>
                  <div>
                    <p className="font-semibold">{getActivityLabel(selectedType!)} in {city}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(selectedDate, "EEEE, MMMM d")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Create Button or Go to Chat Button */}
            {existingActivity ? (
              <Button
                onClick={() => setShowPlanChat(true)}
                className="w-full"
                size="lg"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Go to Group Chat
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={!isValid || isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </span>
                ) : (
                  "Create Activity"
                )}
              </Button>
            )}
          </div>
        )}
      </DialogContent>

      <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />
    </Dialog>
  );
}
