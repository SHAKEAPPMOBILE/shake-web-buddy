import { supabase } from "@/integrations/supabase/client";

export type PointsEvent = { points: number; message?: string; total?: number };

// One popup for every way of earning points. Whoever awards points emits an event here; a single
// host component (PointsPopupHost) shows it, so two sources can never stack two popups.
const listeners = new Set<(e: PointsEvent) => void>();
export const emitPointsEvent = (e: PointsEvent) => listeners.forEach((l) => l(e));
export const subscribePointsEvents = (l: (e: PointsEvent) => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

// The last total the person has been shown, so PointsChangeWatcher can tell a *new* gain from
// the same points it has already celebrated. Per user, in this device's storage.
const seenKey = (uid: string) => `shake_points_seen_${uid}`;
export function getSeenPoints(uid: string): number | null {
  try {
    const v = localStorage.getItem(seenKey(uid));
    return v === null ? null : Number(v);
  } catch { return null; }
}
export function setSeenPoints(uid: string, n: number) {
  try { localStorage.setItem(seenKey(uid), String(n)); } catch { /* storage unavailable */ }
}

// While something that celebrates by itself (check-in, welcome bonus) is mid-award, the generic
// watcher stays quiet so the same points aren't announced twice.
let quietUntil = 0;
export const quietPointsWatcher = (ms: number) => { quietUntil = Date.now() + ms; };
export const pointsWatcherIsQuiet = () => Date.now() < quietUntil;

export async function fetchTotalPoints(uid: string): Promise<number | null> {
  const { data, error } = await supabase.rpc("get_user_points", { target_user_id: uid });
  return error || typeof data !== "number" ? null : data;
}

/** Record the current total as already shown (call right after celebrating points yourself). */
export async function syncSeenPoints(uid: string): Promise<number | null> {
  const total = await fetchTotalPoints(uid);
  if (total !== null) setSeenPoints(uid, total);
  return total;
}
