import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Loader2, UserPlus, Send, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFriends } from "@/hooks/useFriends";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { toast } from "@/lib/app-toast";

export interface HostedEvent {
  id: string;
  title: string;
  emoji: string;
  date: Date;
  attendees: number;
  scanned: number;
  ticketed: boolean;
}

interface Attendee {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
  checked_in_at: string | null;
}

type RpcResult = Promise<{ data: unknown; error: { message: string } | null }>;
// get_event_attendees comes from migration 20261029120000_event_attendees_and_invitations.sql, not in the generated types yet.
const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: object) => RpcResult;

/** One of the host's events: who came (with emails), a one-tap friend request to all of them, and, for an upcoming event, a one-tap invite to all their friends. */
export function HostedEventSheet({ event, onClose }: { event: HostedEvent; onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { friends, pendingSent, pendingReceived, sendFriendRequests } = useFriends();
  const [attendees, setAttendees] = useState<Attendee[] | null>(null);
  const [addingAll, setAddingAll] = useState(false);
  const [added, setAdded] = useState(false);
  const [inviting, setInviting] = useState(false);
  const upcoming = event.date.getTime() > Date.now();

  useEffect(() => {
    let cancelled = false;
    rpc("get_event_attendees", { p_activity_id: event.id }).then(({ data }) => {
      if (!cancelled) setAttendees((data as Attendee[] | null) ?? []);
    });
    return () => { cancelled = true; };
  }, [event.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Everyone who isn't already a friend, or already asked either way.
  const addable = useMemo(() => {
    const known = new Set([...friends, ...pendingSent, ...pendingReceived].map((f) => f.user_id));
    return (attendees ?? []).filter((a) => a.user_id !== user?.id && !known.has(a.user_id)).map((a) => a.user_id);
  }, [attendees, friends, pendingSent, pendingReceived, user?.id]);

  const addAll = useCallback(async () => {
    if (addingAll || addable.length === 0) return;
    setAddingAll(true);
    await sendFriendRequests(addable);
    setAddingAll(false);
    setAdded(true);
    toast.success(t("hosting.event.requestsSent", "Friend requests sent to {{count}} people", { count: addable.length }));
  }, [addingAll, addable, sendFriendRequests, t]);

  const inviteFriends = useCallback(async () => {
    if (inviting) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-friends-to-plan", { body: { activity_id: event.id } });
      if (error) throw error;
      const count = (data as { invited?: number } | null)?.invited ?? 0;
      toast.success(
        count > 0
          ? t("hosting.event.invited", "Invited {{count}} friends", { count })
          : t("hosting.event.noOneToInvite", "No new friends to invite")
      );
    } catch {
      toast.error(t("hosting.event.inviteFailed", "Couldn't send the invitations. Try again."));
    } finally {
      setInviting(false);
    }
  }, [inviting, event.id, t]);

  const actionClass = "flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-opacity disabled:opacity-50";

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 animate-in fade-in duration-200" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div
        role="dialog"
        aria-label={event.title}
        className="relative flex w-full max-w-md max-h-[88vh] flex-col rounded-t-[28px] bg-white pt-3 shadow-2xl animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-gray-300" />
        <button type="button" onClick={onClose} aria-label={t("common.close", "Close")} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <X className="h-4 w-4" />
        </button>

        <div className="shrink-0 px-5 pb-3 pr-14">
          <p className="text-2xl leading-none">{event.emoji}</p>
          <h3 className="mt-1 text-lg font-bold text-gray-900">{event.title}</h3>
          <p className="text-sm text-gray-400">{format(event.date, "EEE, MMM d, yyyy · h:mm a")}</p>
          <div className="mt-3 flex gap-6">
            <div>
              <p className="text-2xl font-bold text-gray-900">{event.attendees}</p>
              <p className="text-xs text-gray-400">{t("hosting.event.attendees", "Attendees")}</p>
            </div>
            {event.ticketed && (
              <div>
                <p className="text-2xl font-bold text-gray-900">{event.scanned}</p>
                <p className="text-xs text-gray-400">{t("hosting.event.checkedIn", "Checked in")}</p>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 space-y-2 px-5 pb-3">
          {upcoming && (
            <button type="button" onClick={inviteFriends} disabled={inviting} className={`${actionClass} bg-black text-white`}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t("hosting.event.inviteFriends", "Invite all my friends")}
            </button>
          )}
          <button
            type="button"
            onClick={addAll}
            disabled={addingAll || addable.length === 0 || attendees === null}
            className={`${actionClass} border border-gray-200 text-gray-900`}
          >
            {addingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : added || addable.length === 0 ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {attendees !== null && addable.length === 0
              ? t("hosting.event.allFriends", "You're connected with everyone")
              : t("hosting.event.addAll", "Send friend request to everyone")}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-gray-100 px-5 pt-2">
          {attendees === null ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : attendees.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">{t("hosting.event.noAttendees", "No one has joined yet")}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {attendees.map((a) => (
                <div key={a.user_id} className="flex items-center gap-3 py-2.5">
                  <Avatar className="h-10 w-10 shrink-0">
                    {a.avatar_url ? <AvatarImage src={getDisplayAvatarUrl(a.avatar_url)} alt={a.name ?? ""} className="object-cover" /> : null}
                    <AvatarFallback className="bg-gray-100 text-sm text-gray-500">{(a.name ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{a.name || t("chat.shaker", "Shaker")}</p>
                    {a.email && <a href={`mailto:${a.email}`} className="block truncate text-xs text-gray-400">{a.email}</a>}
                  </div>
                  {a.checked_in_at && <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-label={t("hosting.event.checkedIn", "Checked in")} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
