import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ALL_ACTIVITY_TYPES } from "@/data/activityTypes";
import { getDisplayAvatarUrl } from "@/lib/avatar";
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
  console.log('[ShareLanding] mounting, activityId:', activityId, 'url:', window.location.href);
  const [activity, setActivity] = useState<ActivityInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!activityId) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    const load = async () => {
      // Phase 1: fetch the core activity row — this determines what we show.
      const { data: actData, error: actError } = await supabase
        .from("user_activities")
        .select("id, activity_type, city, scheduled_for, user_id")
        .eq("id", activityId)
        .eq("is_active", true)
        .maybeSingle();

      if (actError || !actData) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      // Only show as expired once the 24-hour join window has closed.
      if (
        actData.scheduled_for &&
        new Date(actData.scheduled_for).getTime() + 24 * 60 * 60 * 1000 < Date.now()
      ) {
        setIsExpired(true);
        setIsLoading(false);
        return;
      }

      // Phase 2: render the card immediately with what we have.
      setActivity({
        id: actData.id,
        activity_type: actData.activity_type,
        city: actData.city,
        scheduled_for: actData.scheduled_for,
        creator_name: "Someone",
        creator_avatar: null,
        participant_count: 0,
      });
      setIsLoading(false);

      // Update OG meta tags so WhatsApp/social previews show activity-specific info.
      const actInfo = ALL_ACTIVITY_TYPES.find((a) => a.id === actData.activity_type);
      const label = actInfo?.label ?? actData.activity_type;
      const emoji = actInfo?.emoji ?? "🎉";
      const ogImageMap: Record<string, string> = {
        dinner: "https://app.shakeapp.today/icons/activities/dinner-icon.jpg",
        drinks: "https://app.shakeapp.today/icons/activities/drinks-icon.jpg",
        brunch: "https://app.shakeapp.today/icons/activities/brunch-icon.jpg",
        lunch: "https://app.shakeapp.today/icons/activities/lunch-icon.jpg",
        hike: "https://app.shakeapp.today/icons/activities/hike-icon.jpg",
        sports: "https://app.shakeapp.today/icons/activities/sports-icon.jpg",
      };
      const ogImage = ogImageMap[actData.activity_type] ?? "https://app.shakeapp.today/shake-logo.png";
      const ogTitle = `${emoji} Join ${label} in ${actData.city}!`;
      const ogDesc = `Someone's organising ${label} in ${actData.city}. Join them on SHAKE!`;
      document.querySelector('meta[property="og:image"]')?.setAttribute("content", ogImage);
      document.querySelector('meta[property="og:title"]')?.setAttribute("content", ogTitle);
      document.querySelector('meta[property="og:description"]')?.setAttribute("content", ogDesc);
      document.querySelector('meta[name="twitter:image"]')?.setAttribute("content", ogImage);
      document.title = ogTitle;

      // Phase 3: enrich with profile + participant count (best-effort — failures don't block UI).
      const [profileResult, countResult] = await Promise.allSettled([
        supabase
          .from("profiles")
          .select("name, avatar_url")
          .eq("user_id", actData.user_id)
          .maybeSingle(),
        supabase
          .from("activity_joins")
          .select("id", { count: "exact", head: true })
          .eq("activity_id", activityId),
      ]);

      const profileData =
        profileResult.status === "fulfilled" ? profileResult.value.data : null;
      const count =
        countResult.status === "fulfilled" ? countResult.value.count : 0;

      const finalCount = count ?? 0;
      setActivity((prev) =>
        prev
          ? {
              ...prev,
              creator_name: profileData?.name ?? prev.creator_name,
              creator_avatar: profileData?.avatar_url ?? prev.creator_avatar,
              participant_count: finalCount,
            }
          : null
      );

      // Enrich OG description with real participant count.
      if (finalCount > 0) {
        const actInfo2 = ALL_ACTIVITY_TYPES.find((a) => a.id === actData.activity_type);
        const label2 = actInfo2?.label ?? actData.activity_type;
        const updatedDesc = `${finalCount} ${finalCount === 1 ? "person" : "people"} already joined ${label2} in ${actData.city}. Join them on SHAKE!`;
        document.querySelector('meta[property="og:description"]')?.setAttribute("content", updatedDesc);
      }
    };

    load().catch(() => {
      setNotFound(true);
      setIsLoading(false);
    });
  }, [activityId]);

  const activityInfo = activity
    ? ALL_ACTIVITY_TYPES.find((a) => a.id === activity.activity_type)
    : null;

  const activityIcon = activityInfo?.icon ?? null;
  const activityEmoji = activityInfo?.emoji ?? "🎉";
  const activityLabel =
    activityInfo?.label ?? activity?.activity_type ?? "Activity";

  const dateStr = activity?.scheduled_for
    ? format(new Date(activity.scheduled_for), "EEE, d MMM")
    : null;

  const creatorAvatarUrl = activity?.creator_avatar
    ? getDisplayAvatarUrl(activity.creator_avatar)
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
          <p className="text-white/50 text-sm">
            The invite window for this activity has passed.
          </p>
          <a
            href="https://app.shakeapp.today"
            className="mt-4 px-6 py-3 rounded-full bg-white/10 text-white text-sm font-medium"
          >
            Find new activities on SHAKE
          </a>
        </div>
      ) : notFound || !activity ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-5xl">🐯</span>
          <p className="text-white text-lg font-semibold">Activity not found</p>
          <p className="text-white/50 text-sm">This invite may have expired.</p>
          <a
            href="https://app.shakeapp.today"
            className="mt-4 px-6 py-3 rounded-full bg-white/10 text-white text-sm font-medium"
          >
            Go to SHAKE
          </a>
        </div>
      ) : (
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          {/* Activity icon + name */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
              {activityIcon ? (
                <img
                  src={activityIcon}
                  alt={activityLabel}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl">{activityEmoji}</span>
              )}
            </div>
            <h1 className="text-white text-2xl font-bold">{activityLabel}</h1>
            <p className="text-white/60 text-sm">
              {dateStr ? `${dateStr} · ${activity.city}` : activity.city}
            </p>
            {activity.participant_count > 0 && (
              <span
                className="px-3 py-1 rounded-full text-xs font-medium text-white/80"
                style={{ background: "rgba(255,255,255,0.10)" }}
              >
                +{activity.participant_count}{" "}
                {activity.participant_count === 1 ? "person" : "people"} joined
              </span>
            )}
          </div>

          {/* Inviter info card */}
          <div
            className="w-full rounded-2xl px-5 py-4 flex items-center gap-3"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">
              {creatorAvatarUrl ? (
                <img
                  src={creatorAvatarUrl}
                  alt={activity.creator_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-lg">👤</span>
              )}
            </div>
            <p className="text-white/80 text-sm">
              <span className="text-white font-semibold">
                {activity.creator_name}
              </span>{" "}
              invited you
            </p>
          </div>

          {/* CTA — plain link to the app, works in any browser / WhatsApp */}
          <a
            href="https://app.shakeapp.today"
            className="w-full py-4 rounded-full font-semibold text-white text-base text-center"
            style={{
              background: "linear-gradient(to right, #2563EB, #7c3aed)",
            }}
          >
            Join on SHAKE 🤝
          </a>

          <p className="text-white/30 text-xs text-center px-4">
            Free to download · Sign up in seconds
          </p>
        </div>
      )}
    </div>
  );
}
