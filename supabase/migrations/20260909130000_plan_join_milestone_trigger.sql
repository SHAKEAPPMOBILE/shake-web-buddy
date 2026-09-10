-- Wires a DB trigger straight to the new on-plan-join-milestone edge
-- function via pg_net, so a plan creator gets notified the instant their
-- attendee count crosses a multiple of 5 (the "create popular activities"
-- +5 points source in get_user_points(), which otherwise has no discrete
-- award event to hook a notification into).
--
-- The project's other activity_joins webhooks (on-activity-joined,
-- on-first-activity-join) are wired via the Dashboard's Database Webhooks
-- UI, not SQL, so they don't appear in migration history. This one is
-- wired directly in SQL instead, so it's fully reproducible from the repo
-- without a manual dashboard step.

-- Store a JWT once so the trigger can authenticate to the edge function.
-- Must be the project's legacy service_role JWT specifically, not the
-- newer opaque sb_secret_ key: the functions gateway (verify_jwt=true)
-- requires a syntactically valid JWT to even reach the function's own
-- code, and this project's auto-injected SUPABASE_SERVICE_ROLE_KEY env
-- var now resolves to the sb_secret_ format. The edge function itself
-- compares the incoming token against its own TRIGGER_AUTH_JWT secret
-- (set via `supabase secrets set`, same legacy JWT value) rather than
-- SUPABASE_SERVICE_ROLE_KEY, for the same reason. Vault encrypts this at
-- rest; only superuser-level roles can read vault.decrypted_secrets.
select vault.create_secret(
  'REPLACE_WITH_LEGACY_SERVICE_ROLE_JWT',
  'service_role_key_for_triggers',
  'Legacy service_role JWT used by DB triggers to call edge functions via pg_net'
)
where not exists (
  select 1 from vault.secrets where name = 'service_role_key_for_triggers'
);

create or replace function public.notify_plan_join_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  service_key text;
begin
  -- Only plan-specific joins can trigger a creator popularity bonus.
  if new.activity_id is null then
    return new;
  end if;

  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'service_role_key_for_triggers';

  if service_key is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://mpgrjzubegorcijgfjri.supabase.co/functions/v1/on-plan-join-milestone',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'activity_joins',
      'schema', 'public',
      'record', to_jsonb(new),
      'old_record', null
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_plan_join_milestone on public.activity_joins;

create trigger trg_notify_plan_join_milestone
after insert on public.activity_joins
for each row
execute function public.notify_plan_join_milestone();
