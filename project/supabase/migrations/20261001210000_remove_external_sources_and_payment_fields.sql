DROP POLICY IF EXISTS "papers_select_public_repository_links" ON papers;
DROP POLICY IF EXISTS "notes_select_public_catalogue_notes" ON notes;
DROP POLICY IF EXISTS "books_select_public_catalogue_recommendations" ON recommended_books;
DROP POLICY IF EXISTS "answers_select_paid_or_lecturer" ON answers;
CREATE POLICY "answers_select_authenticated" ON answers FOR SELECT TO authenticated
  USING (true);

ALTER TABLE papers DROP COLUMN IF EXISTS external_url;
ALTER TABLE programmes DROP COLUMN IF EXISTS source_url;
ALTER TABLE notes DROP COLUMN IF EXISTS source_url;
ALTER TABLE recommended_books DROP COLUMN IF EXISTS source_url;
ALTER TABLE recommended_books DROP COLUMN IF EXISTS link;

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Only a database administrator can change account roles';
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE profiles DROP COLUMN IF EXISTS has_paid;
