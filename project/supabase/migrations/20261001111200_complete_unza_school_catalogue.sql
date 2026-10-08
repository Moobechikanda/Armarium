/*
# Complete University of Zambia School Catalogue

## Overview
Adds official UNZA school groups that were referenced by the undergraduate programme catalogue
but were not in the initial seed, then attaches their programme records to the UNZA institution.

## New school records
- School of Education
- School of Mines
- School of Health Sciences
- School of Nursing and Public Health

## Programme records
Adds the official catalogue programmes for these schools and keeps the official UNZA catalogue
URL on every record for verification.

## Security
Uses the existing authenticated read and lecturer-managed policies on `schools` and `programmes`.
No existing data is removed.
*/

INSERT INTO schools (name, short_name, description, institution_id)
SELECT v.name, v.short_name, v.description, i.id
FROM (
  VALUES
    ('School of Education', 'Education', 'School of Education programmes.'),
    ('School of Mines', 'Mines', 'School of Mines programmes.'),
    ('School of Health Sciences', 'Health Sciences', 'School of Health Sciences programmes.'),
    ('School of Nursing and Public Health', 'Nursing & Public Health', 'Nursing and public health programmes.')
) AS v(name, short_name, description)
CROSS JOIN (SELECT id FROM institutions WHERE short_name = 'UNZA') i
WHERE NOT EXISTS (
  SELECT 1 FROM schools s WHERE s.institution_id = i.id AND s.short_name = v.short_name
);

WITH official_programmes(school_name, name, qualification, duration_years) AS (
  VALUES
    ('Education', 'Bachelor of Education (Primary Education)', 'Bachelor', 4),
    ('Education', 'Bachelor of Education-Secondary (Mathematics and Science)', 'Bachelor', 4),
    ('Mines', 'Bachelor of Engineering in Geotechnical Engineering', 'Bachelor', 5),
    ('Mines', 'Bachelor of Engineering in Metallurgical Engineering', 'Bachelor', 5),
    ('Mines', 'Bachelor of Engineering Mining Engineering', 'Bachelor', 5),
    ('Mines', 'Bachelor of Science in Geology', 'Bachelor', 4),
    ('Health Sciences', 'Bachelor of Pharmacy', 'Bachelor', 5),
    ('Health Sciences', 'Bachelor of Science in Biomedical Science', 'Bachelor', 4),
    ('Health Sciences', 'Bachelor of Science in Physiotherapy', 'Bachelor', 4),
    ('Health Sciences', 'Bachelor of Science in Radiography', 'Bachelor', 4),
    ('Nursing & Public Health', 'Bachelor of Science in Nursing', 'Bachelor', 4),
    ('Nursing & Public Health', 'Bachelor of Science in Public Health Nursing', 'Bachelor', 4),
    ('Nursing & Public Health', 'Bachelor of Science in Public Health', 'Bachelor', 4)
)
INSERT INTO programmes (school_id, name, qualification, duration_years, source_url)
SELECT s.id, p.name, p.qualification, p.duration_years, 'https://www.unza.zm/academics/undergraduate/programmes'
FROM official_programmes p
JOIN schools s ON s.short_name = p.school_name
WHERE s.institution_id = (SELECT id FROM institutions WHERE short_name = 'UNZA')
AND NOT EXISTS (
  SELECT 1 FROM programmes existing WHERE existing.school_id = s.id AND existing.name = p.name
);
