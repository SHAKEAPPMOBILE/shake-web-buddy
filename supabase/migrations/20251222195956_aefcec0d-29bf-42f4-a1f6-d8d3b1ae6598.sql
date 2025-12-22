-- Add DELETE policy for profiles_private to prevent unauthorized deletion
CREATE POLICY "Users can delete their own private profile"
ON public.profiles_private
FOR DELETE
USING (auth.uid() = user_id);