import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PointsCelebration } from "@/components/PointsCelebration";
import {
  fetchTotalPoints, getSeenPoints, setSeenPoints, subscribePointsEvents,
  pointsWatcherIsQuiet, emitPointsEvent, type PointsEvent,
} from "@/lib/pointsEvents";

const SHOW_MS = 3500;
const CHECK_EVERY_MS = 60_000;

/**
 * Mounted once at the app root. Shows the "+N points" popup for any points event, and also
 * notices points that arrive without the app doing anything (a host's plan reaching 5 people, a
 * referral): it compares the server total with the last total shown and celebrates the difference.
 */
export function PointsPopupHost() {
  const { user } = useAuth();
  const [event, setEvent] = useState<PointsEvent | null>(null);

  useEffect(() => subscribePointsEvents(setEvent), []);

  useEffect(() => {
    if (!event) return;
    const id = setTimeout(() => setEvent(null), SHOW_MS);
    return () => clearTimeout(id);
  }, [event]);

  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    let busy = false;

    const run = async () => {
      if (busy || pointsWatcherIsQuiet() || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const total = await fetchTotalPoints(uid);
        if (total === null || pointsWatcherIsQuiet()) return;
        const seen = getSeenPoints(uid);
        if (seen !== null && total > seen) emitPointsEvent({ points: total - seen, total });
        if (seen === null || total !== seen) setSeenPoints(uid, total);
      } finally {
        busy = false;
      }
    };

    run();
    const timer = setInterval(run, CHECK_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id]);

  if (!event) return null;
  return <PointsCelebration points={event.points} message={event.message} total={event.total} />;
}
