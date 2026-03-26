import { supabase } from "@/integrations/supabase/client";
import { fetchTicketmasterEventDetail } from "@/lib/ticketmaster";

/**
 * Poster URL for event chat header: `public_events.image_url` when present, otherwise
 * Ticketmaster Discovery single-event `images[0].url` (via edge function).
 */
export async function resolveEventChatPosterUrl(eventId: string): Promise<string | null> {
  const id = eventId.trim();
  if (!id) return null;

  const { data: pub } = await supabase.from("public_events").select("image_url").eq("id", id).maybeSingle();

  const fromDb = pub?.image_url?.trim();
  if (fromDb) return fromDb;

  const tm = await fetchTicketmasterEventDetail(id);
  const fromTm = tm?.imageUrl?.trim();
  return fromTm || null;
}
