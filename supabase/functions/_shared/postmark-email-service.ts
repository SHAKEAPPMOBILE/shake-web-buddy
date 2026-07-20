/**
 * Shared Postmark email helper. Mirrors the pattern used by
 * _shared/messagebird-sms-service.ts / vonage-sms-service.ts for SMS.
 *
 * Requires the `POSTMARK_SERVER_TOKEN` secret to be set in Supabase Edge
 * Function secrets (Project Settings > Edge Functions > Secrets, or
 * `supabase secrets set POSTMARK_SERVER_TOKEN=... --project-ref <ref>`).
 */

export interface SendEmailParams {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Postmark message stream — "outbound" (default) for transactional email. */
  messageStream?: string;
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Sends an email via the Postmark HTTP API (https://postmarkapp.com/developer/api/email-api).
 * Returns { success: false, error } instead of throwing, so callers can log/handle
 * failures the same way they previously handled `resend.emails.send()`'s `{ error }` shape.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const serverToken = Deno.env.get("POSTMARK_SERVER_TOKEN");
  if (!serverToken) {
    return { success: false, error: "POSTMARK_SERVER_TOKEN is not configured" };
  }

  const to = Array.isArray(params.to) ? params.to.join(",") : params.to;

  try {
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": serverToken,
      },
      body: JSON.stringify({
        From: params.from,
        To: to,
        Subject: params.subject,
        HtmlBody: params.html,
        TextBody: params.text,
        MessageStream: params.messageStream || "outbound",
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message = data?.Message || `Postmark request failed with status ${res.status}`;
      return { success: false, error: message };
    }

    return { success: true, messageId: data?.MessageID };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
