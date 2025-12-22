-- Create a function to get user age from profiles_private (security definer bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_age(target_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN date_of_birth IS NOT NULL THEN
        EXTRACT(YEAR FROM age(CURRENT_DATE, date_of_birth))::integer
      ELSE NULL
    END
  FROM public.profiles_private
  WHERE user_id = target_user_id
$$;