DROP POLICY IF EXISTS "institutions_select_all" ON institutions;
CREATE POLICY "institutions_select_all" ON institutions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "schools_select_all" ON schools;
CREATE POLICY "schools_select_all" ON schools FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "programmes_select_all" ON programmes;
CREATE POLICY "programmes_select_all" ON programmes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "courses_select_all" ON courses;
CREATE POLICY "courses_select_all" ON courses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "papers_select_public_repository_links" ON papers;
CREATE POLICY "papers_select_public_repository_links" ON papers FOR SELECT
  TO anon USING (external_url IS NOT NULL);

DROP POLICY IF EXISTS "notes_select_public_catalogue_notes" ON notes;
CREATE POLICY "notes_select_public_catalogue_notes" ON notes FOR SELECT
  TO anon USING (posted_by IS NULL AND source_url IS NOT NULL);

DROP POLICY IF EXISTS "books_select_public_catalogue_recommendations" ON recommended_books;
CREATE POLICY "books_select_public_catalogue_recommendations" ON recommended_books FOR SELECT
  TO anon USING (recommended_by IS NULL AND source_url IS NOT NULL);
