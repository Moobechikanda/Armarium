DROP POLICY IF EXISTS "schools_insert_lecturer" ON schools;
DROP POLICY IF EXISTS "schools_update_lecturer" ON schools;
CREATE POLICY "schools_manage_admin" ON schools FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "answers_insert_lecturer" ON answers;
DROP POLICY IF EXISTS "answers_update_own" ON answers;
DROP POLICY IF EXISTS "answers_delete_own" ON answers;
CREATE POLICY "answers_manage_admin" ON answers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "notes_manage_admin" ON notes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "books_manage_admin" ON recommended_books FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
