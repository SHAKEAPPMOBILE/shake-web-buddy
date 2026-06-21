/**
 * PlanSwipeFeed — full-screen vertical snap feed (TikTok/Reels style).
 *
 * Receives the already-loaded plans list from PlansTab and the index of the
 * tapped plan. Renders one card per plan, scroll-snapped vertically.
 *
 * Video performance:
 *   An IntersectionObserver watches each card. When ≥60 % visible → play its
 *   video. When it scrolls out → pause + reset. Only one video ever plays.
 *
 * Ordering (applied here, not in the caller):
 *   1. My-city plans soonest first.
 *   2. Other-city plans soonest first.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { format, isToday, isTomorrow } from "date-fns";
import { ChevronLeft, Volume2, VolumeX } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { parseDbDate } from "@/lib/date-utils";
import { useAuth } from "@/contexts/AuthContext";
import { ReportContentButton } from "@/components/ReportContentButton";
import { UserProfileDialog } from "@/components/UserProfileDialog";

/* ── Types (mirror PlansTab's PlanActivity) ───────────────────────────────── */
export interface FeedPlan {
  id: string;
  user_id: string;
  activity_type: string;
  city: string;
  scheduled_for: string | null;
  note?: string | null;
  promo_video_url?: string | null;
  creator_name?: string;
  creator_avatar?: string;
  participant_count?: number;
  isJoined?: boolean;
  price_amount?: string | null;
}

interface PlanSwipeFeedProps {
  plans: FeedPlan[];
  startIndex: number;
  myCity: string | null;
  /** Called when the feed should close (back button) */
  onClose: () => void;
  /** Called when user taps JOIN on a free plan — joins in-place, stays in feed */
  onJoinInPlace: (plan: FeedPlan) => Promise<{ success: boolean }>;
  /** Called when user taps PAY on a paid plan — exits feed, opens payment flow */
  onPayForPlan: (plan: FeedPlan) => void;
  /** Called when owner taps "Enter chat" or joined user taps "Enter chat" */
  onEnterChat: (plan: FeedPlan) => void;
  /** Called when tapping the creator avatar */
  onViewProfile: (userId: string, name: string | null, avatar: string | null) => void;
}

/* ── Sort helper: my-city first, soonest-scheduled first within each group ── */
function sortFeedPlans(plans: FeedPlan[], myCity: string | null): FeedPlan[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const myNorm = myCity ? norm(myCity) : null;

  const getTime = (p: FeedPlan) =>
    p.scheduled_for ? parseDbDate(p.scheduled_for).getTime() : Infinity;

  return [...plans].sort((a, b) => {
    const aIsMyCity = myNorm ? norm(a.city) === myNorm : false;
    const bIsMyCity = myNorm ? norm(b.city) === myNorm : false;
    if (aIsMyCity !== bIsMyCity) return aIsMyCity ? -1 : 1;
    return getTime(a) - getTime(b);
  });
}

/* ── Single card ──────────────────────────────────────────────────────────── */
interface FeedCardProps {
  plan: FeedPlan;
  isOwn: boolean;
  onJoinInPlace: () => Promise<{ success: boolean }>;
  onPayForPlan: () => void;
  onEnterChat: () => void;
  onViewProfile: () => void;
}

function FeedCard({ plan, isOwn, onJoinInPlace, onPayForPlan, onEnterChat, onViewProfile }: FeedCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [joinedLocally, setJoinedLocally] = useState(false);
  const [joining, setJoining] = useState(false);

  const isPaid = !!(plan.price_amount && parseFloat(plan.price_amount) > 0);
  const isJoined = plan.isJoined || joinedLocally;

  /* IntersectionObserver: play when ≥60 % visible, pause+reset when not */
  useEffect(() => {
    const el = cardRef.current;
    const vid = videoRef.current;
    if (!el || !vid) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.6) {
          // iOS WKWebView: set muted imperatively — JSX prop alone isn't enough
          vid.muted = muted;
          vid.play().catch(() => {});
        } else {
          vid.pause();
          vid.currentTime = 0;
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Keep the DOM muted attribute in sync when user toggles */
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  const handleJoin = async () => {
    if (joining) return;
    setJoining(true);
    try {
      const result = await onJoinInPlace();
      if (result.success) {
        setJoinedLocally(true);
      }
    } finally {
      setJoining(false);
    }
  };

  const dateLabel = (() => {
    if (!plan.scheduled_for) return null;
    const d = parseDbDate(plan.scheduled_for);
    const day = isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : format(d, "EEE, d MMM");
    return `${day} · ${format(d, "h:mm a")}`;
  })();

  /* ── Derive action button props ── */
  const actionButton = (() => {
    if (isOwn) {
      return { label: "Enter chat", handler: onEnterChat, disabled: false };
    }
    if (isJoined) {
      return { label: "Enter chat", handler: onEnterChat, disabled: false };
    }
    if (isPaid) {
      const priceLabel = `PAY $${parseFloat(plan.price_amount!).toFixed(0)}`;
      return { label: priceLabel, handler: onPayForPlan, disabled: false };
    }
    return {
      label: joining ? "Joining…" : "JOIN",
      handler: handleJoin,
      disabled: joining,
    };
  })();

  return (
    <div
      ref={cardRef}
      className="relative w-full flex-shrink-0 bg-black"
      style={{ height: "100dvh", scrollSnapAlign: "start" }}
    >
      {plan.promo_video_url ? (
        /* ── Video card ── */
        <>
          <video
            ref={videoRef}
            src={plan.promo_video_url}
            playsInline
            muted={muted}
            loop
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Gradient scrim */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 45%, transparent 100%)",
            }}
          />

          {/* Mute toggle — top-right */}
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="absolute top-14 right-4 w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white z-10"
            style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </>
      ) : (
        /* ── No-video card: gradient bg with avatar centred ── */
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(88,28,135,0.9) 0%, rgba(67,56,202,0.85) 50%, rgba(88,28,135,0.8) 100%)",
            }}
          />
          {/* Large creator avatar centred */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white/30 shadow-xl flex items-center justify-center bg-white/10">
              {plan.creator_avatar ? (
                <img
                  src={plan.creator_avatar}
                  alt={plan.creator_name || ""}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-5xl font-bold text-white">
                  {plan.creator_name?.charAt(0)?.toUpperCase() || "?"}
                </span>
              )}
            </div>
          </div>
          {/* Gradient scrim for bottom overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%)",
            }}
          />
        </>
      )}

      {/* ── Bottom overlay: avatar + title + meta ──
           paddingBottom = 64px (tab bar) + safe-area-inset-bottom + 16px breathing room
           The video stays full-bleed (100dvh); only the overlay content is inset. */}
      <div
        className="absolute bottom-0 left-0 right-0 px-4 pointer-events-none"
        style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        <div className="flex items-end gap-3 mb-4">
          {/* Creator avatar — tappable */}
          <button
            type="button"
            onClick={onViewProfile}
            className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/50 shadow-lg shrink-0 flex items-center justify-center bg-white/10"
            style={{ pointerEvents: "auto" }}
          >
            {plan.creator_avatar ? (
              <img
                src={plan.creator_avatar}
                alt={plan.creator_name || ""}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-lg font-bold text-white">
                {plan.creator_name?.charAt(0)?.toUpperCase() || "?"}
              </span>
            )}
          </button>

          <div className="flex-1 min-w-0" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
            <p className="font-bold text-white text-base leading-tight truncate">
              {plan.note || plan.activity_type}
            </p>
            <p className="text-white/80 text-sm mt-0.5 truncate">
              {plan.city}{dateLabel ? ` · ${dateLabel}` : ""}
            </p>
          </div>

          {/* Report button */}
          <div style={{ pointerEvents: "auto" }}>
            <ReportContentButton contentId={plan.id} contentType="post" iconOnly />
          </div>
        </div>

        {/* Action button */}
        <div style={{ pointerEvents: "auto" }}>
          <button
            type="button"
            onClick={actionButton.handler}
            disabled={actionButton.disabled}
            className="w-full py-3.5 rounded-full font-semibold text-base text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{
              background: "linear-gradient(to right, rgba(88,28,135,0.9), rgba(67,56,202,0.8))",
            }}
          >
            {actionButton.label}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Feed ──────────────────────────────────────────────────────────────────── */
export function PlanSwipeFeed({
  plans,
  startIndex,
  myCity,
  onClose,
  onJoinInPlace,
  onPayForPlan,
  onEnterChat,
  onViewProfile,
}: PlanSwipeFeedProps) {
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [profileTarget, setProfileTarget] = useState<{
    userId: string;
    userName: string | null;
    avatarUrl: string | null;
  } | null>(null);

  /* Sort once on mount (plans prop is already filtered/loaded by caller) */
  const sorted = useRef<FeedPlan[]>(sortFeedPlans(plans, myCity));

  /* Find where the tapped plan lands in the sorted array */
  const resolvedStart = (() => {
    const tappedId = plans[startIndex]?.id;
    if (!tappedId) return 0;
    const idx = sorted.current.findIndex((p) => p.id === tappedId);
    return idx >= 0 ? idx : 0;
  })();

  /* Scroll to the starting card on mount (instant, no animation) */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || resolvedStart === 0) return;
    // Use requestAnimationFrame so the DOM is fully painted before we scroll
    const id = requestAnimationFrame(() => {
      el.scrollTop = resolvedStart * el.clientHeight;
    });
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewProfile = useCallback(
    (plan: FeedPlan) => {
      setProfileTarget({
        userId: plan.user_id,
        userName: plan.creator_name ?? null,
        avatarUrl: plan.creator_avatar ?? null,
      });
      onViewProfile(plan.user_id, plan.creator_name ?? null, plan.creator_avatar ?? null);
    },
    [onViewProfile]
  );

  return (
    <>
      {/* Full-screen overlay */}
      <div className="fixed inset-0 z-50 bg-black">
        {/* Back arrow — native only */}
        {Capacitor.isNativePlatform() && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-0 left-4 z-20 w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white"
            style={{
              top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Snap scroll container */}
        <div
          ref={scrollRef}
          className="w-full h-full overflow-y-scroll"
          style={{ scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" }}
        >
          {sorted.current.map((plan) => (
            <FeedCard
              key={plan.id}
              plan={plan}
              isOwn={plan.user_id === user?.id}
              onJoinInPlace={() => onJoinInPlace(plan)}
              onPayForPlan={() => onPayForPlan(plan)}
              onEnterChat={() => onEnterChat(plan)}
              onViewProfile={() => handleViewProfile(plan)}
            />
          ))}
        </div>
      </div>

      {/* User profile dialog */}
      {profileTarget && (
        <UserProfileDialog
          open={!!profileTarget}
          onOpenChange={(open) => { if (!open) setProfileTarget(null); }}
          userId={profileTarget.userId}
          userName={profileTarget.userName}
          avatarUrl={profileTarget.avatarUrl}
        />
      )}
    </>
  );
}
