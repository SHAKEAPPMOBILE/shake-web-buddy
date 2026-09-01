import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ALL_ACTIVITY_TYPES, getNextOccurrenceDate } from "@/data/activityTypes";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { format } from "date-fns";
import { parseDbDate } from "@/lib/date-utils";
import logoShake from "@/assets/shake-logo-new.png";
import { storePendingPlanInvite } from "@/lib/pendingPlanInvite";

interface ActivityInfo {
  id: string;
  activity_type: string;
  city: string;
  scheduled_for: string | null;
  creator_name: string;
  creator_avatar: string | null;
  participant_count: number;
  note: string | null;
  price_amount: string | null;
}

export default function ShareLanding() {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<ActivityInfo | null>(null);
  const [isRealPlan, setIsRealPlan] = useState(false);
  const [isGuestEligible, setIsGuestEligible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestError, setGuestError] = useState<string | null>(null);
  const [guestSubmitting, setGuestSubmitting] = useState(false);

  useEffect(() => {
    if (!activityId) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    const load = async () => {
      // Phase 1: fetch the core activity row — this determines what we show.
      // activityId is either a UUID (real plan) or "activitytype-city" (carousel plan).
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const decoded = decodeURIComponent(activityId);
      const isUuid = UUID_RE.test(decoded);

      let actData: { id: string | null; activity_type: string; city: string; scheduled_for: string | null; user_id: string | null; note: string | null; price_amount: string | null; audience?: string | null } | null = null;

      if (isUuid) {
        const { data, error } = await supabase
          .from("user_activities")
          .select("id, activity_type, city, scheduled_for, user_id, note, price_amount, audience")
          .eq("id", decoded)
          .eq("is_active", true)
          .maybeSingle();
        if (error || !data) { setNotFound(true); setIsLoading(false); return; }
        actData = data;
        setIsRealPlan(true);
        setIsGuestEligible(!data.price_amount && (!data.audience || data.audience === "everyone"));
        // Remember which plan this link pointed at so that once the visitor
        // signs up or logs in, the app can land them right on it — same
        // localStorage-then-redeem-post-auth pattern as referral codes.
        if (data.id) storePendingPlanInvite(data.id);
      } else {
        // carousel plan: "acttype-city-useruuid" format, no DB row needed
        const parts = decoded.split("-");
        const actType = parts[0];
        // last 5 parts are the user UUID (8-4-4-4-12), city is everything in between
        const userIdParts = parts.slice(-5);
        const userId = userIdParts.join("-");
        const city = parts.slice(1, -5).join("-");
        actData = {
          id: null,
          activity_type: actType,
          city: city,
          scheduled_for: getNextOccurrenceDate(actType).toISOString(),
          user_id: userId || null,
          note: null,
          price_amount: null,
        };
        setIsRealPlan(false);
        setIsGuestEligible(true);
      }

      // Phase 2: render the card immediately with what we have.
      setActivity({
        id: actData.id ?? decoded,
        activity_type: actData.activity_type,
        city: actData.city,
        scheduled_for: actData.scheduled_for,
        creator_name: "Someone",
        creator_avatar: null,
        participant_count: 0,
        note: actData.note ?? null,
        price_amount: actData.price_amount ?? null,
      });
      setIsLoading(false);

      // Update OG meta tags so WhatsApp/social previews show activity-specific info.
      if (actData.note) {
        // User-created plan: use a generic title so we don't expose category labels.
        const ogTitle = `Join a plan in ${actData.city} on SHAKE!`;
        const ogDesc = `"${actData.note}" — open SHAKE to see the details and join.`;
        const ogImage = "https://www.shakeapp.today/shake-logo.png";
        document.querySelector('meta[property="og:title"]')?.setAttribute("content", ogTitle);
        document.querySelector('meta[property="og:description"]')?.setAttribute("content", ogDesc);
        document.querySelector('meta[property="og:image"]')?.setAttribute("content", ogImage);
        document.querySelector('meta[name="twitter:image"]')?.setAttribute("content", ogImage);
        document.title = ogTitle;
      } else {
        // Carousel / category activity: use the specific activity label + icon.
        const actInfo = ALL_ACTIVITY_TYPES.find((a) => a.id === actData.activity_type);
        const label = actInfo?.label ?? actData.activity_type;
        const emoji = actInfo?.emoji ?? "🎉";
        const ogImageMap: Record<string, string> = {
          dinner: "https://www.shakeapp.today/icons/activities/dinner-icon.jpg",
          drinks: "https://www.shakeapp.today/icons/activities/drinks-icon.jpg",
          brunch: "https://www.shakeapp.today/icons/activities/brunch-icon.jpg",
          lunch: "https://www.shakeapp.today/icons/activities/lunch-icon.jpg",
          hike: "https://www.shakeapp.today/icons/activities/hike-icon.jpg",
          sports: "https://www.shakeapp.today/icons/activities/sports-icon.jpg",
        };
        const ogImage = ogImageMap[actData.activity_type] ?? "https://www.shakeapp.today/shake-logo.png";
        const ogTitle = `${emoji} Join ${label} in ${actData.city}!`;
        const ogDesc = `Someone's organising ${label} in ${actData.city}. Join them on SHAKE!`;
        document.querySelector('meta[property="og:image"]')?.setAttribute("content", ogImage);
        document.querySelector('meta[property="og:title"]')?.setAttribute("content", ogTitle);
        document.querySelector('meta[property="og:description"]')?.setAttribute("content", ogDesc);
        document.querySelector('meta[name="twitter:image"]')?.setAttribute("content", ogImage);
        document.title = ogTitle;
      }

      // Phase 3: enrich with profile + participant count (best-effort — failures don't block UI).
      const enrichPromises: Promise<any>[] = [
        actData.user_id
          ? supabase.from("profiles").select("name, avatar_url").eq("user_id", actData.user_id).maybeSingle()
          : Promise.resolve({ data: null }),
        actData.id
          ? supabase.from("activity_joins").select("id", { count: "exact", head: true }).eq("activity_id", actData.id)
          : Promise.resolve({ count: 0 }),
      ];
      const [profileResult, countResult] = await Promise.allSettled(enrichPromises);

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

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const handleGuestJoin = async () => {
    if (!activity) return;
    const email = guestEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setGuestError("That doesn't look like a valid email.");
      return;
    }
    setGuestError(null);
    setGuestSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("guest-join-plan", {
        body: isRealPlan
          ? { activity_id: activity.id, email, name: guestName.trim() || undefined }
          : {
              activity_type: activity.activity_type,
              city: activity.city,
              scheduled_for: activity.scheduled_for,
              email,
              name: guestName.trim() || undefined,
            },
      });
      if (error || !data?.success) {
        setGuestError(data?.error || "Couldn't join that plan — try again.");
        return;
      }
      navigate(`/guest/${data.token}`);
    } catch {
      setGuestError("Couldn't join that plan — try again.");
    } finally {
      setGuestSubmitting(false);
    }
  };

  const activityInfo = activity
    ? ALL_ACTIVITY_TYPES.find((a) => a.id === activity.activity_type)
    : null;

  const activityIcon = activityInfo?.icon ?? null;
  const activityEmoji = activityInfo?.emoji ?? "🎉";
  const activityLabel =
    activityInfo?.label ?? activity?.activity_type ?? "Activity";

  const dateStr = activity?.scheduled_for
    ? format(parseDbDate(activity.scheduled_for), "EEE, d MMM")
    : null;

  // For user-created plans: show date + time together.
  const planDateStr = activity?.scheduled_for
    ? format(parseDbDate(activity.scheduled_for), "EEE, d MMM · h:mm a")
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
      ) : notFound || !activity ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-5xl">🐯</span>
          <p className="text-white text-lg font-semibold">Activity not found</p>
          <p className="text-white/50 text-sm">This invite may have expired.</p>
          <a
            href="https://www.shakeapp.today"
            className="mt-4 px-6 py-3 rounded-full bg-white/10 text-white text-sm font-medium"
          >
            Go to SHAKE
          </a>
        </div>
      ) : (
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          {activity.note ? (
            /* ── User-created plan ── */
            <>
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="text-5xl">😎</span>
                <h1 className="text-white text-2xl font-bold">"{activity.note}"</h1>
                <p className="text-white/60 text-sm">
                  {[planDateStr, activity.city, activity.price_amount ?? "Free 🎉"]
                    .filter(Boolean)
                    .join(" · ")}
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
                  invited you for{" "}
                  <span className="text-white font-semibold">{activity.note?.trim() || activityLabel}</span>
                </p>
              </div>
            </>
          ) : (
            /* ── Carousel / category activity (existing layout) ── */
            <>
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
            </>
          )}

          {/* CTA — plain link to the app, works in any browser / WhatsApp */}
          <a
            href="https://www.shakeapp.today"
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

          {/* Guest join — only for free, everyone-audience plans. No account
              needed, capped at 2 plans per email (enforced server-side). */}
          {isGuestEligible && !showGuestForm && (
            <button
              type="button"
              onClick={() => setShowGuestForm(true)}
              className="text-white/50 text-sm underline underline-offset-2"
            >
              Just want to join this one? Do it without an account
            </button>
          )}

          {isGuestEligible && showGuestForm && (
            <div
              className="w-full rounded-2xl px-5 py-4 flex flex-col gap-3"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}
            >
              <p className="text-white/70 text-xs">
                No account needed — you just won't be able to chat with the group. You can join up to 2 plans this way.
              </p>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full h-11 rounded-xl bg-white/10 border border-white/10 px-4 text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => { setGuestEmail(e.target.value); setGuestError(null); }}
                placeholder="you@email.com"
                className="w-full h-11 rounded-xl bg-white/10 border border-white/10 px-4 text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
              {guestError && <p className="text-red-300 text-xs">{guestError}</p>}
              <button
                type="button"
                onClick={handleGuestJoin}
                disabled={guestSubmitting || !guestEmail.trim()}
                className="w-full py-3 rounded-full font-semibold text-white text-sm text-center bg-white/15 disabled:opacity-50"
              >
                {guestSubmitting ? "Joining…" : "Join without an account"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
