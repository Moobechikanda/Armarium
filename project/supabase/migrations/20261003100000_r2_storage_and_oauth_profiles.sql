ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'supabase'
    CHECK (storage_provider IN ('supabase', 'r2'));
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'supabase'
    CHECK (storage_provider IN ('supabase', 'r2'));
ALTER TABLE recommended_books
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'supabase'
    CHECK (storage_provider IN ('supabase', 'r2'));
ALTER TABLE answers
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'supabase'
    CHECK (storage_provider IN ('supabase', 'r2'));

CREATE OR REPLACE FUNCTION public.create_student_profile_for_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(COALESCE(NEW.email, 'student'), '@', 1)),
    'student'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_student_profile_for_auth_user ON auth.users;
CREATE TRIGGER create_student_profile_for_auth_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_student_profile_for_auth_user();
