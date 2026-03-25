import { useId, useMemo } from "react";
import type { CSSProperties } from "react";

/** viewBox height for aspect ratio */
const VIEWBOX_H = 178;

/** Display width; height follows viewBox aspect (larger = fills banner right side). */
const NOTE_DISPLAY_W = 182;
const NOTE_DISPLAY_H = Math.round((NOTE_DISPLAY_W * VIEWBOX_H) / 100);

const LAYER_COUNT = 20;
const DEPTH_STEP = 2.2;

/** Head center + tilt (degrees, SVG rotate = CW; negative ≈ classic “up-right” oval). */
const HEAD_CX = 37;
const HEAD_CY = 131;
const HEAD_ROT = -26;
const HEAD_RX = 28;
const HEAD_RY = 17;

/** Bronze / rose-gold metallic stops; `t` = 0 (back) … 1 (front) for shading. */
function metallicStops(t: number): { a: string; b: string; c: string } {
  const lift = t * 14;
  return {
    a: `rgb(${245 - lift * 0.4}, ${228 - lift * 0.5}, ${210 - lift * 0.45})`,
    b: `rgb(${212 - lift * 0.35}, ${160 - lift * 0.3}, ${120 - lift * 0.25})`,
    c: `rgb(${130 - lift * 0.4}, ${88 - lift * 0.35}, ${58 - lift * 0.3})`,
  };
}

/** Right-side attach point of rotated ellipse (stem joins here). */
function stemAttachOnHead(): { x: number; y: number } {
  const rad = (HEAD_ROT * Math.PI) / 180;
  const x = HEAD_CX + HEAD_RX * Math.cos(rad);
  const y = HEAD_CY + HEAD_RX * Math.sin(rad);
  return { x, y };
}

/**
 * Classic single eighth note (♪): filled tilted oval head, thick vertical stem, curved flag.
 * Geometry aligned with engraved notation (stem from right of head).
 */
function EighthNoteSvg({
  gradId,
  layerIndex,
  totalLayers,
}: {
  gradId: string;
  layerIndex: number;
  totalLayers: number;
}) {
  const t = totalLayers > 1 ? layerIndex / (totalLayers - 1) : 1;
  const { a, b, c } = metallicStops(t);
  const attach = stemAttachOnHead();
  const stemLeft = attach.x - 3.2;
  const stemRight = attach.x + 4.2;
  const stemBottom = attach.y + 2.8;
  const stemTop = 22;

  const fill = `url(#${gradId})`;

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
      <defs>
        <linearGradient id={gradId} x1="8%" y1="6%" x2="92%" y2="94%" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={a} />
          <stop offset="48%" stopColor={b} />
          <stop offset="100%" stopColor={c} />
        </linearGradient>
      </defs>

      {/* Tilted filled note head — bold oval like reference icon */}
      <g transform={`translate(${HEAD_CX} ${HEAD_CY}) rotate(${HEAD_ROT})`}>
        <ellipse cx="0" cy="0" rx={HEAD_RX} ry={HEAD_RY} fill={fill} />
      </g>

      {/* Thick vertical stem from right of head */}
      <path
        fill={fill}
        d={`M ${stemLeft.toFixed(2)} ${stemBottom.toFixed(2)}
            L ${stemRight.toFixed(2)} ${stemBottom.toFixed(2)}
            L ${stemRight.toFixed(2)} ${stemTop}
            L ${stemLeft.toFixed(2)} ${stemTop}
            Z`}
      />

      {/* Curved flag: swoops from stem top, tapers toward lower-right (fits viewBox width) */}
      <path
        fill={fill}
        d={`M ${stemLeft} ${stemTop}
            L ${stemRight} ${stemTop}
            C 88 ${stemTop + 1} 100 24 99 46
            C 98 64 91 84 83 91
            C 75 96 65 93 59 82
            C 53 70 51 57 54 45
            C 55 35 55 30 ${stemLeft + 0.5} ${stemTop + 4}
            Z`}
      />

      {layerIndex === totalLayers - 1 ? (
        <>
          <path
            d={`M ${stemLeft} ${stemTop}
              L ${stemRight} ${stemTop}
              C 88 ${stemTop + 1} 100 24 99 46
              C 98 64 91 84 83 91
              C 75 96 65 93 59 82
              C 53 70 51 57 54 45
              C 55 35 55 30 ${stemLeft + 0.5} ${stemTop + 4}
              Z`}
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="0.4"
          />
          <g transform={`translate(${HEAD_CX} ${HEAD_CY}) rotate(${HEAD_ROT})`}>
            <ellipse
              cx="0"
              cy="0"
              rx={HEAD_RX}
              ry={HEAD_RY}
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="0.4"
            />
          </g>
        </>
      ) : null}
    </svg>
  );
}

function ExtrudedEighthNote({ uid }: { uid: string }) {
  const totalDepth = (LAYER_COUNT - 1) * DEPTH_STEP;
  const zOffset = totalDepth / 2;

  const layers = useMemo(
    () =>
      Array.from({ length: LAYER_COUNT }, (_, i) => ({
        i,
        z: i * DEPTH_STEP - zOffset,
        gradId: `note-metal-${uid}-${i}`,
      })),
    [uid, zOffset]
  );

  return (
    <>
      {layers.map(({ i, z, gradId }) => (
        <div
          key={gradId}
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
            backfaceVisibility: "hidden",
            opacity: 0.88 + (i / (LAYER_COUNT - 1 || 1)) * 0.12,
          }}
        >
          <EighthNoteSvg gradId={gradId} layerIndex={i} totalLayers={LAYER_COUNT} />
        </div>
      ))}
    </>
  );
}

export function EventGroupChatBanner3D() {
  const uid = useId().replace(/:/g, "");

  const outerStyle: CSSProperties = {
    perspective: 640,
    perspectiveOrigin: "52% 42%",
    filter: "drop-shadow(14px 22px 34px rgba(40, 20, 10, 0.28))",
  };

  return (
    <div
      className="flex shrink-0 self-center justify-end overflow-visible sm:pr-0 py-0 sm:py-1 max-sm:scale-[0.86] sm:scale-100 origin-center"
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
        <ExtrudedEighthNote uid={uid} />
      </div>
    </div>
  );
}
