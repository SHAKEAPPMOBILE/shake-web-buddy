import { useState, useEffect, useCallback } from "react";
import { MapPin, Calendar, Users, Plus, Crown, Trash2 } from "lucide-react";
import { useCity } from "@/contexts/CityContext";
import { useAuth } from "@/contexts/AuthContext";
import { PlansMapDialog } from "../PlansMapDialog";
import { PremiumDialog } from "../PremiumDialog";
import { CreateActivityDialog } from "../CreateActivityDialog";
import { PlanGroupChatDialog } from "../PlanGroupChatDialog";
import { format } from "date-fns";
import { ALL_ACTIVITY_TYPES, ACTIVITY_TYPES, getActivityDay } from "@/data/activityTypes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PlanActivity {
  id: string;
  user_id: string;
  activity_type: string;
  city: string;
  scheduled_for: string;
  is_active: boolean;
  note?: string | null;
  creator_name?: string;
  creator_avatar?: string;
  participant_count?: number;
  isJoined?: boolean;
}

export function PlansTab() {
  const { selectedCity } = useCity();
  const { user, isPremium } = useAuth();
  const [activities, setActivities] = useState<PlanActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all plans: activities in city + activities user has joined
  const fetchPlans = useCallback(async () => {
    if (!selectedCity) return;
    
    setIsLoading(true);
    
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    // Fetch activities in the current city
    const { data: cityActivities, error: cityError } = await supabase
      .from("user_activities")
      .select("*")
      .eq("city", selectedCity)
      .eq("is_active", true)
      .gte("scheduled_for", startOfToday.toISOString())
      .order("scheduled_for", { ascending: true });

    if (cityError) {
      console.error("Error fetching city activities:", cityError);
      setIsLoading(false);
      return;
    }

    // Fetch activities user has joined (with activity_id - actual plans)
    let joinedActivityIds: string[] = [];
    if (user) {
      const { data: joins } = await supabase
        .from("activity_joins")
        .select("activity_id")
        .eq("user_id", user.id)
        .not("activity_id", "is", null);
      
      joinedActivityIds = (joins || []).map(j => j.activity_id).filter(Boolean) as string[];
    }

    // Fetch carousel joins (without activity_id) for the current user
    let carouselJoins: { activity_type: string; city: string; joined_at: string }[] = [];
    if (user) {
      const { data: cJoins } = await supabase
        .from("activity_joins")
        .select("activity_type, city, joined_at")
        .eq("user_id", user.id)
        .is("activity_id", null)
        .gt("expires_at", new Date().toISOString());
      
      carouselJoins = cJoins || [];
    }

    // Get joined activities that might be in other cities or not in current list
    let joinedActivities: typeof cityActivities = [];
    if (joinedActivityIds.length > 0) {
      const { data: joinedData } = await supabase
        .from("user_activities")
        .select("*")
        .in("id", joinedActivityIds)
        .eq("is_active", true)
        .gte("scheduled_for", startOfToday.toISOString());
      
      joinedActivities = joinedData || [];
    }

    // Combine and deduplicate
    const allActivitiesMap = new Map<string, typeof cityActivities[0]>();
    
    (cityActivities || []).forEach(a => allActivitiesMap.set(a.id, a));
    joinedActivities.forEach(a => allActivitiesMap.set(a.id, a));
    
    const allActivities = Array.from(allActivitiesMap.values());

    // Fetch creator profiles and participant counts
    const activitiesWithDetails = await Promise.all(
      allActivities.map(async (activity) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, avatar_url")
          .eq("user_id", activity.user_id)
          .maybeSingle();

        const { count } = await supabase
          .from("activity_joins")
          .select("*", { count: "exact", head: true })
          .eq("activity_id", activity.id);

        return {
          ...activity,
          creator_name: profile?.name || "Anonymous",
          creator_avatar: profile?.avatar_url,
          participant_count: (count || 0) + 1,
          isJoined: joinedActivityIds.includes(activity.id),
        };
      })
    );

    // Create virtual plans from carousel joins
    const virtualPlans: PlanActivity[] = await Promise.all(
      carouselJoins.map(async (join) => {
        // Get user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, avatar_url")
          .eq("user_id", user!.id)
          .maybeSingle();

        // Get participant count for this activity type in this city
        const { count } = await supabase
          .from("activity_joins")
          .select("*", { count: "exact", head: true })
          .eq("activity_type", join.activity_type)
          .eq("city", join.city)
          .is("activity_id", null)
          .gt("expires_at", new Date().toISOString());

        // Get the day for this activity type
        const activityDef = ACTIVITY_TYPES.find(a => a.id === join.activity_type);
        const dayLabel = getActivityDay(join.activity_type);

        return {
          id: `carousel-${join.activity_type}-${join.city}`,
          user_id: user!.id,
          activity_type: join.activity_type,
          city: join.city,
          scheduled_for: join.joined_at,
          is_active: true,
          note: dayLabel ? `Every ${dayLabel}` : null,
          creator_name: profile?.name || "You",
          creator_avatar: profile?.avatar_url,
          participant_count: count || 1,
          isJoined: true,
        };
      })
    );

    // Combine real activities with virtual carousel plans
    const allPlans = [...activitiesWithDetails, ...virtualPlans];

    // Sort by scheduled_for
    allPlans.sort((a, b) => 
      new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()
    );

    setActivities(allPlans);
    setIsLoading(false);
  }, [selectedCity, user]);

  // Initial fetch and realtime subscription
  useEffect(() => {
    fetchPlans();

    const channel = supabase
      .channel(`plans-tab-${selectedCity}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_activities" },
        () => fetchPlans()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_joins" },
        () => fetchPlans()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPlans]);
  const [showMap, setShowMap] = useState(false);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanActivity | null>(null);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<PlanActivity | null>(null);

  const getActivityEmoji = (type: string) => {
    const activity = ALL_ACTIVITY_TYPES.find(a => a.id === type);
    return activity?.emoji || "📍";
  };

  const getActivityLabel = (type: string) => {
    const activity = ALL_ACTIVITY_TYPES.find(a => a.id === type);
    return activity?.label || type;
  };

  const handleCreatePlan = () => {
    if (!user) {
      return;
    }
    if (!isPremium) {
      setShowPremiumDialog(true);
      return;
    }
    setShowCreateDialog(true);
  };

  const handlePlanClick = (plan: PlanActivity) => {
    setSelectedPlan(plan);
    setShowChatDialog(true);
  };

  const handleDeletePlan = async () => {
    if (!planToDelete || !user) return;

    try {
      // First delete all joins for this activity
      await supabase
        .from("activity_joins")
        .delete()
        .eq("activity_id", planToDelete.id);

      // Then delete all messages
      await supabase
        .from("plan_messages")
        .delete()
        .eq("activity_id", planToDelete.id);

      // Finally delete the activity itself
      const { error } = await supabase
        .from("user_activities")
        .delete()
        .eq("id", planToDelete.id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Plan deleted");
      setPlanToDelete(null);
      fetchPlans();
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast.error("Failed to delete plan");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-lg font-display font-bold">Plans in {selectedCity}</h2>
        <div className="flex items-center gap-2">
          {activities.length > 0 && (
            <button
              onClick={handleCreatePlan}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium text-white hover:opacity-90 transition-all"
              style={{
                background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
              }}
            >
              <Plus className="w-4 h-4" />
              Create
              {!isPremium && <Crown className="w-3 h-3 ml-0.5" />}
            </button>
          )}
          <button
            onClick={() => setShowMap(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium"
          >
            <MapPin className="w-4 h-4" />
            Map
          </button>
        </div>
      </div>

      {/* Plans List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No plans yet in {selectedCity}</p>
            <button
              onClick={handleCreatePlan}
              className="mt-3 flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium text-white hover:opacity-90 transition-all"
              style={{
                background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
              }}
            >
              <Plus className="w-4 h-4" />
              Create
              {!isPremium && <Crown className="w-3 h-3 ml-0.5" />}
            </button>
          </div>
        ) : (
          activities.map((plan) => (
            <button
              key={plan.id}
              onClick={() => handlePlanClick(plan)}
              className="w-full text-left rounded-2xl p-4 space-y-3 hover:opacity-90 transition-all"
              style={{
                background: "linear-gradient(to right, rgba(88, 28, 135, 0.6), rgba(67, 56, 202, 0.5))",
              }}
            >
              <div className="flex items-start gap-3">
                {/* Activity Icon */}
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-2xl">
                    {getActivityEmoji(plan.activity_type)}
                  </div>
                  <Avatar className="absolute -bottom-1 -right-1 w-6 h-6 border-2 border-white/50">
                    <AvatarImage src={plan.creator_avatar || undefined} alt={plan.creator_name} />
                    <AvatarFallback className="bg-white/80 text-muted-foreground text-xs font-semibold">
                      {plan.creator_name?.charAt(0)?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">
                      {getActivityLabel(plan.activity_type)}
                    </h3>
                    {plan.isJoined && (
                      <span className="text-xs bg-green-500/30 text-green-300 px-1.5 py-0.5 rounded-full">
                        Joined
                      </span>
                    )}
                    {plan.user_id === user?.id && (
                      <span className="text-xs bg-white/20 text-white px-1.5 py-0.5 rounded-full">
                        Your plan
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-white/70">by {plan.creator_name || "Anonymous"}</span>
                    {plan.city !== selectedCity && (
                      <span className="text-xs text-white/50">• {plan.city}</span>
                    )}
                  </div>
                  {plan.note && (
                    <p className="text-xs text-white/60 italic mt-1 line-clamp-1">
                      "{plan.note}"
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-3.5 h-3.5 text-white/70" />
                    <span className="text-sm text-white/70">
                      {format(new Date(plan.scheduled_for), "MMM d, h:mm a")}
                    </span>
                  </div>
                </div>
                {/* Delete button for own plans */}
                {plan.user_id === user?.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlanToDelete(plan);
                    }}
                    className="p-2 text-white/70 hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                    title="Delete plan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {plan.participant_count && plan.participant_count > 1 && (
                <div className="flex items-center gap-1 text-sm text-white/70">
                  <Users className="w-3.5 h-3.5" />
                  <span>{plan.participant_count} joined</span>
                </div>
              )}
            </button>
          ))
        )}
      </div>

      <PlansMapDialog 
        open={showMap} 
        onOpenChange={setShowMap} 
        city={selectedCity} 
      />

      <PremiumDialog 
        open={showPremiumDialog} 
        onOpenChange={setShowPremiumDialog} 
      />

      <CreateActivityDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        city={selectedCity}
      />

      {/* Plan Chat Dialog */}
      {selectedPlan && (
        <PlanGroupChatDialog
          open={showChatDialog}
          onOpenChange={setShowChatDialog}
          activity={{
            ...selectedPlan,
            note: selectedPlan.note,
            created_at: selectedPlan.scheduled_for,
            updated_at: selectedPlan.scheduled_for,
          }}
          onBack={() => setShowChatDialog(false)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!planToDelete} onOpenChange={(open) => !open && setPlanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your {planToDelete && getActivityLabel(planToDelete.activity_type)} plan and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlan} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
