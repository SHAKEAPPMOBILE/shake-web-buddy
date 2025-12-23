import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, MapPin, MessageSquare, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { getActivityEmoji, getActivityLabel, ACTIVITY_TYPES } from "@/data/activityTypes";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";

interface MyActivitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectActivity: (selection: {
    activityType: string;
    city: string;
    /** Present when this entry is a scheduled plan (or a join to a specific plan) */
    activityId?: string;
  }) => void;
}

interface ActivityJoin {
  id: string;
  activity_type: string;
  city: string;
  joined_at: string;
  expires_at: string;
  participant_count?: number;
  activity_id?: string | null;
  // When present, this row represents a scheduled plan (creator's own plan)
  scheduled_for?: string;
  source?: "join" | "plan";
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
      const now = new Date();
      const nowIso = now.toISOString();
      
      // Only show joins from the last 24 hours
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      // 1) Fetch user's active chat joins from last 24h (includes plan joins where activity_id is set)
      const { data: joins, error } = await supabase
        .from("activity_joins")
        .select("id, activity_type, city, joined_at, expires_at, activity_id")
        .eq("user_id", user.id)
        .gt("expires_at", nowIso)
        .gte("joined_at", twentyFourHoursAgo)
        .order("joined_at", { ascending: false });

      if (error) {
        console.error("Error fetching activities:", error);
        return;
      }

      // 2) Fetch user's own upcoming plans (creator should see their plan chats too)
      // Show plans scheduled for today or in the future
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      
      const { data: myPlans, error: plansError } = await supabase
        .from("user_activities")
        .select("id, activity_type, city, scheduled_for, created_at")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .gte("scheduled_for", startOfToday.toISOString())
        .order("scheduled_for", { ascending: true });

      if (plansError) {
        console.error("Error fetching my plans:", plansError);
      }

      // Participant counts (plan joins count by activity_id; quick joins count by activity_type+city)
      const joinItems: ActivityJoin[] = await Promise.all(
        (joins || []).map(async (join: any) => {
          if (join.activity_id) {
            const { count } = await supabase
              .from("activity_joins")
              .select("*", { count: "exact", head: true })
              .eq("activity_id", join.activity_id);

            return {
              id: join.id,
              activity_type: join.activity_type,
              city: join.city,
              joined_at: join.joined_at,
              expires_at: join.expires_at,
              participant_count: (count || 0) + 1,
              activity_id: join.activity_id,
              source: "join",
            };
          }

          const { count } = await supabase
            .from("activity_joins")
            .select("*", { count: "exact", head: true })
            .eq("activity_type", join.activity_type)
            .eq("city", join.city)
            .gt("expires_at", nowIso);

          return {
            id: join.id,
            activity_type: join.activity_type,
            city: join.city,
            joined_at: join.joined_at,
            expires_at: join.expires_at,
            participant_count: count || 0,
            activity_id: join.activity_id,
            source: "join",
          };
        })
      );

      const planItems: ActivityJoin[] = await Promise.all(
        (myPlans || []).map(async (plan: any) => {
          const { count } = await supabase
            .from("activity_joins")
            .select("*", { count: "exact", head: true })
            .eq("activity_id", plan.id);

          return {
            id: `plan-${plan.id}`,
            activity_type: plan.activity_type,
            city: plan.city,
            joined_at: plan.created_at,
            // Keep plan visible until its scheduled time (so it's available in chat shortcut)
            expires_at: plan.scheduled_for,
            scheduled_for: plan.scheduled_for,
            activity_id: plan.id,
            participant_count: (count || 0) + 1,
            source: "plan",
          };
        })
      );

      // Deduplicate by activity_type + city, preferring plan entries over generic joins
      const merged = [...planItems, ...joinItems];
      const byKey = new Map<string, ActivityJoin>();
      for (const item of merged) {
        const key = `${item.activity_type}::${item.city}`;
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, item);
          continue;
        }
        if (existing.source !== "plan" && item.source === "plan") {
          byKey.set(key, item);
          continue;
        }
        // Otherwise keep the most recently joined
        if (new Date(item.joined_at).getTime() > new Date(existing.joined_at).getTime()) {
          byKey.set(key, item);
        }
      }

      const finalList = Array.from(byKey.values()).sort((a, b) => {
        const aTime = a.scheduled_for ? new Date(a.scheduled_for).getTime() : new Date(a.joined_at).getTime();
        const bTime = b.scheduled_for ? new Date(b.scheduled_for).getTime() : new Date(b.joined_at).getTime();
        return bTime - aTime;
      });

      setActivities(finalList);
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
    onSelectActivity({
      activityType: activity.activity_type,
      city: activity.city,
      activityId: activity.activity_id || undefined,
    });
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
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {activities.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => handleActivityClick(activity)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left hover:opacity-90"
                  style={{
                    background: "linear-gradient(to right, rgba(88, 28, 135, 0.6), rgba(67, 56, 202, 0.5))",
                  }}
                >
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-2xl shadow-md">
                    {(() => {
                      const activityData = ACTIVITY_TYPES.find(a => a.id === activity.activity_type);
                      return activityData?.icon ? (
                        <img src={activityData.icon} alt={activityData.label} className="w-8 h-8 object-contain" />
                      ) : (
                        <span>{getActivityEmoji(activity.activity_type)}</span>
                      );
                    })()}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">
                        {getActivityLabel(activity.activity_type)}
                      </p>
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {activity.participant_count}
                      </span>
                    </div>
                    <p className="text-sm text-white/70 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {activity.city}
                    </p>
                    {activity.scheduled_for && (
                      <p className="text-xs text-white/60 mt-1">
                        Scheduled for {format(new Date(activity.scheduled_for), "EEEE")} ({format(new Date(activity.scheduled_for), "dd-MM")})
                      </p>
                    )}
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
