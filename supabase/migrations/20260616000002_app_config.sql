-- app_config: key/value store for runtime configuration that can be changed
-- without a code deploy.  First use: minimum_app_version forces old native
-- builds to update before they can use the app.

CREATE TABLE IF NOT EXISTS public.app_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

-- Seed the minimum required version.
-- Set this to the marketing version string (CFBundleShortVersionString / versionName)
-- of the oldest build you still want to allow.  Anything below this value will see
-- the blocking "Update required" modal on launch.
INSERT INTO public.app_config (key, value)
VALUES ('minimum_app_version', '18.5')
ON CONFLICT (key) DO NOTHING;

-- RLS: anyone can read (needed for unauthenticated / pre-login check),
-- no client can write (use the Supabase dashboard or service-role key).
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_config_public_read"
  ON public.app_config
  FOR SELECT
  TO public
  USING (true);
