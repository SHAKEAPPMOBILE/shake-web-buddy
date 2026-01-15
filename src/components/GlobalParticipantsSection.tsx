import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, User, Sparkles } from "lucide-react";
import { PremiumDialog } from "@/components/PremiumDialog";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { SayHiButton } from "@/components/SayHiButton";
import { PrivateChatDialog } from "@/components/PrivateChatDialog";
import { Button } from "@/components/ui/button";
import { SuperHumanIcon } from "./SuperHumanIcon";
import { LoadingSpinner } from "./LoadingSpinner";
import { toast } from "sonner";
import { triggerConfettiWaterfall } from "@/lib/confetti";
import { playNotificationSound, playWelcomeVoice } from "@/lib/notification-sound";
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

  // Seeded random for consistent shuffling (changes twice per week)
  const getWeekSeed = (): number => {
    const now = new Date();
    const year = now.getFullYear();
    const weekNumber = Math.floor((now.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const halfWeek = now.getDay() >= 3 ? 1 : 0; // Changes on Wednesday
    return year * 1000 + weekNumber * 2 + halfWeek;
  };

  // Seeded shuffle - same seed produces same order
  const seededShuffle = <T,>(array: T[], seed: number): T[] => {
    const shuffled = [...array];
    let currentSeed = seed;
    
    const random = () => {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    };

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const fetchRecentParticipants = async () => {
    setIsLoading(true);

    // Get all users who signed up (ordered by most recent)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, name, avatar_url, created_at")
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

    const allParticipants: Participant[] = profiles.map((profile) => ({
      user_id: profile.user_id,
      name: profile.name || null,
      avatar_url: profile.avatar_url || null,
      joined_at: profile.created_at,
    }));

    // Separate users with and without profile pictures
    const withAvatar = allParticipants.filter(p => p.avatar_url);
    const withoutAvatar = allParticipants.filter(p => !p.avatar_url);

    // Use week-based seed for consistent ordering (changes twice per week)
    const seed = getWeekSeed();
    const shuffledWithAvatar = seededShuffle(withAvatar, seed);
    const shuffledWithoutAvatar = seededShuffle(withoutAvatar, seed + 1);

    // Prioritize users with avatars first
    const prioritizedList = [
      ...shuffledWithAvatar,
      ...shuffledWithoutAvatar,
    ];

    setParticipants(prioritizedList);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRecentParticipants();

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
            
            // Trigger confetti celebration, sound, and welcome voice
            triggerConfettiWaterfall();
            playNotificationSound();
            
            // Play the welcome voice after a short delay
            setTimeout(() => {
              playWelcomeVoice();
            }, 300);
            
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
          fetchRecentParticipants();
        }
      )
      .subscribe();

    // Mark initial load as complete after first fetch
    setTimeout(() => {
      isInitialLoad.current = false;
    }, 2000);

    // Also refresh every 30 seconds as backup
    const interval = setInterval(fetchRecentParticipants, 30000);
    
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

  // Preview avatars for the badge - show 5 DIFFERENT users with profile pictures
  const previewAvatars = Array.from(
    new Map(
      participants
        .filter((p) => Boolean(p.avatar_url))
        .map((p) => [p.user_id, p] as const)
    ).values()
  ).slice(0, 5);

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
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <User className={`w-3.5 h-3.5 text-muted-foreground ${p.avatar_url ? 'hidden' : ''}`} />
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-shake-yellow" />
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{totalCount}</span>{" "}
            {totalCount === 1 ? "Shaker" : "Shakers"}
          </span>
        </div>
      </button>

      {/* Participants List Dialog */}
      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
          <DialogHeader>
            <DialogTitle className="font-display">Shakers nearby</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : participants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No Shakers yet. Be the first!
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
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <User className={`w-5 h-5 text-muted-foreground ${participant.avatar_url ? 'hidden' : ''}`} />
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
                  <div className="space-y-2">
                    {blurredParticipants.map((participant, index) => (
                      <div
                        key={participant.user_id}
                        className="relative"
                      >
                        <div
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 blur-sm pointer-events-none select-none"
                        >
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border">
                            {participant.avatar_url ? (
                              <img
                                src={participant.avatar_url}
                                alt={participant.name || "User"}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <User className={`w-5 h-5 text-muted-foreground ${participant.avatar_url ? 'hidden' : ''}`} />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium text-sm">
                              {participant.name || "Shaker"}
                            </p>
                          </div>
                        </div>
                        {/* Unlock button on second blurred user */}
                        {index === 1 && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Button
                              onClick={handleUnlockClick}
                              className="bg-shake-yellow text-shake-dark hover:bg-shake-yellow/90 shadow-lg"
                            >
                              <span className="animate-peek inline-block mr-1">👀</span> Unlock {blurredParticipants.length} more
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
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
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <User className={`w-5 h-5 text-muted-foreground ${participant.avatar_url ? 'hidden' : ''}`} />
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
