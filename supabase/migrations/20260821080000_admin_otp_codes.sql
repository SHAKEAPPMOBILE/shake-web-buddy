-- admin-otp previously kept OTP codes in an in-memory Map inside the edge
-- function. Supabase Edge Functions run on an ephemeral, auto-scaling
-- runtime — the send-otp and verify-otp requests can land on two different
-- isolates, each with its own empty Map, so verification randomly failed
-- with "No verification code found." Durable storage fixes that.
create table public.admin_otp_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_admin_otp_codes_email on public.admin_otp_codes(email);

alter table public.admin_otp_codes enable row level security;
-- No policies: only the edge function (via the service role key, which
-- bypasses RLS) ever touches this table. No client role should read or
-- write it directly.
