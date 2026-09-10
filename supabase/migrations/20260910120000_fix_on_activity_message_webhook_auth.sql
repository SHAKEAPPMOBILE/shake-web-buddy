-- The on-activity-message Database Webhook (Dashboard-created, like the
-- project's other activity_* webhooks) was missing an Authorization header
-- entirely. The functions gateway (verify_jwt=true, same as every other
-- webhook-triggered function here) rejects requests with no Authorization
-- header before the function's own code ever runs — confirmed live via a
-- direct 401 UNAUTHORIZED_NO_AUTH_HEADER response. This silently broke
-- push notifications for new messages in a carousel activity's group chat.
--
-- Fix: recreate the trigger with the same Authorization header the
-- project's other correctly-configured activity_joins/greetings/messages
-- webhooks already use.
drop trigger if exists "on-activity-message" on public.activity_messages;

create trigger "on-activity-message"
after insert on public.activity_messages
for each row
execute function supabase_functions.http_request(
  'https://mpgrjzubegorcijgfjri.supabase.co/functions/v1/on-activity-message',
  'POST',
  '{"Content-type":"application/json","Authorization":"Bearer REPLACE_WITH_CURRENT_SB_SECRET_KEY"}',
  '{}',
  '5000'
);
