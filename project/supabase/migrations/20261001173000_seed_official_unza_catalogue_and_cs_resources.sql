UPDATE schools
SET name = 'School of Humanities and Social Sciences',
    short_name = 'Humanities & Social Sciences',
    description = 'Official UNZA School of Humanities and Social Sciences.'
WHERE short_name = 'Humanities';

UPDATE schools
SET name = 'School of Nursing Sciences',
    short_name = 'Nursing Sciences',
    description = 'Official UNZA School of Nursing Sciences.'
WHERE short_name = 'Nursing & Public Health';

INSERT INTO schools (name, short_name, description, institution_id)
SELECT v.name, v.short_name, v.description, i.id
FROM (VALUES
  ('School of Public Health', 'Public Health', 'Official UNZA School of Public Health.')
) AS v(name, short_name, description)
CROSS JOIN (SELECT id FROM institutions WHERE short_name = 'UNZA') AS i
WHERE NOT EXISTS (
  SELECT 1 FROM schools s WHERE s.institution_id = i.id AND s.short_name = v.short_name
);

UPDATE programmes
SET school_id = (SELECT id FROM schools WHERE short_name = 'Public Health'),
    source_url = 'https://www.unza.zm/academics/undergraduate/programmes'
WHERE name = 'Bachelor of Science in Public Health'
  AND school_id = (SELECT id FROM schools WHERE short_name = 'Nursing Sciences');

WITH official_programmes (school_short_name, name, qualification) AS (
  VALUES
    ('Agriculture', 'Bachelor of Agricultural Sciences (Animal Science)', 'Bachelor'),
    ('Agriculture', 'Bachelor of Agricultural Sciences (Land Management)', 'Bachelor'),
    ('Agriculture', 'Bachelor of Agricultural Sciences (Plant Science)', 'Bachelor'),
    ('Agriculture', 'Bachelor of Food Science and Technology', 'Bachelor'),
    ('Agriculture', 'Bachelor of Science in Agricultural Economics', 'Bachelor'),
    ('Agriculture', 'Bachelor of Science in Agricultural Extension', 'Bachelor'),
    ('Agriculture', 'Bachelor of Science in Agronomy', 'Bachelor'),
    ('Agriculture', 'Bachelor of Science in Human Nutrition', 'Bachelor'),
    ('Education', 'Bachelor of Adult Education', 'Bachelor'),
    ('Education', 'Bachelor of Agricultural Science with Education', 'Bachelor'),
    ('Education', 'Bachelor of Arts in Records and Archives Management', 'Bachelor'),
    ('Education', 'Bachelor of Arts with Education', 'Bachelor'),
    ('Education', 'Bachelor of Arts with Library and Information Studies', 'Bachelor'),
    ('Education', 'Bachelor of Community Education', 'Bachelor'),
    ('Education', 'Bachelor of Cultural Studies', 'Bachelor'),
    ('Education', 'Bachelor of Education (Early Childhood Education)', 'Bachelor'),
    ('Education', 'Bachelor of Education (Educational Administration and Management)', 'Bachelor'),
    ('Education', 'Bachelor of Education (Educational Psychology)', 'Bachelor'),
    ('Education', 'Bachelor of Education (Environmental Education and Management)', 'Bachelor'),
    ('Education', 'Bachelor of Education (Guidance and Counselling)', 'Bachelor'),
    ('Education', 'Bachelor of Education (Literacy and Language)', 'Bachelor'),
    ('Education', 'Bachelor of Education-Secondary (Mathematics and Science)', 'Bachelor'),
    ('Education', 'Bachelor of Education (Primary Education)', 'Bachelor'),
    ('Education', 'Bachelor of Education (Sociology of Education)', 'Bachelor'),
    ('Education', 'Bachelor of Education (Special Education)', 'Bachelor'),
    ('Education', 'Bachelor of Education in Chinese Language Teaching', 'Bachelor'),
    ('Education', 'Bachelor of Education in Commerce and Entrepreneurship', 'Bachelor'),
    ('Education', 'Bachelor of Information and Communication Technologies in Education', 'Bachelor'),
    ('Education', 'Bachelor of Science with Education', 'Bachelor'),
    ('Education', 'Bachelor of Youth Development and Leadership', 'Bachelor'),
    ('Education', 'Diploma in Information and Communication Technologies (ICTS) (Fast Track)', 'Diploma'),
    ('Engineering', 'Bachelor of Engineering (Agricultural Engineering)', 'Bachelor'),
    ('Engineering', 'Bachelor of Engineering (Civil and Environmental Engineering)', 'Bachelor'),
    ('Engineering', 'Bachelor of Engineering (Electrical and Electronic Engineering)', 'Bachelor'),
    ('Engineering', 'Bachelor of Engineering (Geomatic Engineering)', 'Bachelor'),
    ('Engineering', 'Bachelor of Engineering (Mechanical Engineering)', 'Bachelor'),
    ('GSB', 'Bachelor of Science in Accounting and Finance (Fulltime and Evening)', 'Bachelor'),
    ('GSB', 'Bachelor of Science in Business Management (Fulltime and Evening)', 'Bachelor'),
    ('GSB', 'Bachelor of Science in Entrepreneurship and Innovation Management', 'Bachelor'),
    ('GSB', 'Bachelor of Science in Human Resource Management (Fulltime and Evening)', 'Bachelor'),
    ('GSB', 'Bachelor of Science in Marketing (Fulltime and Evening)', 'Bachelor'),
    ('GSB', 'Bachelor of Science in Logistics and Transport Management (Full-time and Evening)', 'Bachelor'),
    ('Health Sciences', 'Bachelor of Pharmacy', 'Bachelor'),
    ('Health Sciences', 'Bachelor of Science in Biomedical Science', 'Bachelor'),
    ('Health Sciences', 'Bachelor of Science in Physiotherapy', 'Bachelor'),
    ('Health Sciences', 'Bachelor of Science in Radiography', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Applied Ethics and Management', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Archaeology', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Chinese Language and Linguistics', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Criminology and Security Studies', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Demography', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Development Studies', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Economics', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in English Language and Linguistics', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in French', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Gender Studies', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in History', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Human Resource Management', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Intangible Cultural Heritage', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in International Relations', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Linguistics and African Languages', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Local Government Administration', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Peace, Security, and Conflict Resolution', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Philosophy and Applied Ethics', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Political Science', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Project Management', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Psychology', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Public Administration', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Rural Sociology and Community Development', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Arts in Sociology', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Business Administration', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Media and Journalism Studies', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Public Relations and Advertising', 'Bachelor'),
    ('Humanities & Social Sciences', 'Bachelor of Social Work', 'Bachelor'),
    ('Law', 'Bachelor of Law', 'Bachelor'),
    ('Medicine', 'Bachelor of Medicine and Surgery (Regular and Parallel)', 'Bachelor'),
    ('Medicine', 'Bachelor of Science in Clinical Medicine for Clinical Officers', 'Bachelor'),
    ('Mines', 'Bachelor of Engineering in Geotechnical Engineering', 'Bachelor'),
    ('Mines', 'Bachelor of Engineering in Metallurgical Engineering', 'Bachelor'),
    ('Mines', 'Bachelor of Engineering Mining Engineering', 'Bachelor'),
    ('Mines', 'Bachelor of Science in Geology', 'Bachelor'),
    ('Mines', 'Bachelor of Science in Occupational Safety Health and Environment', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Computer Science', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Computer Science in Computer Systems Engineering', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Computer Science in Networking and Information Security', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Computer Science in Software Engineering', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Science in Actuarial Science', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Science in Biological Sciences', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Science in Chemical and Biological Sciences', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Science in Chemistry', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Science in Chemistry/Biology', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Science in Chemistry/Geology', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Science in Ecology and Wildlife Management', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Science in Environmental and Natural Resource Management', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Science in Mathematics', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Science in Microbiology', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Science in Molecular Biology and Genetics', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Science in Parasitology', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Science in Physics', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Science in Physics/Mathematics', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Science in Physics/Geology', 'Bachelor'),
    ('Natural & Applied Sciences', 'Bachelor of Science in Statistics', 'Bachelor'),
    ('Nursing Sciences', 'Bachelor of Science in Mental Health Nursing', 'Bachelor'),
    ('Nursing Sciences', 'Bachelor of Science in Midwifery', 'Bachelor'),
    ('Nursing Sciences', 'Bachelor of Science in Nursing', 'Bachelor'),
    ('Nursing Sciences', 'Bachelor of Science in Oncology Nursing', 'Bachelor'),
    ('Nursing Sciences', 'Bachelor of Science in Public Health Nursing', 'Bachelor'),
    ('Nursing Sciences', 'Diploma in Registered Midwifery', 'Diploma'),
    ('Nursing Sciences', 'Diploma in Registered Nursing', 'Diploma'),
    ('Public Health', 'Bachelor in Health Promotion', 'Bachelor'),
    ('Public Health', 'Bachelor of Science in Environmental Health', 'Bachelor'),
    ('Public Health', 'Bachelor of Science in Health Services Management and Planning', 'Bachelor'),
    ('Public Health', 'Bachelor of Science in Public Health', 'Bachelor'),
    ('Veterinary Medicine', 'Bachelor of Veterinary Medicine', 'Bachelor')
)
INSERT INTO programmes (school_id, name, qualification, source_url)
SELECT s.id, p.name, p.qualification, 'https://www.unza.zm/academics/undergraduate/programmes'
FROM official_programmes p
JOIN schools s ON s.short_name = p.school_short_name
WHERE s.institution_id = (SELECT id FROM institutions WHERE short_name = 'UNZA')
  AND NOT EXISTS (
    SELECT 1 FROM programmes existing
    WHERE existing.school_id = s.id AND existing.name = p.name
  );

UPDATE courses
SET programme_id = (
  SELECT p.id
  FROM programmes p
  JOIN schools s ON s.id = p.school_id
  WHERE p.name = 'Bachelor of Computer Science'
    AND s.short_name = 'Natural & Applied Sciences'
    AND s.institution_id = (SELECT id FROM institutions WHERE short_name = 'UNZA')
)
WHERE course_code LIKE 'CSC%';

INSERT INTO papers (course_id, title, paper_type, year, external_url, file_name)
SELECT c.id,
       'Natural Sciences Past Examination Papers, 2020-2021',
       'past_paper', 2021,
       'https://dspace.unza.zm/items/d0c6cfa2-e17c-4fab-81b3-61d8e9d33dfc',
       'UNZA Repository item d0c6cfa2-e17c-4fab-81b3-61d8e9d33dfc'
FROM courses c
WHERE c.course_code LIKE 'CSC%'
  AND NOT EXISTS (
    SELECT 1 FROM papers p
    WHERE p.course_id = c.id AND p.external_url = 'https://dspace.unza.zm/items/d0c6cfa2-e17c-4fab-81b3-61d8e9d33dfc'
  );

WITH recommendations (course_code, title, author, link, description) AS (
  VALUES
    ('CSC 2901', 'Discrete Mathematics and Its Applications', 'Kenneth H. Rosen', 'https://openlibrary.org/search?q=Discrete+Mathematics+and+Its+Applications+Rosen', 'Reference for logic, proof, sets, relations, graphs, and combinatorics.'),
    ('CSC 2101', 'Computer Systems: A Programmer''s Perspective', 'Randal E. Bryant and David R. O''Hallaron', 'https://openlibrary.org/search?q=Computer+Systems+A+Programmer%27s+Perspective', 'Reference for machine-level representation, processor architecture, memory, and systems programming.'),
    ('CSC 2111', 'Computer Organization and Design', 'David A. Patterson and John L. Hennessy', 'https://openlibrary.org/search?q=Computer+Organization+and+Design+Patterson+Hennessy', 'Reference for instruction sets, datapaths, processors, memory, and input/output.'),
    ('CSC 2702', 'Database System Concepts', 'Abraham Silberschatz, Henry F. Korth, and S. Sudarshan', 'https://openlibrary.org/search?q=Database+System+Concepts+Silberschatz+Korth+Sudarshan', 'Reference for relational data models, SQL, transactions, and database design.'),
    ('CSC 2202', 'Operating System Concepts', 'Abraham Silberschatz, Peter B. Galvin, and Greg Gagne', 'https://openlibrary.org/search?q=Operating+System+Concepts+Silberschatz', 'Reference for processes, memory management, file systems, and concurrency.'),
    ('CSC 2000', 'Think Python', 'Allen B. Downey', 'https://greenteapress.com/wp/think-python-3e/', 'Free online introduction to programming and computational thinking.'),
    ('CSC 2912', 'Numerical Analysis', 'Richard L. Burden, J. Douglas Faires, and Annette M. Burden', 'https://openlibrary.org/search?q=Numerical+Analysis+Burden+Faires', 'Reference for numerical error, roots, interpolation, integration, and differential equations.'),
    ('CSC 3120', 'Digital Design', 'M. Morris Mano and Michael D. Ciletti', 'https://openlibrary.org/search?q=Digital+Design+Mano+Ciletti', 'Reference for Boolean algebra, combinational logic, sequential circuits, and digital systems.'),
    ('CSC 3301', 'Programming Language Pragmatics', 'Michael L. Scott', 'https://openlibrary.org/search?q=Programming+Language+Pragmatics+Scott', 'Reference for language design, semantics, implementation, and programming paradigms.'),
    ('CSC 3801', 'Data and Computer Communications', 'William Stallings', 'https://openlibrary.org/search?q=Data+and+Computer+Communications+Stallings', 'Reference for network models, protocols, transmission, and network security.'),
    ('CSC 3612', 'Information Technology Project Management', 'Kathy Schwalbe', 'https://openlibrary.org/search?q=Information+Technology+Project+Management+Schwalbe', 'Reference for project scope, scheduling, risk, teams, and delivery.'),
    ('CSC 3712', 'Fundamentals of Database Systems', 'Ramez Elmasri and Shamkant B. Navathe', 'https://openlibrary.org/search?q=Fundamentals+of+Database+Systems+Elmasri+Navathe', 'Reference for advanced database modeling, query processing, and distributed data.'),
    ('CSC 3601', 'Introduction to Algorithms', 'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, and Clifford Stein', 'https://openlibrary.org/search?q=Introduction+to+Algorithms+Cormen', 'Reference for algorithm design, data structures, graph algorithms, and complexity.'),
    ('CSC 3402', 'Artificial Intelligence: A Modern Approach', 'Stuart Russell and Peter Norvig', 'https://aima.cs.berkeley.edu/', 'Author-hosted companion resource for search, reasoning, learning, and intelligent agents.'),
    ('CSC 3009', 'The Pragmatic Programmer', 'David Thomas and Andrew Hunt', 'https://openlibrary.org/search?q=The+Pragmatic+Programmer+Thomas+Hunt', 'Professional practice reference for software development, collaboration, and continuous learning.'),
    ('CSC 4812', 'Distributed and Cloud Computing', 'Kai Hwang, Geoffrey C. Fox, and Jack J. Dongarra', 'https://openlibrary.org/search?q=Distributed+and+Cloud+Computing+Hwang+Fox+Dongarra', 'Reference for distributed systems, cloud platforms, parallel computing, and performance.'),
    ('CSC 4835', 'Wireless Communications', 'Andrea Goldsmith', 'https://openlibrary.org/search?q=Wireless+Communications+Andrea+Goldsmith', 'Reference for wireless channels, modulation, diversity, and cellular systems.'),
    ('CSC 4765', 'Interaction Design', 'Preece, Rogers, and Sharp', 'https://openlibrary.org/search?q=Interaction+Design+Preece+Rogers+Sharp', 'Reference for user-centered design, prototyping, evaluation, and interaction principles.'),
    ('CSC 4004', 'The Craft of Research', 'Wayne C. Booth, Gregory G. Colomb, Joseph M. Williams, and others', 'https://openlibrary.org/search?q=The+Craft+of+Research+Booth+Colomb+Williams', 'Reference for research questions, evidence, argument, and academic writing.'),
    ('CSC 4130', 'Digital Design and Computer Architecture', 'David Money Harris and Sarah L. Harris', 'https://openlibrary.org/search?q=Digital+Design+and+Computer+Architecture+Harris', 'Reference for hardware description, logic design, processors, and computer architecture.'),
    ('CSC 4722', 'Distributed Systems: Concepts and Design', 'George Coulouris, Jean Dollimore, Tim Kindberg, and Gordon Blair', 'https://openlibrary.org/search?q=Distributed+Systems+Concepts+and+Design+Coulouris', 'Reference for distributed communication, coordination, replication, and fault tolerance.'),
    ('CSC 4300', 'The Complete Software Developer''s Career Guide', 'John Sonmez', 'https://openlibrary.org/search?q=The+Complete+Software+Developer%27s+Career+Guide', 'Professional practice reading for software delivery, teamwork, and workplace readiness.'),
    ('CSC 4792', 'Data Mining: Concepts and Techniques', 'Jiawei Han, Micheline Kamber, and Jian Pei', 'https://openlibrary.org/search?q=Data+Mining+Concepts+and+Techniques+Han+Kamber+Pei', 'Reference for data preparation, classification, clustering, association, and evaluation.')
)
INSERT INTO recommended_books (course_id, title, author, description, link, source_url)
SELECT c.id, r.title, r.author, r.description, r.link, r.link
FROM recommendations r
JOIN courses c ON c.course_code = r.course_code
WHERE NOT EXISTS (
  SELECT 1 FROM recommended_books b
  WHERE b.course_id = c.id AND b.title = r.title
);

INSERT INTO notes (course_id, title, content, source_url)
SELECT c.id,
       'Unofficial starter revision guide',
       'Starter study note for ' || c.course_code || ' - ' || c.title || '. Use the current lecturer-issued outline to create a week-by-week topic checklist, add your own definitions and worked examples, and use the linked past-paper record for revision. This is a community study aid, not an official UNZA syllabus; verify all coverage with your lecturer.',
       'https://www.unza.zm/undergraduate/school-of-natural-and-applied-sciences/computing-and-informatics/bachelor-of-computer-science'
FROM courses c
WHERE c.course_code LIKE 'CSC%'
  AND NOT EXISTS (
    SELECT 1 FROM notes n WHERE n.course_id = c.id AND n.title = 'Unofficial starter revision guide'
  );
