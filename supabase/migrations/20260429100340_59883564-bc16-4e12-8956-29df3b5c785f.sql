ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS interface_language text NOT NULL DEFAULT 'bangla';

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_interface_language_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_interface_language_check
CHECK (interface_language IN ('bangla', 'english', 'banglish'));

COMMENT ON COLUMN public.profiles.interface_language IS 'Student preferred interface language: bangla, english, or banglish.';