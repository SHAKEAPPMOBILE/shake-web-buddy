import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Calendar, MapPin, Plus, Trash2, Users } from "lucide-react";
import { useUserActivities, UserActivity } from "@/hooks/useUserActivities";
import { useAuth } from "@/contexts/AuthContext";
import { getActivityEmoji, getActivityLabel, getActivityColor } from "@/data/activityTypes";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface ActivitiesListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  city: string;
  onCreateActivity: () => void;
  onSelectActivity: (activity: UserActivity) => void;
}

export function ActivitiesListDialog({
  open,
  onOpenChange,
  city,
  onCreateActivity,
  onSelectActivity,
}: ActivitiesListDialogProps) {
  const { user } = useAuth();
  const { activities, myActivities, isLoading, joinActivity, leaveActivity, deleteActivity, hasJoinedActivity } = useUserActivities(city);
  const [joinedActivities, setJoinedActivities] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Check join status for all activities
  useEffect(() => {
    if (!user || !activities.length) return;

    const checkJoinStatus = async () => {
      const joined = new Set<string>();
      for (const activity of activities) {
        if (await hasJoinedActivity(activity.id)) {
          joined.add(activity.id);
        }
      }
      setJoinedActivities(joined);
    };

    checkJoinStatus();
  }, [activities, user, hasJoinedActivity]);

  const handleJoinToggle = async (activity: UserActivity, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (joinedActivities.has(activity.id)) {
      await leaveActivity(activity.id);
      setJoinedActivities(prev => {
        const next = new Set(prev);
        next.delete(activity.id);
        return next;
      });
    } else {
      const success = await joinActivity(activity.id);
      if (success) {
        setJoinedActivities(prev => new Set([...prev, activity.id]));
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteActivity(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const isMyActivity = (activity: UserActivity) => activity.user_id === user?.id;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg bg-card/95 backdrop-blur-xl border-border/50 max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-center text-2xl font-display flex items-center justify-center gap-2">
              <Calendar className="w-6 h-6" />
              Activities in {city}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No upcoming activities</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Be the first to create one!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => {
                  const isOwner = isMyActivity(activity);
                  const hasJoined = joinedActivities.has(activity.id);

                    return (
                      <button
                        key={activity.id}
                        onClick={() => onSelectActivity(activity)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left group overflow-hidden"
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0",
                          getActivityColor(activity.activity_type)
                        )}>
                          {getActivityEmoji(activity.activity_type)}
                        </div>

                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground truncate">
                              {getActivityLabel(activity.activity_type)}
                            </p>
                            {isOwner && (
                              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full whitespace-nowrap">
                                Yours
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {format(new Date(activity.scheduled_for), "EEE, MMM d 'at' h:mm a")}
                          </p>

                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                              <Avatar className="w-4 h-4 shrink-0">
                                <AvatarImage src={activity.creator_avatar || ""} />
                                <AvatarFallback className="text-[8px]">
                                  {activity.creator_name?.charAt(0) || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate">{activity.creator_name}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                              <Users className="w-3 h-3" />
                              <span>{activity.participant_count}</span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1">
                          {isOwner ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(activity.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant={hasJoined ? "secondary" : "default"}
                              className="h-8 px-3 text-xs"
                              onClick={(e) => handleJoinToggle(activity, e)}
                            >
                              {hasJoined ? "Joined" : "Join"}
                            </Button>
                          )}
                        </div>
                      </button>
                    );
                })}
              </div>
            )}
          </div>

          {/* Create Activity Button */}
          <div className="shrink-0 pt-4 border-t border-border">
            <Button
              onClick={() => {
                onOpenChange(false);
                onCreateActivity();
              }}
              className="w-full"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Activity
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Activity?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the activity and notify all participants. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Activity</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancel Activity
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
