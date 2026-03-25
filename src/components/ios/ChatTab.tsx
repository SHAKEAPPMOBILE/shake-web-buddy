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
}

export function ChatTab({ onChatViewChange, pendingActivity, onPendingActivityHandled }: ChatTabProps = {}) {
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

    try {
      // Get user's active carousel joins (activity_id is null)
      const { data: carouselJoins, error: carouselError } = await supabase
        .from("activity_joins")
        .select("activity_type, city, joined_at, expires_at")
        .eq("user_id", user.id)
        .is("activity_id", null)
        .gt("expires_at", new Date().toISOString());

      if (carouselError) throw carouselError;

      // Get user's plan joins (activity_id is not null)
      const { data: planJoins, error: planJoinsError } = await supabase
        .from("activity_joins")
        .select("activity_id")
        .eq("user_id", user.id)
        .not("activity_id", "is", null)
        .gt("expires_at", new Date().toISOString());

      if (planJoinsError) throw planJoinsError;

      // Get user's own plans
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const { data: userPlans, error: userPlansError } = await supabase
        .from("user_activities")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .gte("scheduled_for", startOfToday.toISOString());

      if (userPlansError) throw userPlansError;

      // Get joined plans
      const joinedPlanIds = (planJoins || []).map(j => j.activity_id).filter(Boolean) as string[];
      let joinedPlans: any[] = [];
      
      if (joinedPlanIds.length > 0) {
        const { data: joinedPlansData } = await supabase
          .from("user_activities")
          .select("*")
          .in("id", joinedPlanIds)
          .eq("is_active", true)
          .gte("scheduled_for", startOfToday.toISOString());
        
        joinedPlans = joinedPlansData || [];
      }

      // Build activities list
      const chatActivities: ChatActivity[] = [];

      // Add carousel joins
      for (const join of carouselJoins || []) {
        const { count } = await supabase
          .from("activity_joins")
          .select("*", { count: "exact", head: true })
          .eq("activity_type", join.activity_type)
          .eq("city", join.city)
          .is("activity_id", null)
          .gt("expires_at", new Date().toISOString());

        // Get unread count for activity messages
        const { data: readStatus } = await supabase
          .from("activity_read_status")
          .select("last_read_at")
          .eq("user_id", user.id)
          .eq("activity_type", join.activity_type)
          .eq("city", join.city)
          .maybeSingle();

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const lastReadAt = readStatus?.last_read_at || todayStart.toISOString();

        const { count: unreadCount } = await supabase
          .from("activity_messages")
          .select("*", { count: "exact", head: true })
          .eq("activity_type", join.activity_type)
          .eq("city", join.city)
          .gt("created_at", lastReadAt)
          .neq("user_id", user.id);

        // Calculate the actual next occurrence date for this activity
        const nextOccurrence = getNextOccurrenceDate(join.activity_type);

        chatActivities.push({
          id: `carousel-${join.activity_type}-${join.city}`,
          activity_type: join.activity_type,
          city: join.city,
          scheduled_for: nextOccurrence.toISOString(),
          participant_count: count || 1,
          unread_count: unreadCount || 0,
          is_plan: false,
          note: getActivityDay(join.activity_type) ? `This ${getActivityDay(join.activity_type)}` : null,
        });
      }

      // Add user's own plans and joined plans
      const allPlans = [...(userPlans || []), ...joinedPlans];
      const uniquePlans = new Map();
      allPlans.forEach(p => uniquePlans.set(p.id, p));

      for (const plan of uniquePlans.values()) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, avatar_url")
          .eq("user_id", plan.user_id)
          .maybeSingle();

        const { count } = await supabase
          .from("activity_joins")
          .select("*", { count: "exact", head: true })
          .eq("activity_id", plan.id);

        // Get unread count for plan messages
        const { data: planReadStatus } = await supabase
          .from("activity_read_status")
          .select("last_read_at")
          .eq("user_id", user.id)
          .eq("activity_type", plan.id)
          .maybeSingle();

        const lastPlanRead = planReadStatus?.last_read_at || plan.created_at;

        const { count: unreadPlanCount } = await supabase
          .from("plan_messages")
          .select("*", { count: "exact", head: true })
          .eq("activity_id", plan.id)
          .gt("created_at", lastPlanRead)
          .neq("user_id", user.id);

        chatActivities.push({
          id: plan.id,
          activity_type: plan.activity_type,
          city: plan.city,
          scheduled_for: plan.scheduled_for,
          participant_count: (count || 0),
          unread_count: unreadPlanCount || 0,
          is_plan: true,
          plan_id: plan.id,
          creator_name: profile?.name || "Anonymous",
          creator_avatar: profile?.avatar_url,
          note: plan.note,
        });
      }

      const resolveEventMembershipExpiry = (m: { expires_at?: string | null; paid_at?: string | null }) => {
        if (m.expires_at) {
          const d = new Date(m.expires_at);
          if (!isNaN(d.getTime())) return d;
        }
        if (m.paid_at) {
          const d = new Date(m.paid_at);
          if (!isNaN(d.getTime())) return new Date(d.getTime() + 24 * 60 * 60 * 1000);
        }
        return null;
      };

      // Event chats the user has joined (merged into same list as activity chats)
      const { data: eventMemberships, error: eventMembershipsError } = await supabase
        .from("event_chat_members")
        .select("event_id, paid_at, expires_at, event_name, event_starts_at")
        .eq("user_id", user.id);

      console.log("[ChatTab] Event memberships query", {
        count: eventMemberships?.length ?? 0,
        error: eventMembershipsError?.message,
      });

      if (eventMemberships && eventMemberships.length > 0) {
        for (const membership of eventMemberships as any[]) {
          const expiresAt = resolveEventMembershipExpiry(membership);
          if (expiresAt && expiresAt.getTime() <= Date.now()) continue;

          const parsedName = typeof membership.event_name === "string" && membership.event_name.trim()
            ? membership.event_name.trim()
            : "Event Chat";
          const fallbackVenue = parsedName.includes(" · ") ? parsedName.split(" · ")[1] : "Event";
          const parsedVenue = fallbackVenue;

          const startFromDb = membership.event_starts_at
            ? new Date(membership.event_starts_at as string)
            : null;
          const hasValidStart = startFromDb && !isNaN(startFromDb.getTime());
          const scheduledFor =
            hasValidStart
              ? startFromDb!.toISOString()
              : expiresAt
                ? expiresAt.toISOString()
                : new Date().toISOString();

          // Count participants for this event chat
          const { count: participantCount } = await supabase
            .from("event_chat_members")
            .select("*", { count: "exact", head: true })
            .eq("event_id", membership.event_id);

          chatActivities.push({
            id: `event-${membership.event_id}`,
            activity_type: "event",
            city: parsedVenue,
            scheduled_for: scheduledFor,
            participant_count: participantCount || 1,
            is_plan: false,
            is_event: true,
            event_id: membership.event_id,
            event_name: parsedName,
            event_venue: parsedVenue,
            expires_at: expiresAt ? expiresAt.toISOString() : undefined,
          });
        }
      }

      // Sort with Today first, Tomorrow second, then chronologically
      chatActivities.sort((a, b) => {
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

      setActivities(chatActivities);
    } catch (error) {
      console.error("Error fetching chat activities:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial fetch and realtime subscription
  useEffect(() => {
    fetchActivities();

    if (!user) return;

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
  }, [fetchActivities, user]);

  // Persist city filter to localStorage
  useEffect(() => {
    localStorage.setItem("chat-city-filter", cityFilter);
  }, [cityFilter]);

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
      navigate(`/chat/event/${activity.event_id}`);
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
                <button className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1e2124] text-[#e4e4e7] rounded-full text-sm font-medium border border-[#3f444c]">
                  <Plane className="w-4 h-4" />
                  {cityFilter !== "all" && <span>{cityFilter}</span>}
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
            <div className="w-16 h-16 rounded-full bg-[#1e2124] flex items-center justify-center mb-4 border border-[#3f444c]">
              <MessageSquare className="w-8 h-8 text-[#9ca3af]" />
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
              new Date(activity.scheduled_for),
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
                  <div className="w-12 h-12 rounded-full bg-[#a0c1f9] flex items-center justify-center shadow-sm">
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
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[#9ca3af] bg-[#2a2e32] px-1.5 py-0.5 rounded-md border border-[#3f444c]">
                        {t('common.plan')}
                      </span>
                    )}
                    {activity.is_event && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[#9ca3af] bg-[#2a2e32] px-1.5 py-0.5 rounded-md border border-[#3f444c]">
                        EVENT
                      </span>
                    )}
                    {activity.is_event && (
                      <span className="text-[10px] font-medium text-[#9ca3af] bg-[#252a2e] px-1.5 py-0.5 rounded-md border border-[#3f444c]">
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
                      {isToday(new Date(activity.scheduled_for)) && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
                          {t('common.today')}
                        </span>
                      )}
                      {isTomorrow(new Date(activity.scheduled_for)) && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#a0c1f9] bg-[#a0c1f9]/10 border border-[#a0c1f9]/25 px-1.5 py-0.5 rounded-md">
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
