import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { format } from "date-fns";
import { List, Map, Plus, X, Users, ChevronRight } from "lucide-react";
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

interface PlansMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  city: string;
}

export function PlansMapDialog({ open, onOpenChange, city }: PlansMapDialogProps) {
  const { user } = useAuth();
  const { activities, isLoading } = useAllActivities();
  const { joinActivity, hasJoinedActivity } = useUserActivities(city);
  const [showList, setShowList] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<UserActivity | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [joinedActivities, setJoinedActivities] = useState<Set<string>>(new Set());

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
    const success = await joinActivity(activity.id);
    if (success) {
      setJoinedActivities((prev) => new Set([...prev, activity.id]));
      setSelectedActivity(activity);
      setShowChatDialog(true);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col p-0 bg-card/95 backdrop-blur-xl border-border/50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
            <div>
              <h2 className="text-xl font-display font-bold flex items-center gap-2">
                <Map className="w-5 h-5" />
                Explore Plans
              </h2>
              <p className="text-sm text-muted-foreground">
                {activities.length} {activities.length === 1 ? "plan" : "plans"} worldwide
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={showList ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowList(!showList)}
              >
                <List className="w-4 h-4 mr-1" />
                List
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Create Plan
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Map */}
            <div className={cn("flex-1 transition-all duration-300", showList && "mr-80")}>
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
                    const hasJoined = joinedActivities.has(activity.id);

                    return (
                      <button
                        key={activity.id}
                        onClick={() => handleActivityClick(activity)}
                        className={cn(
                          "w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors",
                          selectedActivity?.id === activity.id
                            ? "bg-primary/10 border border-primary/30"
                            : "bg-muted/50 hover:bg-muted"
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
                            <p className="font-medium text-sm truncate">
                              {getActivityLabel(activity.activity_type)}
                            </p>
                            {isOwner && (
                              <span className="text-[10px] px-1 py-0.5 bg-primary/10 text-primary rounded">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {activity.city}
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            {format(new Date(activity.scheduled_for), "MMM d, h:mm a")}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="w-3 h-3" />
                            <span>{activity.participant_count}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
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
        onOpenChange={setShowCreateDialog}
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
    </>
  );
}