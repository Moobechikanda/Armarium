CREATE TABLE IF NOT EXISTS study_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 80),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_study_groups_school ON study_groups(school_id);

CREATE TABLE IF NOT EXISTS study_group_members (
  group_id uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_study_group_members_user ON study_group_members(user_id);

CREATE TABLE IF NOT EXISTS group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id, created_at);

-- SECURITY DEFINER avoids recursive policy evaluation on study_group_members.
CREATE OR REPLACE FUNCTION public.is_group_member(target_group uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM study_group_members WHERE group_id = target_group AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.add_group_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO study_group_members (group_id, user_id, role) VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS add_group_owner ON study_groups;
CREATE TRIGGER add_group_owner AFTER INSERT ON study_groups
  FOR EACH ROW EXECUTE FUNCTION public.add_group_owner();

ALTER TABLE study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_read_signed_in" ON study_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "groups_create_own" ON study_groups FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "groups_update_owner_or_admin" ON study_groups FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_armarium_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_armarium_admin());
CREATE POLICY "groups_delete_owner_or_admin" ON study_groups FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_armarium_admin());

CREATE POLICY "members_read_signed_in" ON study_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "members_join_self" ON study_group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'member');
CREATE POLICY "members_leave_or_remove" ON study_group_members FOR DELETE TO authenticated
  USING (
    (user_id = auth.uid() AND role = 'member')
    OR public.is_armarium_admin()
    OR EXISTS (SELECT 1 FROM study_groups WHERE id = group_id AND created_by = auth.uid())
  );

CREATE POLICY "messages_read_members" ON group_messages FOR SELECT TO authenticated
  USING (public.is_group_member(group_id) OR public.is_armarium_admin());
CREATE POLICY "messages_post_members" ON group_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id));
CREATE POLICY "messages_delete_author_owner_or_admin" ON group_messages FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_armarium_admin()
    OR EXISTS (SELECT 1 FROM study_groups WHERE id = group_id AND created_by = auth.uid())
  );
