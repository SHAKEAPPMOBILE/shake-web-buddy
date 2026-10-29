-- Booking links were removed (payments stay inside SHAKE); the column never held data.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_booking_url_https;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS booking_url;
