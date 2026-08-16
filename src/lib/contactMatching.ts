/**
 * Privacy-safe contact matching: contacts read from the device never leave
 * it in plaintext. Each phone number and email is normalized and hashed
 * (SHA-256) locally, and only the hashes are sent to the match-contacts
 * edge function, which compares them against hashes of registered users'
 * emails/phones computed server-side. The server never sees raw contact
 * data, and the client never sees non-matching users.
 *
 * Normalization MUST exactly mirror supabase/functions/match-contacts —
 * email: trim + lowercase; phone: digits only (matches how Supabase stores
 * auth.users.phone, with no leading "+").
 */

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Hashes every phone/email a set of device contacts carries, deduped. */
export async function hashContactValues(
  contacts: { emails: string[]; phones: string[] }[]
): Promise<string[]> {
  const normalized = new Set<string>();
  for (const c of contacts) {
    for (const email of c.emails) {
      if (email.trim()) normalized.add(normalizeEmail(email));
    }
    for (const phone of c.phones) {
      const digits = normalizePhone(phone);
      if (digits.length >= 7) normalized.add(digits); // skip obviously-too-short junk
    }
  }
  return Promise.all(Array.from(normalized).map(sha256Hex));
}
