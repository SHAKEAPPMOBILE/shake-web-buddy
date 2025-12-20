import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Utensils, Wine, Beer, Mountain } from "lucide-react";

interface ActivitySelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectActivity: (activity: string) => void;
}

const activities = [
  { id: "lunch", label: "Lunch", icon: Utensils, color: "bg-shake-coral/20 text-shake-coral hover:bg-shake-coral/30" },
  { id: "dinner", label: "Dinner", icon: Wine, color: "bg-shake-purple/20 text-shake-purple hover:bg-shake-purple/30" },
  { id: "drinks", label: "Drinks", icon: Beer, color: "bg-shake-teal/20 text-shake-teal hover:bg-shake-teal/30" },
  { id: "hike", label: "Hike", icon: Mountain, color: "bg-shake-green/20 text-shake-green hover:bg-shake-green/30" },
];

export function ActivitySelectionDialog({ open, onOpenChange, onSelectActivity }: ActivitySelectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-display">What are you in the mood for?</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-6">
          {activities.map((activity) => (
            <button
              key={activity.id}
              onClick={() => onSelectActivity(activity.id)}
              className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl transition-all duration-300 ${activity.color} hover:scale-105`}
            >
              <activity.icon className="w-10 h-10" />
              <span className="font-semibold text-lg">{activity.label}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
