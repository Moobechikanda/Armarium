ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS programme_id uuid REFERENCES programmes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS study_year smallint CHECK (study_year IS NULL OR study_year BETWEEN 1 AND 10);

CREATE INDEX IF NOT EXISTS idx_profiles_programme_id ON profiles(programme_id);

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS ai_guidance text NOT NULL DEFAULT '';

ALTER TABLE programmes
  ADD COLUMN IF NOT EXISTS ai_guidance text NOT NULL DEFAULT '';

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS ai_guidance text NOT NULL DEFAULT '';
