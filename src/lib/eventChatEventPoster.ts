import { supabase } from "@/integrations/supabase/client";
import { fetchTicketmasterEventDetail, type TicketmasterImageLogEntry } from "@/lib/ticketmaster";

export type ResolveEventChatPosterResult = {
  posterUrl: string | null;
  /** Ticketmaster `images` summary when the detail API was used (for debugging). */
  ticketmasterImagesLog?: TicketmasterImageLogEntry[];
};

function pickWidestImageUrl(
  images: Array<{ url?: string | null; width?: number | null }> | null | undefined
): string | null {
  if (!images?.length) return null;
  const withUrl = images.filter((im) => im.url && String(im.url).trim());
  const sorted = [...withUrl].sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0));
  return sorted[0]?.url?.trim() ?? null;
}

/**
 * Poster URL for event chat header:
 * 1) `public_events.image_url` when that row exists and has a URL (Supabase).
 * 2) Else Ticketmaster Discovery single-event `images` — widest by `width` (edge function + client fallback).
 */
export async function resolveEventChatPosterUrl(eventId: string): Promise<ResolveEventChatPosterResult> {
  const id = eventId.trim();
  if (!id) return { posterUrl: null };

  const { data: pub } = await supabase
    .from("public_events")
    .select("id, name, image_url, venue, city, event_starts_at, ticket_url, source")
    .eq("id", id)
    .maybeSingle();

  console.log("[resolveEventChatPosterUrl] Supabase public_events", {
    eventId: id,
    row: pub ?? null,
    note: "Columns: id, name, image_url, venue, city, event_starts_at, ticket_url, source (no separate images JSON).",
  });

  const fromDb = pub?.image_url?.trim();
  if (fromDb) {
    console.log("[resolveEventChatPosterUrl] using public_events.image_url", fromDb);
    return { posterUrl: fromDb };
  }

  const tm = await fetchTicketmasterEventDetail(id);

  let fromTm = tm?.imageUrl?.trim() || null;
  if (!fromTm && tm?.eventImages?.length) {
    fromTm = pickWidestImageUrl(tm.eventImages);
    if (fromTm) {
      console.log("[resolveEventChatPosterUrl] derived poster from Ticketmaster event.images (client fallback)", fromTm);
    }
  }

  console.log("[resolveEventChatPosterUrl] Ticketmaster path result", {
    eventId: id,
    posterUrl: fromTm,
    hadDetail: Boolean(tm),
  });

  return {
    posterUrl: fromTm,
    ticketmasterImagesLog: tm?.imagesLog,
  };
}
