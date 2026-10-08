DROP FUNCTION IF EXISTS public.search_resources(text);

CREATE FUNCTION public.search_resources(q text)
RETURNS TABLE (
  kind text, id uuid, course_id uuid, course_code text, course_title text,
  title text, paper_type text, year integer, semester smallint, snippet text
)
LANGUAGE sql
STABLE
AS $$
  (
    SELECT 'course'::text, c.id, c.id, c.course_code, c.title, c.title, NULL::text, NULL::integer, NULL::smallint,
      left(coalesce(c.description, ''), 160)
    FROM courses c
    WHERE length(trim(q)) > 1
      AND (
        replace(c.course_code, ' ', '') ILIKE '%' || replace(trim(q), ' ', '') || '%'
        OR c.title ILIKE '%' || trim(q) || '%'
        OR c.description ILIKE '%' || trim(q) || '%'
      )
    ORDER BY c.course_code
    LIMIT 20
  )
  UNION ALL
  (
    SELECT 'paper'::text, p.id, p.course_id, c.course_code, c.title, p.title, p.paper_type, p.year::integer, p.semester::smallint,
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
    LIMIT 50
  );
$$;

GRANT EXECUTE ON FUNCTION public.search_resources(text) TO anon, authenticated;
