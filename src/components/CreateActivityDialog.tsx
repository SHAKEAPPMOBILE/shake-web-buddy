import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useMemo } from "react";
import { format, setHours, setMinutes, addHours } from "date-fns";
import { CalendarIcon, Clock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTIVITY_TYPES, getActivityColor, getActivityEmoji, getActivityLabel } from "@/data/activityTypes";
import { useUserActivities } from "@/hooks/useUserActivities";
import { useAuth } from "@/contexts/AuthContext";

interface CreateActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  city: string;
}

const TIME_SLOTS = [
  { label: "Morning (9:00)", hours: 9, minutes: 0 },
  { label: "Noon (12:00)", hours: 12, minutes: 0 },
  { label: "Afternoon (15:00)", hours: 15, minutes: 0 },
  { label: "Evening (18:00)", hours: 18, minutes: 0 },
  { label: "Night (21:00)", hours: 21, minutes: 0 },
];

export function CreateActivityDialog({ open, onOpenChange, city }: CreateActivityDialogProps) {
  const { user } = useAuth();
  const { createActivity, isLoading, remainingActivities } = useUserActivities(city);
  
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<{ hours: number; minutes: number } | null>(null);
  
  const canCreate = remainingActivities > 0;
  
  const scheduledDateTime = useMemo(() => {
    if (!selectedDate || !selectedTime) return null;
    return setMinutes(setHours(selectedDate, selectedTime.hours), selectedTime.minutes);
  }, [selectedDate, selectedTime]);

  const isValid = selectedType && scheduledDateTime && scheduledDateTime > new Date();

  const handleCreate = async () => {
    if (!isValid || !scheduledDateTime) return;
    
    const success = await createActivity(selectedType!, scheduledDateTime);
    if (success) {
      // Reset form
      setSelectedType(null);
      setSelectedDate(undefined);
      setSelectedTime(null);
      onOpenChange(false);
    }
  };

  const resetForm = () => {
    setSelectedType(null);
    setSelectedDate(undefined);
    setSelectedTime(null);
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
            Create Activity
          </DialogTitle>
          <p className="text-center text-sm text-muted-foreground mt-2">
            {canCreate ? (
              <>You have <span className="font-bold text-primary">{remainingActivities}</span> activities left this month</>
            ) : (
              <span className="text-destructive">You've used all 3 activities this month</span>
            )}
          </p>
        </DialogHeader>

        {!user ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Please sign in to create activities</p>
          </div>
        ) : !canCreate ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">You can create more activities next month</p>
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">What time?</label>
              <div className="grid grid-cols-5 gap-2">
                {TIME_SLOTS.map((slot) => (
                  <button
                    key={slot.label}
                    onClick={() => setSelectedTime({ hours: slot.hours, minutes: slot.minutes })}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-lg transition-all border",
                      selectedTime?.hours === slot.hours
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Clock className="w-4 h-4 mb-1" />
                    <span className="text-xs font-medium">{slot.hours}:00</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {isValid && scheduledDateTime && (
              <div className="p-4 rounded-xl bg-muted/50 space-y-2">
                <p className="text-sm font-medium text-foreground">Preview:</p>
                <div className="flex items-center gap-3">
                  <span className={cn("text-3xl p-2 rounded-lg", getActivityColor(selectedType!))}>
                    {getActivityEmoji(selectedType!)}
                  </span>
                  <div>
                    <p className="font-semibold">{getActivityLabel(selectedType!)} in {city}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(scheduledDateTime, "EEEE, MMMM d 'at' h:mm a")}
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
    </Dialog>
  );
}
