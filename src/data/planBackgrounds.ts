/**
 * Preset plan-cover backgrounds — simple, original CSS gradients (no photos
 * or illustrations, since no image-generation tooling is available). Styled
 * after Luma-style event covers: each one is a distinct 2–3 stop gradient
 * named for a plan-type mood, not a literal color name.
 */
export interface PlanBackground {
  id: string;
  label: string;
  /** A valid CSS `background` value (gradient). */
  css: string;
}

export const PLAN_BACKGROUNDS: PlanBackground[] = [
  { id: "dinner-candlelight", label: "Candlelight Dinner", css: "linear-gradient(135deg, #3a1c1c 0%, #7a2e2e 45%, #c9622e 100%)" },
  { id: "blush-brunch", label: "Blush Brunch", css: "linear-gradient(135deg, #ffe3ec 0%, #ffd3a5 60%, #fd9853 100%)" },
  { id: "golden-hour-drinks", label: "Golden Hour Drinks", css: "linear-gradient(135deg, #ff7e5f 0%, #feb47b 50%, #ffd580 100%)" },
  { id: "citrus-spritz", label: "Citrus Spritz", css: "linear-gradient(135deg, #f9f047 0%, #a8ff78 60%, #56ab2f 100%)" },
  { id: "midnight-neon", label: "Midnight Neon", css: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" },
  { id: "disco-fever", label: "Disco Fever", css: "linear-gradient(135deg, #ff0080 0%, #7928ca 55%, #2af598 100%)" },
  { id: "late-night-bar", label: "Late Night Bar", css: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #cc2b5e 100%)" },
  { id: "rooftop-dusk", label: "Rooftop Dusk", css: "linear-gradient(135deg, #1e3c72 0%, #7b4397 55%, #f4791f 100%)" },
  { id: "ocean-breeze", label: "Ocean Breeze", css: "linear-gradient(135deg, #005c97 0%, #363795 50%, #00c9a7 100%)" },
  { id: "sandy-shores", label: "Sandy Shores", css: "linear-gradient(135deg, #f6d365 0%, #fda085 50%, #6dd5fa 100%)" },
  { id: "sunrise-run", label: "Sunrise Run", css: "linear-gradient(135deg, #ff512f 0%, #f09819 60%, #ffe259 100%)" },
  { id: "forest-trail", label: "Forest Trail", css: "linear-gradient(135deg, #1e4d2b 0%, #4c7c3f 55%, #a8c66c 100%)" },
  { id: "court-side", label: "Court Side", css: "linear-gradient(135deg, #1a1a1a 0%, #e65c00 55%, #f9d423 100%)" },
  { id: "clay-court", label: "Clay Court", css: "linear-gradient(135deg, #a45c40 0%, #d9825a 50%, #f2c14e 100%)" },
  { id: "matchday-green", label: "Matchday Green", css: "linear-gradient(135deg, #11421d 0%, #2e7d32 55%, #a5d6a7 100%)" },
  { id: "zen-mist", label: "Zen Mist", css: "linear-gradient(135deg, #cfd9df 0%, #a8bfa1 55%, #7d9b76 100%)" },
  { id: "lavender-unwind", label: "Lavender Unwind", css: "linear-gradient(135deg, #e0c3fc 0%, #b39ddb 55%, #8c9eff 100%)" },
  { id: "cozy-coworking", label: "Cozy Co-working", css: "linear-gradient(135deg, #e8d5b7 0%, #c9a66b 55%, #8d6748 100%)" },
  { id: "arts-palette", label: "Arts & Culture", css: "linear-gradient(135deg, #f857a6 0%, #ff5858 45%, #ffcd38 100%)" },
  { id: "deep-velvet", label: "Deep Velvet", css: "linear-gradient(135deg, #2b0a3d 0%, #5e1a3d 50%, #8e2a4d 100%)" },
];
