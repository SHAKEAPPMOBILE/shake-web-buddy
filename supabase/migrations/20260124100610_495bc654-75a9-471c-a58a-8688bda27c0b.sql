-- Create enum for report reasons
CREATE TYPE public.report_reason AS ENUM (
  'spam',
  'harassment',
  'inappropriate_content',
  'fake_profile',
  'underage',
  'other'
);

-- Create enum for report status
CREATE TYPE public.report_status AS ENUM (
  'pending',
  'reviewed',
  'resolved',
  'dismissed'
);

-- Create user_reports table
CREATE TABLE public.user_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  reported_user_id UUID NOT NULL,
  reason report_reason NOT NULL,
  description TEXT,
  status report_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  
  -- Prevent duplicate reports from same user for same target
  CONSTRAINT unique_active_report UNIQUE (reporter_id, reported_user_id)
);

-- Enable RLS
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports (but not report themselves)
CREATE POLICY "Users can create reports"
ON public.user_reports
FOR INSERT
WITH CHECK (
  auth.uid() = reporter_id 
  AND auth.uid() != reported_user_id
);

-- Users can view their own submitted reports
CREATE POLICY "Users can view their own reports"
ON public.user_reports
FOR SELECT
USING (auth.uid() = reporter_id);

-- Add index for faster lookups
CREATE INDEX idx_user_reports_reported_user ON public.user_reports(reported_user_id);
CREATE INDEX idx_user_reports_status ON public.user_reports(status);