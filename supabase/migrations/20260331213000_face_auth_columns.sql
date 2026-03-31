ALTER TABLE profiles ADD COLUMN IF NOT EXISTS face_descriptor jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS face_auth_enabled boolean DEFAULT false;
