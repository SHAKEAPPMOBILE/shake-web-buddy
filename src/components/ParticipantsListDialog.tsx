import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Crown, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PremiumDialog } from "@/components/PremiumDialog";

interface Participant {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
}

interface ParticipantsListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityType: string;
  city: string;
  onViewProfile: (userId: string, userName: string | null, avatarUrl: string | null) => void;
}

export function ParticipantsListDialog({
  open,
  onOpenChange,
  activityType,
  city,
  onViewProfile,
}: ParticipantsListDialogProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const { user, isPremium } = useAuth();

  const FREE_VISIBLE_COUNT = 3;

  useEffect(() => {
    if (!open) return;

    const fetchParticipants = async () => {
      setIsLoading(true);
      
      // Get active joins for this activity
      const { data: joins, error: joinsError } = await supabase
        .from("activity_joins")
        .select("user_id")
        .eq("activity_type", activityType)
        .eq("city", city)
        .gt("expires_at", new Date().toISOString());

      if (joinsError) {
        console.error("Error fetching joins:", joinsError);
        setIsLoading(false);
        return;
      }

      if (!joins || joins.length === 0) {
        setParticipants([]);
        setIsLoading(false);
        return;
      }

      const userIds = joins.map((j) => j.user_id);

      // Fetch profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      }

      const participantsList: Participant[] = userIds.map((userId) => {
        const profile = profiles?.find((p) => p.user_id === userId);
        return {
          user_id: userId,
          name: profile?.name || null,
          avatar_url: profile?.avatar_url || null,
        };
      });

      setParticipants(participantsList);
      setIsLoading(false);
    };

    fetchParticipants();
  }, [open, activityType, city]);

  const visibleParticipants = participants.slice(0, FREE_VISIBLE_COUNT);
  const blurredParticipants = participants.slice(FREE_VISIBLE_COUNT);
  const hasMoreParticipants = blurredParticipants.length > 0;

  const handleParticipantClick = (participant: Participant) => {
    if (participant.user_id === user?.id) return;
    
    if (isPremium) {
      onViewProfile(participant.user_id, participant.name, participant.avatar_url);
    } else {
      setShowPremiumDialog(true);
    }
  };

  const handleUnlockClick = () => {
    setShowPremiumDialog(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
          <DialogHeader>
            <DialogTitle className="font-display">Participants</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-shake-yellow border-t-transparent rounded-full" />
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
                          {isCurrentUser ? "You" : participant.name || "Shaker"}
                        </p>
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
                        <Crown className="w-4 h-4 mr-2" />
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
                            <p className="font-medium text-sm">
                              {isCurrentUser ? "You" : participant.name || "Shaker"}
                            </p>
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
