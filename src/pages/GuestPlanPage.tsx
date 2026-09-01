import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ALL_ACTIVITY_TYPES } from "@/data/activityTypes";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { format } from "date-fns";
import { parseDbDate } from "@/lib/date-utils";
import logoShake from "@/assets/shake-logo-new.png";
import { storePendingPlanInvite } from "@/lib/pendingPlanInvite";

interface GuestPlan {
  activity_id: string | null;
  activity_type: string;
  city: string;
  scheduled_for: string | null;
  note: string | null;
  plan_label: string;
  creator_name: string | null;
  creator_avatar: string | null;
  promo_video_url: string | null;
  promo_image_url: string | null;
  description: string | null;
  venue_name: string | null;
  participant_count: number;
  guest_name: string | null;
}

// Standalone page for a non-user who joined a plan via ShareLanding's
// "join without an account" flow. No tab bar, no browsing — just this one
// plan, plus a CTA to sign up for the full app (chat, other plans, etc).
export default function GuestPlanPage() {
  const { token } = useParams<{ token: string }>();
  const [plan, setPlan] = useState<GuestPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }
    supabase.functions
      .invoke("get-guest-join", { body: { token } })
      .then(({ data, error }) => {
        if (error || !data?.success) {
          setNotFound(true);
        } else {
          setPlan(data.plan);
          // So signup lands them right back on this plan — claim-guest-joins
          // (called on the next login/signup) converts this into a real join.
          if (data.plan.activity_id) storePendingPlanInvite(data.plan.activity_id);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setIsLoading(false);
      });
  }, [token]);

  const activityInfo = plan ? ALL_ACTIVITY_TYPES.find((a) => a.id === plan.activity_type) : null;
  const activityEmoji = activityInfo?.emoji ?? "🎉";
  const activityLabel = activityInfo?.label ?? plan?.activity_type ?? "Activity";
  const creatorAvatarUrl = plan?.creator_avatar ? getDisplayAvatarUrl(plan.creator_avatar) : null;
  const dateStr = plan?.scheduled_for ? format(parseDbDate(plan.scheduled_for), "EEE, d MMM · h:mm a") : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: "#0d0d1a" }}>
      <img src={logoShake} alt="SHAKE" className="h-10 mb-10 opacity-90" />

      {isLoading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
          <p className="text-white/50 text-sm">Loading your plan…</p>
        </div>
      ) : notFound || !plan ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-5xl">🐯</span>
          <p className="text-white text-lg font-semibold">Plan not found</p>
          <p className="text-white/50 text-sm">This link may have expired.</p>
          <a href="https://www.shakeapp.today" className="mt-4 px-6 py-3 rounded-full bg-white/10 text-white text-sm font-medium">
            Go to SHAKE
          </a>
        </div>
      ) : (
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          {plan.guest_name && (
            <p className="text-white/50 text-sm">You're in, {plan.guest_name.split(" ")[0]} 🎉</p>
          )}

          {plan.promo_video_url || plan.promo_image_url ? (
            <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden">
              {plan.promo_video_url ? (
                <video src={plan.promo_video_url} autoPlay muted loop playsInline className="w-full h-full object-cover" />
              ) : (
                <img src={plan.promo_image_url!} alt={plan.plan_label} className="w-full h-full object-cover" />
              )}
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
              <span className="text-4xl">{activityEmoji}</span>
            </div>
          )}

          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="text-white text-2xl font-bold">
              {plan.note?.trim() || activityLabel}
            </h1>
            <p className="text-white/60 text-sm">
              {[dateStr, plan.venue_name || plan.city].filter(Boolean).join(" · ")}
            </p>
            {plan.participant_count > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-medium text-white/80" style={{ background: "rgba(255,255,255,0.10)" }}>
                +{plan.participant_count} {plan.participant_count === 1 ? "person" : "people"} joined
              </span>
            )}
          </div>

          {plan.description?.trim() && (
            <p className="text-white/70 text-sm text-center whitespace-pre-wrap">{plan.description}</p>
          )}

          {plan.creator_name && (
            <div
              className="w-full rounded-2xl px-5 py-4 flex items-center gap-3"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">
                {creatorAvatarUrl ? (
                  <img src={creatorAvatarUrl} alt={plan.creator_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg">👤</span>
                )}
              </div>
              <p className="text-white/80 text-sm">
                Hosted by <span className="text-white font-semibold">{plan.creator_name}</span>
              </p>
            </div>
          )}

          <div className="w-full rounded-2xl px-5 py-4 flex flex-col gap-2 text-center" style={{ background: "rgba(255,255,255,0.05)" }}>
            <p className="text-white/70 text-sm">
              Sign up free to chat with the group and see everything else happening on SHAKE.
            </p>
            <a
              href="https://www.shakeapp.today"
              className="w-full py-3 rounded-full font-semibold text-white text-sm text-center mt-1"
              style={{ background: "linear-gradient(to right, #2563EB, #7c3aed)" }}
            >
              Create your free profile
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
