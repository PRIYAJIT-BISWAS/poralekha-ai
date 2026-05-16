ALTER TABLE public.study_history
ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'question';

ALTER TABLE public.study_history
ADD CONSTRAINT study_history_entry_type_check
CHECK (entry_type IN ('question', 'step_marking'));

ALTER TABLE public.study_history
ADD COLUMN IF NOT EXISTS score integer DEFAULT NULL;

ALTER TABLE public.study_history
ADD CONSTRAINT study_history_score_check
CHECK (score IS NULL OR (score >= 0 AND score <= 10));