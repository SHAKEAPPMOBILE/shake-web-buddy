import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Check, Search, ArrowLeft } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useTranslation } from "react-i18next";
import { useFriends, ContactMatch } from "@/hooks/useFriends";
import catHead from "@/assets/onboarding/cat-head.png";

interface FriendsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** One result row shared by both the contacts-match list and the name-search list. */
function MatchRow({
  match,
  leading,
  onCancel,
  onAccept,
}: {
  match: ContactMatch;
  leading: React.ReactNode;
  onCancel: (friendshipId: string) => void;
  onAccept: (friendshipId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 py-2">
      {leading}
      <Avatar className="w-10 h-10">
        <AvatarImage src={match.avatar_url || undefined} />
        <AvatarFallback>{match.name?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{match.name || t("friends.someone", "Someone")}</p>
      </div>

      {match.friendship_status === "accepted" && (
        <span className="text-xs text-muted-foreground shrink-0">{t("friends.friends", "Friends")}</span>
      )}
      {match.friendship_status === "pending" && match.friendship_direction === "sent" && (
        <button
          type="button"
          onClick={() => match.friendship_id && onCancel(match.friendship_id)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive shrink-0"
        >
          {t("friends.requested", "Requested")} <X className="w-3.5 h-3.5" />
        </button>
      )}
      {match.friendship_status === "pending" && match.friendship_direction === "received" && (
        <button
          type="button"
          onClick={() => match.friendship_id && onAccept(match.friendship_id)}
          className="flex items-center gap-1 text-xs text-primary font-medium shrink-0"
        >
          <Check className="w-3.5 h-3.5" /> {t("friends.accept", "Accept")}
        </button>
      )}
    </div>
  );
}

export function FriendsImportDialog({ open, onOpenChange }: FriendsImportDialogProps) {
  const { t } = useTranslation();
  const {
    isImporting,
    matches,
    importContactsAndMatch,
    searchUsersByName,
    sendFriendRequest,
    sendFriendRequests,
    cancelFriendRequest,
    acceptFriendRequest,
  } = useFriends();
  const [mode, setMode] = useState<"intro" | "contacts" | "search">("intro");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ContactMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

  const addable = useMemo(() => matches.filter((m) => !m.friendship_status), [matches]);

  // Select every addable match by default once results land, so "send all" is one tap.
  const applyDefaultSelection = (list: ContactMatch[]) => {
    setSelected(new Set(list.filter((m) => !m.friendship_status).map((m) => m.user_id)));
  };

  const handleImport = async () => {
    const result = await importContactsAndMatch();
    if (result.success) {
      setMode("contacts");
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

  const handleAddOne = async (userId: string) => {
    setSendingIds((prev) => new Set(prev).add(userId));
    await sendFriendRequest(userId);
    setSearchResults((prev) =>
      prev.map((m) => (m.user_id === userId ? { ...m, friendship_status: "pending", friendship_direction: "sent" } : m))
    );
    setSendingIds((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  };

  // Debounced live search as the user types.
  useEffect(() => {
    if (mode !== "search") return;
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const handle = setTimeout(async () => {
      const results = await searchUsersByName(query);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery, mode, searchUsersByName]);

  const resetState = () => {
    setMode("intro");
    setSelected(new Set());
    setSearchQuery("");
    setSearchResults([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetState();
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {mode === "search" && (
              <button
                type="button"
                onClick={() => setMode("intro")}
                className="text-muted-foreground hover:text-foreground -ml-1"
                aria-label={t("common.back", "Back")}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <DialogTitle>
              {mode === "search"
                ? t("friends.searchTitle", "Find friends by name")
                : t("friends.importTitle", "Find friends from your contacts")}
            </DialogTitle>
          </div>
        </DialogHeader>

        {mode === "intro" && (
          <div className="flex flex-col items-center text-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full overflow-hidden">
              <img src={catHead} alt="" className="w-full h-full object-cover" />
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
            <button
              type="button"
              onClick={() => setMode("search")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Search className="w-3.5 h-3.5" />
              {t("friends.searchByName", "Or search by name")}
            </button>
          </div>
        )}

        {mode === "search" && (
          <div className="flex-1 flex flex-col min-h-0 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("friends.searchPlaceholder", "Search by name…")}
                className="pl-9"
              />
            </div>

            <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1">
              {isSearching && (
                <div className="flex justify-center py-6">
                  <LoadingSpinner size="sm" />
                </div>
              )}
              {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t("friends.noSearchResults", "No one found with that name.")}
                </p>
              )}
              {!isSearching &&
                searchResults.map((m) => (
                  <MatchRow
                    key={m.user_id}
                    match={m}
                    onCancel={cancelFriendRequest}
                    onAccept={acceptFriendRequest}
                    leading={
                      !m.friendship_status ? (
                        <button
                          type="button"
                          onClick={() => handleAddOne(m.user_id)}
                          disabled={sendingIds.has(m.user_id)}
                          className="text-xs font-medium text-primary shrink-0 order-last ml-auto disabled:opacity-50"
                        >
                          {sendingIds.has(m.user_id) ? <LoadingSpinner size="sm" /> : t("friends.add", "Add")}
                        </button>
                      ) : (
                        <div className="w-4 shrink-0" />
                      )
                    }
                  />
                ))}
            </div>
          </div>
        )}

        {mode === "contacts" && matches.length === 0 && (
          <div className="flex flex-col items-center text-center gap-3 py-10">
            <p className="text-sm text-muted-foreground">
              {t("friends.noMatches", "None of your contacts are on SHAKE yet.")}
            </p>
          </div>
        )}

        {mode === "contacts" && matches.length > 0 && (
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
                <MatchRow
                  key={m.user_id}
                  match={m}
                  onCancel={cancelFriendRequest}
                  onAccept={acceptFriendRequest}
                  leading={
                    !m.friendship_status ? (
                      <Checkbox checked={selected.has(m.user_id)} onCheckedChange={() => toggle(m.user_id)} />
                    ) : (
                      <div className="w-4" />
                    )
                  }
                />
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
