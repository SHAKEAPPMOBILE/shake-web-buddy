import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { SuperHumanIcon } from "../SuperHumanIcon";
import { Calendar, Users, Plus, Plane, Share2, MapPin, Search, X, Trash2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCity } from "@/contexts/CityContext";
import { useAuth } from "@/contexts/AuthContext";
import { PremiumDialog } from "../PremiumDialog";
import { CreateActivityDialog } from "../CreateActivityDialog";
import { PlanGroupChatView } from "./PlanGroupChatView";
import { GroupChatView } from "./GroupChatView";
import { format, isToday, isTomorrow } from "date-fns";
import { ALL_ACTIVITY_TYPES, ACTIVITY_TYPES, getActivityDay, getNextOccurrenceDate } from "@/data/activityTypes";
import { formatDateWithTranslation } from "@/lib/date-utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LoadingSpinner } from "../LoadingSpinner";
import { useReferralCode, getReferralLink } from "@/hooks/useReferralCode";
import { Input } from "@/components/ui/input";
import { SHAKE_CITIES } from "@/data/cities";
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
}

export function PlansTab({ onChatViewChange }: PlansTabProps = {}) {
  const { t, i18n } = useTranslation();
  const { selectedLanguage } = useLanguage();
  const { selectedCity } = useCity();
  const { user, isPremium } = useAuth();
  const { referralCode } = useReferralCode(user?.id);
  const { redirectToPayment, isLoading: paymentLoading } = useActivityPayment();
  const isMobile = useIsMobile();
  const [activities, setActivities] = useState<PlanActivity[]>([]);
  const [searchCity, setSearchCity] = useState<string>(() => {
    return localStorage.getItem("plans-city-filter") || selectedCity || "";
  });
  const [showCitySearch, setShowCitySearch] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const citySearchContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync searchCity with selectedCity when it changes (initial load)
  useEffect(() => {
    if (selectedCity && !localStorage.getItem("plans-city-filter")) {
      setSearchCity(selectedCity);
    }
  }, [selectedCity]);

  // Filter city suggestions based on search query - only show when user types
  const citySuggestions = useMemo(() => {
    if (!citySearchQuery.trim()) return [];
    const query = citySearchQuery.toLowerCase();
    return SHAKE_CITIES.filter(city => 
      city.name.toLowerCase().includes(query) ||
      city.country.toLowerCase().includes(query)
    ).slice(0, 10);
  }, [citySearchQuery]);

  // Fetch all plans for the searched city
  const fetchPlans = useCallback(async () => {
    if (!searchCity) return;
    
    setIsLoading(true);
    
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    // Fetch all active activities in the searched city
    const { data: cityActivities, error: cityError } = await supabase
      .from("user_activities")
      .select("*")
      .eq("city", searchCity)
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

    // Fetch carousel joins (without activity_id) for the current user in searched city
    let carouselJoins: { activity_type: string; city: string; joined_at: string }[] = [];
    if (user) {
      const { data: cJoins } = await supabase
        .from("activity_joins")
        .select("activity_type, city, joined_at")
        .eq("user_id", user.id)
        .eq("city", searchCity)
        .is("activity_id", null)
        .gt("expires_at", new Date().toISOString());
      
      carouselJoins = cJoins || [];
    }

    // Get joined activities that might be in other cities (for the user's own joined plans)
    let joinedActivities: typeof cityActivities = [];
    if (joinedActivityIds.length > 0) {
      const { data: joinedData } = await supabase
        .from("user_activities")
        .select("*")
        .in("id", joinedActivityIds)
        .eq("is_active", true)
        .gte("scheduled_for", startOfToday.toISOString());
      
      // Only include joined activities from the searched city
      joinedActivities = (joinedData || []).filter(a => a.city === searchCity);
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
  }, [searchCity, user]);

  // Initial fetch and realtime subscription
  useEffect(() => {
    fetchPlans();

    const channel = supabase
      .channel(`plans-tab-${searchCity}`)
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
  }, [fetchPlans, searchCity]);
  
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
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
  

  // Notify parent when entering/leaving chat view
  useEffect(() => {
    const isInChat = showChatView || showCarouselChatView;
    onChatViewChange?.(isInChat);
  }, [showChatView, showCarouselChatView, onChatViewChange]);

  // Handle city selection from search
  const handleSelectCity = (cityName: string) => {
    // Premium gate: only Super-Human users can explore other cities
    if (!isPremium && cityName.toLowerCase() !== selectedCity.toLowerCase()) {
      setShowPremiumDialog(true);
      return;
    }
    setSearchCity(cityName);
    setCitySearchQuery("");
    setShowCitySuggestions(false);
    setShowCitySearch(false);
    localStorage.setItem("plans-city-filter", cityName);
  };

  // Reset to user's city
  const handleResetToMyCity = () => {
    setSearchCity(selectedCity);
    setCitySearchQuery("");
    setShowCitySuggestions(false);
    setShowCitySearch(false);
    localStorage.removeItem("plans-city-filter");
  };

  // Focus search input when opened
  useEffect(() => {
    if (showCitySearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showCitySearch]);

  // Click outside to close city search
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        citySearchContainerRef.current &&
        !citySearchContainerRef.current.contains(event.target as Node)
      ) {
        setShowCitySearch(false);
        setShowCitySuggestions(false);
        setCitySearchQuery("");
      }
    };

    if (showCitySearch) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showCitySearch]);

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
            {/* City Search Toggle */}
            <button
              onClick={() => setShowCitySearch(!showCitySearch)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                searchCity !== selectedCity 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-foreground"
              }`}
            >
              <Plane className="w-4 h-4" />
              {searchCity !== selectedCity && <span>{searchCity}</span>}
            </button>
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

        {/* City Search Input */}
        {showCitySearch && (
          <div ref={citySearchContainerRef} className="relative">
            {isPremium ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      type="text"
                    placeholder={t('plans.searchCity')}
                    value={citySearchQuery}
                    onChange={(e) => {
                        setCitySearchQuery(e.target.value);
                        setShowCitySuggestions(true);
                      }}
                      onFocus={() => setShowCitySuggestions(true)}
                      className="pl-9 pr-9 bg-muted border-none"
                    />
                    {citySearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setCitySearchQuery("");
                          searchInputRef.current?.focus();
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  {searchCity !== selectedCity && (
                    <button
                      onClick={handleResetToMyCity}
                      className="text-xs text-primary whitespace-nowrap"
                    >
                      {t('plans.resetToMyCity')}
                    </button>
                  )}
                </div>

                {/* City Suggestions Dropdown */}
                {showCitySuggestions && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    {citySuggestions.length > 0 ? (
                      citySuggestions.map((city) => (
                        <button
                          key={`${city.name}-${city.country}`}
                          onClick={() => handleSelectCity(city.name)}
                          className="w-full px-4 py-2.5 text-left hover:bg-muted flex items-center justify-between text-sm"
                        >
                          <span>{city.name}</span>
                          <span className="text-muted-foreground text-xs">{city.country}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-muted-foreground">
                        {t('plans.noCitiesFound')}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* Non-premium: Show subscribe prompt */
              <div className="bg-card border border-border rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-shake-yellow/20 flex items-center justify-center">
                    <SuperHumanIcon size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">{t('plans.explorePlansWorldwide')}</h4>
                    <p className="text-xs text-muted-foreground">{t('plans.superHumanFeature')}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('plans.browseAndJoinPlans')}
                </p>
                <button
                  onClick={() => {
                    setShowCitySearch(false);
                    setShowPremiumDialog(true);
                  }}
                  className="w-full py-2 bg-shake-yellow text-black rounded-lg text-sm font-medium hover:opacity-90 transition-all"
                >
                  {t('plans.becomeaSuperHuman')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Plans List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <LoadingSpinner size="lg" />
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{t('plans.noPlansInCity', { city: searchCity })}</p>
            {searchCity !== selectedCity && (
              <button
                onClick={handleResetToMyCity}
                className="mt-3 text-sm text-primary hover:underline"
              >
                {t('plans.backTo', { city: selectedCity })}
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
                    <div className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-2xl">
                      {getActivityEmoji(plan.activity_type)}
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
                    <MapPin className="w-3 h-3 text-white/60" />
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


      <PremiumDialog 
        open={showPremiumDialog} 
        onOpenChange={setShowPremiumDialog} 
      />

      <CreateActivityDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        city={searchCity}
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
          onOpenChange={(open) => !open && setSelectedUserProfile(null)}
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
