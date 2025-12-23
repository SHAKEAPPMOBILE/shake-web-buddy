import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PremiumDialog } from "@/components/PremiumDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { SuperHumanIcon } from "./SuperHumanIcon";
import { UserActivity } from "@/hooks/useUserActivities";

interface Participant {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  isOwner: boolean;
}

interface PlanParticipantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: UserActivity;
  onViewProfile: (userId: string, userName: string | null, avatarUrl: string | null) => void;
}

export function PlanParticipantsDialog({
  open,
  onOpenChange,
  activity,
  onViewProfile,
}: PlanParticipantsDialogProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const { user, isPremium } = useAuth();
  const isMobile = useIsMobile();
  
  const swipeHandlers = useSwipeToClose({
    onClose: () => onOpenChange(false),
    threshold: 80,
    enabled: isMobile,
  });

  const FREE_VISIBLE_COUNT = 3;

  useEffect(() => {
    if (!open || !activity.id) return;

    const fetchParticipants = async () => {
      setIsLoading(true);
      
      // Get the owner's profile
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .eq("user_id", activity.user_id)
        .maybeSingle();

      const owner: Participant = {
        user_id: activity.user_id,
        name: ownerProfile?.name || activity.creator_name || null,
        avatar_url: ownerProfile?.avatar_url || activity.creator_avatar || null,
        isOwner: true,
      };

      // Get activity joins for this specific plan
      const { data: joins, error: joinsError } = await supabase
        .from("activity_joins")
        .select("user_id")
        .eq("activity_id", activity.id);

      if (joinsError) {
        console.error("Error fetching joins:", joinsError);
        setParticipants([owner]);
        setIsLoading(false);
        return;
      }

      if (!joins || joins.length === 0) {
        setParticipants([owner]);
        setIsLoading(false);
        return;
      }

      // Get unique user IDs (excluding owner)
      const uniqueUserIds = [...new Set(joins.map((j) => j.user_id))].filter(
        (id) => id !== activity.user_id
      );

      // Fetch profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", uniqueUserIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      }

      const joinedParticipants: Participant[] = uniqueUserIds.map((userId) => {
        const profile = profiles?.find((p) => p.user_id === userId);
        return {
          user_id: userId,
          name: profile?.name || null,
          avatar_url: profile?.avatar_url || null,
          isOwner: false,
        };
      });

      // Owner first, then joined participants
      setParticipants([owner, ...joinedParticipants]);
      setIsLoading(false);
    };

    fetchParticipants();
  }, [open, activity.id, activity.user_id, activity.creator_name, activity.creator_avatar]);

  const visibleParticipants = participants.slice(0, FREE_VISIBLE_COUNT);
  const blurredParticipants = participants.slice(FREE_VISIBLE_COUNT);
  const hasMoreParticipants = blurredParticipants.length > 0;

  const handleParticipantClick = (participant: Participant) => {
    if (participant.user_id === user?.id) return;
    onViewProfile(participant.user_id, participant.name, participant.avatar_url);
  };

  const handleUnlockClick = () => {
    setShowPremiumDialog(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50"
          {...(isMobile ? swipeHandlers : {})}
        >
          {isMobile && (
            <div className="flex justify-center py-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
          )}
          <DialogHeader>
            <DialogTitle className="font-display">Participants ({participants.length})</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : participants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No participants yet
              </p>
            ) : (
              <>
                {/* Visible participants */}
                {visibleParticipants.map((participant) => {
                  const isCurrentUser = participant.user_id === user?.id;
                  return (
                    <button
                      key={participant.user_id}
                      onClick={() => handleParticipantClick(participant)}
                      disabled={isCurrentUser}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        isCurrentUser 
                          ? 'bg-muted/50 cursor-default' 
                          : 'hover:bg-muted/50 cursor-pointer'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border relative">
                        {participant.avatar_url ? (
                          <img
                            src={participant.avatar_url}
                            alt={participant.name || "User"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {isCurrentUser ? "You" : participant.name || "Shaker"}
                          </p>
                          {participant.isOwner && (
                            <span className="flex items-center gap-1 text-xs text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                              <Crown className="w-3 h-3" />
                              Host
                            </span>
                          )}
                        </div>
                      </div>
                      {isCurrentUser && (
                        <span className="text-xs text-muted-foreground">(You)</span>
                      )}
                    </button>
                  );
                })}

                {/* Blurred participants for non-premium */}
                {hasMoreParticipants && !isPremium && (
                  <div className="relative">
                    <div className="space-y-2 blur-sm pointer-events-none select-none">
                      {blurredParticipants.map((participant) => (
                        <div
                          key={participant.user_id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                        >
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border">
                            {participant.avatar_url ? (
                              <img
                                src={participant.avatar_url}
                                alt={participant.name || "User"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium text-sm">
                              {participant.name || "Shaker"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Unlock overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Button
                        onClick={handleUnlockClick}
                        className="bg-shake-yellow text-shake-dark hover:bg-shake-yellow/90 shadow-lg"
                      >
                        <SuperHumanIcon size={16} className="mr-2" />
                        Unlock {blurredParticipants.length} more
                      </Button>
                    </div>
                  </div>
                )}

                {/* Show all participants for premium users */}
                {hasMoreParticipants && isPremium && (
                  <>
                    {blurredParticipants.map((participant) => {
                      const isCurrentUser = participant.user_id === user?.id;
                      return (
                        <button
                          key={participant.user_id}
                          onClick={() => handleParticipantClick(participant)}
                          disabled={isCurrentUser}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                            isCurrentUser 
                              ? 'bg-muted/50 cursor-default' 
                              : 'hover:bg-muted/50 cursor-pointer'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border">
                            {participant.avatar_url ? (
                              <img
                                src={participant.avatar_url}
                                alt={participant.name || "User"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">
                                {isCurrentUser ? "You" : participant.name || "Shaker"}
                              </p>
                              {participant.isOwner && (
                                <span className="flex items-center gap-1 text-xs text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                                  <Crown className="w-3 h-3" />
                                  Host
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PremiumDialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog} />
    </>
  );
}