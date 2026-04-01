import { useState, useEffect, useCallback, useMemo } from "react";
import { MessageSquare, Users, Plane, Ticket } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { useNavigate } from "react-router-dom";
import { GroupChatView } from "./GroupChatView";
import { PlanGroupChatView } from "./PlanGroupChatView";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isTomorrow } from "date-fns";
import { ALL_ACTIVITY_TYPES, ACTIVITY_TYPES, getActivityDay, getNextOccurrenceDate } from "@/data/activityTypes";
import { formatDateWithTranslation } from "@/lib/date-utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingSpinner } from "../LoadingSpinner";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildEventChatNavigateState } from "@/lib/eventChatNavigation";
import { isEventChatMembershipExplicitlyExpired } from "@/lib/eventChatMembership";
import {
  getPendingEventChatsForMerge,
  removePendingEventChat,
  PENDING_EVENT_CHAT_CHANGED,
} from "@/lib/pendingEventChat";
import { logPostgrestError } from "@/lib/supabaseErrorLog";

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
}

interface ChatTabProps {
  onChatViewChange?: (isInChat: boolean) => void;
  pendingActivity?: { activityType: string; city: string } | null;
  onPendingActivityHandled?: () => void;
  /** False while another bottom tab is selected; refetch when user returns so new memberships appear. */
  isActiveTab?: boolean;
}

export function ChatTab({
  onChatViewChange,
  pendingActivity,
  onPendingActivityHandled,
  isActiveTab = true,
}: ChatTabProps = {}) {
  const { t, i18n } = useTranslation();
  const { selectedLanguage } = useLanguage();
  const { user } = useAuth();
  const { selectedCity } = useCity();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ChatActivity[]>([]);
  const [cityFilter, setCityFilter] = useState<string>(() => {
    return localStorage.getItem("chat-city-filter") || "all";
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [showPlanChatDialog, setShowPlanChatDialog] = useState(false);
  const [selectedChatActivity, setSelectedChatActivity] = useState<{ activityType: string; city: string } | null>(null);
  const [selectedPlanActivity, setSelectedPlanActivity] = useState<any>(null);
  const { getActivityJoinCount } = useActivityJoins(selectedCity);

  // Notify parent when entering/leaving chat view
  useEffect(() => {
    const isInChat = showChatDialog || showPlanChatDialog;
    onChatViewChange?.(isInChat);
  }, [showChatDialog, showPlanChatDialog, onChatViewChange]);

  // Handle pending activity from carousel join (open chat immediately)
  useEffect(() => {
    if (pendingActivity) {
      setSelectedChatActivity(pendingActivity);
      setShowChatDialog(true);
      onPendingActivityHandled?.();
    }
  }, [pendingActivity, onPendingActivityHandled]);

  const fetchActivities = useCallback(async () => {
    if (!user) {
      setActivities([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    // 1) Carousel joins (activity_id is null) — no expires_at filter
    const { data: carouselJoins, error: carouselError } = await supabase
      .from("activity_joins")
      .select("activity_type, city")
      .eq("user_id", user.id)
      .is("activity_id", null);

    // 2) Raw debug log for carousel joins
    console.log("[ChatTab] raw carousel joins", { data: carouselJoins, error: carouselError });

    // 3) Build carousel entries
    const carouselActivities: ChatActivity[] = (carouselJoins || []).map((join) => {
      const nextOccurrence = getNextOccurrenceDate(join.activity_type);
      return {
        id: `carousel-${join.activity_type}-${join.city}`,
        activity_type: join.activity_type,
        city: join.city,
        scheduled_for: nextOccurrence.toISOString(),
        participant_count: 1,
        unread_count: 0,
        is_plan: false,
        note: getActivityDay(join.activity_type) ? `This ${getActivityDay(join.activity_type)}` : null,
      };
    });

    // 4) Plan joins (activity_id is not null) — no expires_at filter
    const { data: planJoins, error: planJoinsError } = await supabase
      .from("activity_joins")
      .select("activity_id")
      .eq("user_id", user.id)
      .not("activity_id", "is", null);

    // 5) Raw debug log for plan joins
    console.log("[ChatTab] raw plan joins", { data: planJoins, error: planJoinsError });

    // Build plan entries
    const joinedPlanIds = (planJoins || []).map((j) => j.activity_id).filter(Boolean) as string[];
    let planActivities: ChatActivity[] = [];

    if (joinedPlanIds.length > 0) {
      const { data: joinedPlans } = await supabase
        .from("user_activities")
        .select("id, activity_type, city, scheduled_for, note")
        .in("id", joinedPlanIds)
        .eq("is_active", true);

      planActivities = (joinedPlans || []).map((plan) => ({
        id: plan.id,
        activity_type: plan.activity_type,
        city: plan.city,
        scheduled_for: plan.scheduled_for,
        participant_count: 1,
        unread_count: 0,
        is_plan: true,
        plan_id: plan.id,
        note: plan.note,
      }));
    }

    // 6) Combine and set
    setActivities([...carouselActivities, ...planActivities]);
    setIsLoading(false);
  }, [user]);

  // Fresh list every time the Chat tab becomes active (not only on first mount).
  useEffect(() => {
    if (!user?.id) return;
    if (!isActiveTab) return;
    void fetchActivities();
  }, [user?.id, isActiveTab, fetchActivities]);

  // Realtime while Chat tab is active; cleanup while inactive.
  useEffect(() => {
    if (!isActiveTab || !user) return;

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActivities, user, isActiveTab]);

  useEffect(() => {
    const onPending = () => {
      if (isActiveTab && user) void fetchActivities();
    };
    window.addEventListener(PENDING_EVENT_CHAT_CHANGED, onPending);
    return () => window.removeEventListener(PENDING_EVENT_CHAT_CHANGED, onPending);
  }, [isActiveTab, user, fetchActivities]);

  // Persist city filter to localStorage
  useEffect(() => {
    localStorage.setItem("chat-city-filter", cityFilter);
  }, [cityFilter]);

  // Get unique cities from all activities for the filter
  const availableCities = useMemo(() => {
    const cities = [...new Set(activities.map(a => a.city))];
    return cities.sort();
  }, [activities]);

  // Filter activities based on selected city (event chats always show — city is venue/name fragment, not user city)
  const filteredActivities = useMemo(() => {
    if (cityFilter === "all") return activities;
    return activities.filter((a) => a.is_event || a.city === cityFilter);
  }, [activities, cityFilter]);

  const getActivityEmoji = (type: string) => {
    const activity = ALL_ACTIVITY_TYPES.find(a => a.id === type);
    return activity?.emoji || "📍";
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

  const handleActivityClick = async (activity: ChatActivity) => {
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
            background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
          }}
        >
          {t('common.signIn')}
        </button>
      </div>
    );
  }

  // Show full-page GroupChatView when a carousel activity is selected
  if (selectedChatActivity && showChatDialog) {
    return (
      <GroupChatView
        activityType={selectedChatActivity.activityType}
        city={selectedChatActivity.city}
        homeCity={selectedCity}
        onBack={handleBackToActivities}
        attendeeCount={getActivityJoinCount(selectedChatActivity.activityType)}
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

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-white shrink-0">
        <h2 className="text-lg font-display font-bold text-neutral-900">{t('chat.title')}</h2>
        <div className="flex items-center gap-2">
          {/* City Filter */}
          {availableCities.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-sm font-medium text-white border-0 shadow-sm max-w-[min(50vw,200px)]"
                  style={{
                    background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
                  }}
                >
                  <Plane className="w-4 h-4 shrink-0 text-white" aria-hidden />
                  {cityFilter !== "all" && <span className="truncate">{cityFilter}</span>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border z-50">
                <DropdownMenuItem 
                  onClick={() => setCityFilter("all")}
                  className={cityFilter === "all" ? "bg-primary/10" : ""}
                >
                  {t('common.allCities')}
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
            <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            {activities.length === 0 ? (
              <>
                <p className="text-neutral-600 mb-1">{t('common.noActiveChats')}</p>
                <p className="text-sm text-neutral-500">
                  {t('common.joinActivityToChat')}
                </p>
              </>
            ) : (
              <>
                <p className="text-neutral-600">{t('common.noChatsInCity', { city: cityFilter })}</p>
                <button
                  onClick={() => setCityFilter("all")}
                  className="mt-3 text-sm text-[#a0c1f9] hover:text-[#b8d0fb] hover:underline"
                >
                  {t('common.showAllCities')}
                </button>
              </>
            )}
          </div>
        ) : (
          <>
          {filteredActivities.map((activity) => {
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
              className="w-full text-left rounded-xl p-4 transition-colors cursor-pointer relative border-2 border-transparent bg-[#1e2124] hover:border-[#a0c1f9]/55 focus-visible:outline-none focus-visible:border-[#a0c1f9] active:scale-[0.99]"
            >
              {/* Unread badge */}
              {(activity.unread_count ?? 0) > 0 && (
                <div className="absolute top-3 right-3 min-w-5 h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center z-[1]">
                  {activity.unread_count}
                </div>
              )}

              <div className="flex items-start gap-3.5">
                <div className="relative shrink-0">
                  <div
                    className={
                      activity.is_event
                        ? "w-12 h-12 rounded-full bg-[#a0c1f9] flex items-center justify-center shadow-sm"
                        : "w-12 h-12 rounded-full bg-white border border-neutral-200 shadow-md flex items-center justify-center text-2xl"
                    }
                  >
                    {activity.is_event ? (
                      <Ticket className="w-6 h-6 text-white drop-shadow-sm" strokeWidth={2.25} />
                    ) : (
                      <span className="text-2xl leading-none" aria-hidden>
                        {getActivityEmoji(activity.activity_type)}
                      </span>
                    )}
                  </div>
                  {activity.is_plan && activity.creator_avatar && (
                    <Avatar className="absolute -bottom-1 -right-1 w-6 h-6 border-2 border-[#1e2124]">
                      <AvatarImage src={activity.creator_avatar} alt={activity.creator_name} />
                      <AvatarFallback className="bg-[#2a2e32] text-[#e4e4e7] text-xs font-semibold">
                        {activity.creator_name?.charAt(0)?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>

                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="font-bold text-white text-[15px] leading-snug">
                      {activity.is_plan && activity.note
                        ? activity.note
                        : activity.is_event && activity.event_name
                        ? activity.event_name
                        : getActivityLabel(activity.activity_type)}
                    </h3>
                    {activity.is_plan && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[#9ca3af] bg-[#2a2e32] px-1.5 py-0.5 rounded-xl border border-[#3f444c]">
                        {t('common.plan')}
                      </span>
                    )}
                    {activity.is_event && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[#9ca3af] bg-[#2a2e32] px-1.5 py-0.5 rounded-xl border border-[#3f444c]">
                        EVENT
                      </span>
                    )}
                    {activity.is_event && (
                      <span className="text-[10px] font-medium text-[#9ca3af] bg-[#252a2e] px-1.5 py-0.5 rounded-xl border border-[#3f444c]">
                        12h access
                      </span>
                    )}
                  </div>

                  {activity.is_plan ? (
                    <p className="mt-1.5 text-[13px] leading-snug text-[#9ca3af]">
                      {activity.city} · {dateFormatted}
                      {activity.creator_name ? (
                        <span>
                          {" "}
                          · {t('common.by')} {activity.creator_name}
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[13px] leading-snug text-[#9ca3af] flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <span>
                        {locationLine} · {dateFormatted}
                      </span>
                      {isToday(safeActivityDate(activity.scheduled_for)) && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-xl">
                          {t('common.today')}
                        </span>
                      )}
                      {isTomorrow(safeActivityDate(activity.scheduled_for)) && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#a0c1f9] bg-[#a0c1f9]/10 border border-[#a0c1f9]/25 px-1.5 py-0.5 rounded-xl">
                          {t('common.tomorrow')}
                        </span>
                      )}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Users className="w-3.5 h-3.5 text-[#9ca3af] shrink-0" />
                    <span className="text-[13px] text-[#9ca3af]">
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
  );
}
