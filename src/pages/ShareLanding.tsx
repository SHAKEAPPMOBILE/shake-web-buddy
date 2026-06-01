import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ALL_ACTIVITY_TYPES } from "@/data/activityTypes";
import { format } from "date-fns";
import logoShake from "@/assets/shake-logo-new.png";

interface ActivityInfo {
  id: string;
  activity_type: string;
  city: string;
  scheduled_for: string | null;
  creator_name: string;
  creator_avatar: string | null;
  participant_count: number;
}

export default function ShareLanding() {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activity, setActivity] = useState<ActivityInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!activityId) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    console.log('[ShareLanding] activityId from URL:', activityId);

    const load = async () => {
      try {
        // Fetch activity with creator profile
        const { data: actData, error: actError } = await supabase
          .from("user_activities")
          .select("id, activity_type, city, scheduled_for, user_id")
          .eq("id", activityId)
          .eq("is_active", true)
          .single();

        console.log('[ShareLanding] query result:', actData, actError);

        if (actError || !actData) {
          setNotFound(true);
          return;
        }

        // Fetch creator profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("name, avatar_url")
          .eq("user_id", actData.user_id)
          .single();

        // Count participants (activity_joins where activity_id matches)
        const { count } = await supabase
          .from("activity_joins")
          .select("id", { count: "exact", head: true })
          .eq("activity_id", activityId);

        // Mark expired only if the activity window (scheduled_for + 24h) has passed.
        // A future activity or one currently in-progress should never be treated as expired.
        if (
          actData.scheduled_for &&
          new Date(actData.scheduled_for).getTime() + 24 * 60 * 60 * 1000 < Date.now()
        ) {
          setIsExpired(true);
          return;
        }

        setActivity({
          id: actData.id,
          activity_type: actData.activity_type,
          city: actData.city,
          scheduled_for: actData.scheduled_for,
          creator_name: profileData?.name ?? "Someone",
          creator_avatar: profileData?.avatar_url ?? null,
          participant_count: count ?? 0,
        });
      } catch (err) {
        console.error("[ShareLanding] load error", err);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [activityId]);

  const handleJoin = async () => {
    if (!activityId) return;

    if (!user) {
      // Save pending join and send to auth
      localStorage.setItem("shake_pending_activity_id", activityId);
      navigate("/auth");
      return;
    }

    setIsJoining(true);
    try {
      const { error } = await supabase.from("activity_joins").insert({
        user_id: user.id,
        activity_id: activityId,
      });

      if (error && !error.message.includes("duplicate")) {
        console.error("[ShareLanding] join error", error);
      }

      navigate("/plans");
    } catch (err) {
      console.error("[ShareLanding] join exception", err);
      navigate("/plans");
    } finally {
      setIsJoining(false);
    }
  };

  const activityInfo = activity
    ? ALL_ACTIVITY_TYPES.find((a) => a.id === activity.activity_type)
    : null;

  const activityEmoji = activityInfo?.emoji ?? "🎉";
  const activityLabel = activityInfo?.label ?? activity?.activity_type ?? "Activity";

  const dateStr = activity?.scheduled_for
    ? format(new Date(activity.scheduled_for), "EEE, d MMM")
    : null;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: "#0d0d1a" }}
    >
      {/* Logo */}
      <img src={logoShake} alt="SHAKE" className="h-10 mb-10 opacity-90" />

      {isLoading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
          <p className="text-white/50 text-sm">Loading activity…</p>
        </div>
      ) : isExpired ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-5xl">⏰</span>
          <p className="text-white text-lg font-semibold">This activity has ended</p>
          <p className="text-white/50 text-sm">The invite window for this activity has passed.</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-6 py-3 rounded-full bg-white/10 text-white text-sm font-medium"
          >
            Find new activities
          </button>
        </div>
      ) : notFound || !activity ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-5xl">🐯</span>
          <p className="text-white text-lg font-semibold">Activity not found</p>
          <p className="text-white/50 text-sm">This invite may have expired.</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-6 py-3 rounded-full bg-white/10 text-white text-sm font-medium"
          >
            Go to SHAKE
          </button>
        </div>
      ) : (
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          {/* Activity card */}
          <div
            className="w-full rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            {/* Emoji + title */}
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-5xl">{activityEmoji}</span>
              <h1 className="text-white text-xl font-bold">{activityLabel}</h1>
              {dateStr && (
                <p className="text-white/60 text-sm">{dateStr} · {activity.city}</p>
              )}
              {!dateStr && (
                <p className="text-white/60 text-sm">{activity.city}</p>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-white/10" />

            {/* Invite info */}
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-white/70 text-sm">
                <span className="text-white font-semibold">{activity.creator_name}</span> invited you
              </p>
              {activity.participant_count > 0 && (
                <p className="text-white/50 text-xs">
                  +{activity.participant_count} {activity.participant_count === 1 ? "person" : "people"} joined
                </p>
              )}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleJoin}
            disabled={isJoining}
            className="w-full py-4 rounded-full font-semibold text-white text-base disabled:opacity-60"
            style={{ background: "linear-gradient(to right, #2563EB, #7c3aed)" }}
          >
            {isJoining ? "Joining…" : "Join this activity"}
          </button>

          <p className="text-white/30 text-xs text-center px-4">
            You'll need to sign in or create a free account to join.
          </p>
        </div>
      )}
    </div>
  );
}
