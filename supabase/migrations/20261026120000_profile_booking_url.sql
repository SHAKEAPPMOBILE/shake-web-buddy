-- A creator's own booking link (FareHarbor or any other booking page). Plans they host show a "Book" button that opens it.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS booking_url text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_booking_url_https;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_booking_url_https
  CHECK (booking_url IS NULL OR (booking_url ~* '^https://[^[:space:]]+$' AND length(booking_url) <= 500));
