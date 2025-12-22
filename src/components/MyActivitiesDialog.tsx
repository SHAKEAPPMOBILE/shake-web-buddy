import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, MapPin, MessageSquare, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { getActivityEmoji, getActivityLabel } from "@/data/activityTypes";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";

interface MyActivitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectActivity: (activityType: string, city: string) => void;
}

interface ActivityJoin {
  id: string;
  activity_type: string;
  city: string;
  joined_at: string;
  expires_at: string;
  participant_count?: number;
}

export function MyActivitiesDialog({ 
  open, 
  onOpenChange, 
  onSelectActivity 
}: MyActivitiesDialogProps) {
  const [activities, setActivities] = useState<ActivityJoin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });

  const fetchMyActivities = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Fetch user's active activity joins
      const { data: joins, error } = await supabase
        .from("activity_joins")
        .select("id, activity_type, city, joined_at, expires_at")
        .eq("user_id", user.id)
        .gt("expires_at", new Date().toISOString())
        .order("joined_at", { ascending: false });

      if (error) {
        console.error("Error fetching activities:", error);
        return;
      }

      // Get participant counts for each activity
      const activitiesWithCounts = await Promise.all(
        (joins || []).map(async (join) => {
          const { count } = await supabase
            .from("activity_joins")
            .select("*", { count: "exact", head: true })
            .eq("activity_type", join.activity_type)
            .eq("city", join.city)
            .gt("expires_at", new Date().toISOString());

          return {
            ...join,
            participant_count: count || 0,
          };
        })
      );

      setActivities(activitiesWithCounts);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on open
  useEffect(() => {
    if (!open || !user) return;
    fetchMyActivities();
  }, [open, user]);

  // Real-time subscription for activity joins - listen to all events for user's activities
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`my-activities-realtime-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_joins",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log("Activity join INSERT detected, refetching...");
          fetchMyActivities();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "activity_joins",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log("Activity join DELETE detected, refetching...");
          fetchMyActivities();
        }
      )
      .subscribe((status) => {
        console.log("My activities subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleActivityClick = (activity: ActivityJoin) => {
    onSelectActivity(activity.activity_type, activity.city);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50"
        {...(isMobile ? swipeHandlers : {})}
      >
        {isMobile && (
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-display flex items-center justify-center gap-2">
            <MessageSquare className="w-5 h-5" />
            My Activities
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No active activities</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Join an activity to start chatting with others
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => handleActivityClick(activity)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                    {getActivityEmoji(activity.activity_type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">
                        {getActivityLabel(activity.activity_type)}
                      </p>
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {activity.participant_count}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {activity.city}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Joined {format(new Date(activity.joined_at), "h:mm a")}
                    </p>
                  </div>

                  <MessageSquare className="w-5 h-5 text-primary shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
