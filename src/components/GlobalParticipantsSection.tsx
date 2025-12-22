import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Users, User, Sparkles } from "lucide-react";
import { PremiumDialog } from "@/components/PremiumDialog";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { SayHiButton } from "@/components/SayHiButton";
import { PrivateChatDialog } from "@/components/PrivateChatDialog";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";
import { toast } from "sonner";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { playNotificationSound } from "@/lib/notification-sound";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Participant {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  joined_at: string;
}

const FREE_VISIBLE_COUNT = 7;

export function GlobalParticipantsSection() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showListDialog, setShowListDialog] = useState(false);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    userId: string;
    userName: string | null;
    avatarUrl: string | null;
  } | null>(null);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [chatUser, setChatUser] = useState<{
    userId: string;
    userName: string | null;
    avatarUrl: string | null;
  } | null>(null);
  const { user, isPremium } = useAuth();
  const isInitialLoad = useRef(true);

  const fetchTodaysParticipants = async () => {
    setIsLoading(true);

    // Get today's start (midnight UTC)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Get users who signed up today (profiles created today)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, name, avatar_url, created_at")
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false });

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      setIsLoading(false);
      return;
    }

    if (!profiles || profiles.length === 0) {
      setParticipants([]);
      setTotalCount(0);
      setIsLoading(false);
      return;
    }

    setTotalCount(profiles.length);

    const participantsList: Participant[] = profiles.map((profile) => ({
      user_id: profile.user_id,
      name: profile.name || null,
      avatar_url: profile.avatar_url || null,
      joined_at: profile.created_at,
    }));

    setParticipants(participantsList);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTodaysParticipants();

    // Subscribe to real-time updates on profiles table (new signups)
    const profilesChannel = supabase
      .channel('profiles-signups')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          // Skip celebration on initial load
          if (isInitialLoad.current) return;
          
          // Don't celebrate for the current user's own signup
          if (payload.new && (payload.new as any).user_id !== user?.id) {
            const newMemberName = (payload.new as any).name || "A new Shaker";
            
            // Trigger confetti celebration and sound
            triggerConfettiWaterfall();
            playNotificationSound();
            
            // Show welcome toast
            toast.success(
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-shake-yellow" />
                <span><strong>{newMemberName}</strong> just joined!</span>
              </div>,
              {
                duration: 4000,
              }
            );
          }
          
          // Refresh the list
          fetchTodaysParticipants();
        }
      )
      .subscribe();

    // Mark initial load as complete after first fetch
    setTimeout(() => {
      isInitialLoad.current = false;
    }, 2000);

    // Also refresh every 30 seconds as backup
    const interval = setInterval(fetchTodaysParticipants, 30000);
    
    return () => {
      supabase.removeChannel(profilesChannel);
      clearInterval(interval);
    };
  }, [user?.id]);

  const handleParticipantClick = (participant: Participant) => {
    setSelectedUser({
      userId: participant.user_id,
      userName: participant.name,
      avatarUrl: participant.avatar_url,
    });
    setShowProfileDialog(true);
  };

  const handleUnlockClick = () => {
    setShowPremiumDialog(true);
  };

  const handleMatchFromList = (participant: Participant) => {
    setChatUser({
      userId: participant.user_id,
      userName: participant.name,
      avatarUrl: participant.avatar_url,
    });
    setShowChatDialog(true);
  };

  const visibleParticipants = participants.slice(0, FREE_VISIBLE_COUNT);
  const blurredParticipants = participants.slice(FREE_VISIBLE_COUNT);
  const hasMoreParticipants = blurredParticipants.length > 0;

  // Preview avatars for the badge (show up to 5)
  const previewAvatars = participants.slice(0, 5);

  if (totalCount === 0 && !isLoading) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowListDialog(true)}
        className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-card/50 border border-border/50 backdrop-blur-sm hover:bg-card/70 transition-colors cursor-pointer animate-fade-up"
        style={{ animationDelay: "250ms" }}
      >
        {/* Stacked avatars */}
        {previewAvatars.length > 0 && (
          <div className="flex -space-x-2">
            {previewAvatars.map((p, idx) => (
              <div
                key={p.user_id}
                className="w-7 h-7 rounded-full bg-muted border-2 border-card flex items-center justify-center overflow-hidden"
                style={{ zIndex: previewAvatars.length - idx }}
              >
                {p.avatar_url ? (
                  <img
                    src={p.avatar_url}
                    alt={p.name || "User"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-shake-yellow" />
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{totalCount}</span>{" "}
            new {totalCount === 1 ? "member" : "members"} today
          </span>
        </div>
      </button>

      {/* Participants List Dialog */}
      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
          <DialogHeader>
            <DialogTitle className="font-display">New Members Today</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-shake-yellow border-t-transparent rounded-full" />
              </div>
            ) : participants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No one has joined today yet. Be the first!
              </p>
            ) : (
              <>
                {/* Visible participants */}
                {visibleParticipants.map((participant) => {
                  const isCurrentUser = participant.user_id === user?.id;
                  return (
                    <div
                      key={participant.user_id}
                      className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-muted/50"
                    >
                      <button
                        onClick={() => handleParticipantClick(participant)}
                        className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border hover:border-primary transition-colors"
                      >
                        {participant.avatar_url ? (
                          <img
                            src={participant.avatar_url}
                            alt={participant.name || "User"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>
                      <button
                        onClick={() => handleParticipantClick(participant)}
                        className="flex-1 text-left"
                      >
                        <p className="font-medium text-sm">
                          {isCurrentUser ? "You" : participant.name || "Shaker"}
                        </p>
                      </button>
                      {isCurrentUser ? (
                        <span className="text-xs text-muted-foreground">(You)</span>
                      ) : (
                        <SayHiButton
                          targetUserId={participant.user_id}
                          targetUserName={participant.name}
                          size="sm"
                          onMatch={() => handleMatchFromList(participant)}
                        />
                      )}
                    </div>
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
                        <div
                          key={participant.user_id}
                          className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-muted/50"
                        >
                          <button
                            onClick={() => handleParticipantClick(participant)}
                            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border hover:border-primary transition-colors"
                          >
                            {participant.avatar_url ? (
                              <img
                                src={participant.avatar_url}
                                alt={participant.name || "User"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-muted-foreground" />
                            )}
                          </button>
                          <button
                            onClick={() => handleParticipantClick(participant)}
                            className="flex-1 text-left"
                          >
                            <p className="font-medium text-sm">
                              {isCurrentUser ? "You" : participant.name || "Shaker"}
                            </p>
                          </button>
                          {isCurrentUser ? (
                            <span className="text-xs text-muted-foreground">(You)</span>
                          ) : (
                            <SayHiButton
                              targetUserId={participant.user_id}
                              targetUserName={participant.name}
                              size="sm"
                              onMatch={() => handleMatchFromList(participant)}
                            />
                          )}
                        </div>
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

      {selectedUser && (
        <UserProfileDialog
          open={showProfileDialog}
          onOpenChange={setShowProfileDialog}
          userId={selectedUser.userId}
          userName={selectedUser.userName}
          avatarUrl={selectedUser.avatarUrl}
        />
      )}

      {chatUser && (
        <PrivateChatDialog
          open={showChatDialog}
          onOpenChange={setShowChatDialog}
          otherUserId={chatUser.userId}
          otherUserName={chatUser.userName}
          otherUserAvatar={chatUser.avatarUrl}
        />
      )}
    </>
  );
}
