// Reads events from the two things an organizer's website usually has: a calendar file (.ics) and the
// structured "Event" data (JSON-LD) that most event pages embed for Google. Pure functions, no network.

export interface ParsedEvent {
  uid: string;
  title: string;
  start: Date;
  end: Date | null;
  description: string;
  venue: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
  image: string | null;
}

export interface ParseOptions {
  /** IANA time zone used for times written without one. */
  tz: string;
  now: Date;
  horizonDays: number;
}

// ── time zones ──────────────────────────────────────────────────────────────

export function isValidTz(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
  );
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - utcMs;
}

/** A wall-clock time in a time zone, as the real instant. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = guess - tzOffsetMs(guess, tz);
  return new Date(guess - tzOffsetMs(first, tz));
}

function localParts(date: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date).map((x) => [x.type, x.value]),
  );
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

// ── text helpers ────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function htmlToText(input: string): string {
  return input
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

// ── calendar files (.ics) ───────────────────────────────────────────────────

interface IcsProp { name: string; params: Record<string, string>; value: string }

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function parseLine(line: string): IcsProp | null {
  const colon = (() => {
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') inQuote = !inQuote;
      else if (line[i] === ":" && !inQuote) return i;
    }
    return -1;
  })();
  if (colon < 1) return null;
  const [name, ...rawParams] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

const unescapeIcs = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");

function parseIcsDate(prop: IcsProp, fallbackTz: string): { date: Date; allDay: boolean } | null {
  const m = prop.value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined) {
    return { date: zonedToUtc(+y, +mo, +d, 12, 0, 0, fallbackTz), allDay: true };   // all-day: noon, local
  }
  if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0))), allDay: false };
  const tz = isValidTz(prop.params.TZID) ? prop.params.TZID : fallbackTz;
  return { date: zonedToUtc(+y, +mo, +d, +h, +mi, +(s ?? 0), tz), allDay: false };
}

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** The dates a repeating event falls on (simple daily, weekly and monthly rules), inside the horizon. */
function expandRule(start: Date, rule: string, tz: string, until: Date, exdates: Set<number>): Date[] {
  const r: Record<string, string> = {};
  for (const part of rule.split(";")) { const [k, v] = part.split("="); if (k && v) r[k.toUpperCase()] = v; }
  const freq = r.FREQ; const interval = Math.max(1, parseInt(r.INTERVAL ?? "1", 10) || 1);
  const count = r.COUNT ? parseInt(r.COUNT, 10) : Infinity;
  let hardUntil = until;
  if (r.UNTIL) {
    const m = r.UNTIL.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
    if (m) { const u = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 23), +(m[5] ?? 59), +(m[6] ?? 59))); if (u < hardUntil) hardUntil = u; }
  }
  const base = localParts(start, tz);
  const out: Date[] = [];
  const push = (y: number, mo: number, d: number): boolean => {
    const dt = zonedToUtc(y, mo, d, base.h, base.mi, base.s, tz);
    if (dt < start) return true;
    if (dt > hardUntil || out.length + 0 >= 40) return false;
    if (!exdates.has(dt.getTime())) out.push(dt);
    return true;
  };
  let produced = 0;
  if (freq === "DAILY") {
    for (let i = 0; produced < count && i < 400; i++) {
      const t = new Date(Date.UTC(base.y, base.mo - 1, base.d + i * interval)); produced++;
      if (!push(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())) break;
    }
  } else if (freq === "WEEKLY") {
    const days = (r.BYDAY ? r.BYDAY.split(",").map((x) => WEEKDAYS.indexOf(x.slice(-2))) : [new Date(Date.UTC(base.y, base.mo - 1, base.d)).getUTCDay()]).filter((x) => x >= 0).sort((a, b) => a - b);
    const startDow = new Date(Date.UTC(base.y, base.mo - 1, base.d)).getUTCDay();
    outer: for (let w = 0; w < 120; w++) {
      for (const dow of days) {
        const t = new Date(Date.UTC(base.y, base.mo - 1, base.d + w * 7 * interval + (dow - startDow)));
        if (t.getTime() < Date.UTC(base.y, base.mo - 1, base.d)) continue;
        if (produced >= count) break outer;
        produced++;
        if (!push(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())) break outer;
      }
    }
  } else if (freq === "MONTHLY") {
    for (let i = 0; produced < count && i < 36; i++) {
      const t = new Date(Date.UTC(base.y, base.mo - 1 + i * interval, base.d));
      if (t.getUTCDate() !== base.d) continue;                       // a month without that day
      produced++;
      if (!push(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())) break;
    }
  } else {
    push(base.y, base.mo, base.d);
  }
  return out;
}

export function parseIcs(text: string, opts: ParseOptions): ParsedEvent[] {
  const lines = unfold(text);
  const until = new Date(opts.now.getTime() + opts.horizonDays * 86400000);
  const events: ParsedEvent[] = [];
  let cur: IcsProp[] | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = []; continue; }
    if (line === "END:VEVENT" && cur) {
      const get = (n: string) => cur!.find((p) => p.name === n);
      const startProp = get("DTSTART");
      const summary = get("SUMMARY");
      const status = get("STATUS")?.value?.toUpperCase();
      cur = cur!;
      if (startProp && summary && status !== "CANCELLED") {
        const s = parseIcsDate(startProp, opts.tz);
        const eProp = get("DTEND"); const e = eProp ? parseIcsDate(eProp, opts.tz) : null;
        if (s) {
          const duration = e ? e.date.getTime() - s.date.getTime() : null;
          const uid = get("UID")?.value?.trim() || `${summary.value}-${s.date.toISOString()}`;
          const rrule = get("RRULE")?.value;
          const ex = new Set(cur.filter((p) => p.name === "EXDATE").flatMap((p) => p.value.split(",")).map((v) => parseIcsDate({ name: "EXDATE", params: cur!.find((p) => p.name === "EXDATE")?.params ?? {}, value: v }, opts.tz)).filter(Boolean).map((x) => x!.date.getTime()));
          const starts = rrule ? expandRule(s.date, rrule, opts.tz, until, ex) : [s.date];
          const loc = get("LOCATION") ? unescapeIcs(get("LOCATION")!.value).trim() : "";
          const geo = get("GEO")?.value?.split(";").map(Number);
          const desc = get("DESCRIPTION") ? unescapeIcs(get("DESCRIPTION")!.value) : "";
          const [venue, ...rest] = loc.split(",").map((x) => x.trim()).filter(Boolean);
          for (const st of starts) {
            if (st < opts.now || st > until) continue;
            events.push({
              uid: rrule ? `${uid}@${st.toISOString()}` : uid,
              title: clip(unescapeIcs(summary.value).trim(), 120),
              start: st,
              end: duration && duration > 0 ? new Date(st.getTime() + duration) : null,
              description: clip(htmlToText(desc), 2000),
              venue: venue ?? null,
              address: rest.length ? rest.join(", ") : (loc || null),
              lat: geo && geo.length === 2 && Number.isFinite(geo[0]) ? geo[0] : null,
              lng: geo && geo.length === 2 && Number.isFinite(geo[1]) ? geo[1] : null,
              url: get("URL")?.value?.trim() || null,
              image: null,
            });
          }
        }
      }
      cur = null; continue;
    }
    if (cur) { const p = parseLine(line); if (p) cur.push(p); }
  }
  return events;
}

// ── event pages (JSON-LD) ───────────────────────────────────────────────────

function resolveUrl(u: unknown, base: string): string | null {
  if (typeof u !== "string" || !u.trim()) return null;
  try { return new URL(u.trim(), base).toString(); } catch { return null; }
}

function firstImage(img: unknown, base: string): string | null {
  if (!img) return null;
  if (typeof img === "string") return resolveUrl(img, base);
  if (Array.isArray(img)) return firstImage(img[0], base);
  if (typeof img === "object") return resolveUrl((img as { url?: string }).url, base);
  return null;
}

function parseLdDate(value: unknown, tz: string): Date | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split("-").map(Number); return zonedToUtc(y, m, d, 12, 0, 0, tz); }
  const local = v.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (local) return zonedToUtc(+local[1], +local[2], +local[3], +local[4], +local[5], +(local[6] ?? 0), tz);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function collectEventNodes(node: unknown, out: Record<string, unknown>[], depth = 0) {
  if (!node || depth > 6) return;
  if (Array.isArray(node)) { node.forEach((n) => collectEventNodes(n, out, depth + 1)); return; }
  if (typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  const types = ([] as unknown[]).concat(o["@type"] ?? []).map(String);
  if (types.some((t) => /Event$/.test(t))) out.push(o);
  for (const key of ["@graph", "itemListElement", "item", "event", "subEvent", "events"]) if (o[key]) collectEventNodes(o[key], out, depth + 1);
}

export function parseJsonLd(html: string, baseUrl: string, opts: ParseOptions): ParsedEvent[] {
  const until = new Date(opts.now.getTime() + opts.horizonDays * 86400000);
  const nodes: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const raw = m[1].replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "").trim();
    try { collectEventNodes(JSON.parse(raw), nodes); } catch { /* a malformed block is skipped */ }
  }
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    const name = typeof n.name === "string" ? htmlToText(n.name) : "";
    const start = parseLdDate(n.startDate, opts.tz);
    const status = String(n.eventStatus ?? "");
    if (!name || !start || /Cancel/i.test(status)) continue;
    if (start < opts.now || start > until) continue;
    const offers = ([] as unknown[]).concat(n.offers ?? [])[0] as { url?: string } | undefined;
    const url = resolveUrl(n.url, baseUrl) ?? resolveUrl(offers?.url, baseUrl);
    const uid = url ?? `${name}-${start.toISOString()}`;
    const key = `${uid}|${start.toISOString()}`;
    if (seen.has(key)) continue; seen.add(key);
    const end = parseLdDate(n.endDate, opts.tz);
    const loc = ([] as unknown[]).concat(n.location ?? [])[0];
    let venue: string | null = null, address: string | null = null, lat: number | null = null, lng: number | null = null;
    if (typeof loc === "string") { venue = loc; }
    else if (loc && typeof loc === "object") {
      const l = loc as { name?: string; address?: unknown; geo?: { latitude?: number | string; longitude?: number | string } };
      venue = typeof l.name === "string" ? l.name : null;
      if (typeof l.address === "string") address = l.address;
      else if (l.address && typeof l.address === "object") {
        const a = l.address as Record<string, string>;
        address = [a.streetAddress, a.addressLocality, a.addressRegion].filter(Boolean).join(", ") || null;
      }
      const la = Number(l.geo?.latitude), lo = Number(l.geo?.longitude);
      if (Number.isFinite(la) && Number.isFinite(lo) && (la !== 0 || lo !== 0)) { lat = la; lng = lo; }
    }
    events.push({
      uid, title: clip(name, 120), start, end: end && end > start ? end : null,
      description: clip(htmlToText(typeof n.description === "string" ? n.description : ""), 2000),
      venue, address, lat, lng, url, image: firstImage(n.image, baseUrl),
    });
  }
  return events;
}

/** `<link rel="alternate" type="text/calendar">` and similar pointers to a calendar file. */
export function findCalendarLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (/type=["']text\/calendar["']/i.test(tag) || /\.ics(\?|["'])/i.test(tag)) {
      const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
      const abs = resolveUrl(href, baseUrl); if (abs) links.push(abs);
    }
  }
  for (const m of html.matchAll(/href=["']([^"']+\.ics(?:\?[^"']*)?)["']/gi)) {
    const abs = resolveUrl(m[1], baseUrl); if (abs) links.push(abs);
  }
  return Array.from(new Set(links)).slice(0, 3);
}
