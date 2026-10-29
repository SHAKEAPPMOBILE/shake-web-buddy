import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// GET ?id=<plan id> → an .ics file the phone's calendar app offers to import. Recurring plans carry an
// RRULE, so one tap adds the whole series. Public on purpose (a calendar app can't send a login), and it
// only exposes what the plan's own share link already shows.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");
const icsDate = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// RFC 5545 asks for lines of at most 75 octets; continuation lines start with a space.
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const w = new TextEncoder().encode(ch).length;
    if (size + w > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += w;
  }
  out.push(current);
  return out.join("\r\n ");
}

const RRULES: Record<string, string> = {
  weekly: "FREQ=WEEKLY",
  biweekly: "FREQ=WEEKLY;INTERVAL=2",
  monthly: "FREQ=MONTHLY",
};

serve(async (req) => {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) return new Response("Bad request", { status: 400 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false },
  });
  const { data: plan } = await supabase
    .from("user_activities")
    .select("id, user_id, activity_type, city, note, title, description, scheduled_for, venue_name, venue_address, recurrence")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan || !plan.scheduled_for) return new Response("Not found", { status: 404 });

  const { data: host } = await supabase.from("profiles").select("name").eq("user_id", plan.user_id).maybeSingle();

  const start = new Date(plan.scheduled_for);
  const end = new Date(start.getTime() + DEFAULT_DURATION_MS);
  const label = String(plan.activity_type ?? "plan");
  const title = (plan.note?.trim() || plan.title?.trim() || label.charAt(0).toUpperCase() + label.slice(1)).slice(0, 120);
  const location = [plan.venue_name, plan.venue_address, plan.city].filter(Boolean).join(", ");
  const link = `https://www.shakeapp.today/invite/${plan.id}`;
  const description = [host?.name ? `Hosted by ${host.name} on SHAKE` : "On SHAKE", plan.description?.trim(), link]
    .filter(Boolean)
    .join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SHAKE//Plans//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${plan.id}@shakeapp.today`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(description)}`,
    ...(location ? [`LOCATION:${esc(location)}`] : []),
    `URL:${link}`,
    ...(plan.recurrence && RRULES[plan.recurrence] ? [`RRULE:${RRULES[plan.recurrence]}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(title)}`,
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="shake-plan.ics"',
      "Cache-Control": "no-store",
    },
  });
});
