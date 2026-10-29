import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseDbDate } from "@/lib/date-utils";
import { getActivityEmoji, getActivityLabel } from "@/data/activityTypes";
import { getPlanEmojis } from "@/lib/activityDetection";
import { useEmojiSearchVersion } from "@/hooks/useEmojiSearchVersion";

// Plans the person actually made: not the standing Dinner/Brunch slots, not 24-hour quick posts.
const hostedPlans = () =>
  supabase
    .from("user_activities")
    .select("id, activity_type, note, scheduled_for, requires_ticket")
    .not("is_auto_generated", "is", true)
    .not("is_quick_post", "is", true);

/** How many plans this person has hosted — the Hosting row in the profile menu appears with the first one. */
export function useHostedCount(userId: string | undefined): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("user_activities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("is_auto_generated", "is", true)
      .not("is_quick_post", "is", true)
      .then(({ count: c }) => { if (!cancelled) setCount(c ?? 0); });
    return () => { cancelled = true; };
  }, [userId]);
  return count;
}

interface HostedEvent {
  id: string;
  title: string;
  emoji: string;
  date: Date;
  attendees: number;
  scanned: number;
  ticketed: boolean;
}

export function HostingStats({ userId }: { userId: string | undefined }) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<HostedEvent[] | null>(null);
  useEmojiSearchVersion();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data: plans } = await hostedPlans().eq("user_id", userId).order("scheduled_for", { ascending: false });
      const rows = (plans ?? []) as { id: string; activity_type: string; note: string | null; scheduled_for: string; requires_ticket: boolean | null }[];
      const ids = rows.map((r) => r.id);
      // plan_attendance / plan_tickets aren't in the generated Supabase types yet.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const [attendance, tickets] = ids.length
        ? await Promise.all([
            db.from("plan_attendance").select("activity_id, attendees").in("activity_id", ids),
            db.from("plan_tickets").select("activity_id").in("activity_id", ids).not("checked_in_at", "is", null),
          ])
        : [{ data: [] }, { data: [] }];
      const attendeesBy = new Map<string, number>((attendance.data ?? []).map((a: { activity_id: string; attendees: number }) => [a.activity_id, a.attendees]));
      const scannedBy = new Map<string, number>();
      (tickets.data ?? []).forEach((r: { activity_id: string }) => scannedBy.set(r.activity_id, (scannedBy.get(r.activity_id) ?? 0) + 1));
      if (cancelled) return;
      setEvents(rows.map((r) => ({
        id: r.id,
        title: r.note?.trim() || getActivityLabel(r.activity_type),
        emoji: getPlanEmojis(r.activity_type, r.note)[0] ?? getActivityEmoji(r.activity_type),
        date: parseDbDate(r.scheduled_for),
        attendees: attendeesBy.get(r.id) ?? 0,
        scanned: scannedBy.get(r.id) ?? 0,
        ticketed: Boolean(r.requires_ticket),
      })));
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const { ranking, past, totalAttendees } = useMemo(() => {
    const list = events ?? [];
    const now = Date.now();
    return {
      ranking: [...list].sort((a, b) => b.attendees - a.attendees || b.date.getTime() - a.date.getTime()).slice(0, 5),
      past: list.filter((e) => e.date.getTime() < now).slice(0, 20),
      totalAttendees: list.reduce((sum, e) => sum + e.attendees, 0),
    };
  }, [events]);

  if (!events) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const row = (e: HostedEvent, lead: React.ReactNode) => (
    <div key={e.id} className="flex items-center gap-3 py-2">
      {lead}
      <span className="text-xl leading-none">{e.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
        <p className="text-xs text-gray-400">{format(e.date, "MMM d, yyyy")}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-gray-900">{e.attendees}</p>
        {e.ticketed && e.attendees > 0 && (
          <p className="text-[10px] text-gray-400">{t("hosting.scanned", "{{count}} scanned", { count: e.scanned })}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-3xl font-bold text-gray-900">{events.length}</p>
          <p className="text-xs text-gray-400">{t("hosting.eventsHosted", "Events hosted")}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-3xl font-bold text-gray-900">{totalAttendees}</p>
          <p className="text-xs text-gray-400">{t("hosting.totalAttendees", "Total attendees")}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-sm font-semibold text-gray-900 mb-1">{t("hosting.ranking", "Your top events")}</p>
        <div className="divide-y divide-gray-100">
          {ranking.map((e, i) =>
            row(e, <span className="w-5 text-center text-sm font-bold text-gray-400">{i + 1}</span>)
          )}
        </div>
      </div>

      {past.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-900 mb-1">{t("hosting.pastEvents", "Past events")}</p>
          <div className="divide-y divide-gray-100">{past.map((e) => row(e, null))}</div>
        </div>
      )}
    </div>
  );
}
