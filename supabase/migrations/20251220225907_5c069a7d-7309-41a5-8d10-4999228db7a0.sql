-- Add unique constraint on activity_read_status for user_id, city, activity_type
ALTER TABLE public.activity_read_status 
ADD CONSTRAINT activity_read_status_user_city_activity_unique 
UNIQUE (user_id, city, activity_type);