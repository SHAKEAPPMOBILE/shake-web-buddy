-- Allow admin operations on venues (using service role via edge function in future, or direct for now)
-- For now, allow authenticated users to manage venues (admin panel is password protected)
CREATE POLICY "Authenticated users can insert venues"
ON public.venues
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update venues"
ON public.venues
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete venues"
ON public.venues
FOR DELETE
TO authenticated
USING (true);