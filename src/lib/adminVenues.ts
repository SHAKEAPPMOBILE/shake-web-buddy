/**
 * Venue writes for the admin panel. App users can only read `venues`; writes
 * go through the password-checked seed-test-users function (action=venues).
 */
export type AdminVenueWrite =
  | { op: "insert"; row: Record<string, unknown> }
  | { op: "update"; id: string; values: Record<string, unknown> }
  | { op: "delete"; id: string }
  | { op: "upsert"; rows: Record<string, unknown>[] }
  | { op: "pin"; field: "is_current" | "is_starred"; city: string; venue_type: string; id?: string };

export async function adminVenueWrite<T = Record<string, unknown>>(adminPassword: string, body: AdminVenueWrite): Promise<T> {
  const response = await fetch(
    `https://mpgrjzubegorcijgfjri.supabase.co/functions/v1/seed-test-users?password=${encodeURIComponent(adminPassword)}&action=venues`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.error || `Venue update failed (${response.status})`);
  }
  return result as T;
}
