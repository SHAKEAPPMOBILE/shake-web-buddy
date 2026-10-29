import catHead from "@/assets/onboarding/cat-head.png";

/**
 * The SHAKE cat (the onboarding cat's head) in his striped shirt, holding up a paint palette — the
 * mascot beside the "None" tile in the plan background picker. Drawn as one SVG so it scales cleanly.
 */
export function CatWithPalette({ className }: { className?: string }) {
  const stripe = { stroke: "#1b1b1b", strokeWidth: 7, strokeLinecap: "round" as const, fill: "none" };
  return (
    <svg viewBox="0 0 250 200" className={className} role="img" aria-label="SHAKE cat holding a colour palette">
      {/* Shirt */}
      <path d="M38 112 Q36 160 44 192 L136 192 Q144 160 142 112 Z" fill="#faf7f2" />
      <path d="M44 128 Q90 120 138 128" {...stripe} />
      <path d="M43 146 Q90 138 139 146" {...stripe} />
      <path d="M43 164 Q90 156 139 164" {...stripe} />
      <path d="M44 182 Q90 174 138 182" {...stripe} />
      {/* Raised arm: a sleeve with the shirt's outline, ending in a hand */}
      <path d="M130 156 Q160 150 182 124" stroke="#1b1b1b" strokeWidth="25" strokeLinecap="round" fill="none" />
      <path d="M130 156 Q160 150 182 124" stroke="#faf7f2" strokeWidth="18" strokeLinecap="round" fill="none" />
      <path d="M148 152 L154 142" {...stripe} strokeWidth="4" />
      <path d="M162 142 L168 132" {...stripe} strokeWidth="4" />
      {/* Palette */}
      <g transform="rotate(-14 205 96)">
        <path
          d="M165 96 C165 68 200 58 226 66 C246 72 250 94 238 108 C228 120 214 112 206 118 C198 126 206 138 192 140 C172 142 165 122 165 96 Z"
          fill="#e8c48f" stroke="#9a6b3a" strokeWidth="3" strokeLinejoin="round"
        />
        <ellipse cx="196" cy="118" rx="6" ry="5" fill="#faf7f2" stroke="#9a6b3a" strokeWidth="2" />
        <circle cx="182" cy="86" r="8" fill="#e63946" />
        <circle cx="200" cy="76" r="8" fill="#f4c430" />
        <circle cx="220" cy="78" r="8" fill="#3ec16b" />
        <circle cx="234" cy="92" r="8" fill="#3b82f6" />
        <circle cx="216" cy="98" r="7" fill="#fb8c2a" />
      </g>
      {/* Hand over the palette's edge */}
      <ellipse cx="188" cy="116" rx="14" ry="11" fill="#e8a05a" />
      <ellipse cx="200" cy="108" rx="6" ry="9" fill="#e8a05a" transform="rotate(30 200 108)" />
      {/* Head */}
      <image href={catHead} x="38" y="6" width="104" height="112" preserveAspectRatio="xMidYMid meet" />
    </svg>
  );
}
