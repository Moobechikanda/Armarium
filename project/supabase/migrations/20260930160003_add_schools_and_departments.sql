/*
# Add Schools and Department Structure

## Overview
Adds a `schools` table to group courses by school/department (Natural Sciences, Engineering,
Law, Humanities, GSB, Agriculture, Veterinary Medicine, Medicine, etc.). Links courses to
schools via a foreign key. Seeds the initial set of UNZA schools and assigns existing
Computer Science courses to the School of Natural Sciences.

## New Table
### schools
- id (uuid, PK)
- name (text, unique — e.g. "School of Natural Sciences")
- short_name (text — e.g. "Natural Sciences")
- description (text, nullable)
- created_at (timestamptz)

## Modified Table
### courses
- Adds `school_id` (uuid, nullable, FK to schools) to link each course to its school.

## Seeded Schools
1. School of Natural Sciences (Computer Science Department)
2. School of Engineering
3. School of Law
4. School of Humanities
5. Graduate School of Business (GSB)
6. School of Agricultural Sciences
7. School of Veterinary Medicine
8. School of Medicine

## Security
- schools: all authenticated users can read; lecturers can create new schools.
- No changes to existing course policies (school_id is just an additional column).

## Important Notes
1. Existing CS courses are assigned to the School of Natural Sciences.
2. New schools can be added by lecturers from the UI.
3. school_id is nullable so existing courses without a school still work.
*/

CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  short_name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schools_select_all" ON schools;
CREATE POLICY "schools_select_all" ON schools FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "schools_insert_lecturer" ON schools;
CREATE POLICY "schools_insert_lecturer" ON schools FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer')
  );

DROP POLICY IF EXISTS "schools_update_lecturer" ON schools;
CREATE POLICY "schools_update_lecturer" ON schools FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer')
  );

-- Add school_id to courses
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_courses_school_id ON courses(school_id);

-- Seed schools
INSERT INTO schools (name, short_name, description) VALUES
  ('School of Natural Sciences', 'Natural Sciences', 'Computer Science Department and other natural sciences programs.'),
  ('School of Engineering', 'Engineering', 'School of Engineering programs.'),
  ('School of Law', 'Law', 'School of Law programs.'),
  ('School of Humanities', 'Humanities', 'School of Humanities programs.'),
  ('Graduate School of Business', 'GSB', 'Graduate School of Business programs.'),
  ('School of Agricultural Sciences', 'Agriculture', 'School of Agricultural Sciences programs.'),
  ('School of Veterinary Medicine', 'Veterinary Medicine', 'School of Veterinary Medicine programs.'),
  ('School of Medicine', 'Medicine', 'School of Medicine programs.')
ON CONFLICT (name) DO NOTHING;

-- Assign existing CS courses to School of Natural Sciences
UPDATE courses
SET school_id = (SELECT id FROM schools WHERE name = 'School of Natural Sciences')
WHERE school_id IS NULL
  AND (course_code LIKE 'CSC%' OR course_code LIKE 'csc%');
