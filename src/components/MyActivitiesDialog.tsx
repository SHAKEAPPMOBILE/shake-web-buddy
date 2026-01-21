import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, MapPin, MessageSquare, Users, Plane } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { getActivityEmoji, getActivityLabel, ACTIVITY_TYPES } from "@/data/activityTypes";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { LoadingSpinner } from "./LoadingSpinner";

interface MyActivitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectActivity: (selection: {
    activityType: string;
    city: string;
    /** Present when this entry is a scheduled plan (or a join to a specific plan) */
    activityId?: string;
  }) => void;
  homeCity?: string;
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
  onSelectActivity,
  homeCity,
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
      
      // Fetch activities where user has sent messages (activity_messages for carousel chats)
      const { data: userActivityMessages } = await supabase
        .from("activity_messages")
        .select("activity_type, city")
        .eq("user_id", user.id);

      // Fetch plan messages where user participated
      const { data: userPlanMessages } = await supabase
        .from("plan_messages")
        .select("activity_id")
        .eq("user_id", user.id);

      // Get unique activity types + cities from carousel chat participation
      const carouselChatsParticipated = new Set<string>();
      (userActivityMessages || []).forEach(msg => {
        carouselChatsParticipated.add(`${msg.activity_type}::${msg.city}`);
      });

      // Get unique plan IDs from plan chat participation
      const planChatsParticipated = new Set<string>();
      (userPlanMessages || []).forEach(msg => {
        if (msg.activity_id) planChatsParticipated.add(msg.activity_id);
      });

      // Fetch user's activity joins to check for unread messages
      const { data: joins } = await supabase
        .from("activity_joins")
        .select("id, activity_type, city, joined_at, expires_at, activity_id")
        .eq("user_id", user.id)
        .gt("expires_at", nowIso);

      // Fetch user's own plans
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      
      const { data: myPlans } = await supabase
        .from("user_activities")
        .select("id, activity_type, city, scheduled_for, created_at")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .gte("scheduled_for", startOfToday.toISOString());

      // Fetch read status for unread detection
      const { data: readStatuses } = await supabase
        .from("activity_read_status")
        .select("activity_type, city, last_read_at")
        .eq("user_id", user.id);

      const readStatusMap = new Map<string, string>();
      (readStatuses || []).forEach(rs => {
        readStatusMap.set(`${rs.activity_type}::${rs.city}`, rs.last_read_at);
      });

      // Check for unread messages in carousel chats
      const carouselChatsWithUnread = new Set<string>();
      for (const join of (joins || []).filter(j => !j.activity_id)) {
        const key = `${join.activity_type}::${join.city}`;
        const lastRead = readStatusMap.get(key);
        
        // Check if there are messages after last read
        let query = supabase
          .from("activity_messages")
          .select("id", { count: "exact", head: true })
          .eq("activity_type", join.activity_type)
          .eq("city", join.city)
          .neq("user_id", user.id);
        
        if (lastRead) {
          query = query.gt("created_at", lastRead);
        }
        
        const { count } = await query;
        if (count && count > 0) {
          carouselChatsWithUnread.add(key);
        }
      }

      // Filter to only show activities with participation or unread messages
      const relevantActivities: ActivityJoin[] = [];

      // Process carousel joins (no activity_id)
      for (const join of (joins || []).filter(j => !j.activity_id)) {
        const key = `${join.activity_type}::${join.city}`;
        const hasParticipated = carouselChatsParticipated.has(key);
        const hasUnread = carouselChatsWithUnread.has(key);
        
        if (hasParticipated || hasUnread) {
          const { count } = await supabase
            .from("activity_joins")
            .select("*", { count: "exact", head: true })
            .eq("activity_type", join.activity_type)
            .eq("city", join.city)
            .gt("expires_at", nowIso);

          relevantActivities.push({
            id: join.id,
            activity_type: join.activity_type,
            city: join.city,
            joined_at: join.joined_at,
            expires_at: join.expires_at,
            participant_count: count || 0,
            activity_id: undefined,
            source: "join",
          });
        }
      }

      // Process plan joins and own plans
      for (const join of (joins || []).filter(j => j.activity_id)) {
        const hasParticipated = planChatsParticipated.has(join.activity_id!);
        
        // Check for unread plan messages
        const { count: unreadCount } = await supabase
          .from("plan_messages")
          .select("id", { count: "exact", head: true })
          .eq("activity_id", join.activity_id!)
          .neq("user_id", user.id)
          .gt("created_at", join.joined_at);
        
        const hasUnread = (unreadCount || 0) > 0;
        
        if (hasParticipated || hasUnread) {
          const { count } = await supabase
            .from("activity_joins")
            .select("*", { count: "exact", head: true })
            .eq("activity_id", join.activity_id);

          // Get plan details for scheduled_for
          const { data: planData } = await supabase
            .from("user_activities")
            .select("scheduled_for")
            .eq("id", join.activity_id!)
            .maybeSingle();

          relevantActivities.push({
            id: join.id,
            activity_type: join.activity_type,
            city: join.city,
            joined_at: join.joined_at,
            expires_at: join.expires_at,
            participant_count: (count || 0) + 1,
            activity_id: join.activity_id,
            scheduled_for: planData?.scheduled_for,
            source: "join",
          });
        }
      }

      // Add user's own plans (always show as creator)
      for (const plan of (myPlans || [])) {
        // Check if already added via join
        const alreadyAdded = relevantActivities.some(a => a.activity_id === plan.id);
        if (alreadyAdded) continue;

        const { count } = await supabase
          .from("activity_joins")
          .select("*", { count: "exact", head: true })
          .eq("activity_id", plan.id);

        relevantActivities.push({
          id: `plan-${plan.id}`,
          activity_type: plan.activity_type,
          city: plan.city,
          joined_at: plan.created_at,
          expires_at: plan.scheduled_for,
          scheduled_for: plan.scheduled_for,
          activity_id: plan.id,
          participant_count: (count || 0) + 1,
          source: "plan",
        });
      }

      // Deduplicate and sort
      const byKey = new Map<string, ActivityJoin>();
      for (const item of relevantActivities) {
        const key = item.activity_id || `${item.activity_type}::${item.city}`;
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, item);
          continue;
        }
        if (existing.source !== "plan" && item.source === "plan") {
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
              <LoadingSpinner size="lg" />
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
                    <p className={`text-sm flex items-center gap-1 mt-0.5 ${homeCity && activity.city !== homeCity ? 'text-primary font-medium' : 'text-white/70'}`}>
                      {homeCity && activity.city !== homeCity ? (
                        <Plane className="w-3 h-3" />
                      ) : (
                        <MapPin className="w-3 h-3" />
                      )}
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
