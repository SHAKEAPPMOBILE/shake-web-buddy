import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Calendar, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string | null;
  avatarUrl: string | null;
}

interface ActivityJoin {
  id: string;
  activity_type: string;
  city: string;
  joined_at: string;
}

const activityEmojis: Record<string, string> = {
  lunch: "🍽️",
  dinner: "🍝",
  drinks: "🍻",
  hike: "🥾",
};

export function UserProfileDialog({ 
  open, 
  onOpenChange, 
  userId, 
  userName, 
  avatarUrl 
}: UserProfileDialogProps) {
  const [activityHistory, setActivityHistory] = useState<ActivityJoin[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;

    const fetchActivityHistory = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("activity_joins")
          .select("id, activity_type, city, joined_at")
          .eq("user_id", userId)
          .order("joined_at", { ascending: false })
          .limit(10);

        if (error) {
          console.error("Error fetching activity history:", error);
          return;
        }

        setActivityHistory(data || []);
      } catch (error) {
        console.error("Error fetching activity history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivityHistory();
  }, [open, userId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-display">User Profile</DialogTitle>
        </DialogHeader>

        {/* Avatar and Name */}
        <div className="flex flex-col items-center py-4">
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-4 border-border shadow-lg">
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={userName || "User"}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-12 h-12 text-muted-foreground" />
            )}
          </div>
          <h3 className="mt-4 text-xl font-semibold text-foreground">
            {userName || "Shaker"}
          </h3>
          
          {/* Location from most recent activity */}
          {activityHistory.length > 0 && (
            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              <span>{activityHistory[0].city}</span>
            </div>
          )}
        </div>

        {/* Activity History */}
        <div className="border-t border-border/50 pt-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Recent Activity
          </h4>
          
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activityHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground/70 text-center py-4">
              No recent activity
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activityHistory.map((activity) => (
                <div 
                  key={activity.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                >
                  <span className="text-lg">
                    {activityEmojis[activity.activity_type] || "📍"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground capitalize">
                      {activity.activity_type}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {activity.city}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(activity.joined_at), "MMM d")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
