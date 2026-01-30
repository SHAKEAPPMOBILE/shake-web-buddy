-- Create storage bucket for ID verification documents (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('id-verifications', 'id-verifications', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for ID verification documents
-- Users can upload their own ID
CREATE POLICY "Users can upload their own ID"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'id-verifications' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own ID uploads
CREATE POLICY "Users can view their own ID"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'id-verifications' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own ID uploads
CREATE POLICY "Users can delete their own ID"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'id-verifications' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create table for tracking ID verification status
CREATE TABLE public.creator_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  document_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by TEXT,
  rejection_reason TEXT,
  auto_approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creator_verifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own verification status
CREATE POLICY "Users can view their own verification"
ON public.creator_verifications FOR SELECT
USING (auth.uid() = user_id);

-- Users can submit their verification (insert)
CREATE POLICY "Users can submit verification"
ON public.creator_verifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending verification (re-submit)
CREATE POLICY "Users can update their pending verification"
ON public.creator_verifications FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

-- Add trigger for updated_at
CREATE TRIGGER update_creator_verifications_updated_at
BEFORE UPDATE ON public.creator_verifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for verification status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.creator_verifications;