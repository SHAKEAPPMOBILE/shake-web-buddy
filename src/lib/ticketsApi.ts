import { supabase } from "@/integrations/supabase/client";

// plan_tickets, plan_attendance and these functions come from migration 20261028130000_plan_tickets_recurrence_attendance.sql
// and aren't in the generated Supabase types yet, so call through loosely-typed handles.
type RpcResult = Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args?: object) => RpcResult;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string) => (supabase as any).from(name);

/** What the QR code holds; anything else a camera sees is ignored. */
export const TICKET_PREFIX = "SHAKE:";

export type MyTicket =
  | { ok: true; code: string; checkedInAt: string | null }
  | { ok: false; reason: "not_signed_in" | "not_found" | "no_ticket_needed" | "is_host" | "not_joined" | "error" };

export async function getMyTicket(activityId: string): Promise<MyTicket> {
  const { data, error } = await rpc("get_my_ticket", { p_activity_id: activityId });
  if (error || !data) return { ok: false, reason: "error" };
  const r = data as { ok: boolean; code?: string; checked_in_at?: string | null; reason?: MyTicket extends { ok: false; reason: infer R } ? R : never };
  if (r.ok && r.code) return { ok: true, code: r.code, checkedInAt: r.checked_in_at ?? null };
  return { ok: false, reason: r.reason ?? "error" };
}

export interface ScanResult {
  ok: boolean;
  reason?: "not_signed_in" | "not_host" | "invalid" | "wrong_event" | "already_checked_in" | "error";
  name?: string | null;
  avatar_url?: string | null;
  checked_in_at?: string | null;
}

export async function scanTicket(activityId: string, code: string): Promise<ScanResult> {
  const { data, error } = await rpc("scan_ticket", { p_activity_id: activityId, p_code: code });
  if (error || !data) return { ok: false, reason: "error" };
  return data as ScanResult;
}

export interface TicketCounts {
  attendees: number;
  checkedIn: number;
}

/** Joined people and how many of them have been scanned in. Hosts and co-hosts only (the table's read policy). */
export async function getTicketCounts(activityId: string): Promise<TicketCounts> {
  const [attendance, scanned] = await Promise.all([
    table("plan_attendance").select("attendees").eq("activity_id", activityId).maybeSingle(),
    table("plan_tickets").select("id", { count: "exact", head: true }).eq("activity_id", activityId).not("checked_in_at", "is", null),
  ]);
  return { attendees: attendance.data?.attendees ?? 0, checkedIn: scanned.count ?? 0 };
}
