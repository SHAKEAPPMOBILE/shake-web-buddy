import { useState, useEffect, useCallback } from "react";
import { MapPin, Calendar, Users, Plus, Crown } from "lucide-react";
import { useCity } from "@/contexts/CityContext";
import { useAuth } from "@/contexts/AuthContext";
import { PlansMapDialog } from "../PlansMapDialog";
import { PremiumDialog } from "../PremiumDialog";
import { CreateActivityDialog } from "../CreateActivityDialog";
import { format } from "date-fns";
import { ACTIVITY_TYPES } from "@/data/activityTypes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

interface PlanActivity {
  id: string;
  user_id: string;
  activity_type: string;
  city: string;
  scheduled_for: string;
  is_active: boolean;
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

    // Fetch activities user has joined (from carousel or anywhere)
    let joinedActivityIds: string[] = [];
    if (user) {
      const { data: joins } = await supabase
        .from("activity_joins")
        .select("activity_id")
        .eq("user_id", user.id)
        .not("activity_id", "is", null);
      
      joinedActivityIds = (joins || []).map(j => j.activity_id).filter(Boolean) as string[];
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

    // Sort by scheduled_for
    activitiesWithDetails.sort((a, b) => 
      new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()
    );

    setActivities(activitiesWithDetails);
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

  const getActivityEmoji = (type: string) => {
    const activity = ACTIVITY_TYPES.find(a => a.id === type);
    return activity?.emoji || "📍";
  };

  const getActivityLabel = (type: string) => {
    const activity = ACTIVITY_TYPES.find(a => a.id === type);
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-lg font-display font-bold">Plans in {selectedCity}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreatePlan}
            className="flex items-center gap-1 px-3 py-1.5 bg-shake-yellow text-background rounded-full text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create
            {!isPremium && <Crown className="w-3 h-3 ml-0.5" />}
          </button>
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
            <p className="text-sm text-muted-foreground/70 mt-1">Shake to create one!</p>
          </div>
        ) : (
          activities.map((plan) => (
            <div
              key={plan.id}
              className="bg-card border border-border rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                {/* Creator Avatar */}
                <div className="relative">
                  <Avatar className="w-12 h-12 border-2 border-primary/20">
                    <AvatarImage src={plan.creator_avatar || undefined} alt={plan.creator_name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {plan.creator_name?.charAt(0)?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-sm">
                    {getActivityEmoji(plan.activity_type)}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">
                      {getActivityLabel(plan.activity_type)}
                    </h3>
                    {plan.isJoined && (
                      <span className="text-xs bg-green-500/20 text-green-600 px-1.5 py-0.5 rounded-full">
                        Joined
                      </span>
                    )}
                    {plan.user_id === user?.id && (
                      <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                        Your plan
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">by {plan.creator_name || "Anonymous"}</span>
                    {plan.city !== selectedCity && (
                      <span className="text-xs text-muted-foreground/70">• {plan.city}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(plan.scheduled_for), "MMM d, h:mm a")}
                    </span>
                  </div>
                </div>
              </div>
              {plan.participant_count && plan.participant_count > 1 && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span>{plan.participant_count} joined</span>
                </div>
              )}
            </div>
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
    </div>
  );
}
