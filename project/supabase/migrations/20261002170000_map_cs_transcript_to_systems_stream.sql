DO $$
DECLARE
  systems_id uuid;
BEGIN
  SELECT stream.id INTO systems_id
  FROM programmes stream
  JOIN programmes parent ON parent.id = stream.parent_programme_id
  WHERE parent.name = 'Bachelor of Computer Science'
    AND stream.name = 'Bachelor of Computer Science in Computer Systems Engineering'
  LIMIT 1;

  IF systems_id IS NOT NULL THEN
    DELETE FROM programme_courses pc
    USING courses c
    WHERE pc.course_id = c.id
      AND c.course_code LIKE 'CSC%'
      AND c.year_of_study IN (3, 4)
      AND pc.programme_id IN (
        SELECT id FROM programmes WHERE parent_programme_id = (
          SELECT parent_programme_id FROM programmes WHERE id = systems_id
        )
      );

    UPDATE courses
    SET programme_id = systems_id
    WHERE course_code LIKE 'CSC%'
      AND year_of_study IN (3, 4);

    INSERT INTO programme_courses (programme_id, course_id, year_level)
    SELECT systems_id, id, year_of_study
    FROM courses
    WHERE course_code LIKE 'CSC%'
      AND year_of_study IN (3, 4)
    ON CONFLICT (programme_id, course_id)
    DO UPDATE SET year_level = EXCLUDED.year_level;
  END IF;
END;
$$;
