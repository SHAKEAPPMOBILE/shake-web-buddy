/**
 * Logs PostgREST / Supabase errors with a stable shape so 400s (bad column, RLS, etc.) are visible in the console.
 */
export function logPostgrestError(
  scope: string,
  error: { message?: string; details?: string; hint?: string; code?: string } | null | undefined,
): void {
  if (!error) return;
  const payload = {
    scope,
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  };
  console.error(`[Supabase] ${scope}`, payload, "json:", JSON.stringify(payload));
}
