ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS programme_id uuid REFERENCES programmes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_courses_programme_id ON courses(programme_id);

ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS external_url text;

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS source_url text;

ALTER TABLE recommended_books
  ADD COLUMN IF NOT EXISTS source_url text;