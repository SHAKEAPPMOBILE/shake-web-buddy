import type { CSSProperties } from "react";

/**
 * Preset plan-cover backgrounds — a distinct mood per plan type, Luma-style.
 * Most are still CSS gradients (there's no image-generation tooling in this
 * environment), but a growing number now carry a hand-drawn illustration
 * instead — `image`, when set, always wins over `css`. Drop new illustration
 * files in public/plan-backgrounds/ and point `image` at them; `css` stays
 * around as the pre-illustration look for everything not yet replaced.
 */
export interface PlanBackground {
  id: string;
  label: string;
  /** A valid CSS `background` value (gradient) — the look before/without an illustration. */
  css: string;
  /** Path (under /plan-backgrounds/) to a hand-drawn illustration for this mood. Takes priority over `css` when set. */
  image?: string;
}

/** Renders a gradient preset with a slow, ambient drift instead of sitting
 *  flat — reuses the app's existing `gradientShift` keyframe (see
 *  index.css), just at a much gentler pace than its usual CTA-button use. */
function getAnimatedGradientStyle(css: string): CSSProperties {
  return {
    background: css,
    backgroundSize: "200% 200%",
    animation: "gradientShift 14s ease infinite",
  };
}

/** The style to render for a given preset — an illustration (static, plain
 *  cover image) when one exists, otherwise the animated gradient. */
export function getBackgroundStyle(bg: PlanBackground): CSSProperties {
  if (bg.image) {
    return {
      backgroundImage: `url(${bg.image})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundColor: "#fff",
    };
  }
  return getAnimatedGradientStyle(bg.css);
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
  { id: "birthday-confetti", label: "Birthday Confetti", css: "linear-gradient(135deg, #ff6fa5 0%, #ff9a76 55%, #ffd76e 100%)" },
  { id: "movie-night", label: "Movie Night", css: "linear-gradient(135deg, #0a0a0a 0%, #3d0c11 55%, #8e0e26 100%)" },
  { id: "game-night", label: "Game Night", css: "linear-gradient(135deg, #1a0b2e 0%, #7b2ff7 50%, #00eaff 100%)" },
  { id: "karaoke-night", label: "Karaoke Night", css: "linear-gradient(135deg, #2b0a3d 0%, #c9184a 55%, #ff5cad 100%)" },
  { id: "live-music", label: "Live Music", css: "linear-gradient(135deg, #1e1b4b 0%, #6d28d9 50%, #c026d3 100%)" },
  { id: "picnic-day", label: "Picnic Day", css: "linear-gradient(135deg, #f6fdc3 0%, #d4fc79 55%, #96e6a1 100%)" },
  { id: "pool-day", label: "Pool Day", css: "linear-gradient(135deg, #00c6ff 0%, #72ffe0 50%, #ffe29f 100%)" },
  { id: "fireside-chill", label: "Fireside Chill", css: "linear-gradient(135deg, #1a1a1a 0%, #6b2e0d 55%, #ff8c42 100%)" },
  { id: "holiday-cheer", label: "Holiday Cheer", css: "linear-gradient(135deg, #b91c1c 0%, #d4af37 50%, #166534 100%)" },
  { id: "bonfire-night", label: "Bonfire Night", css: "linear-gradient(135deg, #0f0c29 0%, #302b63 45%, #ff6a00 100%)" },
  { id: "nye-countdown", label: "NYE Countdown", css: "linear-gradient(135deg, #000000 0%, #434343 45%, #ffd700 100%)" },
  { id: "wine-tasting", label: "Wine Tasting", css: "linear-gradient(135deg, #3b0d11 0%, #7a1f2b 55%, #c9a15a 100%)" },
  { id: "coffee-catchup", label: "Coffee Catch-up", css: "linear-gradient(135deg, #6f4e37 0%, #b08968 55%, #ede0d4 100%)" },
  { id: "gallery-visit", label: "Gallery Visit", css: "linear-gradient(135deg, #3c3c3c 0%, #8e8e8e 55%, #e8e2d5 100%)" },
  { id: "road-trip", label: "Road Trip", css: "linear-gradient(135deg, #4a3728 0%, #c68b59 55%, #f4b183 100%)" },
  { id: "networking-mixer", label: "Networking Mixer", css: "linear-gradient(135deg, #1e293b 0%, #334155 55%, #64748b 100%)" },
  { id: "farmers-market", label: "Farmers Market", css: "linear-gradient(135deg, #a8e063 0%, #f9d423 55%, #ff8008 100%)" },
  { id: "sunrise-yoga", label: "Sunrise Yoga", css: "linear-gradient(135deg, #fddb92 0%, #f7a1a1 50%, #c3a6e0 100%)" },
  { id: "spa-day", label: "Spa Day", css: "linear-gradient(135deg, #f9f5f0 0%, #f3d9d9 55%, #e8c5c5 100%)" },
  { id: "beach-bonfire", label: "Beach Bonfire", css: "linear-gradient(135deg, #1e3c72 0%, #ff7e5f 60%, #feb47b 100%)" },
  { id: "snow-day", label: "Snow Day", css: "linear-gradient(135deg, #e0eafc 0%, #cfdef3 50%, #a1c4fd 100%)" },
  { id: "autumn-harvest", label: "Autumn Harvest", css: "linear-gradient(135deg, #7b3f00 0%, #c1440e 55%, #e3a018 100%)" },
  { id: "cherry-blossom", label: "Cherry Blossom", css: "linear-gradient(135deg, #ffe4e9 0%, #ffb7c5 55%, #ff8fab 100%)" },
  { id: "rainy-day-cozy", label: "Rainy Day Cozy", css: "linear-gradient(135deg, #3a3d40 0%, #5c6570 50%, #8b98a5 100%)" },
  { id: "street-food-night", label: "Street Food Night", css: "linear-gradient(135deg, #d7263d 0%, #f46036 55%, #f9c80e 100%)" },
  { id: "rooftop-cinema", label: "Rooftop Cinema", css: "linear-gradient(135deg, #14142b 0%, #4b3f72 55%, #e07a5f 100%)", image: "/plan-backgrounds/rooftop-cinema.webp" },
  { id: "trivia-night", label: "Trivia Night", css: "linear-gradient(135deg, #0b1d3a 0%, #b3202f 55%, #f4c430 100%)", image: "/plan-backgrounds/trivia-night.png" },
  { id: "paint-night", label: "Paint Night", css: "linear-gradient(135deg, #ff3cac 0%, #784ba0 50%, #2b86c5 100%)" },
  { id: "ramen-night", label: "Ramen Night", css: "linear-gradient(135deg, #6e0d0d 0%, #c1272d 55%, #ff8c42 100%)", image: "/plan-backgrounds/ramen-night.png" },
  { id: "taco-tuesday", label: "Taco Tuesday", css: "linear-gradient(135deg, #d7263d 0%, #f46036 50%, #a4d65e 100%)" },
  { id: "speakeasy-lounge", label: "Speakeasy Lounge", css: "linear-gradient(135deg, #1a0000 0%, #4b0f1a 55%, #b8860b 100%)", image: "/plan-backgrounds/speakeasy-lounge.webp" },
  { id: "retro-arcade", label: "Retro Arcade", css: "linear-gradient(135deg, #ff00cc 0%, #7b2ff7 50%, #00c3ff 100%)" },
];
