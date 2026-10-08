ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
UPDATE profiles SET role = 'admin' WHERE role = 'lecturer';
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'admin'));
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'student';

ALTER TABLE papers DROP CONSTRAINT IF EXISTS papers_paper_type_check;
ALTER TABLE papers
  ADD CONSTRAINT papers_paper_type_check CHECK (
    paper_type IN (
      'past_paper', 'test', 'quiz', 'assignment',
      'deferred_exam', 'end_of_semester_exam', 'end_of_year_exam', 'mid_semester_exam'
    )
  );

ALTER TABLE recommended_books
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_name text;

UPDATE storage.buckets SET public = false WHERE id = 'papers';

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND (
    NEW.role IS DISTINCT FROM OLD.role OR
    NEW.has_paid IS DISTINCT FROM OLD.has_paid
  ) THEN
    RAISE EXCEPTION 'Only a database administrator can change profile privileges';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileges ON profiles;
CREATE TRIGGER protect_profile_privileges
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

DROP POLICY IF EXISTS "courses_insert_lecturer" ON courses;
DROP POLICY IF EXISTS "courses_update_own" ON courses;
DROP POLICY IF EXISTS "courses_delete_own" ON courses;
CREATE POLICY "courses_manage_admin" ON courses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "institutions_insert_lecturer" ON institutions;
DROP POLICY IF EXISTS "institutions_update_lecturer" ON institutions;
CREATE POLICY "institutions_manage_admin" ON institutions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "programmes_insert_lecturer" ON programmes;
DROP POLICY IF EXISTS "programmes_update_lecturer" ON programmes;
CREATE POLICY "programmes_manage_admin" ON programmes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "papers_select_paid_or_lecturer" ON papers;
DROP POLICY IF EXISTS "papers_insert_lecturer" ON papers;
DROP POLICY IF EXISTS "papers_update_own" ON papers;
DROP POLICY IF EXISTS "papers_delete_own" ON papers;
CREATE POLICY "papers_select_signed_in" ON papers FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "papers_insert_signed_in" ON papers FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "papers_update_owner_or_admin" ON papers FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (uploaded_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "papers_delete_owner_or_admin" ON papers FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "papers_bucket_read" ON storage.objects;
DROP POLICY IF EXISTS "papers_bucket_upload" ON storage.objects;
DROP POLICY IF EXISTS "papers_bucket_delete" ON storage.objects;
CREATE POLICY "papers_bucket_read_signed_in" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'papers');
CREATE POLICY "papers_bucket_upload_signed_in" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'papers');
CREATE POLICY "papers_bucket_delete_owner_or_admin" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'papers'
    AND (
      owner_id = auth.uid()::text
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT TO authenticated
  USING (true);
