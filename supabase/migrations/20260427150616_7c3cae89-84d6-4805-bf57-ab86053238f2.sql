CREATE TABLE IF NOT EXISTS public.study_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  subject TEXT,
  level TEXT,
  mode TEXT,
  language_used TEXT NOT NULL DEFAULT 'bangla' CHECK (language_used IN ('bangla', 'english', 'mixed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.study_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own study history"
ON public.study_history
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own study history"
ON public.study_history
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own study history"
ON public.study_history
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own study history"
ON public.study_history
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_study_history_updated_at ON public.study_history;
CREATE TRIGGER update_study_history_updated_at
BEFORE UPDATE ON public.study_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();