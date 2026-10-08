ALTER TABLE programmes
  ADD COLUMN IF NOT EXISTS parent_programme_id uuid REFERENCES programmes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_programmes_parent_id ON programmes(parent_programme_id);

UPDATE programmes child
SET parent_programme_id = parent.id
FROM programmes parent
WHERE parent.name = 'Bachelor of Computer Science'
  AND child.name IN (
    'Bachelor of Computer Science in Computer Systems Engineering',
    'Bachelor of Computer Science in Networking and Information Security',
    'Bachelor of Computer Science in Software Engineering'
  )
  AND child.school_id = parent.school_id
  AND child.parent_programme_id IS NULL;

UPDATE courses c
SET programme_id = CASE
  WHEN c.course_code IN ('CSC 2101', 'CSC 2111', 'CSC 2202', 'CSC 3120', 'CSC 4130', 'CSC 4722', 'CSC 4812')
    THEN (SELECT id FROM programmes WHERE name = 'Bachelor of Computer Science in Computer Systems Engineering' LIMIT 1)
  WHEN c.course_code IN ('CSC 3801', 'CSC 4835')
    THEN (SELECT id FROM programmes WHERE name = 'Bachelor of Computer Science in Networking and Information Security' LIMIT 1)
  WHEN c.course_code IN ('CSC 2000', 'CSC 2702', 'CSC 3301', 'CSC 3402', 'CSC 3601', 'CSC 3712', 'CSC 4765', 'CSC 4792')
    THEN (SELECT id FROM programmes WHERE name = 'Bachelor of Computer Science in Software Engineering' LIMIT 1)
  ELSE (SELECT id FROM programmes WHERE name = 'Bachelor of Computer Science' LIMIT 1)
END
WHERE c.course_code LIKE 'CSC%';
