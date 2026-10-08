-- Any member can add other signed-up students to a group; students can still join themselves.
DROP POLICY IF EXISTS "members_join_self" ON study_group_members;
CREATE POLICY "members_join_or_add" ON study_group_members FOR INSERT TO authenticated
  WITH CHECK (role = 'member' AND (user_id = auth.uid() OR public.is_group_member(group_id)));
