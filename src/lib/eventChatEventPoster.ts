import { supabase } from "@/integrations/supabase/client";
import { fetchTicketmasterEventDetail, type TicketmasterImageLogEntry } from "@/lib/ticketmaster";

export type ResolveEventChatPosterResult = {
  posterUrl: string | null;
  /** Ticketmaster `images` summary when the detail API was used (for debugging). */
  ticketmasterImagesLog?: TicketmasterImageLogEntry[];
};

/**
 * Poster URL for event chat header: `public_events.image_url` when present, otherwise
 * Ticketmaster Discovery single-event image (16_9 largest width, else best fallback).
 */
export async function resolveEventChatPosterUrl(eventId: string): Promise<ResolveEventChatPosterResult> {
  const id = eventId.trim();
  if (!id) return { posterUrl: null };

  const { data: pub } = await supabase.from("public_events").select("image_url").eq("id", id).maybeSingle();

  const fromDb = pub?.image_url?.trim();
  if (fromDb) return { posterUrl: fromDb };

  const tm = await fetchTicketmasterEventDetail(id);
  const fromTm = tm?.imageUrl?.trim() || null;
  return {
    posterUrl: fromTm,
    ticketmasterImagesLog: tm?.imagesLog,
  };
}
