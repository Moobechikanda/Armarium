DO $$
DECLARE
  parent_id uuid;
BEGIN
  SELECT id INTO parent_id FROM programmes
    WHERE name = 'Bachelor of Computer Science' AND parent_programme_id IS NULL LIMIT 1;

  IF parent_id IS NOT NULL THEN
    UPDATE courses
    SET programme_id = parent_id
    WHERE course_code LIKE 'CSC%'
      AND year_of_study = 2;

    INSERT INTO programme_courses (programme_id, course_id, year_level)
    SELECT stream.id, course.id, 2
    FROM programmes stream
    JOIN courses course ON course.course_code LIKE 'CSC%' AND course.year_of_study = 2
    WHERE stream.parent_programme_id = parent_id
    ON CONFLICT (programme_id, course_id)
    DO UPDATE SET year_level = EXCLUDED.year_level;
  END IF;
END;
$$;
