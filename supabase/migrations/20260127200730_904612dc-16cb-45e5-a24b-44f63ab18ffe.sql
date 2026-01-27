-- Create venues table for admin-managed venue data
CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  venue_type text NOT NULL CHECK (venue_type IN ('lunch_dinner', 'brunch', 'drinks')),
  latitude double precision,
  longitude double precision,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for fast city lookups
CREATE INDEX idx_venues_city_type ON public.venues(city, venue_type);

-- Enable RLS
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active venues (needed for the app)
CREATE POLICY "Anyone can view active venues"
ON public.venues
FOR SELECT
USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_venues_updated_at
BEFORE UPDATE ON public.venues
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();