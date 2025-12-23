import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { List, Map, Plus, X, Users, ChevronRight, Bell, BellOff, ChevronDown } from "lucide-react";
import { WorldMap } from "@/components/WorldMap";
import { useAllActivities } from "@/hooks/useAllActivities";
import { UserActivity } from "@/hooks/useUserActivities";
import { getActivityEmoji, getActivityLabel, getActivityColor } from "@/data/activityTypes";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreateActivityDialog } from "@/components/CreateActivityDialog";
import { PlanGroupChatDialog } from "@/components/PlanGroupChatDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useUserActivities } from "@/hooks/useUserActivities";
import { usePlanNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { PremiumDialog } from "@/components/PremiumDialog";

interface PlansMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  city: string;
}

export function PlansMapDialog({ open, onOpenChange, city }: PlansMapDialogProps) {
  const { user, isPremium } = useAuth();
  const { activities, isLoading, refetch: refetchActivities } = useAllActivities();
  const { joinActivity, hasJoinedActivity, myActivities } = useUserActivities(city);
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const [showList, setShowList] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<UserActivity | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [joinedActivities, setJoinedActivities] = useState<Set<string>>(new Set());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);

  // Swipe to close on mobile
  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });

  // Get IDs of activities the user owns
  const myActivityIds = useMemo(() => myActivities.map((a) => a.id), [myActivities]);

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
      setJoinedActivities((prev) => new Set([...prev, activity.id]));
      setSelectedActivity(activity);
      setShowChatDialog(true);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="sm:max-w-4xl h-[80vh] max-h-[90vh] flex flex-col p-0 bg-card/95 backdrop-blur-xl border-border/50 overflow-hidden"
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
                  {activities.length} {activities.length === 1 ? "plan" : "plans"} worldwide
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {user && myActivityIds.length > 0 && (
                <Button
                  variant={notificationsEnabled ? "secondary" : "outline"}
                  size="sm"
                  onClick={handleEnableNotifications}
                  className="gap-1 px-2 sm:px-3"
                >
                  {notificationsEnabled ? (
                    <Bell className="w-4 h-4 text-green-500" />
                  ) : (
                    <BellOff className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">
                    {notificationsEnabled ? "Notifications On" : "Enable Notifications"}
                  </span>
                </Button>
              )}
              {/* Mobile view toggle */}
              {isMobile ? (
                <div className="flex rounded-lg overflow-hidden border border-border">
                  <Button
                    variant={mobileView === 'list' ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setMobileView('list')}
                    className="rounded-none px-3"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={mobileView === 'map' ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setMobileView('map')}
                    className="rounded-none px-3"
                  >
                    <Map className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant={showList ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setShowList(!showList)}
                >
                  <List className="w-4 h-4 mr-1" />
                  List
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                className="px-2 sm:px-3"
              >
                <Plus className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Create Plan</span>
              </Button>
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
                      activities={activities}
                      onActivityClick={handleActivityClick}
                      selectedActivityId={selectedActivity?.id}
                      initialCity={city}
                    />
                  </div>
                )}
                {mobileView === 'list' && (
                  <div className="flex-1 flex flex-col bg-card/95">
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {activities.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-sm text-muted-foreground">No plans yet</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            Be the first to create one!
                          </p>
                        </div>
                      ) : (
                        activities.map((activity) => {
                          const isOwner = activity.user_id === user?.id;

                          return (
                            <button
                              key={activity.id}
                              onClick={() => handleActivityClick(activity)}
                              className={cn(
                                "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all",
                                selectedActivity?.id === activity.id
                                  ? "bg-gradient-to-r from-[hsl(270,50%,25%)/0.9] to-[hsl(250,40%,20%)/0.8] border border-primary/30"
                                  : "bg-gradient-to-r from-[hsl(270,30%,20%)/0.7] to-[hsl(250,25%,15%)/0.6] hover:from-[hsl(270,35%,25%)/0.8] hover:to-[hsl(250,30%,20%)/0.7]"
                              )}
                            >
                              <div
                                className={cn(
                                  "w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0",
                                  getActivityColor(activity.activity_type)
                                )}
                              >
                                {getActivityEmoji(activity.activity_type)}
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
                                  Scheduled for {format(new Date(activity.scheduled_for), "EEEE")} ({format(new Date(activity.scheduled_for), "dd-MM")})
                                </p>
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
                    {activities.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground">No plans yet</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          Be the first to create one!
                        </p>
                      </div>
                    ) : (
                      activities.map((activity) => {
                        const isOwner = activity.user_id === user?.id;

                        return (
                          <button
                            key={activity.id}
                            onClick={() => handleActivityClick(activity)}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all",
                              selectedActivity?.id === activity.id
                                ? "bg-gradient-to-r from-[hsl(270,50%,25%)/0.9] to-[hsl(250,40%,20%)/0.8] border border-primary/30"
                                : "bg-gradient-to-r from-[hsl(270,30%,20%)/0.7] to-[hsl(250,25%,15%)/0.6] hover:from-[hsl(270,35%,25%)/0.8] hover:to-[hsl(250,30%,20%)/0.7]"
                            )}
                          >
                            <div
                              className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0",
                                getActivityColor(activity.activity_type)
                              )}
                            >
                              {getActivityEmoji(activity.activity_type)}
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
                                Scheduled for {format(new Date(activity.scheduled_for), "EEEE")} ({format(new Date(activity.scheduled_for), "dd-MM")})
                              </p>
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