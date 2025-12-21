-- Allow users to delete their own messages
CREATE POLICY "Users can delete their own messages"
ON public.activity_messages
FOR DELETE
USING (auth.uid() = user_id);