-- Force RLS on profiles_private to ensure it cannot be bypassed even by table owners
ALTER TABLE public.profiles_private FORCE ROW LEVEL SECURITY;