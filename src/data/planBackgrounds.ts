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
  /** Path (under /plan-backgrounds/) to a photo or illustration for this mood. Takes priority over `css` when set. */
  image?: string;
  /** CSS background-position for `image` — where the subject sits (a skyline's tallest tower, a dome), so a
   *  tall portrait crop keeps it in frame instead of cutting through the middle. Defaults to centre. */
  focus?: string;
  /** Where a photo came from — shown on the Photo credits page. CC BY / CC BY-SA licenses require it. */
  credit?: { author: string; license: string; source: string };
  /** Hidden from the picker but still renders for plans that already picked it — set on the
   *  hand-drawn illustrations that real city photos replaced, so those plans don't lose their background. */
  retired?: boolean;
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
      backgroundPosition: bg.focus ?? "center",
      backgroundColor: "#fff",
    };
  }
  return getAnimatedGradientStyle(bg.css);
}

export const PLAN_BACKGROUNDS: PlanBackground[] = [
  // ── Original 20 palettes — renamed, Disco Fever/Midnight Neon retired ──
  { id: "ember-supper", label: "Ember Supper", css: "linear-gradient(135deg, #3a1c1c 0%, #7a2e2e 45%, #c9622e 100%)" },
  { id: "sunday-brunch", label: "Sunday Brunch", css: "linear-gradient(135deg, #ffe3ec 0%, #ffd3a5 60%, #fd9853 100%)" },
  { id: "aperitivo-hour", label: "Aperitivo Hour", css: "linear-gradient(135deg, #ff7e5f 0%, #feb47b 50%, #ffd580 100%)" },
  { id: "lemon-terrace", label: "Lemon Terrace", css: "linear-gradient(135deg, #f9f047 0%, #a8ff78 60%, #56ab2f 100%)" },
  { id: "last-call", label: "Last Call", css: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #cc2b5e 100%)" },
  { id: "skyline-sunset", label: "Skyline Sunset", css: "linear-gradient(135deg, #1e3c72 0%, #7b4397 55%, #f4791f 100%)" },
  { id: "coastal-breeze", label: "Coastal Breeze", css: "linear-gradient(135deg, #005c97 0%, #363795 50%, #00c9a7 100%)" },
  { id: "seaside-escape", label: "Seaside Escape", css: "linear-gradient(135deg, #f6d365 0%, #fda085 50%, #6dd5fa 100%)" },
  { id: "morning-jog", label: "Morning Jog", css: "linear-gradient(135deg, #ff512f 0%, #f09819 60%, #ffe259 100%)" },
  { id: "woodland-hike", label: "Woodland Hike", css: "linear-gradient(135deg, #1e4d2b 0%, #4c7c3f 55%, #a8c66c 100%)" },
  { id: "game-day", label: "Game Day", css: "linear-gradient(135deg, #1a1a1a 0%, #e65c00 55%, #f9d423 100%)" },
  { id: "tennis-match", label: "Tennis Match", css: "linear-gradient(135deg, #a45c40 0%, #d9825a 50%, #f2c14e 100%)" },
  { id: "pitch-side", label: "Pitch Side", css: "linear-gradient(135deg, #11421d 0%, #2e7d32 55%, #a5d6a7 100%)" },
  { id: "morning-meditation", label: "Morning Meditation", css: "linear-gradient(135deg, #cfd9df 0%, #a8bfa1 55%, #7d9b76 100%)" },
  { id: "evening-unwind", label: "Evening Unwind", css: "linear-gradient(135deg, #e0c3fc 0%, #b39ddb 55%, #8c9eff 100%)" },
  { id: "study-session", label: "Study Session", css: "linear-gradient(135deg, #e8d5b7 0%, #c9a66b 55%, #8d6748 100%)" },
  { id: "creative-studio", label: "Creative Studio", css: "linear-gradient(135deg, #f857a6 0%, #ff5858 45%, #ffcd38 100%)" },
  { id: "velvet-lounge", label: "Velvet Lounge", css: "linear-gradient(135deg, #2b0a3d 0%, #5e1a3d 50%, #8e2a4d 100%)" },
  // ── Real city photos — these replaced the hand-drawn illustrations below ──
  { id: "city-san-francisco", label: "San Francisco", css: "linear-gradient(135deg, #3a3d52 0%, #7a5a3a 55%, #d99a3a 100%)", image: "/plan-backgrounds/city-san-francisco.webp", focus: "28% 50%" },
  { id: "city-dallas", label: "Dallas", css: "linear-gradient(135deg, #1e5fa8 0%, #6aa8e0 55%, #e8f1fa 100%)", image: "/plan-backgrounds/city-dallas.webp", focus: "50% 50%" },
  { id: "city-atlanta", label: "Atlanta", css: "linear-gradient(135deg, #1b2a4a 0%, #6b5b7b 50%, #f0a050 100%)", image: "/plan-backgrounds/city-atlanta.webp", focus: "50% 50%" },
  { id: "city-washington-dc", label: "Washington, DC", css: "linear-gradient(135deg, #b8bcc4 0%, #d9dce0 55%, #8a8f98 100%)", image: "/plan-backgrounds/city-washington-dc.webp", focus: "58% 50%" },
  { id: "city-medellin", label: "Medellín", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-medellin.webp", focus: "62% 50%", credit: { author: "User: (WT-shared) CONOCER at wts wikivoyage", license: "Public domain", source: "https://commons.wikimedia.org/wiki/File:Valley_of_Medell%C3%ADn-_skyline.jpg" } },
  { id: "city-new-york-city", label: "New York City", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-new-york-city.webp", focus: "52% 40%", credit: { author: "Dllu", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu.jpg" } },
  { id: "city-lisbon", label: "Lisbon", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-lisbon.webp", focus: "50% 50%", credit: { author: "NorbertNagel", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:View_of_Lisbon_and_Tejo_-_01.jpg" } },
  { id: "city-los-angeles", label: "Los Angeles", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-los-angeles.webp", focus: "48% 45%", credit: { author: "usicegov", license: "Public domain", source: "https://commons.wikimedia.org/wiki/File:Aerial_Photos_of_Los_Angeles_for_SB56_(52272300091).jpg" } },
  { id: "city-austin", label: "Austin", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-austin.webp", focus: "50% 50%", credit: { author: "Quintin Soloviev", license: "CC BY 4.0", source: "https://commons.wikimedia.org/wiki/File:Austin,_TX_skyline_2026.jpg" } },
  { id: "city-london", label: "London", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-london.webp", focus: "50% 50%", credit: { author: "David Illif with image-alignment and Photoshoping by User:Colin and Kim Hansen", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:City_of_London_skyline_from_London_City_Hall_-_Oct_2008_-_Aligned.jpg" } },
  { id: "city-guadalajara", label: "Guadalajara", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-guadalajara.webp", focus: "50% 50%", credit: { author: "Sergio Estrada Flores", license: "CC BY 4.0", source: "https://commons.wikimedia.org/wiki/File:Catedral_de_Guadalajara,_Jalisco.jpg" } },
  { id: "city-chicago", label: "Chicago", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-chicago.webp", focus: "50% 50%", credit: { author: "Diego Delso", license: "CC BY-SA 3.0", source: "https://commons.wikimedia.org/wiki/File:Skyline_de_Chicago_desde_el_centro,_Illinois,_Estados_Unidos,_2012-10-20,_DD_06.jpg" } },
  { id: "city-toronto", label: "Toronto", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-toronto.webp", focus: "50% 50%", credit: { author: "Mitul Shah", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Toronto_skyline_at_dusk.jpg" } },
  { id: "city-vancouver", label: "Vancouver", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-vancouver.webp", focus: "50% 50%", credit: { author: "Quintin Soloviev", license: "CC BY 4.0", source: "https://commons.wikimedia.org/wiki/File:Skyline_of_Vancouver,_BC.jpg" } },
  { id: "city-mexico-city", label: "Mexico City", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-mexico-city.webp", focus: "50% 50%", credit: { author: "Bohao Zhao", license: "CC BY 3.0", source: "https://commons.wikimedia.org/wiki/File:Panorama_de_la_ciudad_de_M%C3%A9xico_-_panoramio.jpg" } },
  { id: "city-miami", label: "Miami", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-miami.webp", focus: "50% 50%", credit: { author: "Wilfredor", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Miami,_Florida_skyline.jpg" } },
  { id: "city-bogota", label: "Bogotá", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-bogota.webp", focus: "45% 50%", credit: { author: "ProtoplasmaKid", license: "CC BY 4.0", source: "https://commons.wikimedia.org/wiki/File:Vista_a%C3%A9rea_de_Bogot%C3%A1_al_sur_desde_la_Carrera_7.jpg" } },
  { id: "city-cartagena", label: "Cartagena", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-cartagena.webp", focus: "50% 50%", credit: { author: "Dr. Thomas Liptak", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Colombia,_Cartagena,_Castillogrande_Lighthouse_and_Bocagrande%27s_Skyline.jpg" } },
  { id: "city-buenos-aires", label: "Buenos Aires", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-buenos-aires.webp", focus: "50% 50%", credit: { author: "Michelle Maria", license: "CC BY 3.0", source: "https://commons.wikimedia.org/wiki/File:Buenos_Aires,_Argentina_Skyline_-_panoramio_(1).jpg" } },
  { id: "city-paris", label: "Paris", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-paris.webp", focus: "55% 50%", credit: { author: "Ed Ogle", license: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:Paris_panorama_from_Arc_de_Triomphe_de_l%27%C3%89toile,_10_May_2013.jpg" } },
  { id: "city-berlin", label: "Berlin", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-berlin.webp", focus: "40% 50%", credit: { author: "abbilder", license: "CC BY 2.0", source: "https://commons.wikimedia.org/wiki/File:Skyline_Berlin.jpg" } },
  { id: "city-madrid", label: "Madrid", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-madrid.webp", focus: "50% 50%", credit: { author: "Diego Delso", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Edificio_Metr%C3%B3polis,_calle_de_Alcal%C3%A1,_Madrid,_Espa%C3%B1a,_2017-05-18,_DD_08.jpg" } },
  { id: "city-barcelona", label: "Barcelona", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-barcelona.webp", focus: "50% 50%", credit: { author: "Enes royalfound", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Cityscape_of_Barcelona_city_beach_(Unsplash).jpg" } },
  { id: "city-porto", label: "Porto", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-porto.webp", focus: "50% 50%", credit: { author: "lumoplank", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Porto_Cityscapes_-_PortoCityscapes5675.jpg" } },
  { id: "city-dubai", label: "Dubai", css: "linear-gradient(135deg, #3a2a3a 0%, #b5654a 55%, #f0b070 100%)", image: "/plan-backgrounds/city-dubai.webp", focus: "35% 50%", credit: { author: "Robert Bock", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Dubai_skyline_unsplash.jpg" } },
  // ── Retired illustrated presets — hidden from the picker, kept so existing plans still render ──
  { id: "farmers-market", label: "Farmers Market", css: "linear-gradient(135deg, #a8e063 0%, #f9d423 55%, #ff8008 100%)", image: "/plan-backgrounds/farmers-market.webp", retired: true },
  { id: "sunrise-yoga", label: "Sunrise Yoga", css: "linear-gradient(135deg, #fddb92 0%, #f7a1a1 50%, #c3a6e0 100%)", image: "/plan-backgrounds/sunrise-yoga.png", retired: true },
  { id: "beach-bonfire", label: "Beach Bonfire", css: "linear-gradient(135deg, #1e3c72 0%, #ff7e5f 60%, #feb47b 100%)", image: "/plan-backgrounds/beach-bonfire.webp", retired: true },
  { id: "snow-day", label: "Snow Day", css: "linear-gradient(135deg, #e0eafc 0%, #cfdef3 50%, #a1c4fd 100%)", image: "/plan-backgrounds/snow-day.webp", retired: true },
  { id: "autumn-harvest", label: "Autumn Harvest", css: "linear-gradient(135deg, #7b3f00 0%, #c1440e 55%, #e3a018 100%)", image: "/plan-backgrounds/autumn-harvest.webp", retired: true },
  { id: "cherry-blossom", label: "Cherry Blossom", css: "linear-gradient(135deg, #ffe4e9 0%, #ffb7c5 55%, #ff8fab 100%)", image: "/plan-backgrounds/cherry-blossom.webp", retired: true },
  { id: "rainy-day-cozy", label: "Rainy Day Cozy", css: "linear-gradient(135deg, #3a3d40 0%, #5c6570 50%, #8b98a5 100%)", image: "/plan-backgrounds/rainy-day-cozy.png", retired: true },
  { id: "street-food-night", label: "Street Food Night", css: "linear-gradient(135deg, #d7263d 0%, #f46036 55%, #f9c80e 100%)", image: "/plan-backgrounds/street-food-night.webp", retired: true },
  { id: "rooftop-cinema", label: "Rooftop Cinema", css: "linear-gradient(135deg, #14142b 0%, #4b3f72 55%, #e07a5f 100%)", image: "/plan-backgrounds/rooftop-cinema.webp", retired: true },
  { id: "trivia-night", label: "Trivia Night", css: "linear-gradient(135deg, #0b1d3a 0%, #b3202f 55%, #f4c430 100%)", image: "/plan-backgrounds/trivia-night.png", retired: true },
  { id: "ramen-night", label: "Ramen Night", css: "linear-gradient(135deg, #6e0d0d 0%, #c1272d 55%, #ff8c42 100%)", image: "/plan-backgrounds/ramen-night.png", retired: true },
  { id: "taco-tuesday", label: "Taco Tuesday", css: "linear-gradient(135deg, #d7263d 0%, #f46036 50%, #a4d65e 100%)", image: "/plan-backgrounds/taco-tuesday.png", retired: true },
  { id: "speakeasy-lounge", label: "Speakeasy Lounge", css: "linear-gradient(135deg, #1a0000 0%, #4b0f1a 55%, #b8860b 100%)", image: "/plan-backgrounds/speakeasy-lounge.webp", retired: true },
  { id: "retro-arcade", label: "Retro Arcade", css: "linear-gradient(135deg, #ff00cc 0%, #7b2ff7 50%, #00c3ff 100%)", image: "/plan-backgrounds/retro-arcade.png", retired: true },
];
