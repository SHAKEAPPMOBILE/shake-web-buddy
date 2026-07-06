import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import confetti from 'canvas-confetti';
import barManAndCook from "@/assets/bar-man-and-cook.png";
import { Calendar, Users, Plus, Plane, Send, ChevronLeft, Play } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCity } from "@/contexts/CityContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { CitySelector } from "@/components/CitySelector";
import { CityPickerModal } from "@/components/CityPickerModal";
import { PlanGroupChatView } from "./PlanGroupChatView";
import { PlansEmptyState } from "./PlansEmptyState";
import { GroupChatView } from "./GroupChatView";
import { format, isToday, isTomorrow } from "date-fns";
import { ALL_ACTIVITY_TYPES, ACTIVITY_TYPES, getActivityDay, getNextOccurrenceDate } from "@/data/activityTypes";
import { formatDateWithTranslation, parseDbDate } from "@/lib/date-utils";
import { cn, getPriceValue } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/app-toast";
import { findOrCreateOpenGroup, MAX_GROUP_CAPACITY } from "@/lib/activityGroups";
import { LoadingSpinner } from "../LoadingSpinner";
import { ReportContentButton } from "@/components/ReportContentButton";
import { useReferralCode, getReferralLink } from "@/hooks/useReferralCode";
import { SwipeableCard } from "../SwipeableCard";
import { useTranslation } from "react-i18next";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { PlanSwipeFeed } from "./PlanSwipeFeed";
import { useActivityPayment } from "@/hooks/useActivityPayment";
import { ActivityDetailDialog } from "@/components/ActivityDetailDialog";
import { ActivityDetailsCard } from "./ActivityDetailsCard";
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
  promo_video_url?: string | null;
  group_number?: number | null;
  creator_name?: string;
  creator_avatar?: string;
  participant_count?: number;
  isJoined?: boolean;
  isCarouselJoin?: boolean;
  realActivityId?: string | null;
  is_auto_generated?: boolean | null;
}

interface PlansTabProps {
  onChatViewChange?: (isInChat: boolean) => void;
  pendingPaidActivityId?: string | null;
  onPendingPaidActivityHandled?: () => void;
  onOpenEvents?: () => void;
  onJoinActivity?: () => void;
}

/** Shape returned by the get_my_active_plans RPC. */
interface MyActivePlan {
  join_id: string;
  activity_id: string | null;
  activity_type: string;
  city: string;
  expires_at: string | null;
  joined_at: string;
  // null for carousel joins (activity_id IS NULL)
  plan_id: string | null;
  plan_user_id: string | null;
  scheduled_for: string | null;
  is_active: boolean | null;
  note: string | null;
  price_amount: string | null;
  group_number: number | null;
  is_auto_generated: boolean | null;
  created_at: string | null;
  is_carousel: boolean;
}

/** Normalise a city string for comparison: trim whitespace and lower-case.
 *  Prevents "New York City " vs "New York City" or capitalisation variants
 *  from hiding a card the user is actually in. */
const normalizeCity = (city: string): string => city.trim().toLowerCase();

export function PlansTab({ onChatViewChange, pendingPaidActivityId, onPendingPaidActivityHandled, onOpenEvents, onJoinActivity }: PlansTabProps = {}) {
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

  useEffect(() => {
    console.log("[PlansTab] showAllCities changed →", showAllCities);
    // Trigger a fresh fetch when the tab switches — fetchPlansRef may not be
    // set yet on first render, so guard with a check.
    fetchPlansRef.current?.();
  }, [showAllCities]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch all plans — single source of truth via get_my_active_plans RPC
  const fetchPlans = useCallback(async () => {
    if (!user) {
      console.log("[SET:fetchPlans:no-user] setActivities → [] | setCityPlans → []");
      console.trace("[SET:fetchPlans:no-user]");
      setActivities([]);
      setCityPlans([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    // Read showAllCities from the ref, not the closure — the ref is updated
    // synchronously during each render so this always reflects the active tab,
    // even when fetchPlansRef.current holds an older function instance.
    const showAllCities = allPlansRef.current.showAllCities;
    const effectiveCity = selectedCity;
    const fetchId = Date.now();
    console.log(`[PlansTab] fetchPlans START #${fetchId}`, { effectiveCity, showAllCities, caller: new Error().stack?.split('\n')[2]?.trim() });

    const loadingTimeout = setTimeout(() => setIsLoading(false), 5000);

    try {
      // Visibility window: plans more than 24 h past are hidden from the feed.
      const nowMs = Date.now();
      const twentyFourHoursAgo = new Date(nowMs - 24 * 60 * 60 * 1000);
      const fiveDaysAgo        = new Date(nowMs - 5 * 24 * 60 * 60 * 1000);

      const isActivityVisible = (a: { scheduled_for: string | null; created_at: string }) =>
        a.scheduled_for !== null
          ? parseDbDate(a.scheduled_for) >= twentyFourHoursAgo
          : parseDbDate(a.created_at)    >= fiveDaysAgo;

      // Normalised city strings for comparison (trim + lowercase on both sides).
      // joinedPlansCityFilter is set when the user uses the in-Plans city picker.
      const cityForJoined = joinedPlansCityFilter ?? effectiveCity;
      const normCityForJoined = cityForJoined ? normalizeCity(cityForJoined) : null;

      // ── Phase 1: RPC (my active joins) + discovery carousel counts ─────────
      const [myPlansResult, cityCarouselResult] = await Promise.all([
        // Single source of truth: every non-expired join for this user.
        // Returns real-plan rows with the plan already joined in, and carousel
        // rows (activity_id IS NULL) as synthetic entries. SECURITY DEFINER so
        // soft-deleted plans are still readable by the participant.
        (supabase as any).rpc('get_my_active_plans', { p_user_id: user.id }) as
          Promise<{ data: MyActivePlan[] | null; error: unknown }>,

        // Discovery carousel: open-interest joins used to count members and surface
        // groups with >=3 people.
        // My City  → joins in effectiveCity only.
        // All Cities → joins in cities OTHER than effectiveCity.
        showAllCities
          ? effectiveCity
            ? supabase.from("activity_joins").select("activity_type, city, user_id, activity_id").neq("city", effectiveCity)
            : supabase.from("activity_joins").select("activity_type, city, user_id, activity_id")
          : effectiveCity
            ? supabase
                .from("activity_joins")
                .select("activity_type, city, user_id, activity_id")
                .eq("city", effectiveCity)
                .is("activity_id", null)
            : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      if (myPlansResult.error) {
        console.error("[PlansTab] get_my_active_plans error:", myPlansResult.error);
      }
      const myPlans: MyActivePlan[] = myPlansResult.data ?? [];
      console.log(`[PlansTab] RPC get_my_active_plans → ${myPlans.length} rows`, myPlans.map(p => ({ activity_type: p.activity_type, city: p.city, is_carousel: p.is_carousel, plan_id: p.plan_id })));

      const _carouselFilter = showAllCities
        ? effectiveCity ? `city != "${effectiveCity}"` : "all cities (no effectiveCity)"
        : effectiveCity ? `city = "${effectiveCity}" AND activity_id IS NULL` : "empty (no effectiveCity)";
      console.log(`[PlansTab] carousel query [${showAllCities ? "Todas las ciudades" : "Mi Ciudad"}] filter: ${_carouselFilter} → ${cityCarouselResult.data?.length ?? 0} rows`, cityCarouselResult.error ?? cityCarouselResult.data);

      // Split into real-plan joins and carousel joins.
      const realJoins     = myPlans.filter(p => !p.is_carousel);
      const carouselJoins = myPlans.filter(p =>  p.is_carousel);

      // IDs of real plans I've joined — used to deduplicate the discovery feed.
      const myJoinedPlanIds  = new Set<string>(realJoins.map(p => p.plan_id!).filter(Boolean));
      // Activity types I'm currently in — exclude from discovery carousel below.
      const myActiveTypes    = new Set<string>(myPlans.map(p => p.activity_type));

      // Apply city filter to my real joins.
      // isActivityVisible is intentionally NOT applied here — the RPC already gates on
      // expires_at, so every row it returns is authoritative.  Applying a second
      // scheduled_for date check silently dropped plans (e.g. drinks/Medellín) whose
      // event date had passed the 24-h window but whose join was still active.
      //
      // My City  → only plans in normCityForJoined.
      // All Cities → only plans NOT in normCityForJoined (other cities only).
      const filteredRealJoins = realJoins.filter(p => {
        if (!normCityForJoined) return true;
        return showAllCities
          ? normalizeCity(p.city) !== normCityForJoined
          : normalizeCity(p.city) === normCityForJoined;
      });

      // Apply city filter to carousel joins (always future-dated, no visibility filter).
      const filteredCarouselJoins = carouselJoins.filter(p => {
        if (!normCityForJoined) return true;
        return showAllCities
          ? normalizeCity(p.city) !== normCityForJoined
          : normalizeCity(p.city) === normCityForJoined;
      });

      // ── Phase 2: discovery real plans ─────────────────────────────────────
      // My City  → non-auto plans in effectiveCity (unchanged).
      // All Cities → non-auto plans in cities OTHER than effectiveCity.
      const cityPlansDataResult = await (
        !effectiveCity
          ? Promise.resolve({ data: [] as any[], error: null })
          : showAllCities
            ? supabase
                .from("user_activities")
                .select("*")
                .neq("city", effectiveCity)
                .eq("is_active", true)
                .order("scheduled_for", { ascending: true, nullsFirst: false })
                .limit(30)
            : supabase
                .from("user_activities")
                .select("*")
                .eq("city", effectiveCity)
                .eq("is_active", true)
                .neq("is_auto_generated", true)
                .order("scheduled_for", { ascending: true, nullsFirst: false })
                .limit(20)
      );
      const _tab = showAllCities ? "Todas las ciudades" : "Mi Ciudad";
      const _realFilter = !effectiveCity ? "empty (no effectiveCity)"
        : showAllCities ? `city != "${effectiveCity}", is_active=true, LIMIT 30`
        : `city = "${effectiveCity}", is_active=true, is_auto_generated!=true, LIMIT 20`;
      console.log(`[PlansTab] real-plans query [${_tab}] filter: ${_realFilter} → ${cityPlansDataResult.data?.length ?? 0} rows`, cityPlansDataResult.error ?? cityPlansDataResult.data?.map((a: any) => ({ id: a.id, activity_type: a.activity_type, city: a.city, scheduled_for: a.scheduled_for })));

      // Discovery real plans: active plans in the city that I haven't joined.
      // isActivityVisible uses a 24h-back window (for joined plans), so we add a
      // strict future-only guard here: discovery cards must never show past events.
      const nowDate = new Date();
      const cityPublicPlans: any[] = (cityPlansDataResult.data ?? [])
        .filter((a: { id: string }) => !myJoinedPlanIds.has(a.id))
        .filter((a: { scheduled_for: string | null; created_at: string }) => isActivityVisible(a))
        .filter((a: { scheduled_for: string | null }) =>
          // Past-dated plans must not appear as joinable discovery cards.
          // Nulls (no scheduled_for) pass through — they're open-ended invites.
          a.scheduled_for == null || parseDbDate(a.scheduled_for) >= nowDate
        );

      // IDs of plans already in the real-plans feed — used below to deduplicate the
      // discovery carousel so auto-generated plans don't appear in both sections.
      const cityPublicPlanIds = new Set<string>(cityPublicPlans.map((a: any) => a.id));

      // Discovery carousel: other users' open groups (any member count),
      // only for activity types I'm not already in.
      // No activity_type allowlist here — any type returned by the DB is eligible.
      const allCarouselJoins = (cityCarouselResult.data ?? []) as any[];

      const discoveryCarouselMap = new Map<string, { activity_type: string; city: string; userIds: string[]; activityId: string | null }>();
      allCarouselJoins.forEach((j: any) => {
        const key = j.activity_id
          ? `${j.activity_type}-${j.city}-${j.activity_id}`
          : `${j.activity_type}-${j.city}-null-${j.user_id}`;
        if (!discoveryCarouselMap.has(key))
          discoveryCarouselMap.set(key, { activity_type: j.activity_type, city: j.city, userIds: [], activityId: j.activity_id ?? null });
        const entry = discoveryCarouselMap.get(key)!;
        if (!entry.userIds.includes(j.user_id)) entry.userIds.push(j.user_id);
      });

      // Any activity_type is eligible; unknown types fall back to default label/icon.
      // In All Cities mode: exclude entries already shown in the real-plans feed to
      // prevent the same group rendering twice (once per section).
      const discoveryCarouselEntries = Array.from(discoveryCarouselMap.values()).filter(c =>
        !c.userIds.includes(user.id) &&          // I'm not already in this specific group
        !myActiveTypes.has(c.activity_type) &&   // and I don't have this type at all
        (!c.activityId || (!myJoinedPlanIds.has(c.activityId) && !cityPublicPlanIds.has(c.activityId)))
      );

      // ── Phase 3: quick render — cards without profiles (stops spinner early) ─
      const sortByDate = (arr: PlanActivity[]) =>
        arr.sort((a, b) => {
          const da = a.scheduled_for ? parseDbDate(a.scheduled_for) : parseDbDate((a as any).created_at);
          const db = b.scheduled_for ? parseDbDate(b.scheduled_for) : parseDbDate((b as any).created_at);
          if (isToday(da)    && !isToday(db))    return -1;
          if (!isToday(da)   && isToday(db))     return  1;
          if (isTomorrow(da) && !isTomorrow(db)) return -1;
          if (!isTomorrow(da) && isTomorrow(db)) return  1;
          return da.getTime() - db.getTime();
        });

      const quickReal: PlanActivity[] = filteredRealJoins.map(p => ({
        id: p.plan_id!,
        user_id: p.plan_user_id!,
        activity_type: p.activity_type,
        city: p.city,
        scheduled_for: p.scheduled_for,
        is_active: true,
        note: p.note,
        price_amount: p.price_amount,
        group_number: p.group_number,
        is_auto_generated: p.is_auto_generated,
        created_at: p.created_at ?? undefined,
        creator_name: "...",
        participant_count: 0,
        isJoined: true,
        isCarouselJoin: false,
      }));

      const quickCarousel: PlanActivity[] = filteredCarouselJoins.map(p => ({
        id: `carousel-${p.activity_type}-${p.city}-${user.id}`,
        user_id: user.id,
        activity_type: p.activity_type,
        city: p.city,
        scheduled_for: getNextOccurrenceDate(p.activity_type).toISOString(),
        is_active: true,
        creator_name: "...",
        participant_count: 1,
        isJoined: true,
        isCarouselJoin: true,
      }));

      if (quickReal.length > 0 || quickCarousel.length > 0) {
        const _quickNext = sortByDate([...quickReal, ...quickCarousel]);
        console.log(`[SET:fetchPlans:quick-render] setActivities → ${_quickNext.length} items`, _quickNext.map(a => ({ id: a.id, activity_type: a.activity_type, city: a.city, isJoined: a.isJoined })));
        console.trace("[SET:fetchPlans:quick-render]");
        setActivities(_quickNext);
        clearTimeout(loadingTimeout);
        setIsLoading(false);
      }

      // ── Phase 4: enrich with profiles + live counts ────────────────────────
      const [enrichedReal, enrichedCarousel, enrichedCity, enrichedDiscovery] = await Promise.all([
        // My real plan joins
        Promise.all(filteredRealJoins.map(async p => {
          const [{ data: profile }, { count }, { data: activityRow }] = await Promise.all([
            supabase.from("profiles").select("name, avatar_url").eq("user_id", p.plan_user_id!).maybeSingle(),
            supabase.from("activity_joins").select("*", { count: "exact", head: true }).eq("activity_id", p.plan_id!),
            supabase.from("user_activities").select("promo_video_url").eq("id", p.plan_id!).maybeSingle(),
          ]);
          return {
            id: p.plan_id!,
            user_id: p.plan_user_id!,
            activity_type: p.activity_type,
            city: p.city,
            scheduled_for: p.scheduled_for,
            is_active: true,
            note: p.note,
            price_amount: p.price_amount,
            promo_video_url: (activityRow as any)?.promo_video_url ?? null,
            group_number: p.group_number,
            is_auto_generated: p.is_auto_generated,
            created_at: p.created_at ?? undefined,
            creator_name: profile?.name || "Anonymous",
            creator_avatar: profile?.avatar_url ?? undefined,
            participant_count: count || 0,
            isJoined: true,
            isCarouselJoin: false,
          } as PlanActivity;
        })),

        // My carousel joins — synthetic card, always shown regardless of group size
        Promise.all(filteredCarouselJoins.map(async p => {
          const dayLabel = getActivityDay(p.activity_type);
          const { count: liveCount } = await supabase
            .from("activity_joins")
            .select("user_id", { count: "exact", head: true })
            .eq("activity_type", p.activity_type)
            .eq("city", p.city);
          return {
            id: `carousel-${p.activity_type}-${p.city}-${user.id}`,
            user_id: user.id,
            activity_type: p.activity_type,
            city: p.city,
            scheduled_for: getNextOccurrenceDate(p.activity_type).toISOString(),
            is_active: true,
            note: dayLabel ? `This ${dayLabel}` : null,
            creator_name: "Open group",
            participant_count: liveCount ?? 1,
            isJoined: true,
            isCarouselJoin: true,
          } as PlanActivity;
        })),

        // City discovery real plans
        Promise.all(cityPublicPlans.map(async (activity: any) => {
          const [{ data: profile }, { count }, { count: myJoinCount }] = await Promise.all([
            supabase.from("profiles").select("name, avatar_url").eq("user_id", activity.user_id).maybeSingle(),
            supabase.from("activity_joins").select("*", { count: "exact", head: true }).eq("activity_id", activity.id),
            supabase.from("activity_joins").select("*", { count: "exact", head: true }).eq("activity_id", activity.id).eq("user_id", user!.id),
          ]);
          return {
            ...activity,
            creator_name: profile?.name || "Anonymous",
            creator_avatar: profile?.avatar_url,
            participant_count: count || 0,
            isJoined: (myJoinCount ?? 0) > 0,
          } as PlanActivity;
        })),

        // Discovery carousel groups (>=3 others, not my active type)
        Promise.all(discoveryCarouselEntries.map(async (carouselActivity) => {
          const firstUserId = carouselActivity.userIds[0];
          const [{ data: profile }, { data: realActivity }, { count: liveCount }] = await Promise.all([
            supabase.from("profiles").select("name, avatar_url").eq("user_id", firstUserId).maybeSingle(),
            carouselActivity.activityId
              ? supabase.from("user_activities").select("id").eq("id", carouselActivity.activityId).maybeSingle()
              : supabase.from("user_activities").select("id")
                  .eq("activity_type", carouselActivity.activity_type)
                  .eq("city", carouselActivity.city)
                  .eq("is_active", true)
                  .order("scheduled_for", { ascending: false })
                  .limit(1)
                  .maybeSingle(),
            carouselActivity.activityId
              ? supabase.from("activity_joins").select("user_id", { count: "exact", head: true }).eq("activity_id", carouselActivity.activityId)
              : Promise.resolve({ count: carouselActivity.userIds.length }),
          ]);
          const dayLabel      = getActivityDay(carouselActivity.activity_type);
          const nextOccurrence = getNextOccurrenceDate(carouselActivity.activity_type);
          return {
            id: `carousel-${carouselActivity.activity_type}-${carouselActivity.city}-${carouselActivity.activityId ?? firstUserId}`,
            realActivityId: realActivity?.id ?? null,
            user_id: firstUserId,
            activity_type: carouselActivity.activity_type,
            city: carouselActivity.city,
            scheduled_for: nextOccurrence.toISOString(),
            is_active: true,
            note: dayLabel ? `This ${dayLabel}` : null,
            creator_name: profile?.name || "Anonymous",
            creator_avatar: profile?.avatar_url,
            participant_count: liveCount ?? carouselActivity.userIds.length,
            isJoined: false,
            isCarouselJoin: true,
          } as PlanActivity;
        })),
      ]);

      console.log("[PlansTab] myPlans →", { total: myPlans.length, real: filteredRealJoins.length, carousel: filteredCarouselJoins.length });
      const actTotal = [...enrichedReal, ...enrichedCarousel, ...enrichedDiscovery].length;
      console.log(`[PlansTab] fetchPlans END #${fetchId} — setActivities(${actTotal}) setCityPlans(${enrichedCity.length}) showAllCities=${showAllCities}`);

      const _finalActivities = sortByDate([...enrichedReal, ...enrichedCarousel, ...enrichedDiscovery]);
      const _finalCity = sortByDate(enrichedCity);
      console.log(`[SET:fetchPlans:final] setActivities → ${_finalActivities.length} items`, _finalActivities.map(a => ({ id: a.id, activity_type: a.activity_type, city: a.city, isJoined: a.isJoined })));
      console.log(`[SET:fetchPlans:final] setCityPlans → ${_finalCity.length} items`, _finalCity.map(a => ({ id: a.id, activity_type: a.activity_type, city: a.city })));
      console.trace("[SET:fetchPlans:final]");
      setActivities(_finalActivities);
      setCityPlans(_finalCity);

    } finally {
      clearTimeout(loadingTimeout);
      setIsLoading(false);
    }
  }, [selectedCity, user, joinedPlansCityFilter]); // showAllCities intentionally omitted — read live from allPlansRef.current

  // Always-current ref so the realtime subscription callbacks never hold a stale
  // fetchPlans closure — without this the subscription would reinstall every time
  // showAllCities toggles, causing a brief window where the old stale closure fires.
  const fetchPlansRef = useRef(fetchPlans);
  useEffect(() => { fetchPlansRef.current = fetchPlans; }, [fetchPlans]);

  // Always-current ref for values the subscription handler (and fetchPlans) need
  // to read at call time without holding a stale closure snapshot.
  //
  // Assigned synchronously during render — NOT in a useEffect — so the value is
  // already current by the time any effect in this render cycle fires.
  // A useEffect([showAllCities]) would lose the ordering race: the showAllCities
  // effect (line ~120) is declared earlier and fires before a later useEffect
  // could update the ref, meaning fetchPlansRef.current() would still see the
  // old showAllCities snapshot.
  const allPlansRef = useRef<{ userId: string | undefined; showAllCities: boolean }>({ userId: user?.id, showAllCities });
  allPlansRef.current = { userId: user?.id, showAllCities };

  // Initial fetch and realtime subscription — deps: selectedCity only.
  // showAllCities is intentionally excluded: fetchPlansRef.current always points
  // to the latest fetchPlans so the callbacks stay correct without reinstalling.
  useEffect(() => {
    console.log("[PlansTab] subscription INSTALL", { selectedCity, showAllCities });
    fetchPlansRef.current();

    const channel = supabase
      .channel(`plans-tab-${selectedCity ?? "none"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_activities" },
        () => {
          console.log("[PlansTab] realtime user_activities fired → fetchPlans");
          fetchPlansRef.current();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_joins" },
        (payload: { new?: { user_id?: string } }) => {
          // Skip refetch when the change was caused by the current user's own join.
          // handleFeedJoin already applies the local setActivities/setCityPlans update,
          // so a redundant fetchPlans() here would clear+refill the feed, losing the
          // user's scroll position and jumping to a different card.
          // Other users' joins (different user_id) still trigger a refetch so
          // participant counts stay current for everyone watching.
          if (payload.new?.user_id === allPlansRef.current.userId) return;
          console.log("[PlansTab] realtime activity_joins fired (other user) → fetchPlans");
          fetchPlansRef.current();
        }
      )
      .subscribe();

    return () => {
      console.log("[PlansTab] subscription TEARDOWN", { selectedCity, showAllCities });
      supabase.removeChannel(channel);
    };
  }, [selectedCity]); // fetchPlans intentionally omitted — fetchPlansRef.current() is always fresh

  // Only treat city changes as explicit plans-filter choices when the header picker is open.
  useEffect(() => {
    if (!isCitySheetOpen) return;
    if (!selectedCity) return;
    if (cityAtPickerOpen && selectedCity === cityAtPickerOpen) return;
    setJoinedPlansCityFilter(selectedCity);
  }, [isCitySheetOpen, selectedCity, cityAtPickerOpen]);

  // When the city changes from the home screen (picker is closed), clear any stale
  // Plans-internal city override so My City always reflects the global CityContext value.
  useEffect(() => {
    if (isCitySheetOpen) return;
    setJoinedPlansCityFilter(null);
  }, [selectedCity]); // eslint-disable-line react-hooks/exhaustive-deps
  
  const [selectedPlan, setSelectedPlan] = useState<PlanActivity | null>(null);
  const [showChatView, setShowChatView] = useState(false);
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
  const [planPreviewVideoFullscreen, setPlanPreviewVideoFullscreen] = useState(false);

  // Swipe feed (full-screen, opened by tapping a city card)
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedStartIndex, setFeedStartIndex] = useState(0);
  const [autoGenCardPlan, setAutoGenCardPlan] = useState<PlanActivity | null>(null);
  

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
    const diff = parseDbDate(scheduledFor).getTime() - Date.now();
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

  // True when the plan's activity_type maps to a known standard type (dinner, brunch, etc.)
  const isStandardActivity = (type: string) => ALL_ACTIVITY_TYPES.some(a => a.id === type);

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

  const handleInviteFromEmptyState = async () => {
    const link = getReferralLink(referralCode);
    if (Capacitor.isNativePlatform()) {
      try { await Share.share({ title: "Join SHAKE!", text: "Join me on SHAKE to find fun activities and meet new people!", url: link, dialogTitle: "Invite a Friend" }); }
      catch (err) { if ((err as any).errorMessage !== 'Share canceled') { try { await navigator.clipboard.writeText(link); toast.success(t('plans.linkCopied')); } catch {} } }
    } else if (navigator.share) {
      try { await navigator.share({ title: "Join SHAKE!", text: "Join me on SHAKE to find fun activities and meet new people!", url: link }); }
      catch (err) { if ((err as Error).name !== "AbortError") { try { await navigator.clipboard.writeText(link); toast.success(t('plans.linkCopied')); } catch {} } }
    } else {
      try { await navigator.clipboard.writeText(link); toast.success(t('plans.linkCopied'), { description: t('plans.shareEarnPoints') }); }
      catch { toast.error(t('plans.failedToCopyLink')); }
    }
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
    
    if (plan.isJoined) {
      setSelectedPlan(plan);
      setShowChatView(true);
      return;
    }

    setPlanPreview(plan);
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

  const handleLeavePlan = async () => {
    if (!planToLeave || !user) return;
    try {
      let error: unknown;
      if (planToLeave.isCarouselJoin) {
        // Carousel join: no activity_id on the row — delete by type + city
        ({ error } = await supabase
          .from("activity_joins")
          .delete()
          .eq("user_id", user.id)
          .eq("activity_type", planToLeave.activity_type)
          .is("activity_id", null));
      } else {
        // Real plan join: delete by activity_id
        ({ error } = await supabase
          .from("activity_joins")
          .delete()
          .eq("activity_id", planToLeave.id)
          .eq("user_id", user.id));
      }
      if (error) throw error;
      console.log("[SET:handleLeavePlan] setActivities ← remove plan", planToLeave.id);
      console.trace("[SET:handleLeavePlan]");
      setActivities(prev => prev.filter(a => a.id !== planToLeave.id));
      setPlanToLeave(null);
      toast.success(t('plans.leftActivity'));
    } catch (err) {
      console.error("Error leaving plan:", err);
      toast.error(t('plans.failedToLeave'));
    }
  };

  /** Single-source-of-truth guard check.
   *  Calls the same RPC as the feed so the two can never disagree.
   *  Returns the active join for the given activity type, or null if the user
   *  has no non-expired join for that type. */
  const checkExistingJoin = async (activityType: string): Promise<MyActivePlan | null> => {
    if (!user) return null;
    const { data } = await (supabase as any).rpc('get_my_active_plans', { p_user_id: user.id }) as
      { data: MyActivePlan[] | null };
    return (data ?? []).find(p => p.activity_type === activityType) ?? null;
  };

  // Returns an existing joined activity of the same type in a different city, or null.
  const getConflictingActivity = (activityType: string, targetCity: string): PlanActivity | null => {
    return activities.find(
      a => a.activity_type === activityType && a.city.toLowerCase() !== targetCity.toLowerCase()
    ) ?? null;
  };

  const handleSharePlan = async (plan: PlanActivity, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const activityLabel = getActivityLabel(plan.activity_type);
    const activityEmoji = getActivityEmoji(plan.activity_type);
    const dateStr = plan.scheduled_for
      ? format(parseDbDate(plan.scheduled_for), "EEE, d MMM")
      : format(new Date(), "EEE, d MMM");

    // For carousel plans, encode type+city directly. For real plans, use the plan id.
    const shareId = plan.id.startsWith('carousel-')
      ? `${plan.activity_type}-${plan.city}-${user?.id ?? ''}`
      : plan.id;
    const shareUrl = `https://app.shakeapp.today/invite/${encodeURIComponent(shareId)}`;
    const shareText = `${activityEmoji} Join me for ${activityLabel} in ${plan.city} on ${dateStr}! Let's SHAKE up our social life together.`;
    const shareTitle = `SHAKE - ${activityLabel} in ${plan.city}`;

    if (Capacitor.isNativePlatform()) {
      try { await Share.share({ title: shareTitle, text: shareText, url: shareUrl, dialogTitle: shareTitle }); }
      catch (err) { if ((err as any).errorMessage !== 'Share canceled') toast.error(t('plans.failedToShare')); }
    } else if (navigator.share) {
      try { await navigator.share({ title: shareTitle, text: shareText, url: shareUrl }); }
      catch (err) { if ((err as Error).name !== "AbortError") toast.error(t('plans.failedToShare')); }
    } else {
      try { await navigator.clipboard.writeText(shareUrl); toast.success(t('plans.linkCopied'), { description: t('plans.shareFriends') }); }
      catch { toast.error(t('plans.failedToCopyLink')); }
    }
  };

  // findOrCreateOpenGroup and MAX_GROUP_CAPACITY are imported from @/lib/activityGroups.

  // Plans whose activity_type is in this set join immediately (no preview modal),
  // regardless of whether the plan was user-created or auto-generated.
  // A user-created dinner/drinks/brunch plan routes to handleDirectCityJoin, not the preview.
  // Non-carousel types (general, run, surf, etc.) show the preview modal first.
  const CAROUSEL_ACTIVITY_TYPES = new Set(['dinner', 'drinks', 'brunch']);

  const handleCityPlanClick = (plan: PlanActivity) => {
    if (!user) return;
    if (plan.is_auto_generated) {
      setAutoGenCardPlan(plan);
      return;
    }
    // Non-auto plans (own, joined, free, paid) open the swipe feed.
    // Paid-unjoined cards show a "PAY" button inside the feed that calls onPayForPlan.
    const idx = cityPlans.findIndex((p) => p.id === plan.id);
    setFeedStartIndex(idx >= 0 ? idx : 0);
    setFeedOpen(true);
  };

  const handleDirectCityJoin = async (plan: PlanActivity) => {
    if (!user) {
      return;
    }

    // Safety guard: never free-insert a paid plan.
    if (getPriceValue(plan.price_amount) > 0 && !plan.isJoined && plan.user_id !== user.id) {
      toast.error(t('plans.requiresPayment'));
      return;
    }

    // Block joining events that started on a PREVIOUS day.
    // Same-day events are always joinable (plans often default to midnight).
    if (plan.scheduled_for) {
      const scheduledDate = parseDbDate(plan.scheduled_for);
      const isSameDay = scheduledDate.toDateString() === new Date().toDateString();
      if (!isSameDay && scheduledDate < new Date()) {
        toast.error(t('plans.eventAlreadyStarted'));
        return;
      }
    }

    const targetGroup = await findOrCreateOpenGroup(plan.activity_type, plan.city, user.id);
    if (!targetGroup) {
      toast.error(t('plans.groupFull'));
      return;
    }
    if (targetGroup.id !== plan.id) {
      if ((targetGroup.group_number ?? 1) > (plan.group_number ?? 1)) {
        toast.info(t('plans.groupFullNewCreated'));
      } else {
        toast.info(t('plans.groupFullJoiningAnother'));
      }
    }
    const targetPlan: PlanActivity = targetGroup.id === plan.id
      ? plan
      : {
          id: targetGroup.id,
          user_id: targetGroup.user_id,
          activity_type: targetGroup.activity_type,
          city: targetGroup.city,
          scheduled_for: targetGroup.scheduled_for,
          is_active: true,
          note: targetGroup.note ?? null,
          group_number: targetGroup.group_number ?? null,
          is_auto_generated: targetGroup.is_auto_generated ?? null,
          creator_name: "Open Group",
          participant_count: 0,
          isJoined: false,
        };

    // Guard: same RPC as the feed — expired and orphaned joins never block here.
    {
      const existingJoin = await checkExistingJoin(targetPlan.activity_type);
      if (existingJoin) {
        if (normalizeCity(existingJoin.city) === normalizeCity(targetPlan.city)) {
          // Already in — open the plan they're actually in, never show the guard.
          const ownedPlan = activities.find(a => a.id === existingJoin.plan_id) ?? plan;
          setSelectedPlan(ownedPlan);
          setShowChatView(true);
        } else {
          setDuplicateActivityBlock({ activityType: targetPlan.activity_type, oldCity: existingJoin.city, newCity: targetPlan.city });
        }
        return;
      }
    }

    const insertPayload = {
      user_id: user.id,
      activity_id: targetPlan.id,
      activity_type: targetPlan.activity_type,
      city: targetPlan.city,
    };
    const { error } = await supabase
      .from("activity_joins")
      .insert(insertPayload);

    if (error) {
      console.error("[JOIN:handleDirectCityJoin] insert failed", { code: error.code, message: error.message, details: error.details, hint: (error as any).hint });
      toast.error(`Failed to join: ${error.message}`);
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
    console.log("[SET:handleDirectCityJoin] setActivities ← prepend joinedPlan if absent | setCityPlans ← remove plan", { planId: targetPlan.id, activity_type: targetPlan.activity_type, city: targetPlan.city });
    console.trace("[SET:handleDirectCityJoin]");
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

  /**
   * In-feed join: same logic as handleConfirmJoinPreview but takes the plan as a
   * parameter, fires confetti, and does NOT navigate to chat — lets the feed stay open
   * and the card update its own joined state.
   * Returns { success: true } on join, { success: false } otherwise.
   */
  const handleFeedJoin = async (plan: PlanActivity): Promise<{ success: boolean }> => {
    if (!user) return { success: false };

    // Safety guard: never free-insert a paid plan.
    // The feed button should already call onPayForPlan for paid plans, but if
    // display logic misfires this is the definitive block.
    if (getPriceValue(plan.price_amount) > 0 && !plan.isJoined && plan.user_id !== user.id) {
      toast.error(t('plans.requiresPayment'));
      return { success: false };
    }

    if (plan.scheduled_for) {
      const scheduledDate = parseDbDate(plan.scheduled_for);
      const isSameDay = scheduledDate.toDateString() === new Date().toDateString();
      if (!isSameDay && scheduledDate < new Date()) {
        toast.error(t('plans.eventAlreadyStarted'));
        return { success: false };
      }
    }

    // User-created plans join their own plan.id directly.
    // Overflow grouping (findOrCreateOpenGroup) is only for auto-generated capacity-capped
    // activities. Routing a user-created plan through it can redirect the join to a different
    // activity_id, causing an RLS mismatch when the user later tries to send a message.
    if (!plan.is_auto_generated) {
      // For user-created plans, check membership scoped to THIS plan.id only.
      // A type-scoped check would wrongly block joining a second different plan
      // of the same activity_type in the same city.
      const { count: alreadyJoinedCount } = await supabase
        .from("activity_joins")
        .select("*", { count: "exact", head: true })
        .eq("activity_id", plan.id)
        .eq("user_id", user.id);

      if ((alreadyJoinedCount ?? 0) > 0) {
        toast.info(t('plans.alreadyJoined'));
        return { success: true };
      }

      const { error } = await supabase.from("activity_joins").insert({
        user_id: user.id,
        activity_id: plan.id,
        activity_type: plan.activity_type,
        city: plan.city,
      });

      if (error) {
        console.error("[JOIN:handleFeedJoin] insert failed (user-created)", { code: error.code, message: error.message, details: error.details, hint: error.hint });
        toast.error(`Failed to join: ${error.message}`);
        return { success: false };
      }

      if (plan.user_id && plan.user_id !== user.id) {
        void (async () => {
          const { data: joinerProfile } = await supabase.from("profiles").select("name").eq("user_id", user.id).maybeSingle();
          const joinerName = joinerProfile?.name || "Someone";
          await supabase.functions.invoke("send-push-notification", {
            body: {
              to_user_id: plan.user_id,
              title: "New shaker joined! 🎉",
              body: `${joinerName} just joined ${getActivityLabel(plan.activity_type)} in ${plan.city}`,
            },
          });
        })();
      }

      const joinedPlan = { ...plan, isJoined: true };
      console.log("[SET:handleFeedJoin:user-created] setActivities ← prepend joinedPlan if absent | setCityPlans ← remove plan", { planId: plan.id, activity_type: plan.activity_type, city: plan.city });
      console.trace("[SET:handleFeedJoin:user-created]");
      setActivities(prev => prev.find(a => a.id === plan.id) ? prev : [joinedPlan, ...prev]);
      setCityPlans(prev => prev.filter(p => p.id !== plan.id));

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#FFD700', '#FF69B4'],
      });

      return { success: true };
    }

    // Auto-generated plans: use overflow grouping so users are clustered into
    // capacity-capped slots across multiple groups of the same activity type.
    const targetGroup = await findOrCreateOpenGroup(plan.activity_type, plan.city, user.id);
    if (!targetGroup) {
      toast.error(t('plans.groupFull'));
      return { success: false };
    }

    const targetPlan: PlanActivity = targetGroup.id === plan.id
      ? plan
      : {
          id: targetGroup.id,
          user_id: targetGroup.user_id,
          activity_type: targetGroup.activity_type,
          city: targetGroup.city,
          scheduled_for: targetGroup.scheduled_for,
          is_active: true,
          note: targetGroup.note ?? null,
          group_number: targetGroup.group_number ?? null,
          is_auto_generated: targetGroup.is_auto_generated ?? null,
          creator_name: "Open Group",
          participant_count: 0,
          isJoined: false,
        };

    const existingJoin = await checkExistingJoin(targetPlan.activity_type);
    if (existingJoin) {
      if (normalizeCity(existingJoin.city) === normalizeCity(targetPlan.city)) {
        toast.info(t('plans.alreadyJoined'));
        return { success: true }; // already joined — treat as success so button flips
      } else {
        setDuplicateActivityBlock({ activityType: targetPlan.activity_type, oldCity: existingJoin.city, newCity: targetPlan.city });
        return { success: false };
      }
    }

    const { error } = await supabase.from("activity_joins").insert({
      user_id: user.id,
      activity_id: targetPlan.id,
      activity_type: targetPlan.activity_type,
      city: targetPlan.city,
    });

    if (error) {
      console.error("[JOIN:handleFeedJoin] insert failed", error);
      toast.error(`Failed to join: ${error.message}`);
      return { success: false };
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
    console.log("[SET:handleFeedJoin:auto-generated] setActivities ← prepend joinedPlan if absent | setCityPlans ← remove plan", { planId: targetPlan.id, activity_type: targetPlan.activity_type, city: targetPlan.city });
    console.trace("[SET:handleFeedJoin:auto-generated]");
    setActivities(prev => prev.find(a => a.id === targetPlan.id) ? prev : [joinedPlan, ...prev]);
    setCityPlans(prev => prev.filter(p => p.id !== targetPlan.id));

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#FFD700', '#FF69B4'],
    });

    return { success: true };
  };

  const handleConfirmJoinPreview = async () => {
    if (!planPreview || !user) {
      return;
    }
    const plan = planPreview;
    setPlanPreview(null);

    // Safety guard: never free-insert a paid plan.
    if (getPriceValue(plan.price_amount) > 0 && !plan.isJoined && plan.user_id !== user.id) {
      toast.error(t('plans.requiresPayment'));
      return;
    }

    // Block joining events that started on a PREVIOUS day.
    // Same-day events are always joinable (plans often default to midnight).
    if (plan.scheduled_for) {
      const scheduledDate = parseDbDate(plan.scheduled_for);
      const isSameDay = scheduledDate.toDateString() === new Date().toDateString();
      if (!isSameDay && scheduledDate < new Date()) {
        toast.error(t('plans.eventAlreadyStarted'));
        return;
      }
    }

    const targetGroup = await findOrCreateOpenGroup(plan.activity_type, plan.city, user.id);
    if (!targetGroup) {
      toast.error(t('plans.groupFull'));
      return;
    }
    if (targetGroup.id !== plan.id) {
      if ((targetGroup.group_number ?? 1) > (plan.group_number ?? 1)) {
        toast.info(t('plans.groupFullNewCreated'));
      } else {
        toast.info(t('plans.groupFullJoiningAnother'));
      }
    }
    const targetPlan: PlanActivity = targetGroup.id === plan.id
      ? plan
      : {
          id: targetGroup.id,
          user_id: targetGroup.user_id,
          activity_type: targetGroup.activity_type,
          city: targetGroup.city,
          scheduled_for: targetGroup.scheduled_for,
          is_active: true,
          note: targetGroup.note ?? null,
          group_number: targetGroup.group_number ?? null,
          is_auto_generated: targetGroup.is_auto_generated ?? null,
          creator_name: "Open Group",
          participant_count: 0,
          isJoined: false,
        };

    // Guard: same RPC as the feed — expired and orphaned joins never block here.
    {
      const existingJoin = await checkExistingJoin(targetPlan.activity_type);
      if (existingJoin) {
        if (normalizeCity(existingJoin.city) === normalizeCity(targetPlan.city)) {
          // Already in — open the plan they're actually in, never show the guard.
          const ownedPlan = activities.find(a => a.id === existingJoin.plan_id) ?? plan;
          setSelectedPlan(ownedPlan);
          setShowChatView(true);
        } else {
          setDuplicateActivityBlock({ activityType: targetPlan.activity_type, oldCity: existingJoin.city, newCity: targetPlan.city });
        }
        return;
      }
    }

    const insertPayload = {
      user_id: user.id,
      activity_id: targetPlan.id,
      activity_type: targetPlan.activity_type,
      city: targetPlan.city,
    };
    const { error } = await supabase
      .from("activity_joins")
      .insert(insertPayload);

    if (error) {
      console.error("[JOIN:handleConfirmJoinPreview] insert failed", { code: error.code, message: error.message, details: error.details, hint: (error as any).hint });
      toast.error(`Failed to join: ${error.message}`);
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
    console.log("[SET:handleConfirmJoinPreview] setActivities ← prepend joinedPlan if absent | setCityPlans ← remove plan", { planId: targetPlan.id, activity_type: targetPlan.activity_type, city: targetPlan.city });
    console.trace("[SET:handleConfirmJoinPreview]");
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

  // Show full-page chat when a plan is selected.
  // is_auto_generated plans (dinner/brunch clusters) use GroupChatView — it has
  // venue, attendee count, and the X/7 capacity pill.
  // User-created plans (is_auto_generated false/null) keep PlanGroupChatView.
  if (selectedPlan && showChatView) {
    if (selectedPlan.is_auto_generated) {
      return (
        <GroupChatView
          activityType={selectedPlan.activity_type}
          city={selectedPlan.city}
          onBack={handleBackFromChat}
          attendeeCount={selectedPlan.participant_count || 1}
          eventDate={selectedPlan.scheduled_for}
          activityId={selectedPlan.id}
        />
      );
    }
    return (
      <PlanGroupChatView
        activity={{
          ...selectedPlan,
          note: selectedPlan.note,
          created_at: selectedPlan.scheduled_for,
          updated_at: selectedPlan.scheduled_for,
          promo_video_url: selectedPlan.promo_video_url ?? null,
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
        activityId={selectedCarouselActivity.realActivityId ?? null}
      />
    );
  }

  return (
    <div className="flex flex-col h-full relative bg-white dark:bg-white">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      {/* In list mode: normal flow with border. In feed mode: absolute overlay with gradient. */}
      <div className="flex flex-col px-4 py-3 gap-2 shrink-0 border-b border-neutral-200 bg-white dark:bg-white dark:border-neutral-200">
        {/* Title */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-gray-900 dark:text-gray-900">
            {t('plans.myPlans')}
          </h2>
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
            {t('plans.myCity')}
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
            🌍 {t('common.allCities')}
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
          {t("common.allCities")}
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
          <PlansEmptyState onJoinActivity={onJoinActivity ?? (() => {})} />
        ) : (
          <>
            {/* Joined / own plans */}
            {activities.map((plan) => (
              <SwipeableCard
                key={plan.id}
                canDelete={false}
                onDelete={() => {}}
                canLeave={!!plan.isJoined && (plan.isCarouselJoin || plan.user_id !== user?.id)}
                onLeave={() => setPlanToLeave(plan)}
                onClick={() => handlePlanClick(plan)}
                className="w-full text-left p-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-50 dark:border-gray-200 dark:hover:bg-gray-100 cursor-pointer transition-colors"
                style={{}}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                    {isStandardActivity(plan.activity_type) ? (
                      getActivityIcon(plan.activity_type) ? (
                        <img src={getActivityIcon(plan.activity_type)!} alt={plan.activity_type} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">{getActivityEmoji(plan.activity_type)}</span>
                      )
                    ) : plan.promo_video_url ? (
                      <video src={plan.promo_video_url} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                    ) : plan.creator_avatar ? (
                      <img src={plan.creator_avatar} alt={plan.creator_name || "Creator"} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-base font-bold text-gray-500">
                        {plan.creator_name?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">
                        {plan.isCarouselJoin ? getActivityLabel(plan.activity_type) : (plan.note || getActivityLabel(plan.activity_type))}
                      </h3>
                      {plan.isJoined && (
                        !plan.is_auto_generated && plan.user_id === user?.id ? (
                          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">
                            {t('plans.yourPlan')}
                          </span>
                        ) : (
                          <span className="text-xs bg-green-50 text-green-600 border border-green-200 px-1.5 py-0.5 rounded-full">
                            {t('common.joined')} ✓
                          </span>
                        )
                      )}
                      {isSoon(plan.scheduled_for) && (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                          🔴 {t('plans.soon')}
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
                      {!plan.isCarouselJoin && !plan.is_auto_generated && (
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
                      ) : isToday(parseDbDate(plan.scheduled_for)) ? (
                        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 font-semibold px-2 py-0.5 rounded-full animate-pulse">
                          {t('common.today')}
                        </span>
                      ) : isTomorrow(parseDbDate(plan.scheduled_for)) ? (
                        <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 font-semibold px-2 py-0.5 rounded-full">
                          {t('common.tomorrow')}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-600">
                          {format(parseDbDate(plan.scheduled_for), "EEE, d MMM")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    {/* Report button (only for non-owners on custom activities) */}
                    {user && plan.user_id !== user.id && !isStandardActivity(plan.activity_type) && (
                      <ReportContentButton contentId={plan.id} contentType="post" iconOnly />
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleSharePlan(plan, e)}
                      className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-all border border-gray-200"
                      title={t('plans.inviteFriend')}
                      aria-label={t('plans.inviteFriend')}
                    >
                      <Send className="w-4 h-4 text-gray-500" />
                      <span className="text-[10px] text-gray-400 leading-none whitespace-nowrap">{t('plans.inviteFriend')}</span>
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
                {showAllCities && activities.length > 0 && (
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2 pb-0.5">
                    🌍 {t('plans.liveFeedAllCities')}
                  </div>
                )}
                {cityPlans.filter(p => !activities.some(a => a.id === p.id)).map((plan) => (
                  <SwipeableCard
                    key={plan.id}
                    canDelete={false}
                    onDelete={() => {}}
                    onClick={() => handleCityPlanClick(plan)}
                    className="w-full text-left p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-50 dark:border-gray-200 dark:hover:bg-gray-100 cursor-pointer transition-colors"
                    style={{}}
                  >
                    <div className="flex items-start gap-3">
                      {/* Activity icon for standard types, creator avatar for custom plans */}
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                        {isStandardActivity(plan.activity_type) ? (
                          getActivityIcon(plan.activity_type) ? (
                            <img src={getActivityIcon(plan.activity_type)!} alt={plan.activity_type} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl">{getActivityEmoji(plan.activity_type)}</span>
                          )
                        ) : plan.promo_video_url ? (
                          <video src={plan.promo_video_url} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                        ) : plan.creator_avatar ? (
                          <img src={plan.creator_avatar} alt={plan.creator_name || "Creator"} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-base font-bold text-gray-500">
                            {plan.creator_name?.charAt(0)?.toUpperCase() || "?"}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Activity type name — icon is already in the left circle */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-semibold text-gray-900 text-sm">
                            {plan.isCarouselJoin ? getActivityLabel(plan.activity_type) : (plan.note || getActivityLabel(plan.activity_type))}
                            {showAllCities && ` · ${plan.city}`}
                          </h3>
                          {isSoon(plan.scheduled_for) && (
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                              🔴 {t('plans.soon')}
                            </span>
                          )}
                          {!plan.is_auto_generated && plan.user_id === user?.id ? (
                            /* Owner: never show Join or price CTA */
                            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">
                              {t('plans.yourPlan')}
                            </span>
                          ) : plan.price_amount ? (
                            <span className="text-xs bg-green-50 text-green-700 border border-green-200 font-semibold px-2 py-0.5 rounded-full">
                              {plan.price_amount}
                            </span>
                          ) : (
                            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full">
                              {t('common.join', 'Join')}
                            </span>
                          )}
                        </div>

                        {/* City (My City only) + organiser */}
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {!showAllCities && <span className="text-xs font-medium text-primary">{plan.city}</span>}
                          {!showAllCities && <span className="text-xs text-gray-400">·</span>}
                          {!plan.is_auto_generated && (
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
                          )}
                        </div>

                        {/* Date + time */}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="text-xs text-gray-500">
                            {plan.scheduled_for
                              ? format(parseDbDate(plan.scheduled_for), "EEE, d MMM · h:mm a")
                              : t('common.today')}
                          </span>
                          {plan.scheduled_for && isToday(parseDbDate(plan.scheduled_for)) && (
                            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 font-semibold px-1.5 py-0.5 rounded-full animate-pulse">
                              {t('common.today')}
                            </span>
                          )}
                          {plan.scheduled_for && isTomorrow(parseDbDate(plan.scheduled_for)) && (
                            <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 font-semibold px-1.5 py-0.5 rounded-full">
                              {t('common.tomorrow')}
                            </span>
                          )}
                        </div>

                        {/* Attendee count */}
                        <div className="flex items-center gap-1 mt-1">
                          <Users className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {plan.participant_count ?? 0}{plan.is_auto_generated ? `/${MAX_GROUP_CAPACITY}` : ""} {t('common.joined').toLowerCase()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isStandardActivity(plan.activity_type) && (
                          <ReportContentButton contentId={plan.id} contentType="post" iconOnly />
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleSharePlan(plan, e)}
                          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-all border border-gray-200"
                          title={t('plans.inviteFriend')}
                          aria-label={t('plans.inviteFriend')}
                        >
                          <Send className="w-4 h-4 text-gray-500" />
                          <span className="text-[10px] text-gray-400 leading-none whitespace-nowrap">{t('plans.inviteFriend')}</span>
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
      {/* Leave Confirmation Dialog */}
      <AlertDialog open={!!planToLeave} onOpenChange={(open) => !open && setPlanToLeave(null)}>
        <AlertDialogContent className="border-2 border-destructive/40">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('plans.leavePlanTitle', { activity: planToLeave ? getActivityLabel(planToLeave.activity_type) : "" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('plans.leavePlanDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeavePlan} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('plans.leaveBtn')}
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
              <p className="text-xl font-bold text-gray-900">{t('plans.holdOnTitle')}</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                {t('plans.duplicateActivityDesc', {
                  activity: getActivityLabel(duplicateActivityBlock.activityType),
                  oldCity: duplicateActivityBlock.oldCity,
                  newCity: duplicateActivityBlock.newCity,
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDuplicateActivityBlock(null);
                // Switch to All Cities so the user can see their existing plan
                // regardless of which city is currently selected.
                setShowAllCities(true);
              }}
              className="w-full h-11 rounded-full font-semibold text-base text-white transition-all hover:opacity-90 active:scale-95 bg-blue-600"
            >
              {t('plans.seeMyPlan', { activity: getActivityLabel(duplicateActivityBlock.activityType) })}
            </button>
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
              {t('plans.gotIt')}
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

          {planPreview.promo_video_url ? (
            /* ── VIDEO PLAN: full-bleed portrait card ── */
            <div className="relative z-10 w-full max-w-sm pointer-events-auto flex flex-col gap-3">
              {/* Back arrow */}
              <button
                type="button"
                onClick={() => setPlanPreview(null)}
                className="self-start w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white"
                style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Portrait video card */}
              <button
                type="button"
                onClick={() => setPlanPreviewVideoFullscreen(true)}
                className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden block"
                aria-label="View video fullscreen"
              >
                <video
                  src={planPreview.promo_video_url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Gradient scrim */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.18) 45%, transparent 100%)" }}
                />
                {/* Expand icon top-right */}
                <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center pointer-events-none">
                  <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                </div>
                {/* Overlay: creator avatar + title + meta */}
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pointer-events-none">
                  <div className="flex items-end gap-3">
                    {/* Creator avatar — tappable via stopPropagation below */}
                    <div
                      className="w-10 h-10 rounded-full bg-white/20 border border-white/40 overflow-hidden shrink-0 flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (planPreview.user_id) {
                          setPlanPreview(null);
                          setSelectedUserProfile({
                            userId: planPreview.user_id,
                            userName: planPreview.creator_name || null,
                            avatarUrl: planPreview.creator_avatar || null,
                          });
                        }
                      }}
                      style={{ cursor: "pointer", pointerEvents: "auto" }}
                    >
                      {planPreview.creator_avatar ? (
                        <img src={planPreview.creator_avatar} alt={planPreview.creator_name || ""} className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <span className="text-sm font-bold text-white">{planPreview.creator_name?.charAt(0)?.toUpperCase() || "?"}</span>
                      )}
                    </div>
                    {/* Text */}
                    <div className="flex-1 min-w-0" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
                      <p className="font-bold text-white truncate">
                        {planPreview.note || getActivityLabel(planPreview.activity_type) || t('plans.untitledPlan')}
                      </p>
                      <p className="text-xs text-white/80 mt-0.5 truncate">
                        {planPreview.city}
                        {planPreview.scheduled_for && ` · ${
                          isToday(parseDbDate(planPreview.scheduled_for))
                            ? t('common.today')
                            : isTomorrow(parseDbDate(planPreview.scheduled_for))
                            ? t('common.tomorrow')
                            : format(parseDbDate(planPreview.scheduled_for), "EEE, d MMM")
                        } · ${format(parseDbDate(planPreview.scheduled_for), "h:mm a")}`}
                      </p>
                    </div>
                  </div>
                </div>
              </button>

              {/* Enter chat (owner) / JOIN (others) */}
              {planPreview.user_id === user?.id ? (
                <button
                  type="button"
                  onClick={() => { setPlanPreview(null); setSelectedPlan(planPreview); setShowChatView(true); }}
                  className="w-full h-12 rounded-full font-semibold text-base text-white transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(to right, rgba(88,28,135,0.9), rgba(67,56,202,0.8))" }}
                >
                  {t('plans.enterChat')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmJoinPreview}
                  className="w-full h-12 rounded-full font-semibold text-base text-white transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(to right, rgba(88,28,135,0.9), rgba(67,56,202,0.8))" }}
                >
                  {t('plans.joinBtn')}
                </button>
              )}
            </div>
          ) : (
            /* ── NO-VIDEO PLAN: existing simple modal, untouched ── */
            <div className="relative z-10 w-full max-w-md rounded-3xl bg-white shadow-2xl pointer-events-auto overflow-hidden">
              <div className="px-6 pt-6 pb-4 space-y-4">
                {/* Organizer avatar */}
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
                    {planPreview.note || getActivityLabel(planPreview.activity_type) || t('plans.untitledPlan')}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {planPreview.activity_type !== "general" && `${getActivityLabel(planPreview.activity_type)} · `}{planPreview.city}
                  </p>
                  <p className="text-sm text-gray-500">
                    {!planPreview.scheduled_for
                      ? t('common.today')
                      : isToday(parseDbDate(planPreview.scheduled_for))
                      ? `${t('common.today')} · ${format(parseDbDate(planPreview.scheduled_for), "h:mm a")}`
                      : isTomorrow(parseDbDate(planPreview.scheduled_for))
                      ? `${t('common.tomorrow')} · ${format(parseDbDate(planPreview.scheduled_for), "h:mm a")}`
                      : format(parseDbDate(planPreview.scheduled_for), "EEE, d MMM · h:mm a")}
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
                      {(planPreview.participant_count ?? 0) > 4 ? '+' : ''}{t('plans.going', { count: planPreview.participant_count ?? 0 })}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 space-y-2">
                {planPreview.user_id === user?.id ? (
                  <button
                    type="button"
                    onClick={() => { setPlanPreview(null); setSelectedPlan(planPreview); setShowChatView(true); }}
                    className="w-full h-12 rounded-full font-semibold text-base text-white transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(to right, rgba(88,28,135,0.9), rgba(67,56,202,0.8))" }}
                  >
                    {t('plans.enterChat')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirmJoinPreview}
                    className="w-full h-12 rounded-full font-semibold text-base text-white transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(to right, rgba(88,28,135,0.9), rgba(67,56,202,0.8))" }}
                  >
                    {t('plans.yesImIn')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPlanPreview(null)}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  {t('plans.humBtn', 'Hum!')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen video overlay for video-plan preview */}
      {planPreviewVideoFullscreen && planPreview?.promo_video_url && (
        <div
          className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
          onClick={() => setPlanPreviewVideoFullscreen(false)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setPlanPreviewVideoFullscreen(false); }}
            className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-full bg-white/20 text-white"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <video
            src={planPreview.promo_video_url}
            autoPlay
            loop
            playsInline
            controls
            onClick={(e) => e.stopPropagation()}
            className="w-full h-full object-contain"
          />
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

      {/* ── Swipe feed ─────────────────────────────────────────────────── */}
      {feedOpen && (
        <PlanSwipeFeed
          plans={cityPlans}
          startIndex={feedStartIndex}
          myCity={selectedCity}
          onClose={() => setFeedOpen(false)}
          onJoinInPlace={(plan) => handleFeedJoin(plan as PlanActivity)}
          onPayForPlan={(plan) => {
            setFeedOpen(false);
            setPaidActivityDetail(plan as PlanActivity);
          }}
          onEnterChat={(plan) => {
            setFeedOpen(false);
            setSelectedPlan(plan as PlanActivity);
            setShowChatView(true);
          }}
          onViewProfile={(userId, userName, avatarUrl) => {
            setSelectedUserProfile({ userId, userName, avatarUrl });
          }}
        />
      )}

      {/* ── Auto-generated activity details overlay ───────────────────── */}
      {autoGenCardPlan && (() => {
        const alreadyJoined = activities.some(
          a => a.activity_type === autoGenCardPlan.activity_type
            && normalizeCity(a.city) === normalizeCity(autoGenCardPlan.city)
            && a.isJoined
        );
        const matchingActivity = activities.find(
          a => a.activity_type === autoGenCardPlan.activity_type
            && normalizeCity(a.city) === normalizeCity(autoGenCardPlan.city)
            && a.isJoined
        ) ?? autoGenCardPlan;
        const activityObj = ALL_ACTIVITY_TYPES.find(a => a.id === autoGenCardPlan.activity_type);
        const dayName = autoGenCardPlan.scheduled_for
          ? format(parseDbDate(autoGenCardPlan.scheduled_for), 'EEEE')
          : getActivityDay(autoGenCardPlan.activity_type) ?? "";
        const time = autoGenCardPlan.activity_type === 'dinner' ? '7:00 PM'
          : autoGenCardPlan.activity_type === 'drinks' ? '8:00 PM'
          : null;
        return (
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setAutoGenCardPlan(null)}>
            <ActivityDetailsCard
              show={true}
              activity={activityObj ? {
                id: activityObj.id,
                label: getActivityLabel(autoGenCardPlan.activity_type),
                emoji: getActivityEmoji(autoGenCardPlan.activity_type),
                icon: getActivityIcon(autoGenCardPlan.activity_type) ?? undefined,
                isProposePlan: false,
              } : null}
              dayName={dayName}
              time={time}
              joinCity={autoGenCardPlan.city}
              carouselJoinCount={autoGenCardPlan.participant_count ?? 0}
              maxGroupSize={MAX_GROUP_CAPACITY}
              hasNoVenue={false}
              showDifferentCity={false}
              confirmLabel={alreadyJoined ? t('plans.joinGroupChat') : undefined}
              onConfirm={() => {
                setAutoGenCardPlan(null);
                if (alreadyJoined) {
                  setSelectedPlan(matchingActivity);
                  setShowChatView(true);
                } else {
                  handleDirectCityJoin(autoGenCardPlan);
                }
              }}
              onClose={() => setAutoGenCardPlan(null)}
            />
          </div>
        );
      })()}

    </div>
  );
}
