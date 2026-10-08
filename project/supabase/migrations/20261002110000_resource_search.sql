ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS extracted_text text,
  ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || replace(paper_type, '_', ' ') || ' ' || coalesce(extracted_text, ''))
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_papers_search_vector ON papers USING gin(search_vector);

-- Runs as the caller, so row-level security still hides unapproved or removed files.
CREATE OR REPLACE FUNCTION public.search_resources(q text)
RETURNS TABLE (
  id uuid, course_id uuid, course_code text, course_title text,
  title text, paper_type text, year integer, snippet text
)
LANGUAGE sql
STABLE
AS $$
  SELECT p.id, p.course_id, c.course_code, c.title, p.title, p.paper_type, p.year::integer,
    ts_headline('english', coalesce(p.extracted_text, ''), websearch_to_tsquery('english', q), 'MaxFragments=1,MaxWords=25,MinWords=8')
  FROM papers p
  JOIN courses c ON c.id = p.course_id
  WHERE p.deleted_at IS NULL
    AND length(trim(q)) > 1
    AND (
      p.search_vector @@ websearch_to_tsquery('english', q)
      OR replace(c.course_code, ' ', '') ILIKE '%' || replace(trim(q), ' ', '') || '%'
      OR c.title ILIKE '%' || trim(q) || '%'
    )
  ORDER BY ts_rank(p.search_vector, websearch_to_tsquery('english', q)) DESC, p.year DESC NULLS LAST
  LIMIT 50;
$$;
