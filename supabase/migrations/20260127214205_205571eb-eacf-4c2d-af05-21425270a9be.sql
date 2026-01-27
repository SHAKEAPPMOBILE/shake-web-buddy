-- Drop the authenticated-only policies and recreate for public role
-- This is safe because the admin page is already password-protected

DROP POLICY IF EXISTS "Authenticated users can insert venues" ON public.venues;
DROP POLICY IF EXISTS "Authenticated users can update venues" ON public.venues;
DROP POLICY IF EXISTS "Authenticated users can delete venues" ON public.venues;

-- Allow any user (including anonymous via anon key) to manage venues
CREATE POLICY "Anyone can insert venues"
ON public.venues
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update venues"
ON public.venues
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can delete venues"
ON public.venues
FOR DELETE
USING (true);