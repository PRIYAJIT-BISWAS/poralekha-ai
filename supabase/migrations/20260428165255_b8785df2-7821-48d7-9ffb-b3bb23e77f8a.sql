ALTER TABLE public.error_reports
ALTER COLUMN user_id DROP NOT NULL;

CREATE POLICY "Visitors can create anonymous error reports"
ON public.error_reports
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);