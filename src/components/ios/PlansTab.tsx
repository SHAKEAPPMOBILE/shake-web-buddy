import { useState, useEffect, useCallback } from "react";
import confetti from 'canvas-confetti';
import barManAndCook from "@/assets/bar-man-and-cook.png";
import { Calendar, Users, Plus, Plane, Send, Trash2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCity } from "@/contexts/CityContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { CitySelector } from "@/components/CitySelector";
import { CityPickerModal } from "@/components/CityPickerModal";
import { PlanGroupChatView } from "./PlanGroupChatView";
import { GroupChatView } from "./GroupChatView";
import { format, isToday, isTomorrow } from "date-fns";
import { ALL_ACTIVITY_TYPES, ACTIVITY_TYPES, getActivityDay, getNextOccurrenceDate } from "@/data/activityTypes";
import { formatDateWithTranslation } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
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
import { useSettlingGradient } from "@/hooks/useSettlingGradient";
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
  scheduled_for: string | null;
  created_at?: string;
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
  const { style: plansSettlingGradientStyle } = useSettlingGradient("plans");
  const { selectedLanguage } = useLanguage();
  const { selectedCity, detectedCity, revertToDetectedLocation } = useCity();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { referralCode } = useReferralCode(user?.id);
  const { redirectToPayment, isLoading: paymentLoading } = useActivityPayment();
  const isMobile = useIsMobile();
  const [activities, setActivities] = useState<PlanActivity[]>([]);
  const [cityPlans, setCityPlans] = useState<PlanActivity[]>([]);
  const [isCitySheetOpen, setIsCitySheetOpen] = useState(false);
  const [joinedPlansCityFilter, setJoinedPlansCityFilter] = useState<string | null>(null);
  const [cityAtPickerOpen, setCityAtPickerOpen] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // "My City" (false) is the default; "All Cities" (true) is opt-in
  const [showAllCities, setShowAllCities] = useState(false);

  // Fetch all plans for the selected city (global CityContext)
  const fetchPlans = useCallback(async () => {
    if (!user) {
      setActivities([]);
      setCityPlans([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const effectiveCity = selectedCity || detectedCity?.name || null;

    // Safety timeout: stop the spinner after 5 s and show whatever is already rendered
    const loadingTimeout = setTimeout(() => setIsLoading(false), 5000);

    try {
      // --- Expiry helpers ---
      // Rule 1: scheduled_for is set → expire at midnight of that day.
      // Rule 2: scheduled_for is null → expire 5 days after created_at.
      const nowMs = Date.now();
      const nowDate = new Date(nowMs);
      const todayMidnightUTC = new Date(Date.UTC(
        nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate()
      ));
      const fiveDaysAgo = new Date(nowMs - 5 * 24 * 60 * 60 * 1000);

      const isActivityVisible = (a: { scheduled_for: string | null; created_at: string }) =>
        a.scheduled_for !== null
          ? new Date(a.scheduled_for) >= todayMidnightUTC
          : new Date(a.created_at) >= fiveDaysAgo;

      // --- Phase 1: Run all four metadata queries in parallel ---
      const [
        myCarouselJoinsResult,
        joinsResult,
        myCreatedResult,
        cityCarouselResult,
      ] = await Promise.all([
        // 1. User's own carousel joins (all cities)
        supabase
          .from("activity_joins")
          .select("activity_type, city, user_id")
          .eq("user_id", user.id)
          .is("activity_id", null),
        // 2. User's real plan joins (activity_id not null)
        supabase
          .from("activity_joins")
          .select("activity_id")
          .eq("user_id", user.id)
          .not("activity_id", "is", null),
        // 3. User's own created plans (for creator-always-sees fallback)
        supabase
          .from("user_activities")
          .select("id, scheduled_for, created_at")
          .eq("user_id", user.id)
          .limit(50),
        // 4. City-wide carousel joins for participant counts (skip if no city)
        effectiveCity
          ? supabase
              .from("activity_joins")
              .select("activity_type, city, user_id")
              .eq("city", effectiveCity)
              .is("activity_id", null)
          : Promise.resolve({ data: [] as { activity_type: string; city: string; user_id: string }[], error: null }),
      ]);

      const userOwnCarouselJoins = myCarouselJoinsResult.data || [];
      const joinedActivityIds = (joinsResult.data || [])
        .map(j => j.activity_id)
        .filter(Boolean) as string[];
      const myCreatedIds = (myCreatedResult.data || [])
        .filter(a => isActivityVisible(a as { scheduled_for: string | null; created_at: string }))
        .map(a => a.id as string);
      const allJoinedIds = [...new Set([...joinedActivityIds, ...myCreatedIds])];
      const allCarouselJoins = (cityCarouselResult.data || []) as { activity_type: string; city: string; user_id: string }[];

      // Build carousel map (user's own joins seeded first so they always appear)
      const carouselMap = new Map<string, { activity_type: string; city: string; userIds: string[] }>();
      const addToCarouselMap = (join: { activity_type: string; city: string; user_id: string }) => {
        const key = `${join.activity_type}-${join.city}`;
        if (!carouselMap.has(key)) carouselMap.set(key, { activity_type: join.activity_type, city: join.city, userIds: [] });
        const entry = carouselMap.get(key)!;
        if (!entry.userIds.includes(join.user_id)) entry.userIds.push(join.user_id);
      };
      userOwnCarouselJoins.forEach(addToCarouselMap);
      allCarouselJoins.forEach(addToCarouselMap);

      // --- Phase 2: Fetch joined activities and city plans in parallel ---
      const [joinedDataResult, cityPlansDataResult] = await Promise.all([
        allJoinedIds.length > 0
          ? supabase
              .from("user_activities")
              .select("*")
              .in("id", allJoinedIds)
              .limit(20)
          : Promise.resolve({ data: [] as any[], error: null }),
        showAllCities
          ? supabase
              .from("user_activities")
              .select("*")
              .eq("is_active", true)
              .neq("user_id", user.id)
              .order("scheduled_for", { ascending: true, nullsFirst: false })
              .limit(50)
          : effectiveCity
            ? supabase
                .from("user_activities")
                .select("*")
                .eq("city", effectiveCity)
                .eq("is_active", true)
                .neq("user_id", user.id)
                .order("scheduled_for", { ascending: true, nullsFirst: false })
                .limit(20)
            : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      // Filter joined activities with smart expiry + optional city filter
      const visibleJoined = (joinedDataResult.data || []).filter(
        (a: { scheduled_for: string | null; created_at: string }) => isActivityVisible(a)
      );
      const joinedActivities: any[] = joinedPlansCityFilter
        ? visibleJoined.filter((a: { city: string }) => a.city === joinedPlansCityFilter)
        : visibleJoined;

      // Filter city plans with smart expiry + exclude already-joined
      const cityPublicPlans: any[] = (cityPlansDataResult.data || [])
        .filter((a: { id: string }) => !allJoinedIds.includes(a.id))
        .filter((a: { scheduled_for: string | null; created_at: string }) => isActivityVisible(a));

      const allActivitiesMap = new Map<string, any>();
      joinedActivities.forEach((a: any) => allActivitiesMap.set(a.id, a));
      const allActivities = Array.from(allActivitiesMap.values());

      // --- Phase 3: Show plan cards immediately without avatars (stops the spinner early) ---
      const userJoinedCarouselEntries = Array.from(carouselMap.values()).filter(c => c.userIds.includes(user.id));

      if (allActivities.length > 0) {
        const quickPlans = allActivities.map((a: any) => ({
          ...a,
          creator_name: "...",
          creator_avatar: undefined as string | undefined,
          participant_count: 0,
          isJoined: allJoinedIds.includes(a.id),
        }));
        setActivities(quickPlans);
        clearTimeout(loadingTimeout);
        setIsLoading(false);
      }

      // --- Phase 4: Enrich everything with profiles + counts in parallel ---
      const sortByDate = (arr: PlanActivity[]) =>
        arr.sort((a, b) => {
          const da = a.scheduled_for ? new Date(a.scheduled_for) : new Date((a as any).created_at || 0);
          const db = b.scheduled_for ? new Date(b.scheduled_for) : new Date((b as any).created_at || 0);
          if (isToday(da) && !isToday(db)) return -1;
          if (!isToday(da) && isToday(db)) return 1;
          if (isTomorrow(da) && !isTomorrow(db)) return -1;
          if (!isTomorrow(da) && isTomorrow(db)) return 1;
          return da.getTime() - db.getTime();
        });

      const [activitiesWithDetails, cityPlansWithDetails, virtualPlans] = await Promise.all([
        // Enrich joined/owned plans — profile + count fetched in parallel per activity
        Promise.all(
          allActivities.map(async (activity: any) => {
            const [{ data: profile }, { count }] = await Promise.all([
              supabase.from("profiles").select("name, avatar_url").eq("user_id", activity.user_id).maybeSingle(),
              supabase.from("activity_joins").select("*", { count: "exact", head: true }).eq("activity_id", activity.id),
            ]);
            return {
              ...activity,
              creator_name: profile?.name || "Anonymous",
              creator_avatar: profile?.avatar_url,
              participant_count: count || 0,
              isJoined: allJoinedIds.includes(activity.id),
            };
          })
        ),
        // Enrich city discovery plans
        Promise.all(
          cityPublicPlans.map(async (activity: any) => {
            const [{ data: profile }, { count }] = await Promise.all([
              supabase.from("profiles").select("name, avatar_url").eq("user_id", activity.user_id).maybeSingle(),
              supabase.from("activity_joins").select("*", { count: "exact", head: true }).eq("activity_id", activity.id),
            ]);
            return {
              ...activity,
              creator_name: profile?.name || "Anonymous",
              creator_avatar: profile?.avatar_url,
              participant_count: count || 0,
              isJoined: false,
            } as PlanActivity;
          })
        ),
        // Build virtual carousel plans
        Promise.all(
          userJoinedCarouselEntries.map(async (carouselActivity) => {
            const firstUserId = carouselActivity.userIds[0];
            const { data: profile } = await supabase
              .from("profiles").select("name, avatar_url").eq("user_id", firstUserId).maybeSingle();
            const dayLabel = getActivityDay(carouselActivity.activity_type);
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
              isJoined: true,
              isCarouselJoin: true,
            } as PlanActivity;
          })
        ),
      ]);

      setActivities(sortByDate([...activitiesWithDetails, ...virtualPlans]));
      setCityPlans(sortByDate(cityPlansWithDetails));
    } finally {
      clearTimeout(loadingTimeout);
      setIsLoading(false);
    }
  }, [selectedCity, detectedCity, user, joinedPlansCityFilter, showAllCities]);

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
  
  const [selectedPlan, setSelectedPlan] = useState<PlanActivity | null>(null);
  const [showChatView, setShowChatView] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<PlanActivity | null>(null);
  const [planToLeave, setPlanToLeave] = useState<PlanActivity | null>(null);
  const [duplicateActivityBlock, setDuplicateActivityBlock] = useState<{
    activityType: string;
    oldCity: string;
    newCity: string;
  } | null>(null);
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
  // Plan preview before joining (city discovery plans)
  const [planPreview, setPlanPreview] = useState<PlanActivity | null>(null);
  const [planPreviewAttendees, setPlanPreviewAttendees] = useState<{ avatar_url: string | null; name: string | null }[]>([]);
  

  // Notify parent when entering/leaving chat view
  useEffect(() => {
    const isInChat = showChatView || showCarouselChatView;
    onChatViewChange?.(isInChat);
  }, [showChatView, showCarouselChatView, onChatViewChange]);

  // Fetch attendee profiles when plan preview opens
  useEffect(() => {
    if (!planPreview) {
      setPlanPreviewAttendees([]);
      return;
    }
    const fetchAttendees = async () => {
      const { data: joins } = await supabase
        .from("activity_joins")
        .select("user_id")
        .eq("activity_id", planPreview.id)
        .limit(4);
      if (!joins?.length) {
        setPlanPreviewAttendees([]);
        return;
      }
      const profiles = await Promise.all(
        joins.map(async (join) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, avatar_url")
            .eq("user_id", join.user_id)
            .maybeSingle();
          return { name: profile?.name ?? null, avatar_url: profile?.avatar_url ?? null };
        })
      );
      setPlanPreviewAttendees(profiles);
    };
    fetchAttendees();
  }, [planPreview?.id]);

  // Handle pending paid activity (after payment success redirect)
  useEffect(() => {
    if (pendingPaidActivityId && activities.length > 0 && !isLoading) {
      // Find the activity in our list
      const paidActivity = activities.find(a => a.id === pendingPaidActivityId);
      if (paidActivity) {
        // Open the chat directly (user has paid and is now joined)
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#FFD700', '#FF69B4'],
        });
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
            
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#FFD700', '#FF69B4'],
            });
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

  const isSoon = (scheduledFor: string | null): boolean => {
    if (!scheduledFor) return false;
    const diff = new Date(scheduledFor).getTime() - Date.now();
    return diff > 0 && diff <= 3 * 60 * 60 * 1000;
  };

  const getActivityEmoji = (type: string) => {
    const activity = ALL_ACTIVITY_TYPES.find(a => a.id === type);
    return activity?.emoji || "📍";
  };

  const getActivityIcon = (type: string) => {
    const activity = ALL_ACTIVITY_TYPES.find(a => a.id === type);
    return activity?.icon || null;
  };

  // Map activity type to translation key
  const activityKeyMap: Record<string, string> = {
    dinner: "dinner",
    drinks: "drinks",
    brunch: "brunch",
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
    navigate("/propose-plan");
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

  const handleLeavePlan = async () => {
    if (!planToLeave || !user) return;
    try {
      const { error } = await supabase
        .from("activity_joins")
        .delete()
        .eq("activity_id", planToLeave.id)
        .eq("user_id", user.id);
      if (error) throw error;
      setActivities(prev => prev.filter(a => a.id !== planToLeave.id));
      setPlanToLeave(null);
      toast.success("Left activity");
    } catch (err) {
      console.error("Error leaving plan:", err);
      toast.error("Failed to leave");
    }
  };

  // Returns an existing joined activity of the same type in a different city, or null.
  const getConflictingActivity = (activityType: string, targetCity: string): PlanActivity | null => {
    return activities.find(
      a => a.activity_type === activityType && a.city.toLowerCase() !== targetCity.toLowerCase()
    ) ?? null;
  };

  const handleSharePlan = async (plan: PlanActivity, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const activityLabel = getActivityLabel(plan.activity_type);
    const activityEmoji = getActivityEmoji(plan.activity_type);
    const dateStr = plan.scheduled_for
      ? formatDateWithTranslation(new Date(plan.scheduled_for), "EEE, d MMM", selectedLanguage.code)
      : formatDateWithTranslation(new Date(), "EEE, d MMM", selectedLanguage.code);
    
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

  const MAX_CHAT_CAPACITY = 7;

  // Find a group with open capacity, or create a new one if all full.
  const findOrCreateOpenGroup = async (plan: PlanActivity): Promise<PlanActivity> => {
    if (!user) return plan;

    const { count } = await supabase
      .from("activity_joins")
      .select("*", { count: "exact", head: true })
      .eq("activity_id", plan.id);

    if ((count ?? 0) < MAX_CHAT_CAPACITY) return plan;

    // This group is full — look for a sibling with the same type + city + scheduled_for
    const { data: siblings } = await supabase
      .from("user_activities")
      .select("*")
      .eq("activity_type", plan.activity_type)
      .eq("city", plan.city)
      .eq("scheduled_for", plan.scheduled_for)
      .eq("is_active", true)
      .neq("id", plan.id);

    for (const sibling of (siblings ?? [])) {
      const { count: sibCount } = await supabase
        .from("activity_joins")
        .select("*", { count: "exact", head: true })
        .eq("activity_id", sibling.id);

      if ((sibCount ?? 0) < MAX_CHAT_CAPACITY) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, avatar_url")
          .eq("user_id", sibling.user_id)
          .maybeSingle();
        toast.info("This group is full · joining another group");
        return {
          ...sibling,
          creator_name: profile?.name ?? "Anonymous",
          creator_avatar: profile?.avatar_url ?? undefined,
          participant_count: sibCount ?? 0,
          isJoined: false,
        };
      }
    }

    // No sibling with space — create a fresh group
    const { data: newActivity, error: createError } = await supabase
      .from("user_activities")
      .insert({
        user_id: user.id,
        activity_type: plan.activity_type,
        city: plan.city,
        scheduled_for: plan.scheduled_for,
        is_active: true,
        note: plan.note ?? null,
      })
      .select()
      .single();

    if (createError || !newActivity) {
      console.error("[Capacity] Failed to create new group:", createError);
      toast.error("Group is full — couldn't start a new one");
      return plan;
    }

    toast.info("This group is full · a new group has been created for you!");
    return {
      ...newActivity,
      creator_name: "New Group",
      creator_avatar: undefined,
      participant_count: 0,
      isJoined: false,
    };
  };

  const handleJoinPlan = async (plan: PlanActivity, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const targetPlan = await findOrCreateOpenGroup(plan);

    const conflict = getConflictingActivity(targetPlan.activity_type, targetPlan.city);
    if (conflict) {
      setDuplicateActivityBlock({ activityType: targetPlan.activity_type, oldCity: conflict.city, newCity: targetPlan.city });
      return;
    }

    const { error } = await supabase
      .from("activity_joins")
      .insert({
        user_id: user.id,
        activity_id: targetPlan.id,
        activity_type: targetPlan.activity_type,
        city: targetPlan.city,
      });

    if (error) {
      console.error("Error joining plan:", error);
      toast.error("Failed to join plan");
      return;
    }

    // Notify creator (fire-and-forget)
    if (targetPlan.user_id && targetPlan.user_id !== user.id) {
      void (async () => {
        const { data: joinerProfile } = await supabase.from("profiles").select("name").eq("user_id", user.id).maybeSingle();
        const joinerName = joinerProfile?.name || "Someone";
        await supabase.functions.invoke("send-push-notification", {
          body: {
            to_user_id: targetPlan.user_id,
            title: "New shaker joined! 🎉",
            body: `${joinerName} just joined ${getActivityLabel(targetPlan.activity_type)} in ${targetPlan.city}`,
          },
        });
      })();
    }

    setActivities(prev => {
      const existing = prev.find(a => a.id === targetPlan.id);
      if (existing) {
        return prev.map(a => a.id === targetPlan.id
          ? { ...a, isJoined: true, participant_count: (a.participant_count || 0) + 1 }
          : a);
      }
      return [{ ...targetPlan, isJoined: true, participant_count: (targetPlan.participant_count || 0) + 1 }, ...prev];
    });
    setCityPlans(prev => prev.filter(p => p.id !== targetPlan.id));

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#FFD700', '#FF69B4'],
    });
    toast.success("Joined!");
    fetchPlans();
  };

  // Carousel activity types join directly; user-created plan types (general, etc.) show preview first
  const CAROUSEL_ACTIVITY_TYPES = new Set(['dinner', 'drinks', 'brunch']);

  const handleCityPlanClick = (plan: PlanActivity) => {
    if (!user) return;
    // Paid plan → show payment/detail dialog
    if (plan.price_amount) {
      setPaidActivityDetail(plan);
      return;
    }
    // Standard carousel types (dinner, drinks, brunch) → join directly without preview
    // User-created plans (general or any non-carousel type) → show preview modal first
    if (CAROUSEL_ACTIVITY_TYPES.has(plan.activity_type)) {
      handleDirectCityJoin(plan);
    } else {
      setPlanPreview(plan);
    }
  };

  const handleDirectCityJoin = async (plan: PlanActivity) => {
    if (!user) return;

    const targetPlan = await findOrCreateOpenGroup(plan);

    const conflict = getConflictingActivity(targetPlan.activity_type, targetPlan.city);
    if (conflict) {
      setDuplicateActivityBlock({ activityType: targetPlan.activity_type, oldCity: conflict.city, newCity: targetPlan.city });
      return;
    }

    const { error } = await supabase
      .from("activity_joins")
      .insert({
        user_id: user.id,
        activity_id: targetPlan.id,
        activity_type: targetPlan.activity_type,
        city: targetPlan.city,
      });

    if (error) {
      console.error("Error joining plan:", error);
      toast.error("Failed to join plan");
      return;
    }

    // Notify creator (fire-and-forget)
    if (targetPlan.user_id && targetPlan.user_id !== user.id) {
      void (async () => {
        const { data: joinerProfile } = await supabase.from("profiles").select("name").eq("user_id", user.id).maybeSingle();
        const joinerName = joinerProfile?.name || "Someone";
        await supabase.functions.invoke("send-push-notification", {
          body: {
            to_user_id: targetPlan.user_id,
            title: "New shaker joined! 🎉",
            body: `${joinerName} just joined ${getActivityLabel(targetPlan.activity_type)} in ${targetPlan.city}`,
          },
        });
      })();
    }

    const joinedPlan = { ...targetPlan, isJoined: true };
    setActivities(prev => prev.find(a => a.id === targetPlan.id) ? prev : [joinedPlan, ...prev]);
    setCityPlans(prev => prev.filter(p => p.id !== targetPlan.id));

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#FFD700', '#FF69B4'],
    });

    setSelectedPlan(joinedPlan);
    setShowChatView(true);
  };

  const handleConfirmJoinPreview = async () => {
    if (!planPreview || !user) return;
    const plan = planPreview;
    setPlanPreview(null);

    const targetPlan = await findOrCreateOpenGroup(plan);

    const conflict = getConflictingActivity(targetPlan.activity_type, targetPlan.city);
    if (conflict) {
      setDuplicateActivityBlock({ activityType: targetPlan.activity_type, oldCity: conflict.city, newCity: targetPlan.city });
      return;
    }

    const { error } = await supabase
      .from("activity_joins")
      .insert({
        user_id: user.id,
        activity_id: targetPlan.id,
        activity_type: targetPlan.activity_type,
        city: targetPlan.city,
      });

    if (error) {
      console.error("Error joining plan:", error);
      toast.error("Failed to join plan");
      return;
    }

    // Notify creator (fire-and-forget)
    if (targetPlan.user_id && targetPlan.user_id !== user.id) {
      void (async () => {
        const { data: joinerProfile } = await supabase.from("profiles").select("name").eq("user_id", user.id).maybeSingle();
        const joinerName = joinerProfile?.name || "Someone";
        await supabase.functions.invoke("send-push-notification", {
          body: {
            to_user_id: targetPlan.user_id,
            title: "New shaker joined! 🎉",
            body: `${joinerName} just joined ${getActivityLabel(targetPlan.activity_type)} in ${targetPlan.city}`,
          },
        });
      })();
    }

    const joinedPlan = { ...targetPlan, isJoined: true };
    setActivities(prev => prev.find(a => a.id === targetPlan.id) ? prev : [joinedPlan, ...prev]);
    setCityPlans(prev => prev.filter(p => p.id !== targetPlan.id));

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#FFD700', '#FF69B4'],
    });

    setSelectedPlan(joinedPlan);
    setShowChatView(true);
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
        eventDate={selectedCarouselActivity.scheduled_for}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-white">
      {/* Header */}
      <div className="flex flex-col px-4 py-3 border-b border-neutral-200 bg-white dark:bg-white dark:border-neutral-200 gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-gray-900 dark:text-gray-900">{t('plans.myPlans')}</h2>
          <div className="flex items-center gap-2">
            {/* City picker then Events */}
            <button
              type="button"
              onClick={openCityPicker}
              className="flex items-center gap-1 max-w-[min(50vw,200px)] px-2.5 py-1.5 rounded-full text-sm font-medium transition-all bg-primary text-primary-foreground"
            >
              <Plane className="w-4 h-4 shrink-0" />
              <span className="truncate">{joinedPlansCityFilter || t("plans.allCities", "All cities")}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenEvents?.()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-sm font-medium transition-all bg-primary text-primary-foreground"
            >
              <span>⚡️</span>
              <span>{t('plans.events', 'Events')}</span>
            </button>
            {joinedPlansCityFilter && (
              <button
                type="button"
                onClick={clearJoinedPlansCityFilter}
                className="flex items-center justify-center px-2.5 py-1.5 rounded-full text-sm font-medium transition-all bg-muted dark:bg-gray-100 text-foreground dark:text-gray-800"
              >
                {t("plans.clearCityFilter", "All cities")}
              </button>
            )}
            <button
              onClick={handleCreatePlan}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium text-white hover:opacity-90 transition-all"
              style={plansSettlingGradientStyle}
            >
              <Plus className="w-4 h-4" />
              {t('common.create')}
            </button>
          </div>
        </div>

        {/* My City / All Cities filter chips */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAllCities(false)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold transition-all border",
              !showAllCities
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-gray-500 border-gray-200 hover:border-gray-400"
            )}
          >
            My City
          </button>
          <button
            type="button"
            onClick={() => setShowAllCities(true)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold transition-all border",
              showAllCities
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-gray-500 border-gray-200 hover:border-gray-400"
            )}
          >
            🌍 All Cities
          </button>
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
          className="w-full mb-3 rounded-xl px-3 py-2 text-left text-sm text-white font-medium transition-colors hover:opacity-90"
          style={plansSettlingGradientStyle}
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
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 space-y-3 bg-white dark:bg-white min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <LoadingSpinner size="lg" />
          </div>
        ) : activities.length === 0 && cityPlans.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <p className="text-base font-medium text-gray-700 mb-1">
              No plans yet — be the first to shake in your city! 🌎
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
          </div>
        ) : (
          <>
            {/* Joined / own plans */}
            {activities.map((plan) => (
              <SwipeableCard
                key={plan.id}
                canDelete={plan.user_id === user?.id && !plan.isCarouselJoin}
                onDelete={() => setPlanToDelete(plan)}
                canLeave={plan.user_id !== user?.id && !!plan.isJoined && !plan.isCarouselJoin}
                onLeave={() => setPlanToLeave(plan)}
                onClick={() => handlePlanClick(plan)}
                className="w-full text-left p-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-50 dark:border-gray-200 dark:hover:bg-gray-100 cursor-pointer transition-colors"
                style={{}}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 shrink-0">
                    {plan.creator_avatar ? (
                      <img src={plan.creator_avatar} alt={plan.creator_name || "Creator"} className="w-full h-full object-cover" />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full text-base font-bold text-gray-500">
                        {plan.creator_name?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">
                        {plan.isCarouselJoin ? getActivityLabel(plan.activity_type) : (plan.note || t('plans.untitledPlan', 'Untitled Plan'))}
                      </h3>
                      {plan.isJoined && (
                        <span className="text-xs bg-green-50 text-green-600 border border-green-200 px-1.5 py-0.5 rounded-full">
                          {t('common.joined')} ✓
                        </span>
                      )}
                      {isSoon(plan.scheduled_for) && (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                          🔴 Soon
                        </span>
                      )}
                      {/* Price badge for paid activities */}
                      {plan.price_amount && !plan.isCarouselJoin && (
                        <span className="text-xs bg-green-50 text-green-700 border border-green-200 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                          {plan.price_amount}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-gray-600">{plan.city}</span>
                      {!plan.isCarouselJoin && (
                        <span className="text-xs text-gray-500">
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
                            className="underline hover:text-gray-700 transition-colors"
                          >
                            {plan.creator_name || "Anonymous"}
                          </button>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-600" />
                      {!plan.scheduled_for ? (
                        <span className="text-xs text-gray-500">{t('common.today')}</span>
                      ) : isToday(new Date(plan.scheduled_for)) ? (
                        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 font-semibold px-2 py-0.5 rounded-full animate-pulse">
                          {t('common.today')}
                        </span>
                      ) : isTomorrow(new Date(plan.scheduled_for)) ? (
                        <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 font-semibold px-2 py-0.5 rounded-full">
                          {t('common.tomorrow')}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-600">
                          {format(new Date(plan.scheduled_for), "EEE, d MMM")}
                        </span>
                      )}
                    </div>
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
                      className="p-2.5 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-full transition-all shadow-sm"
                      title="Share with friends"
                      aria-label="Share plan"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Show participant count if someone joined */}
                {plan.participant_count > 0 && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-sm text-gray-600">+{plan.participant_count} {t('common.joined').toLowerCase()}</span>
                  </div>
                )}
              </SwipeableCard>
            ))}

            {/* City discovery plans — other users' plans in selectedCity */}
            {cityPlans.length > 0 && (
              <>
                {activities.length > 0 && (
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2 pb-0.5">
                    {showAllCities
                      ? "🌍 Live feed — all cities"
                      : t("plans.moreInCity", "More in {{city}}", { city: selectedCity })}
                  </div>
                )}
                {cityPlans.map((plan) => (
                  <SwipeableCard
                    key={plan.id}
                    canDelete={false}
                    onDelete={() => {}}
                    onClick={() => handleCityPlanClick(plan)}
                    className="w-full text-left p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-50 dark:border-gray-200 dark:hover:bg-gray-100 cursor-pointer transition-colors"
                    style={{}}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 shrink-0">
                        {plan.creator_avatar ? (
                          <img src={plan.creator_avatar} alt={plan.creator_name || "Creator"} className="w-full h-full object-cover" />
                        ) : (
                          <span className="flex items-center justify-center w-full h-full text-base font-bold text-gray-500">
                            {plan.creator_name?.charAt(0)?.toUpperCase() || "?"}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Activity emoji + type name */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-base leading-none">{getActivityEmoji(plan.activity_type)}</span>
                          <h3 className="font-semibold text-gray-900 text-sm">
                            {plan.note || getActivityLabel(plan.activity_type)}
                          </h3>
                          {isSoon(plan.scheduled_for) && (
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                              🔴 Soon
                            </span>
                          )}
                          {plan.price_amount ? (
                            <span className="text-xs bg-green-50 text-green-700 border border-green-200 font-semibold px-2 py-0.5 rounded-full">
                              {plan.price_amount}
                            </span>
                          ) : (
                            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full">
                              {t('common.join', 'Join')}
                            </span>
                          )}
                        </div>

                        {/* City + organiser */}
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <span className="text-xs font-medium text-primary">{plan.city}</span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-500">
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
                              className="underline hover:text-gray-700 transition-colors"
                            >
                              {plan.creator_name || "Anonymous"}
                            </button>
                          </span>
                        </div>

                        {/* Date + time */}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="text-xs text-gray-500">
                            {plan.scheduled_for
                              ? format(new Date(plan.scheduled_for), "EEE, d MMM · h:mm a")
                              : t('common.today')}
                          </span>
                          {plan.scheduled_for && isToday(new Date(plan.scheduled_for)) && (
                            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 font-semibold px-1.5 py-0.5 rounded-full animate-pulse">
                              {t('common.today')}
                            </span>
                          )}
                          {plan.scheduled_for && isTomorrow(new Date(plan.scheduled_for)) && (
                            <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 font-semibold px-1.5 py-0.5 rounded-full">
                              {t('common.tomorrow')}
                            </span>
                          )}
                        </div>

                        {/* Attendee count */}
                        {(plan.participant_count ?? 0) > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <Users className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {plan.participant_count} {t('common.joined').toLowerCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <ReportContentButton contentId={plan.id} contentType="post" iconOnly />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSharePlan(plan, e);
                          }}
                          className="p-2.5 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-full transition-all shadow-sm"
                          title="Share with friends"
                          aria-label="Share plan"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </SwipeableCard>
                ))}
              </>
            )}
          </>
        )}
      </div>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!planToDelete} onOpenChange={(open) => !open && setPlanToDelete(null)}>
        <AlertDialogContent className="border-2 border-shake-yellow">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('plans.deletePlanTitle', 'Delete this plan?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('plans.deletePlanDesc', 'This will permanently delete your {{activity}} plan and all its messages. This action cannot be undone.', { activity: planToDelete ? getActivityLabel(planToDelete.activity_type) : '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlan} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('plans.deletePlanBtn', 'Delete Plan')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Confirmation Dialog */}
      <AlertDialog open={!!planToLeave} onOpenChange={(open) => !open && setPlanToLeave(null)}>
        <AlertDialogContent className="border-2 border-destructive/40">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {planToLeave ? getActivityLabel(planToLeave.activity_type) : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll be removed from this activity and the group chat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeavePlan} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate-activity block modal */}
      {duplicateActivityBlock && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 pointer-events-auto">
          <div
            className="absolute inset-0 pointer-events-auto"
            style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            onClick={() => setDuplicateActivityBlock(null)}
          />
          <div
            className="relative z-10 w-full max-w-sm pointer-events-auto px-6 py-7 flex flex-col gap-4"
            style={{
              background: "rgba(255,255,255,0.55)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.4)",
              borderRadius: "24px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            }}
          >
            <div className="text-center space-y-2">
              <p className="text-xl font-bold text-gray-900">Hold on Tiger! 🐯</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                You're already joined for{" "}
                <span className="font-semibold">{getActivityLabel(duplicateActivityBlock.activityType)}</span>{" "}
                in <span className="font-semibold">{duplicateActivityBlock.oldCity}</span>. Leave that one first before joining in{" "}
                <span className="font-semibold">{duplicateActivityBlock.newCity}</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDuplicateActivityBlock(null)}
              className="w-full h-11 rounded-full font-semibold text-base transition-all hover:opacity-90 active:scale-95"
              style={{
                background: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(0,0,0,0.12)",
                color: "#1a1a1a",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

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

      {/* Plan Preview Modal — shown before joining a city discovery plan */}
      {planPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-auto">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setPlanPreview(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-3xl bg-white shadow-2xl pointer-events-auto overflow-hidden">
            <div className="px-6 pt-6 pb-4 space-y-4">
              {/* Organizer avatar (replaces activity icon) */}
              <div className="text-center">
                <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-3 border-2 border-white shadow-md flex items-center justify-center bg-purple-100 flex-shrink-0">
                  {planPreview.creator_avatar ? (
                    <img
                      src={planPreview.creator_avatar}
                      alt={planPreview.creator_name || "Organiser"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-purple-700">
                      {planPreview.creator_name?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-display font-bold text-gray-900">
                  {planPreview.note || t('plans.untitledPlan', 'Untitled Plan')}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {planPreview.activity_type !== "general" && `${getActivityLabel(planPreview.activity_type)} · `}{planPreview.city}
                </p>
                <p className="text-sm text-gray-500">
                  {!planPreview.scheduled_for
                    ? t('common.today')
                    : isToday(new Date(planPreview.scheduled_for))
                    ? t('common.today')
                    : isTomorrow(new Date(planPreview.scheduled_for))
                    ? t('common.tomorrow')
                    : format(new Date(planPreview.scheduled_for), "EEE, d MMM")}
                </p>
              </div>

              {/* Attendees */}
              {(planPreview.participant_count ?? 0) > 0 && (
                <div className="flex items-center justify-center gap-2">
                  <div className="flex">
                    {planPreviewAttendees.slice(0, 4).map((attendee, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full border-2 border-white overflow-hidden flex items-center justify-center bg-purple-100 flex-shrink-0"
                        style={{ marginLeft: i === 0 ? 0 : -10, zIndex: planPreviewAttendees.length - i }}
                      >
                        {attendee.avatar_url ? (
                          <img src={attendee.avatar_url} alt={attendee.name || ""} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold text-purple-700">
                            {attendee.name?.charAt(0)?.toUpperCase() || "?"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <span className="text-sm text-gray-500 font-medium">
                    {(planPreview.participant_count ?? 0) > 4
                      ? `+${planPreview.participant_count} going`
                      : `${planPreview.participant_count} going`}
                  </span>
                </div>
              )}

            </div>

            {/* Actions */}
            <div className="px-6 pb-6 space-y-2">
              <button
                type="button"
                onClick={handleConfirmJoinPreview}
                className="w-full h-12 rounded-full font-semibold text-base text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(to right, rgba(88,28,135,0.9), rgba(67,56,202,0.8))" }}
              >
                {t('plans.yesImIn', "Yes, I'm in! 🎉")}
              </button>
              <button
                type="button"
                onClick={() => setPlanPreview(null)}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                {t('plans.humBtn', 'Hum!')}
              </button>
            </div>
          </div>
        </div>
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
