import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Users, Ticket, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { useNavigate } from "react-router-dom";
import { GroupChatView } from "./GroupChatView";
import { PlanGroupChatView } from "./PlanGroupChatView";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isTomorrow } from "date-fns";
import { ALL_ACTIVITY_TYPES, ACTIVITY_TYPES, getActivityDay, getNextOccurrenceDate, getActivityIcon } from "@/data/activityTypes";
import { formatDateWithTranslation } from "@/lib/date-utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingSpinner } from "../LoadingSpinner";
import { useTranslation } from "react-i18next";
import { buildEventChatNavigateState } from "@/lib/eventChatNavigation";
import { isEventChatMembershipExplicitlyExpired } from "@/lib/eventChatMembership";
import {
  getPendingEventChatsForMerge,
  removePendingEventChat,
  PENDING_EVENT_CHAT_CHANGED,
} from "@/lib/pendingEventChat";
import { logPostgrestError } from "@/lib/supabaseErrorLog";
import { useSettlingGradient } from "@/hooks/useSettlingGradient";
import { PrivateChatDialog } from "@/components/PrivateChatDialog";
import { getDisplayAvatarUrl } from "@/lib/avatar";

function safeActivityDate(iso: string | undefined): Date {
  if (!iso) return new Date();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

interface ChatActivity {
  id: string;
  activity_type: string;
  city: string;
  scheduled_for: string;
  participant_count: number;
  unread_count?: number;
  is_plan: boolean;
  plan_id?: string;
  creator_name?: string;
  creator_avatar?: string;
  note?: string | null;
  // Event chats
  is_event?: boolean;
  event_id?: string;
  event_name?: string;
  expires_at?: string;
  event_venue?: string;
  // Private (DM) chats
  is_private?: boolean;
  other_user_id?: string;
  other_user_name?: string | null;
  other_user_avatar?: string | null;
  last_message_preview?: string | null;
}

interface ChatTabProps {
  onChatViewChange?: (isInChat: boolean) => void;
  pendingActivity?: { activityType: string; city: string } | null;
  onPendingActivityHandled?: () => void;
  pendingPlanActivityId?: string | null;
  onPendingPlanActivityHandled?: () => void;
  /** Open a private chat directly (e.g. from a push notification deep link). */
  pendingPrivateChatUserId?: string | null;
  onPendingPrivateChatHandled?: () => void;
  /** False while another bottom tab is selected; refetch when user returns so new memberships appear. */
  isActiveTab?: boolean;
}

export function ChatTab({
  onChatViewChange,
  pendingActivity,
  onPendingActivityHandled,
  pendingPlanActivityId,
  onPendingPlanActivityHandled,
  pendingPrivateChatUserId,
  onPendingPrivateChatHandled,
  isActiveTab = true,
}: ChatTabProps = {}) {
  const { t, i18n } = useTranslation();
  const { style: chatSettlingGradientStyle } = useSettlingGradient("chat");
  const { selectedLanguage } = useLanguage();
  const { user } = useAuth();
  const { selectedCity } = useCity();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ChatActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [showPlanChatDialog, setShowPlanChatDialog] = useState(false);
  const [selectedChatActivity, setSelectedChatActivity] = useState<{ activityType: string; city: string } | null>(null);
  const [selectedPlanActivity, setSelectedPlanActivity] = useState<any>(null);
  const [selectedPrivateChat, setSelectedPrivateChat] = useState<{
    userId: string;
    name: string | null;
    avatar: string | null;
  } | null>(null);
  const { getActivityJoinCount } = useActivityJoins(selectedCity);

  // Notify parent when entering/leaving chat view
  useEffect(() => {
    const isInChat = showChatDialog || showPlanChatDialog || !!selectedPrivateChat;
    onChatViewChange?.(isInChat);
  }, [showChatDialog, showPlanChatDialog, selectedPrivateChat, onChatViewChange]);

  // Handle deep-link from push notification tap
  useEffect(() => {
    if (!pendingPlanActivityId) return;
    supabase
      .from("user_activities")
      .select("*")
      .eq("id", pendingPlanActivityId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSelectedPlanActivity(data);
          setShowPlanChatDialog(true);
        }
        onPendingPlanActivityHandled?.();
      });
  }, [pendingPlanActivityId, onPendingPlanActivityHandled]);

  // Handle pending activity from carousel join (open chat immediately)
  useEffect(() => {
    if (pendingActivity) {
      setSelectedChatActivity(pendingActivity);
      setShowChatDialog(true);
      onPendingActivityHandled?.();
    }
  }, [pendingActivity, onPendingActivityHandled]);

  // Handle deep-link from push notification to a private chat
  useEffect(() => {
    if (!pendingPrivateChatUserId) return;
    // Try to find the user info from already-loaded activities
    const existing = activities.find(a => a.is_private && a.other_user_id === pendingPrivateChatUserId);
    setSelectedPrivateChat({
      userId: pendingPrivateChatUserId,
      name: existing?.other_user_name ?? null,
      avatar: existing?.other_user_avatar ?? null,
    });
    onPendingPrivateChatHandled?.();
  }, [pendingPrivateChatUserId, onPendingPrivateChatHandled]);

  const fetchActivities = useCallback(async () => {
    if (!user?.id) {
      setActivities([]);
      setIsLoading(false);
      return;
    }

    const fetchNonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log("[ChatTab] fetchActivities start (fresh query)", { fetchNonce, userId: user.id });

    setIsLoading(true);

    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayIso = startOfToday.toISOString();

      // ── Step 1: Fetch all top-level data in parallel ──────────────────────
      const [
        { data: carouselJoins, error: carouselError },
        { data: planJoins, error: planJoinsError },
        { data: userPlans, error: userPlansError },
        eventMembershipsResult,
        { data: sentGreetings },
        { data: receivedGreetings },
        { data: hiddenConvos },
        { data: blockedUsers },
      ] = await Promise.all([
        supabase
          .from("activity_joins")
          .select("activity_type, city, joined_at, expires_at")
          .eq("user_id", user.id)
          .is("activity_id", null),
        supabase
          .from("activity_joins")
          .select("activity_id")
          .eq("user_id", user.id)
          .not("activity_id", "is", null),
        supabase
          .from("user_activities")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .gte("scheduled_for", todayIso),
        supabase
          .from("event_chat_members")
          .select("event_id, user_id, paid_at, expires_at, event_name, event_starts_at, amount_cents, id, stripe_payment_intent_id")
          .eq("user_id", user.id),
        supabase.from("greetings").select("to_user_id").eq("from_user_id", user.id),
        supabase.from("greetings").select("from_user_id, created_at").eq("to_user_id", user.id),
        supabase.from("private_conversation_hidden").select("other_user_id").eq("user_id", user.id),
        supabase.from("user_blocks").select("blocked_id").eq("blocker_id", user.id),
      ]);

      if (carouselError) throw carouselError;
      if (planJoinsError) throw planJoinsError;
      if (userPlansError) throw userPlansError;

      console.log("[DEBUG] carouselJoins raw", carouselJoins?.length, carouselJoins);
      console.log("[DEBUG] planJoins raw", planJoins?.length, planJoins);

      // ── Step 2: Fetch joined plans (depends on planJoins) ─────────────────
      const joinedPlanIds = (planJoins || []).map(j => j.activity_id).filter(Boolean) as string[];
      let joinedPlans: any[] = [];
      if (joinedPlanIds.length > 0) {
        const { data: joinedPlansData } = await supabase
          .from("user_activities")
          .select("*")
          .in("id", joinedPlanIds)
          .eq("is_active", true)
          .gte("scheduled_for", todayIso);
        joinedPlans = joinedPlansData || [];
      }

      // ── Step 3: Process carousel joins, plans, and events in parallel ─────
      const allPlans = [...(userPlans || []), ...joinedPlans];
      const uniquePlans = new Map<string, any>();
      allPlans.forEach(p => uniquePlans.set(p.id, p));

      // Parse event memberships from step 1
      let eventMemberships: Record<string, unknown>[] = [];
      try {
        const { data: eventMembershipsRaw, error: eventMembershipsError, status: eventMembershipsStatus } = eventMembershipsResult;
        if (eventMembershipsError) {
          if (eventMembershipsStatus !== 400) logPostgrestError("ChatTab event_chat_members select", eventMembershipsError);
        } else if (Array.isArray(eventMembershipsRaw)) {
          eventMemberships = eventMembershipsRaw as Record<string, unknown>[];
        }
      } catch { /* optional — never block rendering */ }

      console.log("[ChatTab] event_chat_members response", {
        fetchNonce,
        rowCount: eventMemberships.length,
      });

      // ── Compute matches from greetings, minus hidden/blocked ───────────────
      const sentToIds = new Set((sentGreetings || []).map(g => g.to_user_id));
      const receivedFromIds = new Set((receivedGreetings || []).map(g => g.from_user_id));
      const hiddenIds = new Set((hiddenConvos || []).map(h => h.other_user_id));
      const blockedIds = new Set((blockedUsers || []).map(b => b.blocked_id));
      const matchedUserIds = [...sentToIds].filter(
        id => receivedFromIds.has(id) && !hiddenIds.has(id) && !blockedIds.has(id)
      );

      // Process all groups in parallel (carousel, plans, events, private chats)
      const [carouselResults, planResults, eventResults, privateResults] = await Promise.all([
        // ── Carousel joins ──────────────────────────────────────────────────
        Promise.all(
          (carouselJoins || []).map(async (join) => {
            const [{ count }, { data: readStatus }] = await Promise.all([
              supabase
                .from("activity_joins")
                .select("*", { count: "exact", head: true })
                .eq("activity_type", join.activity_type)
                .eq("city", join.city)
                .is("activity_id", null),
              supabase
                .from("activity_read_status")
                .select("last_read_at")
                .eq("user_id", user.id)
                .eq("activity_type", join.activity_type)
                .eq("city", join.city)
                .maybeSingle(),
            ]);
            const lastReadAt = readStatus?.last_read_at || todayIso;
            const { count: unreadCount } = await supabase
              .from("activity_messages")
              .select("*", { count: "exact", head: true })
              .eq("activity_type", join.activity_type)
              .eq("city", join.city)
              .gt("created_at", lastReadAt)
              .neq("user_id", user.id);

            const nextOccurrence = getNextOccurrenceDate(join.activity_type);
            return {
              id: `carousel-${join.activity_type}-${join.city}`,
              activity_type: join.activity_type,
              city: join.city,
              scheduled_for: nextOccurrence.toISOString(),
              participant_count: count || 1,
              unread_count: unreadCount || 0,
              is_plan: false,
              note: getActivityDay(join.activity_type) ? `This ${getActivityDay(join.activity_type)}` : null,
            } as ChatActivity;
          })
        ),

        // ── Plans ───────────────────────────────────────────────────────────
        Promise.all(
          Array.from(uniquePlans.values()).map(async (plan) => {
            const [{ data: profile }, { count }, { data: planReadStatus }] = await Promise.all([
              supabase.from("profiles").select("name, avatar_url").eq("user_id", plan.user_id).maybeSingle(),
              supabase.from("activity_joins").select("*", { count: "exact", head: true }).eq("activity_id", plan.id),
              supabase.from("activity_read_status").select("last_read_at").eq("user_id", user.id).eq("activity_type", plan.id).maybeSingle(),
            ]);
            const lastPlanRead = planReadStatus?.last_read_at || plan.created_at;
            const { count: unreadPlanCount } = await supabase
              .from("plan_messages")
              .select("*", { count: "exact", head: true })
              .eq("activity_id", plan.id)
              .gt("created_at", lastPlanRead)
              .neq("user_id", user.id);

            return {
              id: plan.id,
              activity_type: plan.activity_type,
              city: plan.city,
              scheduled_for: plan.scheduled_for,
              participant_count: count || 0,
              unread_count: unreadPlanCount || 0,
              is_plan: true,
              plan_id: plan.id,
              creator_name: profile?.name || "Anonymous",
              creator_avatar: profile?.avatar_url,
              note: plan.note,
            } as ChatActivity;
          })
        ),

        // ── Event memberships ───────────────────────────────────────────────
        Promise.all(
          (eventMemberships as Record<string, unknown>[])
            .filter((membership) => {
              if (isEventChatMembershipExplicitlyExpired(membership as { expires_at?: string | null; event_starts_at?: string | null })) {
                console.log("[ChatTab] skip event row (explicit expires_at in past)", { event_id: membership.event_id });
                return false;
              }
              if (!membership.event_id) {
                console.warn("[ChatTab] skip event membership row missing event_id", membership);
                return false;
              }
              return true;
            })
            .map(async (membership) => {
              const eventId = membership.event_id as string;

              const expiresAt =
                typeof membership.event_starts_at === "string" && membership.event_starts_at.trim()
                  ? (() => { const s = new Date(membership.event_starts_at as string); return Number.isNaN(s.getTime()) ? null : new Date(s.getTime() + 12 * 60 * 60 * 1000); })()
                  : typeof membership.expires_at === "string" && membership.expires_at.trim()
                    ? (() => { const d = new Date(membership.expires_at as string); return Number.isNaN(d.getTime()) ? null : d; })()
                    : null;

              const parsedName =
                typeof membership.event_name === "string" && membership.event_name.trim()
                  ? membership.event_name.trim()
                  : t('chat.eventChat', 'Event Chat');
              const parsedVenue = parsedName.includes(" · ") ? parsedName.split(" · ")[1] : t('chat.eventFallback', 'Event');

              const startFromDb = membership.event_starts_at ? new Date(membership.event_starts_at as string) : null;
              const hasValidStart = startFromDb && !Number.isNaN(startFromDb.getTime());
              const scheduledFor = hasValidStart
                ? startFromDb!.toISOString()
                : expiresAt ? expiresAt.toISOString() : new Date().toISOString();

              // participantCount and chatMeta in parallel
              const [{ count: participantCount }, { data: chatMeta }] = await Promise.all([
                supabase.from("event_chat_members").select("event_id", { count: "exact", head: true }).eq("event_id", eventId),
                supabase.from("event_chats").select("id").eq("event_id", eventId).maybeSingle(),
              ]);

              const { data: lastMsg } = chatMeta?.id
                ? await supabase
                    .from("event_chat_messages")
                    .select("content, created_at")
                    .eq("event_chat_id", chatMeta.id)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle()
                : { data: null };

              console.log("[ChatTab] merged event chat entry", {
                fetchNonce, event_id: eventId, event_name: parsedName, scheduled_for: scheduledFor,
                participant_count: participantCount ?? 1,
                last_message_preview: lastMsg?.content?.slice(0, 80) ?? null,
                last_message_at: lastMsg?.created_at ?? null,
              });

              return {
                id: `event-${eventId}`,
                activity_type: "event",
                city: parsedVenue,
                scheduled_for: scheduledFor,
                participant_count: participantCount || 1,
                is_plan: false,
                is_event: true,
                event_id: eventId,
                event_name: parsedName,
                event_venue: parsedVenue,
                expires_at: expiresAt ? expiresAt.toISOString() : undefined,
              } as ChatActivity;
            })
        ),

        // ── Private (DM) chats ────────────────────────────────────────────────
        Promise.all(
          matchedUserIds.map(async (otherUserId) => {
            const [{ data: profile }, { data: lastMsg }, { count: unreadCount }] = await Promise.all([
              supabase.from("profiles").select("name, avatar_url").eq("user_id", otherUserId).maybeSingle(),
              supabase
                .from("private_messages")
                .select("created_at, message, message_type")
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
              supabase
                .from("private_messages")
                .select("*", { count: "exact", head: true })
                .eq("sender_id", otherUserId)
                .eq("receiver_id", user.id)
                .is("read_at", null),
            ]);

            const lastMsgPreview = lastMsg
              ? (lastMsg.message_type === "image" ? "📷 Photo" : lastMsg.message_type === "video" ? "🎥 Video" : lastMsg.message_type === "gif" ? "🎞 GIF" : lastMsg.message.slice(0, 60))
              : null;

            return {
              id: `private-${otherUserId}`,
              activity_type: "private",
              city: "",
              scheduled_for: lastMsg?.created_at || new Date().toISOString(),
              participant_count: 2,
              unread_count: unreadCount || 0,
              is_plan: false,
              is_private: true,
              other_user_id: otherUserId,
              other_user_name: profile?.name || "Shaker",
              other_user_avatar: profile?.avatar_url || null,
              last_message_preview: lastMsgPreview,
            } as ChatActivity;
          })
        ),
      ]);

      const chatActivities: ChatActivity[] = [...carouselResults, ...planResults, ...eventResults, ...privateResults];

      const serverEventIds = new Set(
        chatActivities.filter((a) => a.is_event && a.event_id).map((a) => a.event_id as string),
      );
      for (const p of getPendingEventChatsForMerge()) {
        if (serverEventIds.has(p.event_id)) {
          removePendingEventChat(p.event_id);
          continue;
        }
        const exp = p.expires_at ? new Date(p.expires_at) : null;
        const hasExp = exp && !Number.isNaN(exp.getTime());
        const startFromPayload = p.event_starts_at ? new Date(p.event_starts_at as string) : null;
        const hasValidStart = startFromPayload && !Number.isNaN(startFromPayload.getTime());
        const scheduledFor = hasValidStart
          ? startFromPayload!.toISOString()
          : hasExp
            ? exp!.toISOString()
            : new Date().toISOString();
        const cityLabel = (p.city && p.city.trim()) || t('chat.eventFallback', 'Event');
        const displayName = (p.event_name && p.event_name.trim()) || t('chat.eventChat', 'Event Chat');

        chatActivities.push({
          id: `event-${p.event_id}`,
          activity_type: "event",
          city: cityLabel,
          scheduled_for: scheduledFor,
          participant_count: 1,
          is_plan: false,
          is_event: true,
          event_id: p.event_id,
          event_name: displayName,
          event_venue: cityLabel,
          expires_at: hasExp ? exp!.toISOString() : undefined,
        });
      }

      const eventSlice = chatActivities.filter((a) => a.is_event);
      console.log("[ChatTab] chatActivities before sort (includes event + carousel + plans)", {
        fetchNonce,
        length: chatActivities.length,
        eventCount: eventSlice.length,
        activities: chatActivities.map((a) => ({
          id: a.id,
          is_event: a.is_event,
          event_id: a.event_id,
          event_name: a.event_name,
          city: a.city,
          scheduled_for: a.scheduled_for,
          expires_at: a.expires_at,
        })),
      });

      // Sort with Today first, Tomorrow second, then chronologically
      chatActivities.sort((a, b) => {
        const dateA = safeActivityDate(a.scheduled_for);
        const dateB = safeActivityDate(b.scheduled_for);
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

      console.log("[DEBUG] chatActivities assembled", chatActivities?.length, chatActivities);
      setActivities(chatActivities);
    } catch (error) {
      console.error("Error fetching chat activities:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fresh list every time the Chat tab becomes active (not only on first mount).
  useEffect(() => {
    if (!user?.id) return;
    if (!isActiveTab) return;
    void fetchActivities();
  }, [user?.id, isActiveTab, fetchActivities]);

  // Realtime while Chat tab is active; cleanup while inactive.
  useEffect(() => {
    if (!isActiveTab || !user?.id) return;

    const channel = supabase
      .channel(`chat-tab-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_joins", filter: `user_id=eq.${user.id}` },
        () => fetchActivities()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_messages" },
        () => fetchActivities()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plan_messages" },
        () => fetchActivities()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_chat_members", filter: `user_id=eq.${user.id}` },
        () => fetchActivities()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_chat_messages" },
        () => fetchActivities()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "greetings" },
        (payload) => {
          const r = payload.new as any;
          const o = payload.old as any;
          if (r?.from_user_id === user.id || r?.to_user_id === user.id ||
              o?.from_user_id === user.id || o?.to_user_id === user.id) {
            fetchActivities();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "private_messages" },
        (payload) => {
          const r = payload.new as any;
          if (r?.sender_id === user.id || r?.receiver_id === user.id) {
            fetchActivities();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "private_conversation_hidden", filter: `user_id=eq.${user.id}` },
        () => fetchActivities()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_blocks", filter: `blocker_id=eq.${user.id}` },
        () => fetchActivities()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActivities, user, isActiveTab]);

  useEffect(() => {
    const onPending = () => {
      if (isActiveTab && user?.id) void fetchActivities();
    };
    window.addEventListener(PENDING_EVENT_CHAT_CHANGED, onPending);
    return () => window.removeEventListener(PENDING_EVENT_CHAT_CHANGED, onPending);
  }, [isActiveTab, user, fetchActivities]);

  // All activities from all cities are shown
  const filteredActivities = activities;

  const getActivityEmoji = (type: string) => {
    const activity = ALL_ACTIVITY_TYPES.find(a => a.id === type);
    return activity?.emoji || "📍";
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

  const handleActivityClick = async (activity: ChatActivity) => {
    if (activity.is_private && activity.other_user_id) {
      setSelectedPrivateChat({
        userId: activity.other_user_id,
        name: activity.other_user_name || null,
        avatar: activity.other_user_avatar || null,
      });
      return;
    }

    if (activity.is_event && activity.event_id) {
      navigate(`/chat/event/${activity.event_id}`, {
        state: buildEventChatNavigateState({
          name: activity.event_name || "Event chat",
          eventStartAt: activity.scheduled_for,
          city: activity.city,
          venue: activity.event_venue,
        }),
      });
      return;
    }

    if (activity.is_plan && activity.plan_id) {
      // Fetch full plan details
      const { data: plan } = await supabase
        .from("user_activities")
        .select("*")
        .eq("id", activity.plan_id)
        .maybeSingle();

      if (plan) {
        setSelectedPlanActivity(plan);
        setShowPlanChatDialog(true);
      }
    } else {
      setSelectedChatActivity({ activityType: activity.activity_type, city: activity.city });
      setShowChatDialog(true);
    }
  };

  const handleBackToActivities = () => {
    setShowChatDialog(false);
    setShowPlanChatDialog(false);
    setSelectedPlanActivity(null);
    setSelectedChatActivity(null);
    fetchActivities();
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center bg-white">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <MessageSquare className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-display font-bold mb-2">{t('common.signIn')}</h2>
        <p className="text-muted-foreground mb-6">
          {t('chat.startConversation')}
        </p>
        <button
          onClick={() => navigate("/auth")}
          className="px-6 py-3 rounded-full font-medium text-white hover:opacity-90 transition-all"
          style={{
            background: "linear-gradient(270deg, #f97316, #8b5cf6, #eab308, #ec4899, #22c55e, #3b82f6, #f97316)",
            backgroundSize: "400% 400%",
            animation: "gradientShift 4s ease infinite",
          }}
        >
          {t('common.signIn')}
        </button>
      </div>
    );
  }

  // Show full-page GroupChatView when a carousel activity is selected
  if (selectedChatActivity && showChatDialog) {
    // Find the scheduled_for date for the selected activity
    const selected = activities.find(
      (a) => a.activity_type === selectedChatActivity.activityType && a.city === selectedChatActivity.city
    );
    return (
      <GroupChatView
        activityType={selectedChatActivity.activityType}
        city={selectedChatActivity.city}
        homeCity={selectedCity}
        onBack={handleBackToActivities}
        attendeeCount={getActivityJoinCount(selectedChatActivity.activityType)}
        eventDate={selected?.scheduled_for || null}
      />
    );
  }

  // Show full-page PlanGroupChatView when a plan activity is selected
  if (selectedPlanActivity && showPlanChatDialog) {
    return (
      <PlanGroupChatView
        activity={selectedPlanActivity}
        onBack={handleBackToActivities}
      />
    );
  }

  // Show full-page PrivateChatDialog when a private match chat is selected
  if (selectedPrivateChat) {
    return (
      <PrivateChatDialog
        onClose={() => { setSelectedPrivateChat(null); fetchActivities(); }}
        otherUserId={selectedPrivateChat.userId}
        otherUserName={selectedPrivateChat.name}
        otherUserAvatar={selectedPrivateChat.avatar}
      />
    );
  }

  return (
    <>
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-white shrink-0">
        <h2 className="text-lg font-display font-bold text-neutral-900">{t('chat.title')}</h2>
        <div className="flex items-center gap-2">
        </div>
      </div>

      {/* Activities List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-white min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={chatSettlingGradientStyle}
            >
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <p className="text-neutral-600 mb-1">{t('common.noActiveChats')}</p>
            <p className="text-sm text-neutral-500">
              {t('common.joinActivityToChat')}
            </p>
          </div>
        ) : (
          <>
          {filteredActivities.map((activity) => {
            // ── Private (DM) chat row ──────────────────────────────────────
            if (activity.is_private) {
              return (
                <div
                  key={activity.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleActivityClick(activity)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleActivityClick(activity);
                    }
                  }}
                  className="w-full text-left rounded-xl p-4 transition-colors cursor-pointer relative border border-gray-200 bg-gray-50 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]"
                >
                  {(activity.unread_count ?? 0) > 0 && (
                    <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full z-[1]" />
                  )}
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-12 h-12 rounded-full overflow-hidden border border-neutral-200 shadow-sm shrink-0 flex items-center justify-center"
                      style={{ background: activity.other_user_avatar ? undefined : "linear-gradient(135deg, #00C6B6, #7c3aed)" }}
                    >
                      {activity.other_user_avatar ? (
                        <img
                          src={getDisplayAvatarUrl(activity.other_user_avatar) ?? activity.other_user_avatar}
                          alt={activity.other_user_name || "User"}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (parent) {
                              parent.style.background = "linear-gradient(135deg, #00C6B6, #7c3aed)";
                              const span = document.createElement("span");
                              span.className = "text-white font-bold text-lg";
                              span.textContent = (activity.other_user_name || "S").charAt(0).toUpperCase();
                              parent.appendChild(span);
                            }
                          }}
                        />
                      ) : (
                        <span className="text-white font-bold text-lg">
                          {(activity.other_user_name || "S").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-[15px] leading-snug truncate">
                          {activity.other_user_name || "Shaker"}
                        </h3>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-xl border border-purple-200 shrink-0">
                          Match
                        </span>
                      </div>
                      {activity.last_message_preview ? (
                        <p className="mt-0.5 text-[13px] text-gray-500 truncate">{activity.last_message_preview}</p>
                      ) : (
                        <p className="mt-0.5 text-[13px] text-gray-400 italic">Start a conversation!</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            const locationLine = activity.is_event
              ? (activity.event_venue ?? activity.city)
              : activity.city;
            const dateFormatted = formatDateWithTranslation(
              safeActivityDate(activity.scheduled_for),
              "EEE, d MMM",
              selectedLanguage.code
            );

            return (
            <div
              key={activity.id}
              role="button"
              tabIndex={0}
              onClick={() => handleActivityClick(activity)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleActivityClick(activity);
                }
              }}
              className="w-full text-left rounded-xl p-4 transition-colors cursor-pointer relative border border-gray-200 bg-gray-50 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]"
            >
              {/* Unread dot */}
              {(activity.unread_count ?? 0) > 0 && (
                <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full z-[1]" />
              )}

              <div className="flex items-start gap-3.5">
                <div className="relative shrink-0">
                  {activity.is_plan && activity.creator_avatar ? (
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-neutral-200 shadow-md">
                      <img src={activity.creator_avatar} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div
                      className={
                        activity.is_event
                          ? "w-12 h-12 rounded-full bg-[#a0c1f9] flex items-center justify-center shadow-sm"
                          : "w-12 h-12 rounded-full overflow-hidden"
                      }
                    >
                      {activity.is_event ? (
                        <Ticket className="w-6 h-6 text-white drop-shadow-sm" strokeWidth={2.25} />
                      ) : (
                        <img
                          src={getActivityIcon(activity.activity_type)}
                          alt={activity.activity_type}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="font-bold text-gray-900 text-[15px] leading-snug">
                      {activity.is_plan && activity.note
                        ? activity.note
                        : activity.is_event && activity.event_name
                        ? activity.event_name
                        : getActivityLabel(activity.activity_type)}
                    </h3>
                    {activity.is_plan && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-600 bg-gray-200 px-1.5 py-0.5 rounded-xl border border-gray-300">
                        {t('common.plan')}
                      </span>
                    )}
                    {activity.is_event && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-600 bg-gray-200 px-1.5 py-0.5 rounded-xl border border-gray-300">
                        {t('chat.eventBadge', 'EVENT')}
                      </span>
                    )}
                    {activity.is_event && (
                      <span className="text-[10px] font-medium text-gray-600 bg-gray-200 px-1.5 py-0.5 rounded-xl border border-gray-300">
                        {t('chat.twelveHourAccess', '12h access')}
                      </span>
                    )}
                  </div>

                  {activity.is_plan ? (
                    <p className="mt-1.5 text-[13px] leading-snug text-gray-600">
                      {activity.city} · {dateFormatted}
                      {activity.creator_name ? (
                        <span>
                          {" "}
                          · {t('common.by')} {activity.creator_name}
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[13px] leading-snug text-gray-600 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <span>
                        {locationLine} · {dateFormatted}
                      </span>
                      {isToday(safeActivityDate(activity.scheduled_for)) && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-xl">
                          {t('common.today')}
                        </span>
                      )}
                      {isTomorrow(safeActivityDate(activity.scheduled_for)) && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-xl">
                          {t('common.tomorrow')}
                        </span>
                      )}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Users className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                    <span className="text-[13px] text-gray-600">
                      {activity.participant_count} {activity.participant_count === 1 ? t('common.person') : t('common.people')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
          </>
        )}
      </div>

    </div>

  </>
  );
}
