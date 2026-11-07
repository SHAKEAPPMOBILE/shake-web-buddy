import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { findCalendarLinks, isValidTz, parseIcs, parseJsonLd, type ParsedEvent } from "../_shared/event-sources.ts";

// Connect a website or calendar: read its upcoming events and mirror them as plans that link back to the
// organizer's own registration page. Three ways in:
//   • a signed-in person   { url, city, tz }  or  { source_id }   (connect, or "sync now")
//   • the daily job        { all: true }       with the service-role key
//   • a dry run            { url, user_id, dry_run: true }  with the service-role key (nothing is written)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_BYTES = 2_000_000;
const MAX_EVENTS = 40;
const HORIZON_DAYS = 180;
const MAX_SOURCES_PER_USER = 5;
const RESYNC_COOLDOWN_MS = 60_000;
const USER_AGENT = "SHAKE-EventSync/1.0 (+https://www.shakeapp.today)";
const PROBE_PATHS = ["/events.ics", "/calendar.ics", "/?ical=1", "/events/?ical=1"];

class SyncError extends Error {
  constructor(public code: string, message?: string) { super(message ?? code); }
}

// ── safe fetching: public https hosts only ─────────────────────────────────

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:127.") || l.startsWith("::ffff:10.") || l.startsWith("::ffff:192.168.");
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n))) return true;
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) || (p[0] === 169 && p[1] === 254) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224;
}

async function assertPublicHost(u: URL) {
  if (u.protocol !== "https:") throw new SyncError("blocked_url", "Only https addresses can be connected.");
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) throw new SyncError("blocked_url");
  if (/^[\d.]+$/.test(host) || host.includes(":")) throw new SyncError("blocked_url");
  const addrs: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try { addrs.push(...await Deno.resolveDns(host, type)); } catch { /* no records of this type */ }
  }
  if (addrs.length === 0) throw new SyncError("unreachable");
  if (addrs.some(isPrivateIp)) throw new SyncError("blocked_url");
}

async function safeFetch(url: string): Promise<{ text: string; contentType: string; finalUrl: string }> {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    const u = new URL(current);
    await assertPublicHost(u);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(u, { redirect: "manual", signal: ctrl.signal, headers: { "User-Agent": USER_AGENT, Accept: "text/calendar, text/html, application/xhtml+xml, */*;q=0.5" } });
    } catch {
      clearTimeout(timer);
      throw new SyncError("unreachable");
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      clearTimeout(timer);
      current = new URL(res.headers.get("location")!, u).toString();
      continue;
    }
    if (!res.ok) { clearTimeout(timer); throw new SyncError("unreachable", `HTTP ${res.status}`); }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = []; let total = 0;
    try {
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length; chunks.push(value);
        if (total > MAX_BYTES) { await reader.cancel(); break; }
      }
    } finally { clearTimeout(timer); }
    const merged = new Uint8Array(Math.min(total, MAX_BYTES));
    let off = 0; for (const c of chunks) { const part = c.subarray(0, merged.length - off); merged.set(part, off); off += part.length; if (off >= merged.length) break; }
    return { text: new TextDecoder().decode(merged), contentType: res.headers.get("content-type") ?? "", finalUrl: current };
  }
  throw new SyncError("unreachable", "Too many redirects");
}

const looksLikeIcs = (text: string, contentType: string) => /text\/calendar/i.test(contentType) || text.trimStart().startsWith("BEGIN:VCALENDAR");

async function loadEvents(url: string, tz: string): Promise<{ events: ParsedEvent[]; kind: "ics" | "jsonld"; pageUrl: string }> {
  const opts = { tz, now: new Date(), horizonDays: HORIZON_DAYS };
  const first = await safeFetch(url);
  if (looksLikeIcs(first.text, first.contentType)) {
    return { events: parseIcs(first.text, opts), kind: "ics", pageUrl: first.finalUrl };
  }
  const fromPage = parseJsonLd(first.text, first.finalUrl, opts);
  if (fromPage.length > 0) return { events: fromPage, kind: "jsonld", pageUrl: first.finalUrl };

  // No structured data on the page: look for a calendar file the site offers.
  const origin = new URL(first.finalUrl).origin;
  const candidates = [...findCalendarLinks(first.text, first.finalUrl), ...PROBE_PATHS.map((p) => origin + p)];
  for (const candidate of Array.from(new Set(candidates)).slice(0, 6)) {
    try {
      const res = await safeFetch(candidate);
      if (!looksLikeIcs(res.text, res.contentType)) continue;
      const events = parseIcs(res.text, opts);
      if (events.length > 0) return { events, kind: "ics", pageUrl: first.finalUrl };
    } catch { /* try the next one */ }
  }
  return { events: [], kind: "jsonld", pageUrl: first.finalUrl };
}

// ── syncing one source ─────────────────────────────────────────────────────

interface SourceRow { id: string; user_id: string; url: string; city: string | null; tz: string | null }

// deno-lint-ignore no-explicit-any
async function syncSource(supabase: any, source: SourceRow, dryRun = false) {
  const tz = isValidTz(source.tz) ? source.tz! : "UTC";
  if (!source.city && !dryRun) throw new SyncError("city_required");
  const { events, kind, pageUrl } = await loadEvents(source.url, tz);
  const list = events.sort((a, b) => a.start.getTime() - b.start.getTime()).slice(0, MAX_EVENTS);

  if (dryRun) {
    return { kind, found: list.length, events: list.map((e) => ({ uid: e.uid, title: e.title, start: e.start.toISOString(), venue: e.venue, address: e.address, url: e.url, image: e.image })) };
  }
  if (list.length === 0) {
    await supabase.from("plan_sources").update({ last_synced_at: new Date().toISOString(), last_status: "no_events", last_count: 0 }).eq("id", source.id);
    throw new SyncError("no_events");
  }

  const httpsOr = (u: string | null) => (u && /^https:\/\//i.test(u) ? u : null);
  const rows = list.map((e) => ({
    user_id: source.user_id,
    source_id: source.id,
    external_uid: e.uid.slice(0, 300),
    external_url: httpsOr(e.url) ?? httpsOr(pageUrl) ?? source.url,
    activity_type: "general",
    city: source.city,
    scheduled_for: e.start.toISOString(),
    note: e.title,
    description: e.description || null,
    venue_name: e.venue,
    venue_address: e.address,
    venue_lat: e.lat,
    venue_lng: e.lng,
    promo_image_url: httpsOr(e.image),
    audience: "everyone",
    is_active: true,
    is_quick_post: false,
    requires_ticket: false,
  }));

  const { data: existing } = await supabase.from("user_activities").select("external_uid").eq("source_id", source.id);
  const known = new Set<string>((existing ?? []).map((r: { external_uid: string }) => r.external_uid));
  const { error } = await supabase.from("user_activities").upsert(rows, { onConflict: "source_id,external_uid" });
  if (error) { console.error("[sync-event-source] upsert failed:", error); throw new SyncError("save_failed"); }

  // Upcoming events that vanished from the site are cancelled here too.
  const keep = rows.map((r) => r.external_uid);
  const { data: gone } = await supabase.from("user_activities").delete()
    .eq("source_id", source.id).gt("scheduled_for", new Date().toISOString())
    .not("external_uid", "in", `(${keep.map((k) => `"${k.replace(/"/g, '\\"')}"`).join(",")})`).select("id");

  const imported = rows.filter((r) => !known.has(r.external_uid)).length;
  await supabase.from("plan_sources").update({ kind, last_synced_at: new Date().toISOString(), last_status: "ok", last_count: rows.length }).eq("id", source.id);
  return { kind, imported, updated: rows.length - imported, removed: gone?.length ?? 0, titles: list.slice(0, 3).map((e) => e.title), total: rows.length };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const isService = token === serviceKey;
    const body = await req.json().catch(() => ({}));

    // Daily job: refresh every active source.
    if (isService && body?.all) {
      const { data: sources } = await supabase.from("plan_sources").select("id, user_id, url, city, tz").eq("active", true).limit(200);
      let ok = 0, failed = 0;
      for (const s of sources ?? []) {
        try { await syncSource(supabase, s as SourceRow); ok++; } catch (e) { failed++; console.warn("[sync-event-source] daily sync failed", s.id, (e as Error).message); }
        await new Promise((r) => setTimeout(r, 400));
      }
      return json({ ok: true, synced: ok, failed });
    }

    // Who is asking?
    let userId: string | null = null;
    if (isService) userId = body?.user_id ?? null;
    else {
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id ?? null;
    }
    if (!userId) return json({ ok: false, error: "unauthorized" }, 401);

    const normalize = (raw: unknown): string => {
      let u = String(raw ?? "").trim();
      if (/^webcal:\/\//i.test(u)) u = "https://" + u.slice(9);
      if (u && !/^[a-z]+:\/\//i.test(u)) u = "https://" + u;
      try { const parsed = new URL(u); if (parsed.protocol === "http:") parsed.protocol = "https:"; return parsed.toString(); } catch { throw new SyncError("bad_url"); }
    };

    // Dry run (service role only): show what would be imported.
    if (isService && body?.dry_run) {
      const result = await syncSource(supabase, { id: "dry", user_id: userId, url: normalize(body.url), city: body.city ?? "Dry run", tz: body.tz ?? "UTC" }, true);
      return json({ ok: true, dry_run: true, ...result });
    }

    let source: SourceRow;
    if (body?.source_id) {
      const { data } = await supabase.from("plan_sources").select("id, user_id, url, city, tz, last_synced_at").eq("id", body.source_id).eq("user_id", userId).maybeSingle();
      if (!data) return json({ ok: false, error: "not_found" }, 404);
      if (data.last_synced_at && Date.now() - new Date(data.last_synced_at).getTime() < RESYNC_COOLDOWN_MS) return json({ ok: false, error: "too_soon" });
      source = data as SourceRow;
    } else {
      const url = normalize(body?.url);
      const city = typeof body?.city === "string" ? body.city.trim().slice(0, 80) : "";
      const tz = isValidTz(body?.tz) ? body.tz : "UTC";
      if (!city) return json({ ok: false, error: "city_required" });
      await assertPublicHost(new URL(url));
      const { data: mine } = await supabase.from("plan_sources").select("id, url").eq("user_id", userId);
      const already = (mine ?? []).find((s: { url: string }) => s.url === url);
      if (!already && (mine ?? []).length >= MAX_SOURCES_PER_USER) return json({ ok: false, error: "too_many_sources" });
      const { data, error } = await supabase.from("plan_sources")
        .upsert({ user_id: userId, url, city, tz, active: true }, { onConflict: "user_id,url" })
        .select("id, user_id, url, city, tz").single();
      if (error || !data) { console.error("[sync-event-source] source save failed:", error); return json({ ok: false, error: "save_failed" }); }
      source = data as SourceRow;
    }

    try {
      const result = await syncSource(supabase, source);
      return json({ ok: true, source_id: source.id, ...result });
    } catch (e) {
      if (e instanceof SyncError) {
        // A site that gave us nothing isn't kept as a connected source.
        if (!body?.source_id && ["no_events", "unreachable", "blocked_url"].includes(e.code)) await supabase.from("plan_sources").delete().eq("id", source.id);
        return json({ ok: false, error: e.code });
      }
      throw e;
    }
  } catch (err) {
    if (err instanceof SyncError) return json({ ok: false, error: err.code });
    console.error("[sync-event-source] error:", err);
    return json({ ok: false, error: "server_error" }, 500);
  }
});
