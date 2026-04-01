import { useState, useEffect, useCallback } from "react";
import { Calendar, Users, Plus, Plane, Share2, Trash2, Music2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCity } from "@/contexts/CityContext";
import { useAuth } from "@/contexts/AuthContext";
import { CreateActivityDialog } from "../CreateActivityDialog";
import { CitySelector } from "@/components/CitySelector";
import { CityPickerModal } from "@/components/CityPickerModal";
import { PlanGroupChatView } from "./PlanGroupChatView";
import { GroupChatView } from "./GroupChatView";
import { format, isToday, isTomorrow } from "date-fns";
import { ALL_ACTIVITY_TYPES, ACTIVITY_TYPES, getActivityDay, getNextOccurrenceDate } from "@/data/activityTypes";
import { formatDateWithTranslation } from "@/lib/date-utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/app-toast";
import { LoadingSpinner } from "../LoadingSpinner";
import { ReportContentButton } from "@/components/ReportContentButton";
import { useReferralCode, getReferralLink } from "@/hooks/useReferralCode";
import { SwipeableCard } from "../SwipeableCard";
import { useTranslation } from "react-i18next";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { useActivityPayment } from "@/hooks/useActivityPayment";
import { ActivityDetailDialog } from "@/components/ActivityDetailDialog";
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
  price_amount?: string | null;
  creator_name?: string;
  creator_avatar?: string;
  participant_count?: number;
  isJoined?: boolean;
  isCarouselJoin?: boolean;
}

interface PlansTabProps {
  onChatViewChange?: (isInChat: boolean) => void;
  pendingPaidActivityId?: string | null;
  onPendingPaidActivityHandled?: () => void;
  onOpenEvents?: () => void;
}

export function PlansTab({ onChatViewChange, pendingPaidActivityId, onPendingPaidActivityHandled, onOpenEvents }: PlansTabProps = {}) {
  const { t, i18n } = useTranslation();
  const { selectedLanguage } = useLanguage();
  const { selectedCity, detectedCity, revertToDetectedLocation } = useCity();
  const { user } = useAuth();
  const { referralCode } = useReferralCode(user?.id);
  const { redirectToPayment, isLoading: paymentLoading } = useActivityPayment();
  const isMobile = useIsMobile();
  const [activities, setActivities] = useState<PlanActivity[]>([]);
  const [isCitySheetOpen, setIsCitySheetOpen] = useState(false);
  const [joinedPlansCityFilter, setJoinedPlansCityFilter] = useState<string | null>(null);
  const [cityAtPickerOpen, setCityAtPickerOpen] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all plans for the selected city (global CityContext)
  const fetchPlans = useCallback(async () => {
    // Only skip if there's no logged-in user — selectedCity being null is fine
    // (we still show the user's own joined plans and carousel joins from any city)
    if (!user) {
      setActivities([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const nowIso = new Date().toISOString();

    // --- 1. User's OWN carousel joins from ALL cities (always, regardless of selectedCity) ---
    const { data: myCarouselJoinsData } = await supabase
      .from("activity_joins")
      .select("activity_type, city, user_id")
      .eq("user_id", user.id)
      .is("activity_id", null)
      
    const userOwnCarouselJoins = myCarouselJoinsData || [];

    // --- 2. Public discovery: all active activities in the selected city ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cityActivities: any[] = [];
    if (selectedCity) {
      const { data: cityData, error: cityError } = await supabase
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
      cityActivities = cityData || [];
    }

    // --- 3. User's real plan joins (activity_id is not null) ---
    const { data: joins } = await supabase
      .from("activity_joins")
      .select("activity_id")
      .eq("user_id", user.id)
      .not("activity_id", "is", null)
      
    const joinedActivityIds = (joins || []).map(j => j.activity_id).filter(Boolean) as string[];

    // --- 4. City-wide carousel joins for participant-count enrichment (only if city is set) ---
    let allCarouselJoins: { activity_type: string; city: string; user_id: string }[] = [];
    if (selectedCity) {
      const { data: cityCarouselData } = await supabase
        .from("activity_joins")
        .select("activity_type, city, user_id")
        .eq("city", selectedCity)
        .is("activity_id", null)
        
      allCarouselJoins = cityCarouselData || [];
    }

    // --- Build carouselMap: seed with user's OWN joins first so they always appear ---
    const carouselMap = new Map<string, { activity_type: string; city: string; userIds: string[] }>();

    const addToCarouselMap = (join: { activity_type: string; city: string; user_id: string }) => {
      const key = `${join.activity_type}-${join.city}`;
      if (!carouselMap.has(key)) {
        carouselMap.set(key, { activity_type: join.activity_type, city: join.city, userIds: [] });
      }
      const entry = carouselMap.get(key)!;
      if (!entry.userIds.includes(join.user_id)) {
        entry.userIds.push(join.user_id);
      }
    };

    // User's own joins first (guarantees they appear even if city doesn't match selectedCity)
    userOwnCarouselJoins.forEach(addToCarouselMap);
    // Then city-wide joins for participant-count enrichment
    allCarouselJoins.forEach(addToCarouselMap);

    // Get joined activities — from any city (all cities mode) or filtered to explicit city
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let joinedActivities: any[] = [];
    if (joinedActivityIds.length > 0) {
      const { data: joinedData } = await supabase
        .from("user_activities")
        .select("*")
        .in("id", joinedActivityIds)
        .eq("is_active", true)
        .gte("scheduled_for", startOfToday.toISOString());

      // If user explicitly selected a filter city in Plans header, apply it.
      // Otherwise (default), include joined plans from all cities.
      joinedActivities = joinedPlansCityFilter
        ? (joinedData || []).filter((a: { city: string }) => a.city === joinedPlansCityFilter)
        : (joinedData || []);
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

    // Create virtual plans — only for carousel activities the current user has actually joined
    const userJoinedCarouselEntries = Array.from(carouselMap.values()).filter(
      (c) => c.userIds.includes(user.id)
    );

    const virtualPlans: PlanActivity[] = await Promise.all(
      userJoinedCarouselEntries.map(async (carouselActivity) => {
        // Use the user themselves as the "creator" display when they're the only participant
        const firstUserId = carouselActivity.userIds[0];
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, avatar_url")
          .eq("user_id", firstUserId)
          .maybeSingle();

        // Get the day for this activity type
        const dayLabel = getActivityDay(carouselActivity.activity_type);

        // Calculate the actual next occurrence date for this activity
        const nextOccurrence = getNextOccurrenceDate(carouselActivity.activity_type);

        return {
          id: `carousel-${carouselActivity.activity_type}-${carouselActivity.city}`,
          user_id: firstUserId,
          activity_type: carouselActivity.activity_type,
          city: carouselActivity.city,
          scheduled_for: nextOccurrence.toISOString(),
          is_active: true,
          note: dayLabel ? `This ${dayLabel}` : null,
          creator_name: profile?.name || "Anonymous",
          creator_avatar: profile?.avatar_url,
          participant_count: carouselActivity.userIds.length,
          isJoined: true, // always true — we only create entries for user's own joins
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
  }, [selectedCity, user, joinedPlansCityFilter]);

  // Initial fetch and realtime subscription
  useEffect(() => {
    fetchPlans();

    const channel = supabase
      .channel(`plans-tab-${selectedCity ?? "none"}`)
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
  }, [fetchPlans, selectedCity]);

  // Only treat city changes as explicit plans-filter choices when the header picker is open.
  useEffect(() => {
    if (!isCitySheetOpen) return;
    if (!selectedCity) return;
    if (cityAtPickerOpen && selectedCity === cityAtPickerOpen) return;
    setJoinedPlansCityFilter(selectedCity);
  }, [isCitySheetOpen, selectedCity, cityAtPickerOpen]);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanActivity | null>(null);
  const [showChatView, setShowChatView] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<PlanActivity | null>(null);
  const [selectedCarouselActivity, setSelectedCarouselActivity] = useState<PlanActivity | null>(null);
  const [showCarouselChatView, setShowCarouselChatView] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<{
    userId: string;
    userName: string | null;
    avatarUrl: string | null;
  } | null>(null);
  const [paidActivityDetail, setPaidActivityDetail] = useState<PlanActivity | null>(null);
  // Store the activity to restore when closing user profile opened from ActivityDetailDialog
  const [activityDetailToRestore, setActivityDetailToRestore] = useState<PlanActivity | null>(null);
  

  // Notify parent when entering/leaving chat view
  useEffect(() => {
    const isInChat = showChatView || showCarouselChatView;
    onChatViewChange?.(isInChat);
  }, [showChatView, showCarouselChatView, onChatViewChange]);

  // Handle pending paid activity (after payment success redirect)
  useEffect(() => {
    if (pendingPaidActivityId && activities.length > 0 && !isLoading) {
      // Find the activity in our list
      const paidActivity = activities.find(a => a.id === pendingPaidActivityId);
      if (paidActivity) {
        // Open the chat directly (user has paid and is now joined)
        setSelectedPlan(paidActivity);
        setShowChatView(true);
        onPendingPaidActivityHandled?.();
      } else {
        // Activity not in current city's list - fetch it directly
        const fetchAndOpenActivity = async () => {
          const { data: activity } = await supabase
            .from("user_activities")
            .select("*")
            .eq("id", pendingPaidActivityId)
            .eq("is_active", true)
            .maybeSingle();
          
          if (activity) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("name, avatar_url")
              .eq("user_id", activity.user_id)
              .maybeSingle();
            
            const { count } = await supabase
              .from("activity_joins")
              .select("*", { count: "exact", head: true })
              .eq("activity_id", activity.id);
            
            const activityWithDetails: PlanActivity = {
              ...activity,
              creator_name: profile?.name || "Anonymous",
              creator_avatar: profile?.avatar_url || undefined,
              participant_count: count || 0,
              isJoined: true, // User just paid, so they're joined
            };
            
            setSelectedPlan(activityWithDetails);
            setShowChatView(true);
          }
          onPendingPaidActivityHandled?.();
        };
        fetchAndOpenActivity();
      }
    }
  }, [pendingPaidActivityId, activities, isLoading, onPendingPaidActivityHandled]);

  const browsingDifferentFromDetected =
    !!detectedCity &&
    !!selectedCity &&
    selectedCity.toLowerCase() !== detectedCity.name.toLowerCase();

  const getActivityEmoji = (type: string) => {
    const activity = ALL_ACTIVITY_TYPES.find(a => a.id === type);
    return activity?.emoji || "📍";
  };

  const getActivityIcon = (type: string) => {
    const activity = ALL_ACTIVITY_TYPES.find(a => a.id === type);
    return activity?.icon;
  };

  // Map activity type to translation key
  const activityKeyMap: Record<string, string> = {
    lunch: "lunch",
    dinner: "dinner",
    drinks: "drinks",
    brunch: "brunch",
    hike: "hike",
    surf: "surf",
    run: "run",
    "co-working": "coWorking",
    basketball: "basketball",
    "tennis-padel": "tennisPadel",
    football: "football",
    shopping: "shopping",
    arts: "arts",
  };

  const getActivityLabel = (type: string) => {
    const key = activityKeyMap[type];
    if (key) {
      return t(`activities.${key}`, type);
    }
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

  const handlePlanClick = async (plan: PlanActivity) => {
    if (plan.isCarouselJoin) {
      setSelectedCarouselActivity(plan);
      setShowCarouselChatView(true);
      return;
    }
    
    // If it's a paid plan and user hasn't joined and is not the creator, show detail dialog
    if (plan.price_amount && !plan.isJoined && plan.user_id !== user?.id) {
      setPaidActivityDetail(plan);
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

  const openCityPicker = () => {
    setCityAtPickerOpen(selectedCity ?? null);
    setIsCitySheetOpen(true);
  };

  const clearJoinedPlansCityFilter = () => {
    setJoinedPlansCityFilter(null);
    setIsCitySheetOpen(false);
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
    const dateStr = formatDateWithTranslation(new Date(plan.scheduled_for), "EEE, d MMM", selectedLanguage.code);
    
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
      <div className="flex flex-col px-4 py-3 border-b border-border gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold">{t('plans.myPlans')}</h2>
          <div className="flex items-center gap-2">
            {/* Events + city (same picker as Home — CityContext) */}
            <button
              type="button"
              onClick={() => onOpenEvents?.()}
              className="flex items-center justify-center px-2.5 py-1.5 rounded-full text-sm font-medium transition-all bg-muted text-foreground"
            >
              <Music2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={openCityPicker}
              className={`flex items-center gap-1 max-w-[min(50vw,200px)] px-2.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                browsingDifferentFromDetected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              <Plane className="w-4 h-4 shrink-0" />
              <span className="truncate">{joinedPlansCityFilter || t("plans.allCities", "All cities")}</span>
            </button>
            {joinedPlansCityFilter && (
              <button
                type="button"
                onClick={clearJoinedPlansCityFilter}
                className="flex items-center justify-center px-2.5 py-1.5 rounded-full text-sm font-medium transition-all bg-muted text-foreground"
              >
                {t("plans.clearCityFilter", "All cities")}
              </button>
            )}
            <button
              onClick={handleCreatePlan}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium text-white hover:opacity-90 transition-all"
              style={{
                background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
              }}
            >
              <Plus className="w-4 h-4" />
              {t('common.create')}
            </button>
          </div>
        </div>

      </div>

      <CityPickerModal
        open={isCitySheetOpen}
        onOpenChange={setIsCitySheetOpen}
        title={t("plans.chooseYourCity", "Choose your city")}
      >
        <button
          type="button"
          onClick={clearJoinedPlansCityFilter}
          className="w-full mb-3 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
        >
          {t("plans.allCities", "All cities")}
        </button>
        <CitySelector
          variant="picker"
          autoFocusSearch={isCitySheetOpen}
          onPickerClose={() => setIsCitySheetOpen(false)}
        />
      </CityPickerModal>

      {/* Plans List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <LoadingSpinner size="lg" />
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <span
                className="inline-flex items-center justify-center w-8 h-8 text-muted-foreground text-2xl leading-none"
                aria-hidden
              >
                🚧
              </span>
            </div>
            <p className="text-muted-foreground">
              {joinedPlansCityFilter
                ? t("plans.noPlansInCity", { city: joinedPlansCityFilter })
                : t("plans.noPlansAllCities", "No joined plans found in any city")}
            </p>
            {browsingDifferentFromDetected && (
              <button
                type="button"
                onClick={() => revertToDetectedLocation()}
                className="mt-3 text-sm text-primary hover:underline"
              >
                {t("plans.resetToMyCity")}
              </button>
            )}
            <button
              onClick={handleCreatePlan}
              className="mt-3 flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium text-white hover:opacity-90 transition-all"
              style={{
                background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
              }}
            >
              <Plus className="w-4 h-4" />
              {t('plans.createOne')}
            </button>
          </div>
        ) : (
          activities.map((plan) => (
            <SwipeableCard
              key={plan.id}
              canDelete={plan.user_id === user?.id && !plan.isCarouselJoin}
              onDelete={() => setPlanToDelete(plan)}
              onClick={() => handlePlanClick(plan)}
              className="w-full text-left p-4 space-y-3 hover:opacity-90 cursor-pointer"
              style={{
                background: "linear-gradient(to right, rgba(88, 28, 135, 0.6), rgba(67, 56, 202, 0.5))",
              }}
            >
              <div className="flex items-start gap-3">
                {/* Profile Picture or Activity Emoji */}
                <div className="relative">
                  {plan.isCarouselJoin ? (
                    <div className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center overflow-hidden">
                      {getActivityIcon(plan.activity_type) ? (
                        <img src={getActivityIcon(plan.activity_type)} alt={plan.activity_type} className="w-9 h-9 object-contain mix-blend-multiply" />
                      ) : (
                        <span className="text-2xl">{getActivityEmoji(plan.activity_type)}</span>
                      )}
                    </div>
                  ) : (
                    <Avatar className="w-12 h-12 border-2 border-white/50 shadow-md">
                      <AvatarImage src={plan.creator_avatar || undefined} alt={plan.creator_name} />
                      <AvatarFallback className="bg-white text-muted-foreground text-lg font-semibold">
                        {plan.creator_name?.charAt(0)?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-white">
                      {plan.isCarouselJoin ? getActivityLabel(plan.activity_type) : (plan.note || t('plans.untitledPlan', 'Untitled Plan'))}
                    </h3>
                    {plan.isJoined && (
                      <span className="text-xs bg-green-500/30 text-green-300 px-1.5 py-0.5 rounded-full">
                        {t('common.joined')}
                      </span>
                    )}
                    {/* Price badge for paid activities */}
                    {plan.price_amount && !plan.isCarouselJoin && (
                      <span className="text-xs bg-green-500/80 text-white font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                        {plan.price_amount}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="inline-flex items-center justify-center w-3 h-3 text-white/60">📍</span>
                    <span className="text-xs text-white/70">{plan.city}</span>
                    {!plan.isCarouselJoin && (
                      <span className="text-xs text-white/50">
                        • {t('common.by')}{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUserProfile({
                              userId: plan.user_id,
                              userName: plan.creator_name || null,
                              avatarUrl: plan.creator_avatar || null,
                            });
                          }}
                          className="underline hover:text-white/80 transition-colors"
                        >
                          {plan.creator_name || "Anonymous"}
                        </button>
                      </span>
                    )}
                  </div>

                  {plan.isCarouselJoin && (
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-white/70" />
                      <span className="text-sm text-white/70">
                        {formatDateWithTranslation(new Date(plan.scheduled_for), "EEE, d MMM", selectedLanguage.code)}
                      </span>
                      {isToday(new Date(plan.scheduled_for)) && (
                        <span className="text-xs bg-shake-yellow text-black font-semibold px-2 py-0.5 rounded-full animate-pulse">
                          {t('common.today')}
                        </span>
                      )}
                      {isTomorrow(new Date(plan.scheduled_for)) && (
                        <span className="text-xs bg-primary/80 text-white font-semibold px-2 py-0.5 rounded-full">
                          {t('common.tomorrow')}
                        </span>
                      )}
                    </div>
                  )}

                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {/* Delete button - desktop only, for owner's plans */}
                  {!isMobile && plan.user_id === user?.id && !plan.isCarouselJoin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlanToDelete(plan);
                      }}
                      className="p-2.5 bg-destructive/80 hover:bg-destructive text-white rounded-full transition-all shadow-sm"
                      title="Delete plan"
                      aria-label="Delete plan"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  {/* Report button (only for non-owners) */}
                  {user && plan.user_id !== user.id && (
                    <ReportContentButton contentId={plan.id} contentType="post" iconOnly />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSharePlan(plan, e);
                    }}
                    className="p-2.5 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all shadow-sm"
                    title="Share with friends"
                    aria-label="Share plan"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Show participant count if someone joined */}
              {plan.participant_count > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-sm text-white/70">+{plan.participant_count} {t('common.joined').toLowerCase()}</span>
                </div>
              )}
            </SwipeableCard>
          ))
        )}
      </div>


      <CreateActivityDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        city={selectedCity ?? ""}
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

      {/* User Profile Dialog */}
      {selectedUserProfile && (
        <UserProfileDialog
          open={!!selectedUserProfile}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedUserProfile(null);
              // Restore ActivityDetailDialog if it was open before
              if (activityDetailToRestore) {
                setPaidActivityDetail(activityDetailToRestore);
                setActivityDetailToRestore(null);
              }
            }
          }}
          userId={selectedUserProfile.userId}
          userName={selectedUserProfile.userName}
          avatarUrl={selectedUserProfile.avatarUrl}
        />
      )}

      {/* Paid Activity Detail Dialog */}
      {paidActivityDetail && (
        <ActivityDetailDialog
          open={!!paidActivityDetail}
          onOpenChange={(open) => !open && setPaidActivityDetail(null)}
          activity={paidActivityDetail}
          onCreatorClick={() => {
            // Store activity to restore when profile is closed
            setActivityDetailToRestore(paidActivityDetail);
            setPaidActivityDetail(null);
            setSelectedUserProfile({
              userId: paidActivityDetail.user_id,
              userName: paidActivityDetail.creator_name || null,
              avatarUrl: paidActivityDetail.creator_avatar || null,
            });
          }}
        />
      )}
    </div>
  );
}
