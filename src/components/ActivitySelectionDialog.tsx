import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { useAuth } from "@/contexts/AuthContext";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-display">What are you in the mood for?</DialogTitle>
          <p className="text-center text-sm text-muted-foreground mt-2">
            Your choice is recorded for 24 hours. You'll be notified when others join!
          </p>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-6">
          {activities.map((activity) => {
            const joinCount = getActivityJoinCount(activity.id);
            return (
              <button
                key={activity.id}
                onClick={() => onSelectActivity(activity.id)}
                className={`flex flex-col items-center justify-center gap-3 p-4 rounded-full transition-all duration-300 ${activity.color} hover:scale-105 relative`}
              >
                <img src={activity.icon} alt={activity.label} className="w-20 h-20 object-contain" />
                <span className="font-semibold text-lg text-foreground">{activity.label}</span>
                {joinCount > 0 && (
                  <span className="absolute top-0 right-0 bg-shake-yellow text-background text-xs font-bold px-2 py-0.5 rounded-full">
                    {joinCount} today
                  </span>
                )}
              </button>
            );
          })}
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
