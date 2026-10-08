DELETE FROM papers
WHERE external_url ILIKE '%unza.zm%'
   OR file_name LIKE 'UNZA Repository item %';

UPDATE programmes SET source_url = NULL;
UPDATE notes SET source_url = NULL;
UPDATE recommended_books SET source_url = NULL, link = NULL;
UPDATE papers SET external_url = NULL WHERE external_url ILIKE '%unza.zm%';

UPDATE institutions
SET name = 'Armarium Independent Study Repository',
    short_name = 'ARM',
    country = 'Independent',
    website = NULL
WHERE short_name = 'UNZA';

UPDATE schools
SET description = regexp_replace(description, 'Official UNZA ', '');
