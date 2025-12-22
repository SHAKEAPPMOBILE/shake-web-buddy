import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { format, startOfDay } from "date-fns";
import { CalendarIcon, Plus, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTIVITY_TYPES, getActivityColor, getActivityEmoji, getActivityLabel } from "@/data/activityTypes";
import { useUserActivities } from "@/hooks/useUserActivities";
import { useAuth } from "@/contexts/AuthContext";
import { PremiumDialog } from "@/components/PremiumDialog";

interface CreateActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  city: string;
}


export function CreateActivityDialog({ open, onOpenChange, city }: CreateActivityDialogProps) {
  const { user } = useAuth();
  const { createActivity, isLoading, remainingActivities } = useUserActivities(city);
  
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  
  const canCreate = remainingActivities > 0;
  const today = startOfDay(new Date());
  
  const isValid = selectedType && selectedDate && selectedDate >= today;

  const handleCreate = async () => {
    if (!isValid || !selectedDate) return;
    
    const success = await createActivity(selectedType!, selectedDate);
    if (success) {
      // Reset form
      setSelectedType(null);
      setSelectedDate(undefined);
      onOpenChange(false);
    }
  };

  const resetForm = () => {
    setSelectedType(null);
    setSelectedDate(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-lg bg-card/95 backdrop-blur-xl border-border/50 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-display flex items-center justify-center gap-2">
            <Plus className="w-6 h-6" />
            Propose a Plan
          </DialogTitle>
          <p className="text-center text-sm text-muted-foreground mt-2">
            {canCreate ? (
              <>You have <span className="font-bold text-primary">{remainingActivities}</span> plans left this month</>
            ) : (
              <span className="text-destructive">You have used all 5 plans this month</span>
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
              <Crown className="w-8 h-8 text-shake-yellow" />
            </div>
            <div>
              <p className="font-semibold text-foreground">You've used all 5 free plans this month</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upgrade to Premium for unlimited plans
              </p>
            </div>
            <Button 
              onClick={() => setShowPremiumDialog(true)}
              className="bg-shake-yellow text-background hover:bg-shake-yellow/90"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Premium
            </Button>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Activity Type Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">What type of activity?</label>
              <div className="grid grid-cols-5 gap-2">
                {ACTIVITY_TYPES.map((activity) => (
                  <button
                    key={activity.id}
                    onClick={() => setSelectedType(activity.id)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-xl transition-all",
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
                  </button>
                ))}
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

            {/* Preview */}
            {isValid && selectedDate && (
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

            {/* Create Button */}
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
          </div>
        )}
      </DialogContent>

      <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />
    </Dialog>
  );
}
