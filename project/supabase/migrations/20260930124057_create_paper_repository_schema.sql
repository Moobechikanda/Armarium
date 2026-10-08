/*
# UNZA CS Department Past Paper Repository — Initial Schema

## Overview
Creates the full database schema for a past paper repository for the University of Zambia
Computer Science Department. Supports courses, papers (past papers/tests/quizzes/assignments),
lecturer-provided answers, student questions and lecturer/AI answers, student payments for access,
and role-based access (student vs lecturer).

## Tables

### profiles
Extends auth.users with role (student/lecturer), full name, and payment status.
- id (uuid, PK, references auth.users)
- full_name (text)
- role (text: 'student' | 'lecturer')
- has_paid (boolean, default false — whether student has paid for access)
- created_at (timestamptz)

### courses
Represents a course (subject) in the CS department.
- id (uuid, PK)
- course_code (text, unique, e.g. "CSC 201")
- title (text, e.g. "Data Structures and Algorithms")
- description (text)
- created_by (uuid, references profiles — the lecturer who created it)
- created_at (timestamptz)

### papers
Past papers, test papers, quizzes, or assignments uploaded under a course.
- id (uuid, PK)
- course_id (uuid, references courses, ON DELETE CASCADE)
- title (text)
- paper_type (text: 'past_paper' | 'test' | 'quiz' | 'assignment')
- year (int)
- file_path (text — path to the uploaded file in storage)
- file_name (text — original file name)
- uploaded_by (uuid, references profiles)
- created_at (timestamptz)

### answers
Lecturer-provided answers/marking guides for papers.
- id (uuid, PK)
- paper_id (uuid, references papers, ON DELETE CASCADE)
- content (text — the answer/mark scheme text)
- file_path (text, nullable — optional uploaded answer file)
- file_name (text, nullable)
- posted_by (uuid, references profiles)
- created_at (timestamptz)

### questions
Student questions about a paper or course topic.
- id (uuid, PK)
- paper_id (uuid, nullable, references papers, ON DELETE CASCADE)
- course_id (uuid, references courses, ON DELETE CASCADE)
- title (text)
- body (text)
- asked_by (uuid, references profiles)
- created_at (timestamptz)

### question_answers
Answers to student questions (by lecturers or AI).
- id (uuid, PK)
- question_id (uuid, references questions, ON DELETE CASCADE)
- content (text)
- answered_by (uuid, nullable, references profiles — null if AI-generated)
- is_ai_answer (boolean, default false)
- created_at (timestamptz)

### ai_solutions
AI-generated solutions for papers (when a student uses the AI solver).
- id (uuid, PK)
- paper_id (uuid, references papers, ON DELETE CASCADE)
- content (text — the AI-generated solution)
- requested_by (uuid, references profiles)
- created_at (timestamptz)

## Security (RLS)
- profiles: users can read all profiles (to see lecturer names), update only their own.
- courses: anyone authenticated can read; lecturers can create/update/delete their own.
- papers: authenticated users can read (students only if has_paid); lecturers can manage their own.
- answers: authenticated users can read (students only if has_paid); lecturers can manage their own.
- questions: students can read all and manage their own; lecturers can read all.
- question_answers: anyone authenticated can read; the question owner or lecturer can post.
- ai_solutions: the requesting student can read their own; lecturers can read for their courses.

## Storage
A storage bucket 'papers' is created for storing paper files and answer files.
*/

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'lecturer')),
  has_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- ============================================
-- COURSES
-- ============================================
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code text UNIQUE NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- All authenticated users can see courses
DROP POLICY IF EXISTS "courses_select_all" ON courses;
CREATE POLICY "courses_select_all" ON courses FOR SELECT
  TO authenticated USING (true);

-- Only lecturers can create courses
DROP POLICY IF EXISTS "courses_insert_lecturer" ON courses;
CREATE POLICY "courses_insert_lecturer" ON courses FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer')
  );

-- Only the creator lecturer can update/delete
DROP POLICY IF EXISTS "courses_update_own" ON courses;
CREATE POLICY "courses_update_own" ON courses FOR UPDATE
  TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "courses_delete_own" ON courses;
CREATE POLICY "courses_delete_own" ON courses FOR DELETE
  TO authenticated USING (created_by = auth.uid());

-- ============================================
-- PAPERS
-- ============================================
CREATE TABLE IF NOT EXISTS papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  paper_type text NOT NULL DEFAULT 'past_paper' CHECK (paper_type IN ('past_paper', 'test', 'quiz', 'assignment')),
  year int,
  file_path text,
  file_name text,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE papers ENABLE ROW LEVEL SECURITY;

-- Students who have paid can read, lecturers can read all
DROP POLICY IF EXISTS "papers_select_paid_or_lecturer" ON papers;
CREATE POLICY "papers_select_paid_or_lecturer" ON papers FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'lecturer' OR has_paid = true))
  );

-- Lecturers can insert papers
DROP POLICY IF EXISTS "papers_insert_lecturer" ON papers;
CREATE POLICY "papers_insert_lecturer" ON papers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer')
  );

-- Uploader can update/delete their own papers
DROP POLICY IF EXISTS "papers_update_own" ON papers;
CREATE POLICY "papers_update_own" ON papers FOR UPDATE
  TO authenticated USING (uploaded_by = auth.uid()) WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "papers_delete_own" ON papers;
CREATE POLICY "papers_delete_own" ON papers FOR DELETE
  TO authenticated USING (uploaded_by = auth.uid());

-- ============================================
-- ANSWERS (lecturer-provided answer/marking guides)
-- ============================================
CREATE TABLE IF NOT EXISTS answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  file_path text,
  file_name text,
  posted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

-- Students who have paid can read, lecturers can read all
DROP POLICY IF EXISTS "answers_select_paid_or_lecturer" ON answers;
CREATE POLICY "answers_select_paid_or_lecturer" ON answers FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'lecturer' OR has_paid = true))
  );

-- Lecturers can insert answers
DROP POLICY IF EXISTS "answers_insert_lecturer" ON answers;
CREATE POLICY "answers_insert_lecturer" ON answers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer')
  );

-- Poster can update/delete their own answers
DROP POLICY IF EXISTS "answers_update_own" ON answers;
CREATE POLICY "answers_update_own" ON answers FOR UPDATE
  TO authenticated USING (posted_by = auth.uid()) WITH CHECK (posted_by = auth.uid());

DROP POLICY IF EXISTS "answers_delete_own" ON answers;
CREATE POLICY "answers_delete_own" ON answers FOR DELETE
  TO authenticated USING (posted_by = auth.uid());

-- ============================================
-- QUESTIONS (student questions)
-- ============================================
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid REFERENCES papers(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  asked_by uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read questions
DROP POLICY IF EXISTS "questions_select_all" ON questions;
CREATE POLICY "questions_select_all" ON questions FOR SELECT
  TO authenticated USING (true);

-- Students and lecturers can post questions
DROP POLICY IF EXISTS "questions_insert_own" ON questions;
CREATE POLICY "questions_insert_own" ON questions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = asked_by);

-- Only the asker can update/delete their question
DROP POLICY IF EXISTS "questions_update_own" ON questions;
CREATE POLICY "questions_update_own" ON questions FOR UPDATE
  TO authenticated USING (asked_by = auth.uid()) WITH CHECK (asked_by = auth.uid());

DROP POLICY IF EXISTS "questions_delete_own" ON questions;
CREATE POLICY "questions_delete_own" ON questions FOR DELETE
  TO authenticated USING (asked_by = auth.uid());

-- ============================================
-- QUESTION_ANSWERS (lecturer or AI answers to questions)
-- ============================================
CREATE TABLE IF NOT EXISTS question_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  answered_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_ai_answer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE question_answers ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read answers to questions
DROP POLICY IF EXISTS "qanswers_select_all" ON question_answers;
CREATE POLICY "qanswers_select_all" ON question_answers FOR SELECT
  TO authenticated USING (true);

-- Lecturers can answer questions; students can also answer (e.g. AI requests)
DROP POLICY IF EXISTS "qanswers_insert_own" ON question_answers;
CREATE POLICY "qanswers_insert_own" ON question_answers FOR INSERT
  TO authenticated WITH CHECK (
    answered_by IS NULL OR answered_by = auth.uid()
  );

-- Only the answerer can update/delete
DROP POLICY IF EXISTS "qanswers_update_own" ON question_answers;
CREATE POLICY "qanswers_update_own" ON question_answers FOR UPDATE
  TO authenticated USING (answered_by = auth.uid()) WITH CHECK (answered_by = auth.uid());

DROP POLICY IF EXISTS "qanswers_delete_own" ON question_answers;
CREATE POLICY "qanswers_delete_own" ON question_answers FOR DELETE
  TO authenticated USING (answered_by = auth.uid());

-- ============================================
-- AI_SOLUTIONS (AI-generated paper solutions)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_solutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  requested_by uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_solutions ENABLE ROW LEVEL SECURITY;

-- The requesting student can read their own AI solutions; lecturers can read for their courses
DROP POLICY IF EXISTS "ai_solutions_select_own_or_lecturer" ON ai_solutions;
CREATE POLICY "ai_solutions_select_own_or_lecturer" ON ai_solutions FOR SELECT
  TO authenticated USING (
    requested_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer')
  );

-- Any authenticated user can request an AI solution (the edge function will verify payment)
DROP POLICY IF EXISTS "ai_solutions_insert_own" ON ai_solutions;
CREATE POLICY "ai_solutions_insert_own" ON ai_solutions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = requested_by);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_papers_course_id ON papers(course_id);
CREATE INDEX IF NOT EXISTS idx_answers_paper_id ON answers(paper_id);
CREATE INDEX IF NOT EXISTS idx_questions_course_id ON questions(course_id);
CREATE INDEX IF NOT EXISTS idx_questions_paper_id ON questions(paper_id);
CREATE INDEX IF NOT EXISTS idx_qanswers_question_id ON question_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_ai_solutions_paper_id ON ai_solutions(paper_id);

-- ============================================
-- STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('papers', 'papers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can read, lecturers can upload
DROP POLICY IF EXISTS "papers_bucket_read" ON storage.objects;
CREATE POLICY "papers_bucket_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'papers');

DROP POLICY IF EXISTS "papers_bucket_upload" ON storage.objects;
CREATE POLICY "papers_bucket_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'papers'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer')
  );

DROP POLICY IF EXISTS "papers_bucket_delete" ON storage.objects;
CREATE POLICY "papers_bucket_delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'papers'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lecturer')
  );
