import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { emitPointsEvent, quietPointsWatcher, syncSeenPoints } from "@/lib/pointsEvents";
import { getDistanceFromLatLng } from "@/data/cities";

const CHECK_EVERY_MS = 60_000;
// Matches the server's limit (check_in_to_plan); the server re-checks, this only avoids pointless calls.
const NEAR_METERS = 150;

type Candidate = { activity_id: string; venue_name: string; venue_lat: number; venue_lng: number };
type RpcResult = Promise<{ data: unknown; error: { message: string } | null }>;

// The two functions come from migration 20261005120000_plan_checkin_points.sql and aren't in the
// generated Supabase types yet, so call through a loosely-typed handle.
const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: object) => RpcResult;

function getPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000,
    });
  });
}

/**
 * +5 points when you're at a plan you joined or host. Mounted once at the app root.
 *
 * It asks the server which of your plans are happening right now and pinned to a place; only if
 * there is one does it read the phone's location (so nobody gets a location prompt for nothing).
 * When you're within range it asks the server to award the points — the server re-checks the
 * time, the place, that you're in the plan and that someone else is too, and pays once per plan.
 */
export function PlanCheckInWatcher() {
  const { user } = useAuth();
  const busy = useRef(false);
  const awarded = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const run = async () => {
      if (busy.current || document.visibilityState !== "visible") return;
      busy.current = true;
      try {
        const { data, error } = await rpc("get_my_checkin_candidates");
        if (error || cancelled) return;
        const candidates = ((data as Candidate[] | null) ?? []).filter((c) => !awarded.current.has(c.activity_id));
        if (candidates.length === 0) return;

        const pos = await getPosition();
        if (!pos || cancelled) return;
        const { latitude, longitude } = pos.coords;

        for (const c of candidates) {
          const meters = getDistanceFromLatLng(latitude, longitude, c.venue_lat, c.venue_lng) * 1000;
          if (meters > NEAR_METERS) continue;
          // We celebrate this ourselves; keep the generic points popup from announcing it too.
          quietPointsWatcher(15_000);
          const res = await rpc("check_in_to_plan", { p_activity_id: c.activity_id, p_lat: latitude, p_lng: longitude });
          const out = res.data as { ok?: boolean; points?: number; reason?: string } | null;
          if (out?.ok) {
            awarded.current.add(c.activity_id);
            const points = out.points ?? 5;
            const message = `You made it to ${c.venue_name}`;
            const total = await syncSeenPoints(user.id);
            emitPointsEvent({ points, message, total: total ?? undefined });
            // Same fire-and-forget self-push the welcome bonus uses, so it also shows if the app is in the background.
            supabase.functions
              .invoke("send-push-notification", {
                body: {
                  to_user_id: user.id,
                  title: `🎉 +${points} points`,
                  body: total !== null ? `${message}. You now have ${total} points.` : `${message}.`,
                },
              })
              .catch((err) => console.error("Error sending check-in push:", err));
          } else if (out?.reason === "already_checked_in") {
            awarded.current.add(c.activity_id);
          }
        }
      } catch (e) {
        console.log("[PlanCheckInWatcher] skipped:", e);
      } finally {
        busy.current = false;
      }
    };

    run();
    const timer = setInterval(run, CHECK_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id]);

  return null;
}
