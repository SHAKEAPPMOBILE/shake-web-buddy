import { useState, useEffect, useCallback, useMemo } from "react";
import { MapPin, Calendar, Users, Plus, Trash2, Plane, Share2 } from "lucide-react";
import { useCity } from "@/contexts/CityContext";
import { useAuth } from "@/contexts/AuthContext";
import { PlansMapDialog } from "../PlansMapDialog";
import { PremiumDialog } from "../PremiumDialog";
import { CreateActivityDialog } from "../CreateActivityDialog";
import { PlanGroupChatView } from "./PlanGroupChatView";
import { GroupChatView } from "./GroupChatView";
import { format, isToday, isTomorrow } from "date-fns";
import { ALL_ACTIVITY_TYPES, ACTIVITY_TYPES, getActivityDay, getNextOccurrenceDate } from "@/data/activityTypes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LoadingSpinner } from "../LoadingSpinner";
import { useReferralCode, getReferralLink } from "@/hooks/useReferralCode";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  isCarouselJoin?: boolean;
}

interface PlansTabProps {
  onChatViewChange?: (isInChat: boolean) => void;
}

export function PlansTab({ onChatViewChange }: PlansTabProps = {}) {
  const { selectedCity } = useCity();
  const { user, isPremium } = useAuth();
  const { referralCode } = useReferralCode(user?.id);
  const [activities, setActivities] = useState<PlanActivity[]>([]);
  const [cityFilter, setCityFilter] = useState<string>(() => {
    return localStorage.getItem("plans-city-filter") || "all";
  });
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
          participant_count: count || 0,
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
        const dayLabel = getActivityDay(join.activity_type);
        
        // Calculate the actual next occurrence date for this activity
        const nextOccurrence = getNextOccurrenceDate(join.activity_type);

        return {
          id: `carousel-${join.activity_type}-${join.city}`,
          user_id: user!.id,
          activity_type: join.activity_type,
          city: join.city,
          scheduled_for: nextOccurrence.toISOString(),
          is_active: true,
          note: dayLabel ? `This ${dayLabel}` : null,
          creator_name: profile?.name || "You",
          creator_avatar: profile?.avatar_url,
          participant_count: count || 1,
          isJoined: true,
          isCarouselJoin: true,
        };
      })
    );

    // Combine real activities with virtual carousel plans
    const allPlans = [...activitiesWithDetails, ...virtualPlans];

    // Sort with Today first, Tomorrow second, then chronologically
    allPlans.sort((a, b) => {
      const dateA = new Date(a.scheduled_for);
      const dateB = new Date(b.scheduled_for);
      const isTodayA = isToday(dateA);
      const isTodayB = isToday(dateB);
      const isTomorrowA = isTomorrow(dateA);
      const isTomorrowB = isTomorrow(dateB);
      
      // Today first
      if (isTodayA && !isTodayB) return -1;
      if (!isTodayA && isTodayB) return 1;
      
      // Tomorrow second
      if (isTomorrowA && !isTomorrowB) return -1;
      if (!isTomorrowA && isTomorrowB) return 1;
      
      // Then chronologically
      return dateA.getTime() - dateB.getTime();
    });

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
  const [showChatView, setShowChatView] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<PlanActivity | null>(null);
  const [selectedCarouselActivity, setSelectedCarouselActivity] = useState<PlanActivity | null>(null);
  const [showCarouselChatView, setShowCarouselChatView] = useState(false);
  const [mapOnlyMode, setMapOnlyMode] = useState(true); // Default to map-only view

  // Notify parent when entering/leaving chat view
  useEffect(() => {
    const isInChat = showChatView || showCarouselChatView;
    onChatViewChange?.(isInChat);
  }, [showChatView, showCarouselChatView, onChatViewChange]);

  // Get unique cities from all activities for the filter
  const availableCities = useMemo(() => {
    const cities = [...new Set(activities.map(a => a.city))];
    return cities.sort();
  }, [activities]);

  // Filter activities based on selected city
  const filteredActivities = useMemo(() => {
    if (cityFilter === "all") return activities;
    return activities.filter(a => a.city === cityFilter);
  }, [activities, cityFilter]);

  // Persist city filter to localStorage
  useEffect(() => {
    localStorage.setItem("plans-city-filter", cityFilter);
  }, [cityFilter]);

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
    // Always open create dialog - it handles premium check internally based on remaining activities
    setShowCreateDialog(true);
  };

  const handlePlanClick = (plan: PlanActivity) => {
    if (plan.isCarouselJoin) {
      setSelectedCarouselActivity(plan);
      setShowCarouselChatView(true);
      return;
    }
    setSelectedPlan(plan);
    setShowChatView(true);
  };

  const handleBackFromChat = () => {
    setShowChatView(false);
    setShowCarouselChatView(false);
    setSelectedPlan(null);
    setSelectedCarouselActivity(null);
    fetchPlans();
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

  const handleSharePlan = async (plan: PlanActivity, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const activityLabel = getActivityLabel(plan.activity_type);
    const activityEmoji = getActivityEmoji(plan.activity_type);
    const dateStr = format(new Date(plan.scheduled_for), "EEE, d MMM");
    
    const shareUrl = getReferralLink(referralCode);
    const shareText = `${activityEmoji} Join me for ${activityLabel} in ${plan.city} on ${dateStr}! Let's SHAKE up our social life together.`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `SHAKE - ${activityLabel} in ${plan.city}`,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error
        if ((err as Error).name !== "AbortError") {
          console.error("Error sharing:", err);
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        toast.success("Link copied to clipboard!");
      } catch (err) {
        console.error("Failed to copy:", err);
        toast.error("Failed to share");
      }
    }
  };

  // Show full-page PlanGroupChatView when a plan is selected
  if (selectedPlan && showChatView) {
    return (
      <PlanGroupChatView
        activity={{
          ...selectedPlan,
          note: selectedPlan.note,
          created_at: selectedPlan.scheduled_for,
          updated_at: selectedPlan.scheduled_for,
        }}
        onBack={handleBackFromChat}
      />
    );
  }

  // Show full-page GroupChatView when a carousel activity is selected
  if (selectedCarouselActivity && showCarouselChatView) {
    return (
      <GroupChatView
        activityType={selectedCarouselActivity.activity_type}
        city={selectedCarouselActivity.city}
        onBack={handleBackFromChat}
        attendeeCount={selectedCarouselActivity.participant_count || 1}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-lg font-display font-bold">Your Plans</h2>
        <div className="flex items-center gap-2">
          {/* City Filter */}
          {availableCities.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-2.5 py-1.5 bg-muted text-foreground rounded-full text-sm font-medium">
                  <Plane className="w-4 h-4" />
                  {cityFilter !== "all" && <span>{cityFilter}</span>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border z-50">
                <DropdownMenuItem 
                  onClick={() => setCityFilter("all")}
                  className={cityFilter === "all" ? "bg-primary/10" : ""}
                >
                  All cities
                </DropdownMenuItem>
                {availableCities.map((city) => (
                  <DropdownMenuItem 
                    key={city} 
                    onClick={() => setCityFilter(city)}
                    className={cityFilter === city ? "bg-primary/10" : ""}
                  >
                    {city}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-muted-foreground" />
            </div>
            {activities.length === 0 ? (
              <>
                <p className="text-muted-foreground">No plans yet</p>
                <button
                  onClick={handleCreatePlan}
                  className="mt-3 flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium text-white hover:opacity-90 transition-all"
                  style={{
                    background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Create
                </button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">No plans in {cityFilter}</p>
                <button
                  onClick={() => setCityFilter("all")}
                  className="mt-3 text-sm text-primary hover:underline"
                >
                  Show all cities
                </button>
              </>
            )}
          </div>
        ) : (
          filteredActivities.map((plan) => (
            <div
              key={plan.id}
              role="button"
              tabIndex={0}
              onClick={() => handlePlanClick(plan)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handlePlanClick(plan);
                }
              }}
              className="w-full text-left rounded-2xl p-4 space-y-3 hover:opacity-90 transition-all cursor-pointer"
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
                  {!plan.isCarouselJoin && (
                    <Avatar className="absolute -bottom-1 -right-1 w-6 h-6 border-2 border-white/50">
                      <AvatarImage src={plan.creator_avatar || undefined} alt={plan.creator_name} />
                      <AvatarFallback className="bg-white/80 text-muted-foreground text-xs font-semibold">
                        {plan.creator_name?.charAt(0)?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{getActivityLabel(plan.activity_type)}</h3>
                    {plan.isJoined && (
                      <span className="text-xs bg-green-500/30 text-green-300 px-1.5 py-0.5 rounded-full">
                        Joined
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-white/60" />
                    <span className="text-xs text-white/70">{plan.city}</span>
                    {!plan.isCarouselJoin && (
                      <span className="text-xs text-white/50">• by {plan.creator_name || "Anonymous"}</span>
                    )}
                  </div>

                  {plan.isCarouselJoin && (
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-white/70" />
                      <span className="text-sm text-white/70">
                        {format(new Date(plan.scheduled_for), "EEE, d MMM")}
                      </span>
                      {isToday(new Date(plan.scheduled_for)) && (
                        <span className="text-xs bg-shake-yellow text-black font-semibold px-2 py-0.5 rounded-full animate-pulse">
                          Today
                        </span>
                      )}
                      {isTomorrow(new Date(plan.scheduled_for)) && (
                        <span className="text-xs bg-primary/80 text-white font-semibold px-2 py-0.5 rounded-full">
                          Tomorrow
                        </span>
                      )}
                    </div>
                  )}

                  {/* Show note for user-created plans instead of date */}
                  {!plan.isCarouselJoin && plan.note && (
                    <p className="text-sm text-white/70 mt-1 italic">"{plan.note}"</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {/* Share button - available for all plans */}
                  <button
                    type="button"
                    onClick={(e) => handleSharePlan(plan, e)}
                    className="p-2.5 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all shadow-sm"
                    title="Share with friends"
                    aria-label="Share plan"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>

                  {/* Delete button for own plans */}
                  {plan.user_id === user?.id && !plan.isCarouselJoin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlanToDelete(plan);
                      }}
                      className="p-2.5 bg-white/20 hover:bg-destructive/80 text-white hover:text-white rounded-full transition-all shadow-sm"
                      title="Delete plan"
                      aria-label="Delete plan"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Show creator avatar + participant count if someone joined */}
              <div className="flex items-center gap-1.5 mt-2">
                <Avatar className="w-5 h-5 border border-white/30">
                  <AvatarImage src={plan.creator_avatar || undefined} alt={plan.creator_name} />
                  <AvatarFallback className="bg-white/20 text-white text-[10px] font-medium">
                    {plan.creator_name?.charAt(0)?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                {plan.participant_count > 0 && (
                  <span className="text-sm text-white/70">+{plan.participant_count} joined</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <PlansMapDialog 
        open={showMap} 
        onOpenChange={setShowMap} 
        city={selectedCity}
        mapOnlyMode={mapOnlyMode}
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
