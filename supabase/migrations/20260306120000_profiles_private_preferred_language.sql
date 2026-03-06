-- Persist preferred language so it syncs across devices
ALTER TABLE public.profiles_private
ADD COLUMN IF NOT EXISTS preferred_language TEXT;

COMMENT ON COLUMN public.profiles_private.preferred_language IS 'User preferred UI language code (e.g. en, es, pt).';
