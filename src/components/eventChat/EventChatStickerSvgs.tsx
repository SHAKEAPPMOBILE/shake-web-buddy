import type { FC } from "react";
import type { EventChatStickerId } from "@/lib/eventChatStickers";

type StickerSvgProps = {
  size?: number;
  className?: string;
};

/** Picker ~80px, chat bubble ~120px */
export function StickerGuitarShred({ size = 80, className }: StickerSvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className} aria-hidden>
      <style>
        {`
          @keyframes ec-guitar-strum {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(1.5px); }
          }
          @keyframes ec-guitar-body {
            0%, 100% { transform: rotate(-1deg); }
            50% { transform: rotate(1deg); }
          }
          .ec-guitar-str { transform-origin: center; animation: ec-guitar-strum 0.35s ease-in-out infinite; }
          .ec-guitar-body { transform-origin: 28px 48px; animation: ec-guitar-body 0.7s ease-in-out infinite; }
        `}
      </style>
      <g className="ec-guitar-body">
        <path
          fill="#7c3aed"
          d="M12 52c0-8 6-14 14-14h6l8-28c0-2 2-4 4-4h4c2 0 4 2 4 4v28h6c8 0 14 6 14 14v8H12v-8z"
        />
        <rect x="34" y="8" width="12" height="22" rx="2" fill="#4c1d95" />
        <circle cx="40" cy="12" r="3" fill="#c4b5fd" />
      </g>
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          className="ec-guitar-str"
          x1={36 + i * 2.5}
          y1="14"
          x2={36 + i * 2.5}
          y2="50"
          stroke="#fde68a"
          strokeWidth="1.2"
          style={{ animationDelay: `${i * 0.08}s` }}
        />
      ))}
    </svg>
  );
}

export function StickerFireHype({ size = 80, className }: StickerSvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className} aria-hidden>
      <style>
        {`
          @keyframes ec-fire-flicker {
            0%, 100% { opacity: 0.95; transform: scaleY(1) scaleX(1); }
            33% { opacity: 0.65; transform: scaleY(1.08) scaleX(0.96); }
            66% { opacity: 0.85; transform: scaleY(0.94) scaleX(1.04); }
          }
          @keyframes ec-fire-core {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
          .ec-fire-outer { transform-origin: 40px 58px; animation: ec-fire-flicker 0.45s ease-in-out infinite; }
          .ec-fire-inner { transform-origin: 40px 52px; animation: ec-fire-flicker 0.35s ease-in-out infinite reverse; }
          .ec-fire-core { animation: ec-fire-core 0.25s ease-in-out infinite; }
        `}
      </style>
      <path
        className="ec-fire-outer"
        fill="#f97316"
        d="M40 12c-4 12-16 18-12 32 2 8 10 14 12 22 2-8 10-14 12-22 4-14-8-20-12-32z"
      />
      <path
        className="ec-fire-inner"
        fill="#fbbf24"
        d="M40 24c-3 8-10 12-8 22 1 5 5 9 8 14 3-5 7-9 8-14 2-10-5-14-8-22z"
      />
      <ellipse className="ec-fire-core" cx="40" cy="44" rx="8" ry="12" fill="#fff7ed" />
    </svg>
  );
}

export function StickerHandsUp({ size = 80, className }: StickerSvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className} aria-hidden>
      <style>
        {`
          @keyframes ec-hand-l {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-7px); }
          }
          @keyframes ec-hand-r {
            0%, 100% { transform: translateY(-3px); }
            50% { transform: translateY(4px); }
          }
          .ec-hand-l { transform-origin: 24px 52px; animation: ec-hand-l 0.55s ease-in-out infinite; }
          .ec-hand-r { transform-origin: 56px 52px; animation: ec-hand-r 0.55s ease-in-out infinite 0.12s; }
        `}
      </style>
      <g className="ec-hand-l">
        <ellipse cx="24" cy="50" rx="14" ry="18" fill="#fcd34d" stroke="#b45309" strokeWidth="2" />
        <ellipse cx="24" cy="38" rx="5" ry="6" fill="#fde68a" />
        <ellipse cx="18" cy="34" rx="4" ry="5" fill="#fde68a" />
        <ellipse cx="30" cy="34" rx="4" ry="5" fill="#fde68a" />
      </g>
      <g className="ec-hand-r">
        <ellipse cx="56" cy="50" rx="14" ry="18" fill="#fcd34d" stroke="#b45309" strokeWidth="2" />
        <ellipse cx="56" cy="38" rx="5" ry="6" fill="#fde68a" />
        <ellipse cx="50" cy="34" rx="4" ry="5" fill="#fde68a" />
        <ellipse cx="62" cy="34" rx="4" ry="5" fill="#fde68a" />
      </g>
    </svg>
  );
}

export function StickerConfettiBurst({ size = 80, className }: StickerSvgProps) {
  const colors = ["#f472b6", "#38bdf8", "#a78bfa", "#fbbf24", "#34d399", "#fb7185"];
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className} aria-hidden>
      <style>
        {`
          @keyframes ec-conf-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes ec-conf-pulse {
            0%, 100% { transform: scale(0.75); opacity: 0.75; }
            50% { transform: scale(1.2); opacity: 1; }
          }
          .ec-conf-root { transform-origin: 40px 40px; animation: ec-conf-spin 3.5s linear infinite; }
          .ec-conf-dot { transform-origin: center; animation: ec-conf-pulse 0.9s ease-in-out infinite; }
        `}
      </style>
      <g className="ec-conf-root">
        {colors.map((fill, i) => {
          const a = (i / colors.length) * Math.PI * 2;
          const x = 40 + Math.cos(a) * 16;
          const y = 40 + Math.sin(a) * 16;
          return (
            <circle
              key={i}
              className="ec-conf-dot"
              cx={x}
              cy={y}
              r={5 + (i % 3)}
              fill={fill}
              style={{ animationDelay: `${i * 0.12}s` }}
            />
          );
        })}
      </g>
    </svg>
  );
}

export function StickerMicDrop({ size = 80, className }: StickerSvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className} aria-hidden>
      <style>
        {`
          @keyframes ec-mic-drop {
            0%, 100% { transform: translateY(-18px); }
            30% { transform: translateY(10px); }
            45% { transform: translateY(3px); }
            60% { transform: translateY(8px); }
            75% { transform: translateY(5px); }
          }
          .ec-mic-grp { transform-origin: 40px 36px; animation: ec-mic-drop 1.4s ease-in infinite; }
        `}
      </style>
      <rect x="36" y="58" width="8" height="14" rx="1" fill="#64748b" />
      <g className="ec-mic-grp">
        <rect x="30" y="18" width="20" height="28" rx="10" fill="#94a3b8" stroke="#475569" strokeWidth="2" />
        <line x1="40" y1="46" x2="40" y2="58" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="40" cy="24" rx="6" ry="4" fill="#cbd5e1" />
      </g>
    </svg>
  );
}

export function StickerLightning({ size = 80, className }: StickerSvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className} aria-hidden>
      <style>
        {`
          @keyframes ec-bolt-flash {
            0%, 90%, 100% { opacity: 1; filter: drop-shadow(0 0 6px #fbbf24); }
            45%, 55% { opacity: 0.25; filter: drop-shadow(0 0 2px #f59e0b); }
          }
          .ec-bolt { animation: ec-bolt-flash 0.8s ease-in-out infinite; }
        `}
      </style>
      <path
        className="ec-bolt"
        fill="#fbbf24"
        stroke="#f59e0b"
        strokeWidth="1.5"
        d="M46 8L28 38h14l-8 34 26-36H46l6-28z"
      />
    </svg>
  );
}

export function StickerDancer({ size = 80, className }: StickerSvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className} aria-hidden>
      <style>
        {`
          @keyframes ec-dance {
            0%, 100% { transform: rotate(-4deg) translateY(0); }
            50% { transform: rotate(4deg) translateY(-3px); }
          }
          .ec-dancer { transform-origin: 40px 44px; animation: ec-dance 0.55s ease-in-out infinite; }
        `}
      </style>
      <g className="ec-dancer" fill="#1e1b4b">
        <circle cx="40" cy="18" r="9" />
        <path d="M32 30c-4 0-8 6-6 14l4 22h6l-2-18 4 18h6l2-24c2-10-4-12-10-12h-4z" />
        <path d="M26 46l-10 20h6l8-14zM54 46l10 20h-6l-8-14z" />
      </g>
    </svg>
  );
}

export function StickerMusicNotes({ size = 80, className }: StickerSvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={className} aria-hidden>
      <style>
        {`
          @keyframes ec-note-float {
            0% { transform: translateY(8px); opacity: 0.3; }
            40% { opacity: 1; }
            100% { transform: translateY(-14px); opacity: 0; }
          }
          .ec-n1 { animation: ec-note-float 1.8s ease-out infinite; }
          .ec-n2 { animation: ec-note-float 1.8s ease-out infinite 0.5s; }
        `}
      </style>
      <g className="ec-n1" fill="#8b5cf6">
        <ellipse cx="28" cy="52" rx="8" ry="6" />
        <rect x="34" y="22" width="3" height="32" rx="1" />
      </g>
      <g className="ec-n2" fill="#c084fc">
        <ellipse cx="48" cy="48" rx="7" ry="5" />
        <rect x="53" y="18" width="3" height="32" rx="1" />
        <path d="M53 18h12v3H53z" fill="#c084fc" />
      </g>
    </svg>
  );
}

export const EVENT_STICKER_SVG_COMPONENTS: Record<EventChatStickerId, FC<StickerSvgProps>> = {
  guitar_shred: StickerGuitarShred,
  fire_hype: StickerFireHype,
  hands_up: StickerHandsUp,
  confetti_burst: StickerConfettiBurst,
  mic_drop: StickerMicDrop,
  lightning: StickerLightning,
  dancer: StickerDancer,
  music_notes: StickerMusicNotes,
};

export function EventStickerGraphic({
  stickerId,
  size,
  className,
}: {
  stickerId: string;
  size: number;
  className?: string;
}) {
  const Comp = EVENT_STICKER_SVG_COMPONENTS[stickerId as EventChatStickerId];
  if (!Comp) return null;
  return <Comp size={size} className={className} />;
}
