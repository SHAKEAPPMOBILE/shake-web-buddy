-- Drop the restrictive INSERT policy and recreate as permissive
DROP POLICY IF EXISTS "Authenticated users can insert venues" ON public.venues;

CREATE POLICY "Authenticated users can insert venues"
ON public.venues
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also fix UPDATE and DELETE policies to be permissive
DROP POLICY IF EXISTS "Authenticated users can update venues" ON public.venues;

CREATE POLICY "Authenticated users can update venues"
ON public.venues
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete venues" ON public.venues;

CREATE POLICY "Authenticated users can delete venues"
ON public.venues
FOR DELETE
TO authenticated
USING (true);