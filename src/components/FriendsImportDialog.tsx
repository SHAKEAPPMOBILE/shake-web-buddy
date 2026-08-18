import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, X, Check } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useTranslation } from "react-i18next";
import { useFriends, ContactMatch } from "@/hooks/useFriends";
import { useSettlingGradient } from "@/hooks/useSettlingGradient";

interface FriendsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FriendsImportDialog({ open, onOpenChange }: FriendsImportDialogProps) {
  const { t } = useTranslation();
  const { style: iconGradientStyle } = useSettlingGradient("friendsImport");
  const {
    isImporting,
    matches,
    importContactsAndMatch,
    sendFriendRequests,
    cancelFriendRequest,
    acceptFriendRequest,
  } = useFriends();
  const [hasImported, setHasImported] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);

  const addable = useMemo(() => matches.filter((m) => !m.friendship_status), [matches]);

  // Select every addable match by default once results land, so "send all" is one tap.
  const applyDefaultSelection = (list: ContactMatch[]) => {
    setSelected(new Set(list.filter((m) => !m.friendship_status).map((m) => m.user_id)));
  };

  const handleImport = async () => {
    const result = await importContactsAndMatch();
    if (result.success) {
      setHasImported(true);
      applyDefaultSelection(result.matches);
    }
  };

  const handleSendSelected = async () => {
    if (selected.size === 0) return;
    setIsSending(true);
    await sendFriendRequests(Array.from(selected));
    setSelected(new Set());
    setIsSending(false);
  };

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setHasImported(false);
          setSelected(new Set());
        }
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("friends.importTitle", "Find friends from your contacts")}</DialogTitle>
        </DialogHeader>

        {!hasImported ? (
          <div className="flex flex-col items-center text-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={iconGradientStyle}>
              <Users className="w-8 h-8 text-white" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t("friends.importExplainer", "We check your contacts against people already on SHAKE.")}
            </p>
            <Button
              onClick={handleImport}
              disabled={isImporting}
              className="w-full bg-gray-900 text-white hover:bg-gray-800"
            >
              {isImporting ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  {t("friends.checking", "Checking contacts…")}
                </span>
              ) : (
                t("friends.checkContacts", "Check my contacts")
              )}
            </Button>
          </div>
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-3 py-10">
            <p className="text-sm text-muted-foreground">
              {t("friends.noMatches", "None of your contacts are on SHAKE yet.")}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-1">
              <p className="text-sm text-muted-foreground">
                {t("friends.foundCount", "{{count}} found on SHAKE", { count: matches.length })}
              </p>
              {addable.length > 0 && (
                <button
                  type="button"
                  onClick={() => applyDefaultSelection(matches)}
                  className="text-sm text-primary font-medium"
                >
                  {t("friends.selectAll", "Select all")}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1">
              {matches.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 py-2">
                  {!m.friendship_status ? (
                    <Checkbox checked={selected.has(m.user_id)} onCheckedChange={() => toggle(m.user_id)} />
                  ) : (
                    <div className="w-4" />
                  )}
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={m.avatar_url || undefined} />
                    <AvatarFallback>{m.name?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.name || t("friends.someone", "Someone")}</p>
                  </div>

                  {m.friendship_status === "accepted" && (
                    <span className="text-xs text-muted-foreground shrink-0">{t("friends.friends", "Friends")}</span>
                  )}
                  {m.friendship_status === "pending" && m.friendship_direction === "sent" && (
                    <button
                      type="button"
                      onClick={() => m.friendship_id && cancelFriendRequest(m.friendship_id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive shrink-0"
                    >
                      {t("friends.requested", "Requested")} <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {m.friendship_status === "pending" && m.friendship_direction === "received" && (
                    <button
                      type="button"
                      onClick={() => m.friendship_id && acceptFriendRequest(m.friendship_id)}
                      className="flex items-center gap-1 text-xs text-primary font-medium shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" /> {t("friends.accept", "Accept")}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {addable.length > 0 && (
              <Button onClick={handleSendSelected} disabled={selected.size === 0 || isSending} className="w-full shrink-0">
                {isSending ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    {t("friends.sending", "Sending…")}
                  </span>
                ) : (
                  t("friends.sendRequests", "Send {{count}} friend requests", { count: selected.size })
                )}
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
