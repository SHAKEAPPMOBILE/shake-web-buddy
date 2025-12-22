-- Add date_of_birth column to profiles_private table
ALTER TABLE public.profiles_private
ADD COLUMN date_of_birth date;