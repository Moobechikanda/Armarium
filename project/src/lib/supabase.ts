import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Institution = {
  id: string;
  name: string;
  short_name: string;
  country: string;
  website: string | null;
  created_at: string;
};

export type School = {
  id: string;
  name: string;
  short_name: string;
  description: string;
  institution_id: string | null;
  ai_guidance: string;
  created_at: string;
};

export type Programme = {
  id: string;
  school_id: string;
  parent_programme_id: string | null;
  name: string;
  qualification: string | null;
  duration_years: number | null;
  ai_guidance: string;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  role: 'student' | 'admin';
  programme_id: string | null;
  study_year: number | null;
  created_at: string;
};

export type Course = {
  id: string;
  course_code: string;
  title: string;
  description: string;
  year_of_study: number | null;
  school_id: string | null;
  programme_id: string | null;
  ai_guidance: string;
  created_by: string | null;
  created_at: string;
};

export type Paper = {
  id: string;
  course_id: string;
  title: string;
  paper_type: 'past_paper' | 'test' | 'quiz' | 'assignment' | 'deferred_exam' | 'end_of_semester_exam' | 'end_of_year_exam' | 'mid_semester_exam';
  year: number | null;
  semester: 1 | 2 | null;
  file_hash: string | null;
  status: 'pending' | 'approved' | 'rejected';
  deleted_at: string | null;
  file_path: string | null;
  storage_provider: 'supabase' | 'r2';
  file_name: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type ProgrammeCourseLink = {
  programme_id: string;
  course_id: string;
  year_level: number | null;
  semester: 1 | 2 | null;
};

export type FileReport = {
  id: string;
  paper_id: string;
  reported_by: string;
  reason: string;
  status: 'open' | 'resolved';
  created_at: string;
};

export type Answer = {
  id: string;
  paper_id: string;
  content: string;
  file_path: string | null;
  storage_provider: 'supabase' | 'r2';
  file_name: string | null;
  posted_by: string | null;
  created_at: string;
};

export type Question = {
  id: string;
  paper_id: string | null;
  course_id: string;
  title: string;
  body: string;
  asked_by: string;
  created_at: string;
};

export type QuestionAnswer = {
  id: string;
  question_id: string;
  content: string;
  answered_by: string | null;
  is_ai_answer: boolean;
  created_at: string;
};

export type AiSolution = {
  id: string;
  paper_id: string;
  content: string;
  requested_by: string;
  created_at: string;
};

export type Note = {
  id: string;
  course_id: string;
  title: string;
  content: string;
  file_path: string | null;
  storage_provider: 'supabase' | 'r2';
  file_name: string | null;
  posted_by: string | null;
  created_at: string;
};

export type RecommendedBook = {
  id: string;
  course_id: string;
  title: string;
  author: string;
  isbn: string | null;
  description: string;
  file_path: string | null;
  storage_provider: 'supabase' | 'r2';
  file_name: string | null;
  recommended_by: string | null;
  created_at: string;
};

export const PAPER_TYPES = [
  { value: 'past_paper', label: 'Past Paper' },
  { value: 'deferred_exam', label: 'Deferred Exam' },
  { value: 'end_of_semester_exam', label: 'End-of-Semester Exam' },
  { value: 'end_of_year_exam', label: 'End-of-Year Exam' },
  { value: 'mid_semester_exam', label: 'Mid-Semester Exam' },
  { value: 'test', label: 'Test' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'assignment', label: 'Assignment' },
] as const;

export const STORAGE_BUCKET = 'papers';

// Links come from programme_courses; falls back to courses.programme_id before the table exists.
export async function buildCourseLinker(courses: Course[]) {
  const { data, error } = await supabase.from('programme_courses').select('*');
  const links: ProgrammeCourseLink[] = !error && data
    ? data as ProgrammeCourseLink[]
    : courses.flatMap(course => course.programme_id ? [{ programme_id: course.programme_id, course_id: course.id, year_level: course.year_of_study, semester: null }] : []);
  const byId = new Map(courses.map(course => [course.id, course]));
  const linkedIds = new Set(links.map(link => link.course_id));
  return {
    coursesFor: (programmeId: string): Course[] => links
      .filter(link => link.programme_id === programmeId)
      .flatMap(link => {
        const course = byId.get(link.course_id);
        return course ? [{ ...course, year_of_study: link.year_level ?? course.year_of_study }] : [];
      })
      .sort((a, b) => a.course_code.localeCompare(b.course_code)),
    unlinkedFor: (schoolId: string): Course[] => courses.filter(course => course.school_id === schoolId && !linkedIds.has(course.id)),
  };
}

export async function sha256Hex(file: File): Promise<string> {
  // crypto.subtle only exists on https or localhost; fall back so uploads still work elsewhere.
  if (!globalThis.crypto?.subtle) return `weak:${file.size}-${file.lastModified}-${file.name}`;
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

const FILENAME_TYPES: Record<string, Paper['paper_type']> = {
  endsemester: 'end_of_semester_exam',
  endofsemester: 'end_of_semester_exam',
  endyear: 'end_of_year_exam',
  endofyear: 'end_of_year_exam',
  midsemester: 'mid_semester_exam',
  mid: 'mid_semester_exam',
  deferred: 'deferred_exam',
  supplementary: 'deferred_exam',
  pastpaper: 'past_paper',
  test: 'test',
  quiz: 'quiz',
  assignment: 'assignment',
};

// Parses names like EEE2110_2023_S1_EndSemester.pdf.
export function parsePaperFilename(fileName: string) {
  const parts = fileName.replace(/\.[^.]+$/, '').split(/[_\s-]+/);
  const code = (parts[0] || '').replace(/\s+/g, '').toUpperCase();
  const year = parts.map(part => /^(19|20)\d{2}$/.test(part) ? Number(part) : null).find(Boolean) ?? null;
  const semesterPart = parts.find(part => /^s[12]$/i.test(part));
  const semester = semesterPart ? (Number(semesterPart[1]) as 1 | 2) : null;
  const typePart = parts.map(part => part.toLowerCase().replace(/[^a-z]/g, '')).find(part => FILENAME_TYPES[part]);
  return { code, year, semester, paperType: typePart ? FILENAME_TYPES[typePart] : null };
}

export function normaliseCourseCode(code: string) {
  return code.replace(/\s+/g, '').toUpperCase();
}

