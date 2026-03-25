import type { CSSProperties } from "react";

const BANNER_3D_SIZE = 92;

const G_FRONT =
  "linear-gradient(168deg, #f2d4bc 0%, #d4a078 38%, #a86b45 72%, #7a4a32 100%)";
const G_SIDE = "linear-gradient(135deg, #e8c4a8 0%, #b8825c 45%, #6b4428 100%)";
const G_BACK = "linear-gradient(195deg, #c9a080 0%, #8f5c3e 50%, #5c3824 100%)";
const G_TOP =
  "linear-gradient(155deg, #fff5eb 0%, #f0d4b8 35%, #e8b88a 70%, #d4986a 100%)";
const G_BOTTOM = "linear-gradient(180deg, #a07050 0%, #6b4030 100%)";

function faceShell(
  w: number,
  h: number,
  mx: number,
  my: number,
  transform: string,
  bg: string
): CSSProperties {
  return {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: w,
    height: h,
    marginLeft: -mx,
    marginTop: -my,
    backfaceVisibility: "hidden",
    border: "1px solid rgba(255,255,255,0.35)",
    boxShadow:
      "inset 0 2px 4px rgba(255,255,255,0.45), inset 0 -12px 24px rgba(60,30,20,0.25), 0 0 0 1px rgba(0,0,0,0.06)",
    background: bg,
    transform,
  };
}

/** Single rectangular prism centered on parent origin, bronze metallic faces. */
function BronzePrism({
  w,
  h,
  d,
  groupTransform = "",
}: {
  w: number;
  h: number;
  d: number;
  groupTransform?: string;
}) {
  const mx = w / 2;
  const my = h / 2;
  const mz = d / 2;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 0,
        height: 0,
        transformStyle: "preserve-3d",
        transform: groupTransform,
      }}
    >
      <div style={faceShell(w, h, mx, my, `rotateY(0deg) translateZ(${mz}px)`, G_FRONT)} />
      <div style={faceShell(w, h, mx, my, `rotateY(180deg) translateZ(${mz}px)`, G_BACK)} />
      <div style={faceShell(d, h, mz, my, `rotateY(90deg) translateZ(${mx}px)`, G_SIDE)} />
      <div style={faceShell(d, h, mz, my, `rotateY(-90deg) translateZ(${mx}px)`, G_SIDE)} />
      <div style={faceShell(w, d, mx, mz, `rotateX(90deg) translateZ(${my}px)`, G_TOP)} />
      <div style={faceShell(w, d, mx, mz, `rotateX(-90deg) translateZ(${my}px)`, G_BOTTOM)} />
    </div>
  );
}

/** Eighth-note style: oval head, stem, angled flag — all CSS 3D prisms. */
function MusicalNote3D() {
  return (
    <>
      {/* Note head (oval as thin prism) */}
      <BronzePrism w={30} h={22} d={11} groupTransform="translate3d(-6px, 12px, 0)" />
      {/* Stem */}
      <BronzePrism w={7} h={48} d={7} groupTransform="translate3d(11px, -14px, 0)" />
      {/* Flag (angled beam from stem) */}
      <BronzePrism
        w={5}
        h={28}
        d={11}
        groupTransform="translate3d(13px, -40px, 3px) rotateZ(-32deg) rotateX(12deg)"
      />
    </>
  );
}

export function EventGroupChatBanner3D() {
  return (
    <div
      className="flex shrink-0 self-center justify-end sm:pr-2 py-0 sm:py-2 max-sm:scale-[0.68] sm:scale-100 origin-center"
      style={{
        perspective: 520,
        perspectiveOrigin: "55% 40%",
        filter: "drop-shadow(12px 20px 28px rgba(40, 20, 10, 0.22))",
      }}
    >
      <style>
        {`
          @keyframes eventDetailChatObjectDrift {
            from { transform: rotateX(-20deg) rotateY(28deg); }
            to { transform: rotateX(-20deg) rotateY(388deg); }
          }
          @media (prefers-reduced-motion: reduce) {
            .event-detail-chat-object-spin {
              animation: none !important;
              transform: rotateX(-20deg) rotateY(42deg) !important;
            }
          }
        `}
      </style>
      <div
        className="event-detail-chat-object-spin relative"
        style={{
          width: BANNER_3D_SIZE,
          height: BANNER_3D_SIZE,
          transformStyle: "preserve-3d",
          animation: "eventDetailChatObjectDrift 20s linear infinite",
        }}
      >
        <MusicalNote3D />
      </div>
    </div>
  );
}
