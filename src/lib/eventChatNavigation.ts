/** Passed via react-router `location.state` so the event chat header has a real title before `loadMeta` finishes. */
export type EventChatLocationState = {
  eventPrefetch?: {
    name: string;
    imageUrl?: string | null;
    eventStartsAt?: string | null;
    city?: string;
    venue?: string;
  };
  /** Where to return when leaving chat so Near You state / refetch is correct (embedded vs /events). */
  eventsReturn?: { mode: "standalone_events" | "home_near_you" };
};

export function buildEventChatNavigateState(ev: {
  name: string;
  imageUrl?: string | null;
  eventStartAt?: string | null;
  city?: string;
  venue?: string;
}): EventChatLocationState {
  return {
    eventPrefetch: {
      name: ev.name,
      imageUrl: ev.imageUrl ?? null,
      eventStartsAt: ev.eventStartAt ?? null,
      city: ev.city,
      venue: ev.venue,
    },
  };
}
