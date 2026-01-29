import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Calendar, MapPin, Plus, Trash2, Users } from "lucide-react";
import { useUserActivities, UserActivity } from "@/hooks/useUserActivities";
import { useAuth } from "@/contexts/AuthContext";
import { getActivityEmoji, getActivityLabel, getActivityColor, ACTIVITY_TYPES } from "@/data/activityTypes";
import { getActivityConfig } from "@/lib/activityDetection";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { PremiumDialog } from "@/components/PremiumDialog";
import { LoadingSpinner } from "./LoadingSpinner";

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
  const { user, isPremium } = useAuth();
  const { activities, myActivities, isLoading, joinActivity, leaveActivity, deleteActivity, hasJoinedActivity } = useUserActivities(city);
  const [joinedActivities, setJoinedActivities] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const isMobile = useIsMobile();
  
  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });

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
      const result = await joinActivity(activity.id, isPremium);
      if (result.requiresPremium) {
        setShowPremiumDialog(true);
        return;
      }
      if (result.success) {
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
        <DialogContent 
          className="sm:max-w-lg bg-card/95 backdrop-blur-xl border-border/50 max-h-[85vh] overflow-hidden flex flex-col"
          {...(isMobile ? swipeHandlers : {})}
        >
          {isMobile && (
            <div className="flex justify-center py-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
          )}
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-center text-2xl font-display flex items-center justify-center gap-2">
              <Calendar className="w-6 h-6" />
              Plans in {city}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No upcoming plans</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Be the first to propose one!
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
                        className="w-full flex items-center gap-3 p-4 rounded-xl transition-all text-left group overflow-hidden hover:opacity-90"
                        style={{
                          background: "linear-gradient(to right, rgba(88, 28, 135, 0.6), rgba(67, 56, 202, 0.5))",
                        }}
                      >
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 bg-white shadow-md">
                          <span>{getActivityConfig(activity.activity_type).emoji}</span>
                        </div>

                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-white truncate">
                              {activity.note || getActivityLabel(activity.activity_type)}
                            </p>
                            {isOwner && (
                              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full whitespace-nowrap">
                                Yours
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm text-white/70 mt-1 truncate">
                            Scheduled for {format(new Date(activity.scheduled_for), "EEEE")} ({format(new Date(activity.scheduled_for), "dd-MM")})
                          </p>

                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-1 text-xs text-white/60 min-w-0">
                              <Avatar className="w-4 h-4 shrink-0">
                                <AvatarImage src={activity.creator_avatar || ""} />
                                <AvatarFallback className="text-[8px]">
                                  {activity.creator_name?.charAt(0) || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate">{activity.creator_name}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-white/60 shrink-0">
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

          {/* Create Plan Button */}
          <div className="shrink-0 pt-4 border-t border-border">
            <button
              onClick={() => {
                onOpenChange(false);
                onCreateActivity();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-medium transition-all hover:opacity-90"
              style={{
                background: "linear-gradient(to right, rgba(88, 28, 135, 0.8), rgba(67, 56, 202, 0.7))",
              }}
            >
              <Plus className="w-5 h-5" />
              Propose a Plan
            </button>
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

      <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />
    </>
  );
}
