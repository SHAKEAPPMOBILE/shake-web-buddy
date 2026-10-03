import type React from "react";
import { Share as ShareIcon } from "lucide-react";
import { PLAN_BACKGROUNDS } from "@/data/planBackgrounds";
import { PlanBackgroundFill } from "@/components/PlanBackgroundFill";
import { getActivityIcon } from "@/data/activityTypes";
import { getPlanEmojis } from "@/lib/activityDetection";
import { useEmojiSearchVersion } from "@/hooks/useEmojiSearchVersion";
import { getDisplayAvatarUrl } from "@/lib/avatar";
import type { SharePlan } from "@/lib/planShare";

const DEFAULT_BG = "linear-gradient(135deg, #667eea 0%, #764ba2 30%, #f093fb 70%, #f5576c 100%)";

interface ShareEventCardProps {
  plan: SharePlan;
  title: string;
  when: string | null;
  hostedBy: string;
  joinedLabel?: string | null;
  /** When set, a share icon sits in the card's top-right corner and calls this (opens the system share sheet). */
  onShare?: () => void;
  shareLabel?: string;
}

/**
 * The preview shown above the share options — what the plan looks like when it
 * goes out. Uses the plan's own background (a city photo or a color) and its
 * activity icon, so a picnic reads as a picnic before anyone taps send.
 */
export function ShareEventCard({ plan, title, when, hostedBy, joinedLabel, onShare, shareLabel = "Share" }: ShareEventCardProps) {
  const bg = plan.background_id ? PLAN_BACKGROUNDS.find((b) => b.id === plan.background_id) : undefined;
  const icon = getActivityIcon(plan.activity_type);
  // The newer activity icons are transparent PNGs and sit straight on the background;
  // the original dinner/drinks/brunch icons are JPEGs on white, so they get a round frame.
  const transparentIcon = !!icon && icon.endsWith(".png");
  const avatar = getDisplayAvatarUrl(plan.creator_avatar);
  useEmojiSearchVersion();
  const emojis = getPlanEmojis(plan.activity_type, plan.note);

  // What sits above the title. A recognised activity gets its icon; an unrecognised one has only the
  // generic 📍 fallback, which says nothing — so on a photo background it gets no hero at all, and on a
  // plain gradient the host's own avatar stands in.
  let hero: React.ReactNode = null;
  if (emojis.length >= 2) {
    // A plan that names several activities ("surf, tennis, dinner") shows all of them, in order.
    hero = (
      <div className={`flex flex-wrap items-center justify-center gap-x-2 leading-tight drop-shadow-2xl ${emojis.length > 3 ? "text-[44px]" : "text-[56px]"}`}>
        {emojis.map((e, i) => (
          <span key={i}>{e}</span>
        ))}
      </div>
    );
  } else if (icon && transparentIcon) {
    hero = <img src={icon} alt="" className="h-full w-auto max-w-[72%] object-contain drop-shadow-2xl" />;
  } else if (icon) {
    hero = (
      <div className="h-full aspect-square max-w-[72%] rounded-full overflow-hidden bg-white ring-4 ring-white/70 shadow-2xl">
        <img src={icon} alt="" className="w-full h-full object-cover" />
      </div>
    );
  } else if (emojis.length === 1) {
    hero = <span className="text-[72px] leading-none drop-shadow-2xl">{emojis[0]}</span>;
  } else if (!bg && avatar) {
    hero = (
      <div className="h-full aspect-square max-w-[72%] rounded-full overflow-hidden ring-4 ring-white/60 shadow-2xl">
        <img src={avatar} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className="relative flex w-full aspect-[4/5] flex-col overflow-hidden rounded-3xl text-white shadow-xl"
      style={{ background: DEFAULT_BG }}
    >
      {bg && <PlanBackgroundFill bg={bg} />}

      <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/80 via-black/45 to-transparent" />

      <div className="absolute left-4 top-4 z-10 rounded-full bg-black/25 backdrop-blur-sm px-3 py-1 text-[11px] font-bold tracking-[0.2em]">
        SHAKE
      </div>

      {onShare && (
        <button
          type="button"
          onClick={onShare}
          aria-label={shareLabel}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-transform active:scale-90"
        >
          <ShareIcon className="h-[18px] w-[18px]" />
        </button>
      )}

      {/* The icon takes whatever room the text block below leaves, so a long title can never run over it. */}
      <div className="relative min-h-0 flex-1">
        {hero && <div className="absolute inset-0 flex items-center justify-center px-6 pb-2 pt-10">{hero}</div>}
      </div>

      <div className="relative px-5 pb-4">
        <h3 className="text-[24px] font-extrabold leading-[1.1] line-clamp-2">{title}</h3>
        {when && <p className="mt-1.5 text-[13px] font-semibold text-white/95">{when}</p>}
        <p className="text-[13px] text-white/80">{plan.city}</p>

        <div className="mt-3 flex items-center gap-2 text-[12px] text-white/90">
          <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-white/25 flex items-center justify-center text-[11px] font-bold">
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              hostedBy.charAt(0).toUpperCase()
            )}
          </span>
          <span className="truncate">{hostedBy}</span>
          {joinedLabel && <span className="shrink-0 text-white/75">· {joinedLabel}</span>}
        </div>

        <div className="mt-3 flex items-baseline justify-between border-t border-white/25 pt-2.5">
          <span className="text-[13px] font-bold">join on SHAKE</span>
          <span className="text-[11px] text-white/75">shakeapp.today</span>
        </div>
      </div>
    </div>
  );
}
