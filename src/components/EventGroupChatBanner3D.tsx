import { useMemo } from "react";
import type { CSSProperties } from "react";

/** viewBox height for aspect ratio */
const VIEWBOX_H = 165;

/** ~40% smaller than prior ~182px accent — compact banner accent */
const NOTE_DISPLAY_W = 110;
const NOTE_DISPLAY_H = Math.round((NOTE_DISPLAY_W * VIEWBOX_H) / 100);

const LAYER_COUNT = 20;
const DEPTH_STEP = 2.2;

/** Classic engraved tilt (SVG positive rotate = CW; negative = oval up-right). */
const HEAD_CX = 35;
const HEAD_CY = 118;
const HEAD_ROT = -22;
const HEAD_RX = 25;
const HEAD_RY = 15;

/** Front face pure black; slices toward the back use subtle dark gray for extrusion depth. */
function extrusionFill(layerIndex: number, totalLayers: number): string {
  if (totalLayers <= 1) return "#000000";
  const t = layerIndex / (totalLayers - 1);
  const v = Math.round(30 * (1 - t));
  return `rgb(${v},${v},${v})`;
}

function stemAttachOnHead(): { x: number; y: number } {
  const rad = (HEAD_ROT * Math.PI) / 180;
  const x = HEAD_CX + HEAD_RX * Math.cos(rad);
  const y = HEAD_CY + HEAD_RX * Math.sin(rad);
  return { x, y };
}

/**
 * Single eighth note (♪): filled oval head (bottom), straight vertical stem from head’s right,
 * one curved flag at stem top — classic icon proportions.
 */
function EighthNoteSvg({
  fill,
  layerIndex,
  totalLayers,
}: {
  fill: string;
  layerIndex: number;
  totalLayers: number;
}) {
  const attach = stemAttachOnHead();
  const stemLeft = attach.x - 3;
  const stemRight = attach.x + 4;
  const stemBottom = attach.y + 2.5;
  const stemTop = 22;

  const isFront = layerIndex === totalLayers - 1;

  return (
    <svg
      width={NOTE_DISPLAY_W}
      height={NOTE_DISPLAY_H}
      viewBox={`0 0 100 ${VIEWBOX_H}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="block"
    >
      <g transform={`translate(${HEAD_CX} ${HEAD_CY}) rotate(${HEAD_ROT})`}>
        <ellipse cx="0" cy="0" rx={HEAD_RX} ry={HEAD_RY} fill={fill} />
      </g>

      <path
        fill={fill}
        d={`M ${stemLeft.toFixed(2)} ${stemBottom.toFixed(2)}
            L ${stemRight.toFixed(2)} ${stemBottom.toFixed(2)}
            L ${stemRight.toFixed(2)} ${stemTop}
            L ${stemLeft.toFixed(2)} ${stemTop}
            Z`}
      />

      {/* Single flag: smooth outward curl, tapers toward lower-right */}
      <path
        fill={fill}
        d={`M ${stemLeft} ${stemTop}
            L ${stemRight} ${stemTop}
            C 79 ${stemTop + 2} 93 30 92 50
            C 91 68 80 84 68 88
            C 58 91 50 86 46 76
            C 42 64 44 50 48 40
            C 50 33 50 28 ${stemLeft + 0.5} ${stemTop + 5}
            Z`}
      />

      {isFront ? (
        <>
          <path
            d={`M ${stemLeft} ${stemTop}
              L ${stemRight} ${stemTop}
              C 79 ${stemTop + 2} 93 30 92 50
              C 91 68 80 84 68 88
              C 58 91 50 86 46 76
              C 42 64 44 50 48 40
              C 50 33 50 28 ${stemLeft + 0.5} ${stemTop + 5}
              Z`}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.35"
          />
          <g transform={`translate(${HEAD_CX} ${HEAD_CY}) rotate(${HEAD_ROT})`}>
            <ellipse
              cx="0"
              cy="0"
              rx={HEAD_RX}
              ry={HEAD_RY}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="0.35"
            />
          </g>
        </>
      ) : null}
    </svg>
  );
}

function ExtrudedEighthNote() {
  const totalDepth = (LAYER_COUNT - 1) * DEPTH_STEP;
  const zOffset = totalDepth / 2;

  const layers = useMemo(
    () =>
      Array.from({ length: LAYER_COUNT }, (_, i) => ({
        i,
        z: i * DEPTH_STEP - zOffset,
        fill: extrusionFill(i, LAYER_COUNT),
      })),
    [zOffset]
  );

  return (
    <>
      {layers.map(({ i, z, fill }) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: NOTE_DISPLAY_W,
            height: NOTE_DISPLAY_H,
            marginLeft: -NOTE_DISPLAY_W / 2,
            marginTop: -NOTE_DISPLAY_H / 2,
            transform: `translateZ(${z}px)`,
            transformStyle: "preserve-3d",
            backfaceVisibility: "visible",
            WebkitBackfaceVisibility: "visible",
            opacity: 1,
          }}
        >
          <EighthNoteSvg fill={fill} layerIndex={i} totalLayers={LAYER_COUNT} />
        </div>
      ))}
    </>
  );
}

export function EventGroupChatBanner3D() {
  const outerStyle: CSSProperties = {
    perspective: 640,
    perspectiveOrigin: "52% 42%",
    filter: "drop-shadow(14px 22px 34px rgba(40, 20, 10, 0.28))",
  };

  return (
    <div
      className="flex shrink-0 self-center justify-end overflow-visible sm:pr-0 py-0 sm:py-1 max-sm:scale-100 sm:scale-100 origin-center"
      style={outerStyle}
    >
      <style>
        {`
          @keyframes eventDetailChatObjectDrift {
            from { transform: rotateX(-18deg) rotateY(26deg); }
            to { transform: rotateX(-18deg) rotateY(386deg); }
          }
          @media (prefers-reduced-motion: reduce) {
            .event-detail-chat-object-spin {
              animation: none !important;
              transform: rotateX(-18deg) rotateY(44deg) !important;
            }
          }
        `}
      </style>
      <div
        className="event-detail-chat-object-spin relative overflow-visible"
        style={{
          width: NOTE_DISPLAY_W,
          height: NOTE_DISPLAY_H,
          transformStyle: "preserve-3d",
          animation: "eventDetailChatObjectDrift 20s linear infinite",
        }}
      >
        <ExtrudedEighthNote />
      </div>
    </div>
  );
}
