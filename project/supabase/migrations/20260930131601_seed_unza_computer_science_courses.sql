/*
# Add UNZA Computer Science Course Catalogue

## Overview
Adds the year-of-study field to courses and seeds the Computer Science course catalogue
shown in the supplied University of Zambia student-results screenshot.

## Course scope
- Includes Computer Science courses for second, third, and fourth year.
- Medicine courses shown in the screenshot are intentionally excluded.
- First-year Natural Sciences courses are not seeded because the supplied screenshot only
  shows Medicine for first year; they should be added when their course list is provided.

## Modified table
- `courses`
- Adds `year_of_study` (smallint, nullable) so courses can be grouped by year.
- Inserts or updates the 23 Computer Science courses from the screenshot.

## Security
- No new tables or policies are created.
- Existing authenticated course policies continue to protect course management.

## Important notes
1. Inserts are idempotent and use `course_code` as the stable identifier.
2. `created_by` remains null for catalogue courses until a lecturer claims or edits them.
3. No existing rows or user data are deleted.
*/

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS year_of_study smallint;

INSERT INTO courses (course_code, title, description, year_of_study)
VALUES
  ('CSC 2901', 'Discrete Structures', 'Computer Science course in the School of Natural Sciences.', 2),
  ('CSC 2101', 'Computer Systems', 'Computer Science course in the School of Natural Sciences.', 2),
  ('CSC 2111', 'Computer Architecture', 'Computer Science course in the School of Natural Sciences.', 2),
  ('CSC 2702', 'Database & Information Management System', 'Computer Science course in the School of Natural Sciences.', 2),
  ('CSC 2202', 'Operating Systems', 'Computer Science course in the School of Natural Sciences.', 2),
  ('CSC 2000', 'Computer Programming', 'Computer Science course in the School of Natural Sciences.', 2),
  ('CSC 2912', 'Numerical Analysis', 'Computer Science course in the School of Natural Sciences.', 2),
  ('CSC 3120', 'Digital Electronics', 'Computer Science course in the School of Natural Sciences.', 3),
  ('CSC 3301', 'Programming Languages Design & Implementation', 'Computer Science course in the School of Natural Sciences.', 3),
  ('CSC 3801', 'Data Communication & Networking', 'Computer Science course in the School of Natural Sciences.', 3),
  ('CSC 3612', 'IT Project Management', 'Computer Science course in the School of Natural Sciences.', 3),
  ('CSC 3712', 'Advanced Databases', 'Computer Science course in the School of Natural Sciences.', 3),
  ('CSC 3601', 'Algorithms and Complexity', 'Computer Science course in the School of Natural Sciences.', 3),
  ('CSC 3402', 'Fundamentals of Artificial Intelligence', 'Computer Science course in the School of Natural Sciences.', 3),
  ('CSC 3009', 'Industrial Training Course', 'Computer Science course in the School of Natural Sciences.', 3),
  ('CSC 4812', 'Cloud and High Performance Computing', 'Computer Science course in the School of Natural Sciences.', 4),
  ('CSC 4835', 'Wireless and Mobile Computing', 'Computer Science course in the School of Natural Sciences.', 4),
  ('CSC 4765', 'Multimedia and Human Computer Interactions', 'Computer Science course in the School of Natural Sciences.', 4),
  ('CSC 4004', 'Projects', 'Computer Science course in the School of Natural Sciences.', 4),
  ('CSC 4130', 'Hardware Design and Implementation', 'Computer Science course in the School of Natural Sciences.', 4),
  ('CSC 4722', 'Distributed Systems', 'Computer Science course in the School of Natural Sciences.', 4),
  ('CSC 4300', 'Industrial Training Course', 'Computer Science course in the School of Natural Sciences.', 4),
  ('CSC 4792', 'Data Mining and Warehousing', 'Computer Science course in the School of Natural Sciences.', 4)
ON CONFLICT (course_code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  year_of_study = EXCLUDED.year_of_study;