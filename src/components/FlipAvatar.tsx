import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { EmojiShine } from "@/components/EmojiShine";

const COIN_FLIP_MS = 900;
const PROFILE_SHOW_MS = 4000;

/**
 * The bot's sunglasses avatar. The lenses catch the same periodic glint as the "Propose a plan"
 * card on Home. Tap it and it flips like a tossed coin to the user's own profile photo, holds it
 * for a few seconds, then flips back — and each new tap does it again. (Tapping while the photo is
 * showing flips it back early.) With no profile photo there's nothing to flip to, so it just glints.
 */
export function FlipAvatar({ color, profileUrl }: { color: string; profileUrl?: string }) {
  // Each flip adds 2.5 turns, so it always keeps spinning the same way and lands on the other face.
  const [angle, setAngle] = useState(0);
  const [hop, setHop] = useState(false);
  const [showingProfile, setShowingProfile] = useState(false);
  const busy = useRef(false);
  const backTimer = useRef<ReturnType<typeof setTimeout>>();
  const settleTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => { clearTimeout(backTimer.current); clearTimeout(settleTimer.current); }, []);

  const flip = useCallback((toProfile: boolean) => {
    busy.current = true;
    setAngle((a) => a + 900);
    setShowingProfile(toProfile);
    setHop(true);
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => { busy.current = false; setHop(false); }, COIN_FLIP_MS);
  }, []);

  const onTap = () => {
    if (!profileUrl || busy.current) return;
    clearTimeout(backTimer.current);
    if (showingProfile) {
      flip(false);
    } else {
      flip(true);
      backTimer.current = setTimeout(() => flip(false), COIN_FLIP_MS + PROFILE_SHOW_MS);
    }
  };

  const face: React.CSSProperties = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label="Show my profile photo"
      className={cn("relative h-16 w-16 shrink-0 rounded-full", profileUrl ? "cursor-pointer" : "cursor-default", hop && "coin-hop")}
      style={{ perspective: 600 }}
    >
      <span
        className="coin-3d absolute inset-0 block"
        style={{ transformStyle: "preserve-3d", transform: `rotateY(${angle}deg)`, transition: `transform ${COIN_FLIP_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1)` }}
      >
        <span className="absolute inset-0 flex items-center justify-center rounded-full text-3xl" style={{ background: color, ...face }}>
          <EmojiShine emoji="😎" enabled />
        </span>
        {profileUrl && (
          <span className="absolute inset-0 overflow-hidden rounded-full bg-muted" style={{ transform: "rotateY(180deg)", ...face }}>
            <img src={profileUrl} alt="" className="h-full w-full object-cover" draggable={false} />
          </span>
        )}
      </span>
    </button>
  );
}
