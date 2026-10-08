CREATE OR REPLACE FUNCTION public.is_armarium_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- A course can belong to many programmes, each with its own year level.
CREATE TABLE IF NOT EXISTS programme_courses (
  programme_id uuid NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  year_level smallint CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 10),
  semester smallint CHECK (semester IS NULL OR semester IN (1, 2)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (programme_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_programme_courses_course ON programme_courses(course_id);

INSERT INTO programme_courses (programme_id, course_id, year_level)
SELECT programme_id, id, year_of_study FROM courses WHERE programme_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE programme_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "programme_courses_read_all" ON programme_courses FOR SELECT USING (true);
CREATE POLICY "programme_courses_manage_admin" ON programme_courses FOR ALL TO authenticated
  USING (public.is_armarium_admin()) WITH CHECK (public.is_armarium_admin());

-- Resource metadata, moderation state, duplicate detection and soft delete.
ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS semester smallint CHECK (semester IS NULL OR semester IN (1, 2)),
  ADD COLUMN IF NOT EXISTS file_hash text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_papers_course_file_hash
  ON papers(course_id, file_hash) WHERE file_hash IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_papers_status ON papers(status) WHERE deleted_at IS NULL;

-- Student uploads wait for review; only admins can change moderation fields.
CREATE OR REPLACE FUNCTION public.papers_moderation_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_armarium_admin() THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.reviewed_by := auth.uid();
      NEW.reviewed_at := now();
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
  ELSIF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
    RAISE EXCEPTION 'Only an administrator can review uploads';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS papers_moderation_guard ON papers;
CREATE TRIGGER papers_moderation_guard
  BEFORE INSERT OR UPDATE ON papers
  FOR EACH ROW EXECUTE FUNCTION public.papers_moderation_guard();

DROP POLICY IF EXISTS "papers_select_signed_in" ON papers;
DROP POLICY IF EXISTS "papers_select_public_repository_links" ON papers;
CREATE POLICY "papers_select_visible" ON papers FOR SELECT TO authenticated
  USING (
    public.is_armarium_admin()
    OR (deleted_at IS NULL AND (status = 'approved' OR uploaded_by = auth.uid()))
  );

-- Reports on broken or wrong files.
CREATE TABLE IF NOT EXISTS file_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_file_reports_status ON file_reports(status);

ALTER TABLE file_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "file_reports_insert_own" ON file_reports FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid());
CREATE POLICY "file_reports_read_own_or_admin" ON file_reports FOR SELECT TO authenticated
  USING (reported_by = auth.uid() OR public.is_armarium_admin());
CREATE POLICY "file_reports_update_admin" ON file_reports FOR UPDATE TO authenticated
  USING (public.is_armarium_admin()) WITH CHECK (public.is_armarium_admin());

-- Who uploaded or changed what.
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_read_admin" ON audit_log FOR SELECT TO authenticated
  USING (public.is_armarium_admin());

CREATE OR REPLACE FUNCTION public.audit_papers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_name text;
  row_data papers;
BEGIN
  row_data := COALESCE(NEW, OLD);
  IF TG_OP = 'INSERT' THEN
    action_name := 'upload';
  ELSIF TG_OP = 'DELETE' THEN
    action_name := 'hard_delete';
  ELSIF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    action_name := CASE WHEN NEW.deleted_at IS NULL THEN 'restore' ELSE 'soft_delete' END;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    action_name := NEW.status;
  ELSE
    action_name := 'edit';
  END IF;
  INSERT INTO audit_log (actor_id, action, table_name, record_id, details)
  VALUES (auth.uid(), action_name, 'papers', row_data.id,
    jsonb_build_object('title', row_data.title, 'course_id', row_data.course_id, 'status', row_data.status));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_papers ON papers;
CREATE TRIGGER audit_papers
  AFTER INSERT OR UPDATE OR DELETE ON papers
  FOR EACH ROW EXECUTE FUNCTION public.audit_papers();
