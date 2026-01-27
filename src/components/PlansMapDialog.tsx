import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo, useRef } from "react";
import { format } from "date-fns";
import { List, Map, Plus, X, Users, ChevronRight, Bell, BellOff, ChevronDown, Check, Search, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useVenueContext } from "@/contexts/VenueContext";
import { WorldMap, WorldMapHandle } from "@/components/WorldMap";
import { useAllActivities } from "@/hooks/useAllActivities";
import { UserActivity } from "@/hooks/useUserActivities";
import { getActivityEmoji, getActivityLabel, getActivityColor, ACTIVITY_TYPES } from "@/data/activityTypes";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreateActivityDialog } from "@/components/CreateActivityDialog";
import { PlanGroupChatDialog } from "@/components/PlanGroupChatDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useUserActivities } from "@/hooks/useUserActivities";
import { usePlanNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { playDingDingSound } from "@/lib/notification-sound";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { PremiumDialog } from "@/components/PremiumDialog";
import { SHAKE_CITIES } from "@/data/cities";

interface PlansMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  city: string;
}

export function PlansMapDialog({ open, onOpenChange, city }: PlansMapDialogProps) {
  const { user, isPremium } = useAuth();
  const { activities, isLoading, refetch: refetchActivities } = useAllActivities();
  const { joinActivity, hasJoinedActivity, myActivities } = useUserActivities(city);
  const { getLocationString, getMapsUrl } = useVenueContext();
  const isMobile = useIsMobile();
  const mapRef = useRef<WorldMapHandle>(null);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const [showList, setShowList] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<UserActivity | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [joinedActivities, setJoinedActivities] = useState<Set<string>>(new Set());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [showJoinSuccess, setShowJoinSuccess] = useState(false);
  const [joinedActivityInfo, setJoinedActivityInfo] = useState<{ label: string; emoji: string; city: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  // Get city suggestions based on search query
  const citySuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 1) return [];
    const query = searchQuery.toLowerCase().trim();
    return SHAKE_CITIES
      .filter((city) => city.name.toLowerCase().includes(query))
      .slice(0, 6);
  }, [searchQuery]);

  // Handle city selection from suggestions
  const handleSelectCity = (cityName: string) => {
    setSearchQuery(cityName);
    setShowCitySuggestions(false);
    // Fly to the city on the map
    mapRef.current?.flyToCity(cityName);
    // Switch to map view on mobile
    if (isMobile) {
      setMobileView('map');
    }
  };

  // Swipe to close on mobile
  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });

  // Get IDs of activities the user owns
  const myActivityIds = useMemo(() => myActivities.map((a) => a.id), [myActivities]);

  // Filter activities by search query
  const filteredActivities = useMemo(() => {
    if (!searchQuery.trim()) return activities;
    const query = searchQuery.toLowerCase().trim();
    return activities.filter((activity) => 
      activity.city.toLowerCase().includes(query)
    );
  }, [activities, searchQuery]);

  // Set up plan notifications
  const { requestPermission } = usePlanNotifications(
    myActivityIds,
    (activityId, joinerName) => {
      // Handle join notification - could update UI or refetch
      console.log(`${joinerName} joined activity ${activityId}`);
    },
    (activityId, senderName, message) => {
      // Handle message notification
      console.log(`${senderName} sent message in ${activityId}: ${message}`);
    }
  );

  // Check notification permission status
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      toast.success("Notifications enabled! You'll be notified when someone joins your plans.");
    } else {
      toast.error("Notifications were denied. You can enable them in your browser settings.");
    }
  };

  const handleActivityClick = async (activity: UserActivity) => {
    // Check if user has access to chat (creator or joined)
    if (!user) {
      setSelectedActivity(activity);
      return;
    }

    const isCreator = activity.user_id === user.id;
    const hasJoined = await hasJoinedActivity(activity.id);

    if (isCreator || hasJoined) {
      setSelectedActivity(activity);
      setShowChatDialog(true);
    } else {
      setSelectedActivity(activity);
    }
  };

  const handleJoin = async (activity: UserActivity) => {
    const result = await joinActivity(activity.id, isPremium);
    if (result.requiresPremium) {
      setShowPremiumDialog(true);
      return;
    }
    if (result.success) {
      // Store joined activity info for confirmation display
      setJoinedActivityInfo({
        label: getActivityLabel(activity.activity_type),
        emoji: getActivityEmoji(activity.activity_type),
        city: activity.city,
      });
      
      // Show success confirmation
      setShowJoinSuccess(true);
      
      // Play celebration effects
      playDingDingSound();
      triggerConfettiWaterfall();
      
      setJoinedActivities((prev) => new Set([...prev, activity.id]));
      
      // After delay, close confirmation and open chat
      setTimeout(() => {
        setShowJoinSuccess(false);
        setJoinedActivityInfo(null);
        setSelectedActivity(activity);
        setShowChatDialog(true);
      }, 2000);
    }
  };

  // Join success confirmation overlay
  if (showJoinSuccess && joinedActivityInfo) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            {/* Activity emoji with animation */}
            <div 
              className="animate-scale-in"
              style={{ animationDuration: '0.4s' }}
            >
              <div className="w-28 h-28 rounded-full bg-white shadow-lg flex items-center justify-center">
                <span className="text-6xl">{joinedActivityInfo.emoji}</span>
              </div>
            </div>
            
            {/* Confirmation message */}
            <div className="text-center animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <h2 className="text-2xl font-display font-bold text-foreground">
                You joined {joinedActivityInfo.label}! 🎉
              </h2>
              <p className="text-lg text-muted-foreground mt-2">
                in {joinedActivityInfo.city}
              </p>
            </div>
            
            {/* Success icon */}
            <div 
              className="animate-scale-in"
              style={{ animationDelay: '0.3s' }}
            >
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-500" />
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground/70 text-center max-w-xs animate-fade-in" style={{ animationDelay: '0.4s' }}>
              Opening the group chat so you can say hi!
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="sm:max-w-4xl h-[80vh] max-h-[90vh] flex flex-col p-0 bg-card/95 backdrop-blur-xl border-border/50 overflow-hidden [&>button.dialog-close]:text-white [&>button.dialog-close]:bg-black/50 [&>button.dialog-close]:hover:bg-black/70 [&>button.dialog-close]:flex"
          {...(isMobile ? swipeHandlers : {})}
        >
          {/* Swipe indicator for mobile */}
          {isMobile && (
            <div className="flex justify-center py-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
          )}
          
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border/50 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {/* Mobile close button */}
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden h-8 w-8 shrink-0"
                onClick={() => onOpenChange(false)}
              >
                <ChevronDown className="w-5 h-5" />
              </Button>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-display font-bold flex items-center gap-2">
                  <Map className="w-5 h-5 shrink-0" />
                  <span className="truncate">Explore Plans</span>
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {filteredActivities.length} {filteredActivities.length === 1 ? "plan" : "plans"} {searchQuery ? "found" : "worldwide"}
                </p>
              </div>
              {/* Search bar with autocomplete */}
              <div className="relative hidden sm:block">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                <Input
                  type="text"
                  placeholder="Search by city..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowCitySuggestions(true);
                  }}
                  onFocus={() => setShowCitySuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCitySuggestions(false), 150)}
                  className="pl-8 h-8 w-48 text-sm bg-background"
                />
                {/* City suggestions dropdown */}
                {showCitySuggestions && citySuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                    {citySuggestions.map((cityItem) => (
                      <button
                        key={cityItem.name}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectCity(cityItem.name);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors flex items-center justify-between"
                      >
                        <span className="font-medium">{cityItem.name}</span>
                        <span className="text-xs text-muted-foreground">{cityItem.country}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button
                onClick={() => setShowCreateDialog(true)}
                className="px-3 py-1.5 rounded-full text-sm font-medium text-white hover:opacity-90 transition-all flex items-center gap-1"
                style={{
                  background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
                }}
              >
                <Plus className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Create Plan</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden relative min-h-0">
            {/* Mobile: Show either list or map */}
            {isMobile ? (
              <>
                {mobileView === 'map' && (
                  <div className="flex-1 h-full">
                    <WorldMap
                      ref={mapRef}
                      activities={activities}
                      onActivityClick={handleActivityClick}
                      selectedActivityId={selectedActivity?.id}
                      initialCity={city}
                    />
                  </div>
                )}
                {mobileView === 'list' && (
                  <div className="flex-1 flex flex-col bg-card/95">
                    {/* Mobile search bar with autocomplete */}
                    <div className="p-2 border-b border-border/30">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                        <Input
                          type="text"
                          placeholder="Search by city..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setShowCitySuggestions(true);
                          }}
                          onFocus={() => setShowCitySuggestions(true)}
                          onBlur={() => setTimeout(() => setShowCitySuggestions(false), 150)}
                          className="pl-8 h-9 text-sm bg-background"
                        />
                        {/* City suggestions dropdown */}
                        {showCitySuggestions && citySuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                            {citySuggestions.map((cityItem) => (
                              <button
                                key={cityItem.name}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectCity(cityItem.name);
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors flex items-center justify-between"
                              >
                                <span className="font-medium">{cityItem.name}</span>
                                <span className="text-xs text-muted-foreground">{cityItem.country}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {filteredActivities.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-sm text-muted-foreground">
                            {searchQuery ? "No plans found" : "No plans yet"}
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            {searchQuery ? "Try a different city name" : "Be the first to create one!"}
                          </p>
                        </div>
                      ) : (
                        filteredActivities.map((activity) => {
                          const isOwner = activity.user_id === user?.id;

                          return (
                            <button
                              key={activity.id}
                              onClick={() => handleActivityClick(activity)}
                              className={cn(
                                "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all",
                                selectedActivity?.id === activity.id
                                  ? "border border-primary/30"
                                  : ""
                              )}
                              style={{
                                background: selectedActivity?.id === activity.id
                                  ? "linear-gradient(to right, rgba(88, 28, 135, 0.9), rgba(67, 56, 202, 0.8))"
                                  : "linear-gradient(to right, rgba(88, 28, 135, 0.6), rgba(67, 56, 202, 0.5))",
                              }}
                            >
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 bg-white shadow-md">
                                {(() => {
                                  const activityData = ACTIVITY_TYPES.find(a => a.id === activity.activity_type);
                                  return activityData?.icon ? (
                                    <img src={activityData.icon} alt={activityData.label} className="w-6 h-6 object-contain" />
                                  ) : (
                                    <span>{getActivityEmoji(activity.activity_type)}</span>
                                  );
                                })()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <p className="font-medium text-sm truncate text-white">
                                    {getActivityLabel(activity.activity_type)}
                                  </p>
                                  {isOwner && (
                                    <span className="text-[10px] px-1 py-0.5 bg-primary/10 text-primary rounded">
                                      You
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-white/70 truncate">
                                  {format(new Date(activity.scheduled_for), "EEEE")} ({format(new Date(activity.scheduled_for), "dd-MM")})
                                </p>
                                {(activity.activity_type === "lunch" || activity.activity_type === "dinner" || activity.activity_type === "drinks" || activity.activity_type === "brunch") && (
                                  <a
                                    href={getMapsUrl(activity.city, activity.activity_type) || "/"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-xs text-white/60 truncate flex items-center gap-1 hover:text-white/90 transition-colors underline-offset-2 hover:underline"
                                  >
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    {getLocationString(activity.city, activity.activity_type)}
                                  </a>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <div className="flex items-center gap-1 text-xs text-white/70">
                                  <Users className="w-3 h-3" />
                                  <span>{activity.participant_count}</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-white/50" />
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Desktop: Map with side panel */
              <>
                <div className={cn("flex-1 h-full transition-all duration-300", showList && "mr-80")}>
                  <WorldMap
                    ref={mapRef}
                    activities={activities}
                    onActivityClick={handleActivityClick}
                    selectedActivityId={selectedActivity?.id}
                    initialCity={city}
                  />
                </div>

                {/* List overlay */}
                <div
                  className={cn(
                    "absolute top-0 right-0 h-full w-80 bg-card/95 backdrop-blur-xl border-l border-border/50 transition-transform duration-300 flex flex-col",
                    showList ? "translate-x-0" : "translate-x-full"
                  )}
                >
                  <div className="flex items-center justify-between p-3 border-b border-border/50 shrink-0">
                    <h3 className="font-semibold text-sm">All Plans</h3>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowList(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {filteredActivities.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground">
                          {searchQuery ? "No plans found" : "No plans yet"}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {searchQuery ? "Try a different city name" : "Be the first to create one!"}
                        </p>
                      </div>
                    ) : (
                      filteredActivities.map((activity) => {
                        const isOwner = activity.user_id === user?.id;

                        return (
                          <button
                            key={activity.id}
                            onClick={() => handleActivityClick(activity)}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all",
                              selectedActivity?.id === activity.id
                                ? "border border-primary/30"
                                : ""
                            )}
                            style={{
                              background: selectedActivity?.id === activity.id
                                ? "linear-gradient(to right, rgba(88, 28, 135, 0.9), rgba(67, 56, 202, 0.8))"
                                : "linear-gradient(to right, rgba(88, 28, 135, 0.6), rgba(67, 56, 202, 0.5))",
                            }}
                          >
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 bg-white shadow-md">
                              {(() => {
                                const activityData = ACTIVITY_TYPES.find(a => a.id === activity.activity_type);
                                return activityData?.icon ? (
                                  <img src={activityData.icon} alt={activityData.label} className="w-6 h-6 object-contain" />
                                ) : (
                                  <span>{getActivityEmoji(activity.activity_type)}</span>
                                );
                              })()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <p className="font-medium text-sm truncate text-white">
                                  {getActivityLabel(activity.activity_type)}
                                </p>
                                {isOwner && (
                                  <span className="text-[10px] px-1 py-0.5 bg-primary/10 text-primary rounded">
                                    You
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-white/70">
                                {format(new Date(activity.scheduled_for), "EEEE")} ({format(new Date(activity.scheduled_for), "dd-MM")})
                              </p>
                              {(activity.activity_type === "lunch" || activity.activity_type === "dinner" || activity.activity_type === "drinks" || activity.activity_type === "brunch") && (
                                <a
                                  href={getMapsUrl(activity.city, activity.activity_type) || "/"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-white/60 truncate flex items-center gap-1 hover:text-white/90 transition-colors underline-offset-2 hover:underline"
                                >
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  {getLocationString(activity.city, activity.activity_type)}
                                </a>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <div className="flex items-center gap-1 text-xs text-white/70">
                                <Users className="w-3 h-3" />
                                <span>{activity.participant_count}</span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-white/50" />
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Selected activity detail (when not in chat) */}
          {selectedActivity && !showChatDialog && (
            <div className="shrink-0 p-4 border-t border-border/50 bg-muted/30">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0",
                    getActivityColor(selectedActivity.activity_type)
                  )}
                >
                  {getActivityEmoji(selectedActivity.activity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">
                    {getActivityLabel(selectedActivity.activity_type)} in {selectedActivity.city}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedActivity.scheduled_for), "EEEE, MMMM d 'at' h:mm a")}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Avatar className="w-4 h-4">
                      <AvatarImage src={selectedActivity.creator_avatar || ""} />
                      <AvatarFallback className="text-[8px]">
                        {selectedActivity.creator_name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span>{selectedActivity.creator_name}</span>
                    <span>•</span>
                    <span>{selectedActivity.participant_count} going</span>
                  </div>
                </div>
                <div className="shrink-0">
                  {selectedActivity.user_id === user?.id ? (
                    <Button onClick={() => setShowChatDialog(true)}>
                      Open Chat
                    </Button>
                  ) : (
                    <Button onClick={() => handleJoin(selectedActivity)}>
                      Join Plan
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Activity Dialog */}
      <CreateActivityDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          // Refetch activities when dialog closes (activity may have been created)
          if (!open) {
            refetchActivities();
          }
        }}
        city={city}
      />

      {/* Plan Group Chat Dialog */}
      {selectedActivity && showChatDialog && (
        <PlanGroupChatDialog
          open={showChatDialog}
          onOpenChange={(open) => {
            setShowChatDialog(open);
            if (!open) setSelectedActivity(null);
          }}
          activity={selectedActivity}
          onBack={() => {
            setShowChatDialog(false);
            setSelectedActivity(null);
          }}
        />
      )}

      <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />
    </>
  );
}