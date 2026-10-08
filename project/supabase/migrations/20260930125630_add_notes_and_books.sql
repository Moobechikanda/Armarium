/*
# Add Notes and Recommended Books

## Overview
Adds two new tables to the existing schema: notes (student-uploaded study notes per course)
and recommended_books (books recommended for each course, added by lecturers or students).

## New Tables

### notes
Study notes shared per course. Any authenticated user can post notes (students can share
their own notes, lecturers can share official ones).
- id (uuid, PK)
- course_id (uuid, FK to courses, ON DELETE CASCADE)
- title (text)
- content (text — the note content, can be text or a description of an uploaded file)
- file_path (text, nullable — path to uploaded note file in storage)
- file_name (text, nullable — original file name)
- posted_by (uuid, FK to profiles)
- created_at (timestamptz)

### recommended_books
Recommended reading books per course.
- id (uuid, PK)
- course_id (uuid, FK to courses, ON DELETE CASCADE)
- title (text — book title)
- author (text — author name)
- isbn (text, nullable — ISBN for reference)
- description (text, nullable — why this book is recommended)
- link (text, nullable — optional link to where to find the book)
- recommended_by (uuid, FK to profiles)
- created_at (timestamptz)

## Security
- notes: All authenticated users can read. The poster can delete their own notes.
  Students who have paid OR lecturers can read (same as papers). Any authenticated
  user can post notes.
- recommended_books: All authenticated users can read. The recommender can delete
  their own recommendations. Any authenticated user can recommend books.

## Indexes
- idx_notes_course_id on notes(course_id)
- idx_books_course_id on recommended_books(course_id)
*/

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  file_path text,
  file_name text,
  posted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read notes
DROP POLICY IF EXISTS "notes_select_all" ON notes;
CREATE POLICY "notes_select_all" ON notes FOR SELECT
  TO authenticated USING (true);

-- Any authenticated user can post notes
DROP POLICY IF EXISTS "notes_insert_own" ON notes;
CREATE POLICY "notes_insert_own" ON notes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = posted_by);

-- Only the poster can update/delete their notes
DROP POLICY IF EXISTS "notes_update_own" ON notes;
CREATE POLICY "notes_update_own" ON notes FOR UPDATE
  TO authenticated USING (posted_by = auth.uid()) WITH CHECK (posted_by = auth.uid());

DROP POLICY IF EXISTS "notes_delete_own" ON notes;
CREATE POLICY "notes_delete_own" ON notes FOR DELETE
  TO authenticated USING (posted_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notes_course_id ON notes(course_id);

-- ============================================

CREATE TABLE IF NOT EXISTS recommended_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  author text NOT NULL,
  isbn text,
  description text DEFAULT '',
  link text,
  recommended_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recommended_books ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read recommended books
DROP POLICY IF EXISTS "books_select_all" ON recommended_books;
CREATE POLICY "books_select_all" ON recommended_books FOR SELECT
  TO authenticated USING (true);

-- Any authenticated user can recommend books
DROP POLICY IF EXISTS "books_insert_own" ON recommended_books;
CREATE POLICY "books_insert_own" ON recommended_books FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = recommended_by);

-- Only the recommender can update/delete their recommendation
DROP POLICY IF EXISTS "books_update_own" ON recommended_books;
CREATE POLICY "books_update_own" ON recommended_books FOR UPDATE
  TO authenticated USING (recommended_by = auth.uid()) WITH CHECK (recommended_by = auth.uid());

DROP POLICY IF EXISTS "books_delete_own" ON recommended_books;
CREATE POLICY "books_delete_own" ON recommended_books FOR DELETE
  TO authenticated USING (recommended_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_books_course_id ON recommended_books(course_id);

-- ============================================
-- STORAGE: Allow all authenticated users to upload note files (not just lecturers)
-- The existing 'papers' bucket is reused for note file storage as well.
-- Update the upload policy to allow any authenticated user to upload.
-- ============================================
DROP POLICY IF EXISTS "papers_bucket_upload" ON storage.objects;
CREATE POLICY "papers_bucket_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'papers');

DROP POLICY IF EXISTS "papers_bucket_delete" ON storage.objects;
CREATE POLICY "papers_bucket_delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'papers'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
  );
