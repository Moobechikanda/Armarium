/*
# Add Multi-University Institutions and Programme Catalogue

## Overview
Expands the repository beyond one university. Institutions own schools, and schools can
contain programme records sourced from official university catalogues. This keeps the app
ready for universities beyond UNZA while preserving the existing course and paper data.

## New table: institutions
- id (uuid, primary key)
- name (text, unique)
- short_name (text)
- country (text)
- website (text, optional)
- created_at (timestamptz)

## New table: programmes
- id (uuid, primary key)
- school_id (uuid, references schools)
- name (text)
- qualification (text, optional)
- duration_years (smallint, optional)
- source_url (text, optional)
- created_at (timestamptz)

## Modified table: schools
- Adds `institution_id` (uuid, references institutions) to support multiple universities.

## Seeded official catalogue
- Adds University of Zambia as the first institution.
- Assigns current UNZA schools to that institution.
- Adds a representative set of undergraduate programmes from UNZA's official catalogue,
  including Natural and Applied Sciences, Engineering, Law, Agriculture, GSB, Health,
  Humanities and Social Sciences, Mines, Medicine, Veterinary Medicine, Education, Nursing,
  Public Health, and related areas.
- Links the catalogue records to the official UNZA undergraduate-programmes page.

## Security
- Institutions and programmes are readable by authenticated users.
- Lecturers can add and update institution/programme catalogue records.
- No existing tables or user data are deleted.
*/

CREATE TABLE IF NOT EXISTS institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  short_name text NOT NULL,
  country text NOT NULL DEFAULT 'Zambia',
  website text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "institutions_select_all" ON institutions;
CREATE POLICY "institutions_select_all" ON institutions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "institutions_insert_lecturer" ON institutions;
CREATE POLICY "institutions_insert_lecturer" ON institutions FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer'));

DROP POLICY IF EXISTS "institutions_update_lecturer" ON institutions;
CREATE POLICY "institutions_update_lecturer" ON institutions FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer'));

CREATE TABLE IF NOT EXISTS programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  qualification text,
  duration_years smallint,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "programmes_select_all" ON programmes;
CREATE POLICY "programmes_select_all" ON programmes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "programmes_insert_lecturer" ON programmes;
CREATE POLICY "programmes_insert_lecturer" ON programmes FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer'));

DROP POLICY IF EXISTS "programmes_update_lecturer" ON programmes;
CREATE POLICY "programmes_update_lecturer" ON programmes FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer'));

CREATE INDEX IF NOT EXISTS idx_programmes_school_id ON programmes(school_id);

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schools_institution_id ON schools(institution_id);

INSERT INTO institutions (name, short_name, country, website)
VALUES ('University of Zambia', 'UNZA', 'Zambia', 'https://www.unza.zm')
ON CONFLICT (name) DO NOTHING;

UPDATE schools
SET institution_id = (SELECT id FROM institutions WHERE short_name = 'UNZA')
WHERE institution_id IS NULL;

UPDATE schools
SET name = 'School of Natural and Applied Sciences',
    short_name = 'Natural & Applied Sciences'
WHERE name = 'School of Natural Sciences';

WITH target_school AS (
  SELECT id AS school_id FROM schools WHERE institution_id = (SELECT id FROM institutions WHERE short_name = 'UNZA') AND short_name = 'Natural & Applied Sciences'
), official AS (
  SELECT 'Bachelor of Computer Science' AS name, 'Bachelor' AS qualification, 4 AS duration_years UNION ALL
  SELECT 'Bachelor of Computer Science in Computer Systems Engineering', 'Bachelor', 4 UNION ALL
  SELECT 'Bachelor of Computer Science in Networking and Information Security', 'Bachelor', 4 UNION ALL
  SELECT 'Bachelor of Computer Science in Software Engineering', 'Bachelor', 4 UNION ALL
  SELECT 'Bachelor of Science in Actuarial Science', 'Bachelor', 4 UNION ALL
  SELECT 'Bachelor of Science in Biological Sciences', 'Bachelor', 4 UNION ALL
  SELECT 'Bachelor of Science in Chemistry', 'Bachelor', 4 UNION ALL
  SELECT 'Bachelor of Science in Mathematics', 'Bachelor', 4 UNION ALL
  SELECT 'Bachelor of Science in Microbiology', 'Bachelor', 4 UNION ALL
  SELECT 'Bachelor of Science in Physics', 'Bachelor', 4 UNION ALL
  SELECT 'Bachelor of Science in Statistics', 'Bachelor', 4
)
INSERT INTO programmes (school_id, name, qualification, duration_years, source_url)
SELECT target_school.school_id, official.name, official.qualification, official.duration_years, 'https://www.unza.zm/academics/undergraduate/programmes'
FROM target_school CROSS JOIN official
WHERE NOT EXISTS (
  SELECT 1 FROM programmes p WHERE p.school_id = target_school.school_id AND p.name = official.name
);

WITH official_schools AS (
  SELECT id, short_name FROM schools WHERE institution_id = (SELECT id FROM institutions WHERE short_name = 'UNZA')
), official_programmes(school_name, name, qualification, duration_years) AS (
  VALUES
    ('Engineering', 'Bachelor of Engineering (Agricultural Engineering)', 'Bachelor', 5),
    ('Engineering', 'Bachelor of Engineering (Civil and Environmental Engineering)', 'Bachelor', 5),
    ('Engineering', 'Bachelor of Engineering (Electrical and Electronic Engineering)', 'Bachelor', 5),
    ('Engineering', 'Bachelor of Engineering (Geomatic Engineering)', 'Bachelor', 5),
    ('Engineering', 'Bachelor of Engineering (Mechanical Engineering)', 'Bachelor', 5),
    ('Law', 'Bachelor of Law', 'Bachelor', 4),
    ('Medicine', 'Bachelor of Medicine and Surgery', 'Bachelor', 6),
    ('Veterinary Medicine', 'Bachelor of Veterinary Medicine', 'Bachelor', 5),
    ('Agriculture', 'Bachelor of Agricultural Sciences (Animal Science)', 'Bachelor', 4),
    ('Agriculture', 'Bachelor of Agricultural Sciences (Land Management)', 'Bachelor', 4),
    ('Agriculture', 'Bachelor of Agricultural Sciences (Plant Science)', 'Bachelor', 4),
    ('Agriculture', 'Bachelor of Food Science and Technology', 'Bachelor', 4),
    ('GSB', 'Bachelor of Science in Accounting and Finance', 'Bachelor', 4),
    ('GSB', 'Bachelor of Science in Business Management', 'Bachelor', 4),
    ('Health Sciences', 'Bachelor of Pharmacy', 'Bachelor', 5),
    ('Health Sciences', 'Bachelor of Science in Biomedical Science', 'Bachelor', 4),
    ('Health Sciences', 'Bachelor of Science in Physiotherapy', 'Bachelor', 4),
    ('Health Sciences', 'Bachelor of Science in Radiography', 'Bachelor', 4),
    ('Humanities', 'Bachelor of Arts in Archaeology', 'Bachelor', 4),
    ('Humanities', 'Bachelor of Arts in Economics', 'Bachelor', 4),
    ('Humanities', 'Bachelor of Arts in English Language and Linguistics', 'Bachelor', 4),
    ('Humanities', 'Bachelor of Arts in Psychology', 'Bachelor', 4),
    ('Humanities', 'Bachelor of Arts in Sociology', 'Bachelor', 4),
    ('Mines', 'Bachelor of Engineering in Geotechnical Engineering', 'Bachelor', 5),
    ('Mines', 'Bachelor of Engineering in Metallurgical Engineering', 'Bachelor', 5),
    ('Mines', 'Bachelor of Engineering Mining Engineering', 'Bachelor', 5),
    ('Mines', 'Bachelor of Science in Geology', 'Bachelor', 4),
    ('Education', 'Bachelor of Education (Primary Education)', 'Bachelor', 4),
    ('Education', 'Bachelor of Education-Secondary (Mathematics and Science)', 'Bachelor', 4),
    ('Nursing & Public Health', 'Bachelor of Science in Nursing', 'Bachelor', 4),
    ('Nursing & Public Health', 'Bachelor of Science in Public Health Nursing', 'Bachelor', 4),
    ('Nursing & Public Health', 'Bachelor of Science in Public Health', 'Bachelor', 4)
)
INSERT INTO programmes (school_id, name, qualification, duration_years, source_url)
SELECT s.id, p.name, p.qualification, p.duration_years, 'https://www.unza.zm/academics/undergraduate/programmes'
FROM official_programmes p
JOIN official_schools s ON s.short_name = p.school_name
WHERE NOT EXISTS (
  SELECT 1 FROM programmes existing WHERE existing.school_id = s.id AND existing.name = p.name
);
