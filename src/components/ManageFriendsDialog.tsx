import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Check, X, MoreVertical, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFriends } from "@/hooks/useFriends";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/app-toast";
import { FriendsImportDialog } from "@/components/FriendsImportDialog";

interface ManageFriendsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Renders the same content as a plain fragment (no Dialog/overlay) instead
   *  of a modal — used to embed this inline as an expanding section, matching
   *  the other Profile rows (My Points, Creator Payouts) instead of popping
   *  up as its own separate window. */
  inline?: boolean;
  /** Friends data/actions, lifted from the caller's own useFriends() call
   *  instead of this component calling the hook itself — ProfileTab already
   *  needs useFriends() for its "pending request" badge, so it starts
   *  fetching (and the avatar images start downloading) as soon as the
   *  Profile tab mounts. Calling useFriends() again in here would restart
   *  that fetch from zero at the moment this section is opened, which is
   *  exactly the "friends list is slow to open" delay this avoids. */
  friendsData: ReturnType<typeof useFriends>;
}

export function ManageFriendsDialog({ open, onOpenChange, inline = false, friendsData }: ManageFriendsDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    friends,
    pendingReceived,
    pendingSent,
    isLoadingFriends,
    cancelFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    refetchFriends,
  } = friendsData;
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Blocking a friend also ends the friendship — keeping someone as a
  // "friend" while blocked doesn't make sense, and blocks already show up
  // in the existing Paranormal Activity list regardless of source.
  const handleBlock = async (friendshipId: string, friendUserId: string) => {
    if (!user) return;
    setBlockingId(friendshipId);
    try {
      await supabase.from("user_blocks").upsert(
        { blocker_id: user.id, blocked_id: friendUserId },
        { onConflict: "blocker_id,blocked_id" }
      );
      await supabase.from("friendships").delete().eq("id", friendshipId);
      toast.success(t("shakers.blocked", "Blocked"));
      await refetchFriends();
    } catch {
      toast.error(t("shakers.blockFailed", "Couldn't block"));
    } finally {
      setBlockingId(null);
    }
  };

  if (inline && !open) return null;

  const addFriendsButton = (
    <button
      type="button"
      onClick={() => setShowImportDialog(true)}
      className="shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-primary border border-primary/30 bg-primary/5"
    >
      <Plus className="w-3.5 h-3.5" />
      {t("plans.addFriends", "Add friends")}
    </button>
  );

  const body = (
    <>
      {inline ? (
        <div className="flex items-center justify-end mb-3">{addFriendsButton}</div>
      ) : (
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle>{t("shakers.manageFriends", "My Friends")}</DialogTitle>
            {addFriendsButton}
          </div>
        </DialogHeader>
      )}

      <FriendsImportDialog
        open={showImportDialog}
        onOpenChange={(next) => {
          setShowImportDialog(next);
          if (!next) refetchFriends();
        }}
      />

      <div className={inline ? "space-y-5" : "flex-1 overflow-y-auto space-y-5"}>
          {isLoadingFriends ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <>
              {pendingReceived.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {t("shakers.requests", "Friend requests")}
                  </p>
                  <div className="space-y-2">
                    {pendingReceived.map((f) => (
                      <div key={f.friendship_id} className="flex items-center gap-3">
                        <Avatar className="w-9 h-9">
                          <AvatarImage src={f.avatar_url || undefined} />
                          <AvatarFallback>{f.name?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm font-medium truncate">
                          {f.name || t("friends.someone", "Someone")}
                        </span>
                        <button
                          type="button"
                          onClick={() => acceptFriendRequest(f.friendship_id)}
                          aria-label={t("friends.accept", "Accept")}
                          className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => declineFriendRequest(f.friendship_id)}
                          aria-label={t("shakers.decline", "Decline")}
                          className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingSent.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {t("shakers.sentRequests", "Requested")}
                  </p>
                  <div className="space-y-2">
                    {pendingSent.map((f) => (
                      <div key={f.friendship_id} className="flex items-center gap-3">
                        <Avatar className="w-9 h-9">
                          <AvatarImage src={f.avatar_url || undefined} />
                          <AvatarFallback>{f.name?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm font-medium truncate">
                          {f.name || t("friends.someone", "Someone")}
                        </span>
                        <button
                          type="button"
                          onClick={() => cancelFriendRequest(f.friendship_id)}
                          className="flex items-center gap-1 text-xs text-muted-foreground shrink-0"
                        >
                          {t("friends.requested", "Requested")} <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {t("shakers.myFriends", "My friends")}
                </p>
                {friends.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {t("plans.noFriendsYet", "You haven't added any friends yet.")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {friends.map((f) => (
                      <div key={f.friendship_id} className="flex items-center gap-3">
                        <Avatar className="w-9 h-9">
                          <AvatarImage src={f.avatar_url || undefined} />
                          <AvatarFallback>{f.name?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm font-medium truncate">
                          {f.name || t("friends.someone", "Someone")}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={t("shakers.manageFriend", "Manage friend")}
                              className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => cancelFriendRequest(f.friendship_id)}>
                              {t("shakers.unshake", "Unshake (remove friend)")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              disabled={blockingId === f.friendship_id}
                              onClick={() => handleBlock(f.friendship_id, f.user_id)}
                            >
                              {t("shakers.block", "Block")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
    </>
  );

  if (inline) return body;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        {body}
      </DialogContent>
    </Dialog>
  );
}
