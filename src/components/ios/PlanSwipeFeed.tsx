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
import { ChevronLeft, DollarSign, Volume2, VolumeX, User, X } from "lucide-react";
import { parseDbDate } from "@/lib/date-utils";
import { getPriceValue, cn } from "@/lib/utils";
import { getActivityIcon, getActivityEmoji, getActivityLabel, ACTIVITY_START_TIMES } from "@/data/activityTypes";
import { useAuth } from "@/contexts/AuthContext";
import { ReportContentButton } from "@/components/ReportContentButton";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import { ParticipantsListDialog } from "@/components/ParticipantsListDialog";
import { PlanParticipantsDialog } from "@/components/PlanParticipantsDialog";
import type { UserActivity } from "@/hooks/useUserActivities";
import type { CohostAvatar } from "@/components/PlanAvatarStack";

/* ── Types (mirror PlansTab's PlanActivity) ───────────────────────────────── */
export interface FeedPlan {
  id: string;
  user_id: string;
  activity_type: string;
  city: string;
  scheduled_for: string | null;
  note?: string | null;
  promo_video_url?: string | null;
  promo_image_url?: string | null;
  description?: string | null;
  creator_name?: string;
  creator_avatar?: string;
  cohosts?: CohostAvatar[];
  participant_count?: number;
  isJoined?: boolean;
  price_amount?: string | null;
  price_tiers?: { label: string; amount: number }[] | null;
  is_auto_generated?: boolean | null;
  isCarouselJoin?: boolean;
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

/* Mirrors PlansTab's activityKeyMap so standard activity types render their
   translated, capitalized label ("Dinner") instead of the raw DB value
   ("dinner") in the feed's title. */
const ACTIVITY_TRANSLATION_KEYS: Record<string, string> = {
  dinner: "dinner",
  drinks: "drinks",
  brunch: "brunch",
  surf: "surf",
  run: "run",
  "co-working": "coWorking",
  basketball: "basketball",
  "tennis-padel": "tennisPadel",
  football: "football",
  shopping: "shopping",
  arts: "arts",
};

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
  const [showDescription, setShowDescription] = useState(false);

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

  const planTitle = !plan.isCarouselJoin && plan.note
    ? plan.note
    : t(
        `activities.${ACTIVITY_TRANSLATION_KEYS[plan.activity_type] ?? ""}`,
        getActivityLabel(plan.activity_type)
      );

  const dateLabel = (() => {
    if (!plan.scheduled_for) return null;
    const d = parseDbDate(plan.scheduled_for);
    const day = isToday(d) ? t('common.today', 'Today') : isTomorrow(d) ? t('common.tomorrow', 'Tomorrow') : format(d, "EEE, d MMM");
    // Auto-generated (carousel) plans carry a synthetic noon scheduled_for —
    // it only encodes which DAY the card is for, never a real time of day.
    // Show the activity type's actual start time instead of formatting that
    // placeholder noon straight out of scheduled_for.
    const time = plan.is_auto_generated
      ? ACTIVITY_START_TIMES[plan.activity_type]
      : format(d, "h:mm a");
    return time ? `${day} · ${time}` : day;
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
      const hasTiers = Boolean(plan.price_tiers && plan.price_tiers.length > 0);
      return { label: hasTiers ? "Pay to Join" : `Pay $${priceValue.toFixed(0)}`, handler: onPayForPlan, disabled: false };
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
      ) : plan.promo_image_url ? (
        /* ── Photo card — creator-uploaded, takes priority over every
             other fallback below (same rank as video, just a still). ── */
        <>
          <img
            src={plan.promo_image_url}
            alt={plan.note || getActivityLabel(plan.activity_type)}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 45%, transparent 100%)",
              zIndex: 2,
            }}
          />
        </>
      ) : (
        /* ── No promo media card ──
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
          {/* Creator avatar — tappable. Auto-generated open groups (e.g. the standard
              Dinner/Brunch overflow slots) don't have a meaningful single "creator" —
              the user_id on the row is just whoever's join happened to spin up that
              slot, not an owner. Hide it here the same way the plans list already does
              (see the "!plan.is_auto_generated" check there) instead of misleadingly
              crediting/linking to that person. */}
          {!plan.is_auto_generated && (
            <div className="flex items-center shrink-0" style={{ pointerEvents: "auto" }}>
              <button
                type="button"
                onClick={onViewProfile}
                className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/50 shadow-lg shrink-0 flex items-center justify-center bg-white/10"
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
              {/* Co-hosts — visual only, not individually tappable */}
              {plan.cohosts?.slice(0, 5).map((cohost) => (
                <div
                  key={cohost.user_id}
                  className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/50 shadow-lg shrink-0 flex items-center justify-center bg-white/10"
                  style={{ marginLeft: -10 }}
                >
                  {cohost.avatar_url ? (
                    <img src={cohost.avatar_url} alt={cohost.name || ""} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-white">
                      {(cohost.name || "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 min-w-0" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
            {plan.description?.trim() ? (
              <button
                type="button"
                onClick={() => setShowDescription(true)}
                className="font-bold text-white text-base leading-tight truncate text-left underline decoration-white/40 underline-offset-2"
                style={{ pointerEvents: "auto" }}
              >
                {/* Discovery-carousel entries (other cities' open groups) store a day
                    hint like "This Saturday" in `note` — never a real title — so
                    always show the activity type label for those. Same gate the
                    Plans list already uses (isCarouselJoin), not is_auto_generated:
                    a user's OWN joined auto-generated slot has no note at all, but a
                    discovery-carousel card's note is a day hint, not a title. */}
                {planTitle}
              </button>
            ) : (
              <p className="font-bold text-white text-base leading-tight truncate">
                {planTitle}
              </p>
            )}
            {!plan.is_auto_generated && plan.creator_name && (
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

      {/* Description half-sheet — tapping the title slides this up over the
          bottom half of the card, leaving the video/photo visible above it.
          Always mounted (once a description exists) so the slide is an
          actual transform transition, not a mount/unmount pop. */}
      {plan.description?.trim() && (
        <>
          <div
            className="absolute inset-0 z-30 transition-opacity duration-300"
            style={{
              background: "rgba(0,0,0,0.35)",
              opacity: showDescription ? 1 : 0,
              pointerEvents: showDescription ? "auto" : "none",
            }}
            onClick={() => setShowDescription(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 z-40 bg-white rounded-t-3xl shadow-2xl flex flex-col transition-transform duration-300 ease-out"
            style={{
              height: "50%",
              transform: showDescription ? "translateY(0)" : "translateY(100%)",
            }}
          >
            {/* Grab handle */}
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="flex items-start justify-between gap-3 px-5 pb-3 shrink-0">
              <p className="font-bold text-gray-900 text-base leading-tight pt-1">{planTitle}</p>
              <button
                type="button"
                onClick={() => setShowDescription(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
                aria-label="Close description"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {plan.description}
              </p>
            </div>
          </div>
        </>
      )}

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

  /* Infinite loop: prepend a duplicate render of the last plan and append a
     duplicate render of the first plan (same underlying plan object — only the
     React key differs, so participant counts/join state/actions all stay
     correct even while a duplicate is on screen). Reaching either duplicate
     snaps the *real* card into view a moment later (see the scroll-settle
     effect below), so swiping past the last plan lands on the first one and
     vice versa instead of dead-ending. Real indices in `looped` are offset by
     +1 because of the leading duplicate. Skipped when there's only one plan —
     looping a single card to itself is meaningless. */
  const looped = useMemo(() => {
    if (sorted.length <= 1) return sorted.map((plan) => ({ key: plan.id, plan }));
    const head = sorted[sorted.length - 1];
    const tail = sorted[0];
    return [
      { key: `${head.id}__loop-head`, plan: head },
      ...sorted.map((plan) => ({ key: plan.id, plan })),
      { key: `${tail.id}__loop-tail`, plan: tail },
    ];
  }, [sorted]);
  const isLooping = looped.length > sorted.length;
  const realOffset = isLooping ? 1 : 0;

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
    const startTarget = resolvedStart + realOffset;
    // Use requestAnimationFrame so the DOM is fully painted before we scroll
    const id = requestAnimationFrame(() => {
      if (startTarget !== 0) {
        el.scrollTop = startTarget * el.clientHeight;
      }
      const prev = el.scrollTop;
      el.scrollTop = prev + 1;
      el.scrollTop = prev;
    });
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Wraparound: once scrolling settles on a clone card (the loop-head clone at
     index 0, or the loop-tail clone at the very end), silently jump to the
     matching real card at the opposite end of the list — same index arithmetic,
     no animation, so it reads as a seamless loop instead of a visible reset.
     Each jump gets the same WKWebView "wake up" nudge as the initial mount
     scroll: a raw JS scrollTop assignment (not a native scroll/snap gesture)
     can leave the touch-scroll engine frozen right after — the card lands in
     the right spot, but the next swipe doesn't register at all. Without this,
     looping worked once (visually landing back on the first card) and then
     went dead, which is exactly what going all the way around back to the
     first card and getting stuck there looked like. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isLooping) return;
    let settleTimer: ReturnType<typeof setTimeout>;
    const lastIndex = looped.length - 1;
    const wake = () => {
      const prev = el.scrollTop;
      el.scrollTop = prev + 1;
      el.scrollTop = prev;
    };
    const handleScroll = () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        const clientHeight = el.clientHeight;
        if (!clientHeight) return;
        const currentIndex = Math.round(el.scrollTop / clientHeight);
        if (currentIndex === 0) {
          // Landed on the loop-head clone (visually = last plan) — jump to the real last plan.
          el.scrollTop = (lastIndex - 1) * clientHeight;
          requestAnimationFrame(wake);
        } else if (currentIndex === lastIndex) {
          // Landed on the loop-tail clone (visually = first plan) — jump to the real first plan.
          el.scrollTop = 1 * clientHeight;
          requestAnimationFrame(wake);
        }
      }, 120); // let scroll-snap settle before checking
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      clearTimeout(settleTimer);
    };
  }, [isLooping, looped.length]);

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
        {/* Back arrow — closes the feed, which reveals whatever was showing
            underneath (list or map), since neither view's own state changes
            while the feed is open. */}
        {!inline && (
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
          {looped.map(({ key, plan }) => (
            <FeedCard
              key={key}
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
