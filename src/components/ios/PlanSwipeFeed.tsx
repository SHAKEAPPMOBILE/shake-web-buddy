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

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { format, isToday, isTomorrow } from "date-fns";
import { ChevronLeft, DollarSign, Volume2, VolumeX, User } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { parseDbDate } from "@/lib/date-utils";
import { getPriceValue, cn } from "@/lib/utils";
import { getActivityIcon, getActivityEmoji } from "@/data/activityTypes";
import { useAuth } from "@/contexts/AuthContext";
import { ReportContentButton } from "@/components/ReportContentButton";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { ParticipantsListDialog } from "@/components/ParticipantsListDialog";
import { PlanParticipantsDialog } from "@/components/PlanParticipantsDialog";
import type { UserActivity } from "@/hooks/useUserActivities";

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
  is_auto_generated?: boolean | null;
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
  /** When true the feed renders inline (no fixed overlay); back button hidden */
  inline?: boolean;
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
  inline?: boolean;
  onJoinInPlace: () => Promise<{ success: boolean }>;
  onPayForPlan: () => void;
  onEnterChat: () => void;
  onViewProfile: () => void;
  onViewParticipantProfile: (userId: string, userName: string | null, avatarUrl: string | null) => void;
}

function FeedCard({ plan, isOwn, inline, onJoinInPlace, onPayForPlan, onEnterChat, onViewProfile, onViewParticipantProfile }: FeedCardProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [joinedLocally, setJoinedLocally] = useState(false);
  const [joining, setJoining] = useState(false);
  const [lowRes, setLowRes] = useState(false);
  const [smallImage, setSmallImage] = useState(false);
  const [previewAvatars, setPreviewAvatars] = useState<{ avatar_url: string | null }[]>([]);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [joinCount, setJoinCount] = useState<number | null>(null);

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const { videoWidth, videoHeight } = e.currentTarget;
setLowRes(Math.max(videoWidth, videoHeight) < 600);
  }, []);

  const priceValue = getPriceValue(plan.price_amount);
  const isPaid = priceValue > 0;
  const isJoined = plan.isJoined || joinedLocally;

  /* IntersectionObserver: play muted when ≥60 % visible; pause+reset mute when not */
  useEffect(() => {
    const el = cardRef.current;
    const vid = videoRef.current;
    if (!el || !vid) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.6) {
          vid.muted = true;
          setMuted(true);
          vid.play().catch(() => {});
        } else {
          vid.pause();
          vid.currentTime = 0;
          vid.muted = true;
          setMuted(true);
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Sync muted state → video DOM (handles tap-toggle path) */
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  /* Fetch up to 3 participant avatars for the stack preview */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let userIds: string[] = [];
      if (plan.is_auto_generated) {
        // Carousel group: all joiners for this activity_type + city
        const { data: joins, count } = await supabase
          .from("activity_joins")
          .select("user_id", { count: "exact" })
          .eq("activity_type", plan.activity_type)
          .eq("city", plan.city)
          .gt("expires_at", new Date().toISOString())
          .limit(3);
        userIds = joins?.map((j: { user_id: string }) => j.user_id) ?? [];
        if (!cancelled) setJoinCount(count ?? 0);
      } else {
        // User-created plan: joiners for this specific activity_id
        const { data: joins, count } = await supabase
          .from("activity_joins")
          .select("user_id", { count: "exact" })
          .eq("activity_id", plan.id)
          .limit(3);
        userIds = joins?.map((j: { user_id: string }) => j.user_id) ?? [];
        if (!cancelled) setJoinCount(count ?? 0);
      }
      if (cancelled || !userIds.length) return;
      const profiles = await Promise.all(
        userIds.map((uid) =>
          supabase.from("profiles").select("avatar_url").eq("user_id", uid).maybeSingle()
        )
      );
      if (!cancelled) {
        setPreviewAvatars(profiles.map((r) => ({ avatar_url: r.data?.avatar_url ?? null })));
      }
    })();
    return () => { cancelled = true; };
  }, [plan.id, plan.activity_type, plan.city, plan.is_auto_generated]);

  const handleJoin = async () => {
    if (joining) return;
    setJoining(true);
    try {
      const result = await onJoinInPlace();
      if (result.success) {
        setJoinedLocally(true);
        setJoinCount(prev => (prev ?? 0) + 1);
      }
    } finally {
      setJoining(false);
    }
  };

  const dateLabel = (() => {
    if (!plan.scheduled_for) return null;
    const d = parseDbDate(plan.scheduled_for);
    const day = isToday(d) ? t('common.today', 'Today') : isTomorrow(d) ? t('common.tomorrow', 'Tomorrow') : format(d, "EEE, d MMM");
    return `${day} · ${format(d, "h:mm a")}`;
  })();

  /* ── Derive action button props ── */
  const actionButton = (() => {
    if (isOwn) {
      return { label: t('plans.enterChat', 'Enter chat'), handler: onEnterChat, disabled: false };
    }
    if (isJoined) {
      return { label: t('plans.enterChat', 'Enter chat'), handler: onEnterChat, disabled: false };
    }
    if (isPaid) {
      return { label: `Pay $${priceValue.toFixed(0)}`, handler: onPayForPlan, disabled: false };
    }
    return {
      label: joining ? t('plans.joiningBtn', 'Joining…') : t('plans.joinBtn', 'JOIN'),
      handler: handleJoin,
      disabled: joining,
    };
  })();

  return (
    <div
      ref={cardRef}
      className={cn("relative w-full flex-shrink-0", plan.is_auto_generated ? "bg-white" : "bg-black")}
      style={{ height: inline ? "calc(100dvh - 208px - env(safe-area-inset-bottom, 0px))" : "100dvh", scrollSnapAlign: "start", scrollSnapStop: "always" }}
    >
      {plan.promo_video_url ? (
        /* ── Video card ── */
        <>
          {/* Tap to toggle mute — onClick only fires on taps, not swipes */}
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="absolute inset-0 w-full h-full cursor-pointer bg-transparent border-0 p-0"
            style={{ zIndex: 1 }}
            aria-label={muted ? "Unmute video" : "Mute video"}
          >
            <video
              ref={videoRef}
              src={plan.promo_video_url}
              playsInline
              muted
              loop
              onLoadedMetadata={handleLoadedMetadata}
              className={cn("w-full h-full", lowRes ? "object-contain" : "object-cover")}
            />
          </button>

          {/* Gradient scrim */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 45%, transparent 100%)",
              zIndex: 2,
            }}
          />

          {/* Speaker indicator — subtle, top-right */}
          <div
            className="absolute top-14 right-4 w-8 h-8 rounded-full flex items-center justify-center pointer-events-none"
            style={{
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              zIndex: 3,
            }}
          >
            {muted
              ? <VolumeX className="w-3.5 h-3.5 text-white/70" />
              : <Volume2 className="w-3.5 h-3.5 text-white" />
            }
          </div>
        </>
      ) : (
        /* ── No-video card ──
             Fallback chain:
             1. is_auto_generated → activity-type image (never a face)
             2. creator_avatar    → full-bleed creator photo
             3. getActivityIcon   → activity-type image
             4. last resort       → purple gradient + name initial
        ── */
        <>
          {plan.is_auto_generated ? (
            /* Auto-generated plan: carousel-style circle, not full-bleed */
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full bg-card overflow-hidden flex items-center justify-center border-2 border-blue-400 shadow-2xl">
                {getActivityIcon(plan.activity_type) ? (
                  <div
                    className="w-full h-full rounded-full bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${getActivityIcon(plan.activity_type)})` }}
                  />
                ) : (
                  <span className="text-5xl flex items-center justify-center w-full h-full">
                    {getActivityEmoji(plan.activity_type)}
                  </span>
                )}
              </div>
            </div>
          ) : plan.creator_avatar ? (
            /* User-created with avatar: full-bleed, or framed on gradient if small */
            <div className={cn("absolute inset-0 flex items-center justify-center", smallImage && "bg-white")}>
              <img
                src={plan.creator_avatar}
                alt={plan.creator_name || ""}
                onLoad={(e) => {
                  const { naturalWidth, naturalHeight } = e.currentTarget;
                  setSmallImage(Math.max(naturalWidth, naturalHeight) < 600);
                }}
                className={cn(
                  smallImage
                    ? "max-w-[92%] max-h-[92%] object-contain rounded-lg shadow-2xl"
                    : "absolute inset-0 w-full h-full object-cover"
                )}
              />
            </div>
          ) : getActivityIcon(plan.activity_type) ? (
            /* User-created, no avatar: fall back to activity-type image */
            <img
              src={getActivityIcon(plan.activity_type)!}
              alt={plan.activity_type}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            /* Last resort: purple gradient + name initial */
            <>
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(88,28,135,0.9) 0%, rgba(67,56,202,0.85) 50%, rgba(88,28,135,0.8) 100%)",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white/30 shadow-xl flex items-center justify-center bg-white/10">
                  <span className="text-5xl font-bold text-white">
                    {plan.creator_name?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                </div>
              </div>
            </>
          )}
          {/* Gradient scrim for bottom overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%)" }}
          />
        </>
      )}

      {/* ── Right-side action column: avatar stack + CHAT/JOIN button ── */}
      <div
        className="absolute right-4 z-10 flex flex-col items-center gap-4"
        style={{ top: "50%", transform: "translateY(-50%)", pointerEvents: "auto" }}
      >
        {/* Avatar stack — tappable, opens participant list */}
        {previewAvatars.length > 0 && (
          <button
            type="button"
            onClick={() => setParticipantsOpen(true)}
            className="flex flex-col items-center gap-1 transition-opacity hover:opacity-80"
          >
            <div className="flex flex-col items-center -space-y-2">
              {previewAvatars.slice(0, 3).map((a, i) => (
                <Avatar key={i} className="w-8 h-8 border-2 border-white/60 shadow-md">
                  <AvatarImage src={getDisplayAvatarUrl(a.avatar_url)} />
                  <AvatarFallback className="bg-white/20 text-white">
                    <User className="w-3 h-3" />
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            {((joinCount ?? plan.participant_count ?? 0) > 3) && (
              <span
                className="text-white text-[11px] font-semibold mt-1 leading-none"
                style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
              >
                +{(joinCount ?? plan.participant_count ?? 0) - 3}
              </span>
            )}
          </button>
        )}

        {/* CHAT / JOIN button */}
        <button
          type="button"
          onClick={actionButton.handler}
          disabled={actionButton.disabled}
          aria-label={actionButton.label}
          className="flex flex-col items-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-60"
        >
          {/* Circle */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl"
            style={{
              background:
                (isOwn || isJoined)
                  ? "#ffffff"
                  : isPaid
                    ? "linear-gradient(to bottom, #f59e0b, #d97706)"
                    : "#ffffff",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          >
            {(isOwn || isJoined) ? (
              <span className="text-sm font-bold tracking-wide animate-gradient-shift" style={{ backgroundClip: "text", WebkitTextFillColor: "transparent" }}>CHAT</span>
            ) : isPaid ? (
              <DollarSign className="w-6 h-6 text-white" />
            ) : joining ? (
              <div className="w-5 h-5 border-2 border-black/40 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-sm font-bold tracking-wide animate-gradient-shift" style={{ backgroundClip: "text", WebkitTextFillColor: "transparent" }}>JOIN</span>
            )}
          </div>
          {/* Label beneath circle — shown for paid and joining states */}
          {isPaid && !(isOwn || isJoined) && (
            <span
              className="text-white text-[11px] font-semibold leading-none"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
            >
              ${priceValue.toFixed(0)}
            </span>
          )}
          {joining && (
            <span
              className="text-white text-[11px] font-semibold leading-none"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
            >
              Joining…
            </span>
          )}
        </button>
      </div>

      {/* ── Bottom overlay: avatar + title + meta ──
           paddingBottom = 64px (tab bar) + safe-area-inset-bottom + 36px breathing room
           zIndex: 5 — must sit above the video mute-button (z:1), scrim (z:2), speaker (z:3) */}
      <div
        className="absolute bottom-0 left-0 right-0 px-4 pointer-events-none"
        style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 36px)", zIndex: 5 }}
      >
        <div className="flex items-end gap-3">
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
            {plan.creator_name && (
              <p className="text-white/80 text-sm mt-0.5 truncate">
                {plan.creator_name}
              </p>
            )}
            <p className="text-white/80 text-sm mt-0.5 truncate">
              {plan.city}{dateLabel ? ` · ${dateLabel}` : ""}
            </p>
          </div>

          {/* Report button */}
          <div style={{ pointerEvents: "auto" }}>
            <ReportContentButton contentId={plan.id} contentType="post" iconOnly />
          </div>
        </div>

      </div>

      {/* Participants dialog — portal-rendered, not constrained by scroll container */}
      {plan.is_auto_generated ? (
        <ParticipantsListDialog
          open={participantsOpen}
          onOpenChange={setParticipantsOpen}
          activityType={plan.activity_type}
          city={plan.city}
          onViewProfile={onViewParticipantProfile}
        />
      ) : (
        <PlanParticipantsDialog
          open={participantsOpen}
          onOpenChange={setParticipantsOpen}
          activity={{
            id: plan.id,
            user_id: plan.user_id,
            activity_type: plan.activity_type,
            city: plan.city,
            scheduled_for: plan.scheduled_for || '',
            created_at: '',
            updated_at: '',
            is_active: true,
            note: plan.note,
            price_amount: plan.price_amount,
            creator_name: plan.creator_name,
            creator_avatar: plan.creator_avatar,
            participant_count: plan.participant_count,
          } as UserActivity}
          onViewProfile={onViewParticipantProfile}
        />
      )}
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
  inline = false,
}: PlanSwipeFeedProps) {
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [profileTarget, setProfileTarget] = useState<{
    userId: string;
    userName: string | null;
    avatarUrl: string | null;
  } | null>(null);

  /* Re-sort whenever plans or myCity changes so enriched data (e.g. promo_video_url)
     is reflected without remounting the feed. */
  const sorted = useMemo(() => sortFeedPlans(plans, myCity), [plans, myCity]);

  /* Find where the tapped plan lands in the sorted array */
  const resolvedStart = (() => {
    const tappedId = plans[startIndex]?.id;
    if (!tappedId) return 0;
    const idx = sorted.findIndex((p) => p.id === tappedId);
    return idx >= 0 ? idx : 0;
  })();

  /* Scroll to the starting card on mount (instant, no animation), then apply a
     touch-scroll "wake up" nudge — the same WKWebView fix used elsewhere in the
     app (useScrollNudge). Jumping scrollTop via JS on a freshly-mounted overflow
     container can leave WKWebView's momentum-scroll engine in a state where the
     card renders in the right place but subsequent touch/swipe gestures don't
     register until the OS "catches up" on its own — which is exactly why opening
     the feed on any card other than the first (e.g. a plan sorted to the bottom
     of the list) used to make the feed feel stuck on that single card. A
     synchronous 1px scroll-and-back right after the jump forces it to recognize
     scrollability immediately, regardless of where we start. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Use requestAnimationFrame so the DOM is fully painted before we scroll
    const id = requestAnimationFrame(() => {
      if (resolvedStart !== 0) {
        el.scrollTop = resolvedStart * el.clientHeight;
      }
      const prev = el.scrollTop;
      el.scrollTop = prev + 1;
      el.scrollTop = prev;
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
      {/* Full-screen overlay (or inline fill when inline=true) */}
      <div className={inline ? "relative w-full h-full bg-black" : "fixed inset-0 z-50 bg-black"}>
        {/* Back arrow — native full-screen mode only */}
        {!inline && Capacitor.isNativePlatform() && (
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
          style={{ scrollSnapType: "y mandatory" }}
        >
          {sorted.map((plan) => (
            <FeedCard
              key={plan.id}
              plan={plan}
              isOwn={plan.user_id === user?.id}
              inline={inline}
              onJoinInPlace={() => onJoinInPlace(plan)}
              onPayForPlan={() => onPayForPlan(plan)}
              onEnterChat={() => onEnterChat(plan)}
              onViewProfile={() => handleViewProfile(plan)}
              onViewParticipantProfile={(userId, userName, avatarUrl) => {
                setProfileTarget({ userId, userName, avatarUrl });
                onViewProfile(userId, userName, avatarUrl);
              }}
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
