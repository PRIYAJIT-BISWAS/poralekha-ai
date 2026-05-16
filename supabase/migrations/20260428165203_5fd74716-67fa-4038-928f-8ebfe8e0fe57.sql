CREATE TABLE IF NOT EXISTS public.error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question text NOT NULL,
  ai_answer text NOT NULL,
  report_type text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT error_reports_report_type_check CHECK (report_type IN ('ভুল তথ্য', 'অসম্পূর্ণ উত্তর', 'বিষয়ের বাইরে', 'অন্য সমস্যা'))
);

ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own error reports"
ON public.error_reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own error reports"
ON public.error_reports
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_error_reports_user_created_at
ON public.error_reports (user_id, created_at DESC);