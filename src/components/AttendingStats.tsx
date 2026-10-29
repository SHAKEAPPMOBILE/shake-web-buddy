import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseDbDate } from "@/lib/date-utils";
import { getActivityEmoji, getActivityLabel } from "@/data/activityTypes";
import { getPlanEmojis } from "@/lib/activityDetection";
import { useEmojiSearchVersion } from "@/hooks/useEmojiSearchVersion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { UserProfileDialog } from "@/components/UserProfileDialog";

type RpcResult = Promise<{ data: unknown; error: { message: string } | null }>;
// my_attended_events / get_attended_event_people come from migration 20261030120000_attended_events.sql, not in the generated types yet.
const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: object) => RpcResult;

interface AttendedRow {
  activity_id: string;
  activity_type: string;
  note: string | null;
  city: string | null;
  scheduled_for: string;
  host_id: string;
  host_name: string | null;
  host_avatar: string | null;
  attendees: number;
}

interface AttendedEvent {
  id: string;
  title: string;
  emoji: string;
  date: Date;
  city: string | null;
  hostName: string | null;
  attendees: number;
}

interface Person {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  is_host: boolean;
}

function useAttendedEvents(userId: string | undefined): AttendedEvent[] | null {
  const [events, setEvents] = useState<AttendedEvent[] | null>(null);
  useEmojiSearchVersion();
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    rpc("my_attended_events").then(({ data }) => {
      if (cancelled) return;
      setEvents(((data as AttendedRow[] | null) ?? []).map((r) => ({
        id: r.activity_id,
        title: r.note?.trim() || getActivityLabel(r.activity_type),
        emoji: getPlanEmojis(r.activity_type, r.note)[0] ?? getActivityEmoji(r.activity_type),
        date: parseDbDate(r.scheduled_for),
        city: r.city,
        hostName: r.host_name,
        attendees: r.attendees,
      })));
    });
    return () => { cancelled = true; };
  }, [userId]);
  return events;
}

/** How many events this person has attended — the Attending row in the profile menu appears with the first. */
export function useAttendedCount(userId: string | undefined): number | null {
  const events = useAttendedEvents(userId);
  return events === null ? null : events.length;
}

export function AttendingStats({ userId }: { userId: string | undefined }) {
  const { t } = useTranslation();
  const events = useAttendedEvents(userId);
  const [open, setOpen] = useState<AttendedEvent | null>(null);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const list = events ?? [];
    return {
      upcoming: list.filter((e) => e.date.getTime() >= now).reverse(),
      past: list.filter((e) => e.date.getTime() < now),
    };
  }, [events]);

  if (!events) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const row = (e: AttendedEvent) => (
    <button key={e.id} type="button" onClick={() => setOpen(e)} className="flex w-full items-center gap-3 py-2 text-left active:opacity-60">
      <span className="text-xl leading-none">{e.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
        <p className="text-xs text-gray-400 truncate">
          {format(e.date, "MMM d, yyyy")}{e.hostName ? ` · ${t("attending.hostedBy", "Hosted by {{name}}", { name: e.hostName })}` : ""}
        </p>
      </div>
      <p className="text-sm font-semibold text-gray-900 shrink-0">{e.attendees + 1}</p>
    </button>
  );

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-900 mb-1">{t("hosting.upcomingEvents", "Upcoming events")}</p>
          <div className="divide-y divide-gray-100">{upcoming.map(row)}</div>
        </div>
      )}
      {past.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-900 mb-1">{t("hosting.pastEvents", "Past events")}</p>
          <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto">{past.map(row)}</div>
        </div>
      )}
      {open && <AttendedEventSheet event={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** An event the person attended: who hosted and who else was there. Names and photos only — never emails. */
function AttendedEventSheet({ event, onClose }: { event: AttendedEvent; onClose: () => void }) {
  const { t } = useTranslation();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [profileFor, setProfileFor] = useState<Person | null>(null);

  useEffect(() => {
    let cancelled = false;
    rpc("get_attended_event_people", { p_activity_id: event.id }).then(({ data }) => {
      if (!cancelled) setPeople((data as Person[] | null) ?? []);
    });
    return () => { cancelled = true; };
  }, [event.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {createPortal(
        <div className={`fixed inset-0 z-[80] flex items-end justify-center bg-black/50 animate-in fade-in duration-200 ${profileFor ? "invisible" : ""}`} onClick={(e) => { e.stopPropagation(); onClose(); }}>
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
              <p className="text-sm text-gray-400">{format(event.date, "EEE, MMM d, yyyy · h:mm a")}{event.city ? ` · ${event.city}` : ""}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto border-t border-gray-100 px-5 pt-2">
              {people === null ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {people.map((p) => (
                    <button key={p.user_id} type="button" onClick={() => setProfileFor(p)} className="flex w-full items-center gap-3 py-2.5 text-left active:opacity-60">
                      <Avatar className="h-10 w-10 shrink-0">
                        {p.avatar_url ? <AvatarImage src={getDisplayAvatarUrl(p.avatar_url)} alt={p.name ?? ""} className="object-cover" /> : null}
                        <AvatarFallback className="bg-gray-100 text-sm text-gray-500">{(p.name ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-900">{p.name || t("chat.shaker", "Shaker")}</span>
                      {p.is_host && <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">{t("attending.host", "Host")}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
      {profileFor && (
        <UserProfileDialog
          open
          onOpenChange={(next) => { if (!next) setProfileFor(null); }}
          userId={profileFor.user_id}
          userName={profileFor.name}
          avatarUrl={profileFor.avatar_url}
        />
      )}
    </>
  );
}
