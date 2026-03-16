export const DAILY_THEMES = [
  { name: "violet", primary: "#7C3AED", gradient: "from-violet-600 to-purple-500" },
  { name: "amber", primary: "#D97706", gradient: "from-amber-500 to-yellow-400" },
  { name: "rose", primary: "#E11D48", gradient: "from-rose-600 to-pink-500" },
  { name: "cyan", primary: "#0891B2", gradient: "from-cyan-600 to-teal-500" },
  { name: "emerald", primary: "#059669", gradient: "from-emerald-600 to-green-500" },
  { name: "orange", primary: "#EA580C", gradient: "from-orange-600 to-amber-500" },
  { name: "indigo", primary: "#4F46E5", gradient: "from-indigo-600 to-violet-500" },
] as const;

export type DailyTheme = (typeof DAILY_THEMES)[number];

export function getTodaysTheme(): DailyTheme {
  const dayIndex = Math.floor(Date.now() / 86400000) % DAILY_THEMES.length;
  return DAILY_THEMES[dayIndex];
}

export function hexToHslCssVars(hex: string): string | null {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;

  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);
  return `${h} ${sPct}% ${lPct}%`;
}

