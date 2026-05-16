ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'bangla';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_preferred_language_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_preferred_language_check
    CHECK (preferred_language IN ('bangla', 'english', 'mixed'));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.study_history') IS NOT NULL THEN
    ALTER TABLE public.study_history
    ADD COLUMN IF NOT EXISTS language_used TEXT NOT NULL DEFAULT 'bangla';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'study_history_language_used_check'
        AND conrelid = 'public.study_history'::regclass
    ) THEN
      ALTER TABLE public.study_history
      ADD CONSTRAINT study_history_language_used_check
      CHECK (language_used IN ('bangla', 'english', 'mixed'));
    END IF;
  END IF;
END $$;