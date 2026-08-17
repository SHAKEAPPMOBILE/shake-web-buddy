-- Optional phone number for contact-matching purposes only — decoupled from
-- auth.users.phone (Supabase Auth's verified login/OTP phone) so users can
-- supply a number without going through phone-verification. match-contacts
-- checks both this and auth.users.phone.
ALTER TABLE public.profiles_private ADD COLUMN IF NOT EXISTS phone text;
