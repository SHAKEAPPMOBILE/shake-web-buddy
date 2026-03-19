-- Public events table: curated events (e.g. from Eventbrite or manual) for the Events page.
CREATE TABLE IF NOT EXISTS public.public_events (
  id text PRIMARY KEY,
  name text,
  image_url text,
  venue text,
  city text,
  event_starts_at timestamptz,
  ticket_url text,
  source text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.public_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public_events"
ON public.public_events FOR SELECT
USING (true);
