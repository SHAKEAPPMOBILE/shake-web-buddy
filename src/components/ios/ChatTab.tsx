import { useState, useEffect, useCallback, useMemo } from "react";
import { MessageSquare, Users, Plane, MapPin, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";
import { useNavigate } from "react-router-dom";
import { GroupChatView } from "./GroupChatView";
import { PlanGroupChatView } from "./PlanGroupChatView";
import { useActivityJoins } from "@/hooks/useActivityJoins";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isTomorrow } from "date-fns";
import { ALL_ACTIVITY_TYPES, ACTIVITY_TYPES, getActivityDay } from "@/data/activityTypes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingSpinner } from "../LoadingSpinner";
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
}

interface ChatTabProps {
  onChatViewChange?: (isInChat: boolean) => void;
  pendingActivity?: { activityType: string; city: string } | null;
  onPendingActivityHandled?: () => void;
}

export function ChatTab({ onChatViewChange, pendingActivity, onPendingActivityHandled }: ChatTabProps = {}) {
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

        chatActivities.push({
          id: `carousel-${join.activity_type}-${join.city}`,
          activity_type: join.activity_type,
          city: join.city,
          scheduled_for: join.joined_at,
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
          participant_count: (count || 0) + 1,
          unread_count: unreadPlanCount || 0,
          is_plan: true,
          plan_id: plan.id,
          creator_name: profile?.name || "Anonymous",
          creator_avatar: profile?.avatar_url,
          note: plan.note,
        });
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

  const getActivityLabel = (type: string) => {
    const activity = ALL_ACTIVITY_TYPES.find(a => a.id === type);
    return activity?.label || type;
  };

  const handleActivityClick = async (activity: ChatActivity) => {
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
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <MessageSquare className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-display font-bold mb-2">Sign in to chat</h2>
        <p className="text-muted-foreground mb-6">
          Join activities and connect with others
        </p>
        <button
          onClick={() => navigate("/auth")}
          className="px-6 py-3 rounded-full font-medium text-white hover:opacity-90 transition-all"
          style={{
            background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
          }}
        >
          Sign In
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-lg font-display font-bold">My Chats</h2>
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
        </div>
      </div>

      {/* Activities List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            {activities.length === 0 ? (
              <>
                <p className="text-muted-foreground mb-1">No active chats</p>
                <p className="text-sm text-muted-foreground">
                  Join an activity to start chatting
                </p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">No chats in {cityFilter}</p>
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
          filteredActivities.map((activity) => (
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
              className="w-full text-left rounded-2xl p-4 space-y-3 hover:opacity-90 transition-all cursor-pointer relative"
              style={{
                background: "linear-gradient(to right, rgba(88, 28, 135, 0.6), rgba(67, 56, 202, 0.5))",
              }}
            >
              {/* Unread badge */}
              {(activity.unread_count ?? 0) > 0 && (
                <div className="absolute top-3 right-3 min-w-5 h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {activity.unread_count}
                </div>
              )}

              <div className="flex items-start gap-3">
                {/* Activity Icon */}
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-2xl">
                    {getActivityEmoji(activity.activity_type)}
                  </div>
                  {activity.is_plan && activity.creator_avatar && (
                    <Avatar className="absolute -bottom-1 -right-1 w-6 h-6 border-2 border-white/50">
                      <AvatarImage src={activity.creator_avatar} alt={activity.creator_name} />
                      <AvatarFallback className="bg-white/80 text-muted-foreground text-xs font-semibold">
                        {activity.creator_name?.charAt(0)?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{getActivityLabel(activity.activity_type)}</h3>
                    {activity.is_plan && (
                      <span className="text-xs bg-white/20 text-white px-1.5 py-0.5 rounded-full">
                        Plan
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-white/60" />
                    <span className="text-xs text-white/70">{activity.city}</span>
                    {activity.is_plan && activity.creator_name && (
                      <span className="text-xs text-white/50">• by {activity.creator_name}</span>
                    )}
                  </div>

                  {!activity.is_plan && activity.note && (
                    <p className="text-xs text-white/60 italic mt-1 line-clamp-1">"{activity.note}"</p>
                  )}

                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-white/70" />
                      <span className="text-sm text-white/70">
                        {activity.participant_count} {activity.participant_count === 1 ? "person" : "people"}
                      </span>
                    </div>
                    {activity.is_plan && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-white/70" />
                        <span className="text-sm text-white/70">
                          {format(new Date(activity.scheduled_for), "d MMM")}
                        </span>
                        {isToday(new Date(activity.scheduled_for)) && (
                          <span className="text-xs bg-shake-yellow text-black font-semibold px-2 py-0.5 rounded-full animate-pulse">
                            Today
                          </span>
                        )}
                        {isTomorrow(new Date(activity.scheduled_for)) && (
                          <span className="text-xs bg-primary/80 text-white font-semibold px-2 py-0.5 rounded-full">
                            Tomorrow
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
