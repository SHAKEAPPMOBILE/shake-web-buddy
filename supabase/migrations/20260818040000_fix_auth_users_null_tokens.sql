-- GoTrue's admin listUsers() scans these text columns in Go and fails with
-- "converting NULL to string is unsupported" if any row has NULL instead of
-- ''. OAuth-created users (Google/Apple) are never given a confirmation_token,
-- so they end up NULL — this breaks admin.listUsers() for ALL users project-wide
-- as soon as one OAuth user exists. Backfill now, and a trigger keeps it fixed.
update auth.users set
  confirmation_token = coalesce(confirmation_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  recovery_token = coalesce(recovery_token, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where confirmation_token is null
   or email_change is null
   or email_change_token_new is null
   or email_change_token_current is null
   or recovery_token is null
   or phone_change is null
   or phone_change_token is null
   or reauthentication_token is null;

create or replace function public.handle_auth_user_null_tokens()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.confirmation_token := coalesce(new.confirmation_token, '');
  new.email_change := coalesce(new.email_change, '');
  new.email_change_token_new := coalesce(new.email_change_token_new, '');
  new.email_change_token_current := coalesce(new.email_change_token_current, '');
  new.recovery_token := coalesce(new.recovery_token, '');
  new.phone_change := coalesce(new.phone_change, '');
  new.phone_change_token := coalesce(new.phone_change_token, '');
  new.reauthentication_token := coalesce(new.reauthentication_token, '');
  return new;
end;
$$;

drop trigger if exists on_auth_user_null_tokens on auth.users;
create trigger on_auth_user_null_tokens
  before insert or update on auth.users
  for each row execute function public.handle_auth_user_null_tokens();
