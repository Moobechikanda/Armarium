import { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase, normaliseCourseCode, type Course, type Programme, type School } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Input';

const COLUMNS = ['school', 'program', 'year_level', 'course_code', 'course_title', 'semester'] as const;

type ImportRow = {
  line: number;
  school: string;
  program: string;
  yearLevel: number | null;
  courseCode: string;
  courseTitle: string;
  semester: 1 | 2 | null;
  errors: string[];
  notes: string[];
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell.trim()); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(cell.trim());
      if (row.some(value => value)) rows.push(row);
      row = []; cell = '';
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(value => value)) rows.push(row);
  return rows;
}

const lower = (value: string) => value.trim().toLowerCase();

export function AdminImportPage() {
  const { profile } = useAuth();
  const [csv, setCsv] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setCsv(await file.text());
  }

  async function validate() {
    setMessage(''); setDone(false);
    const table = parseCsv(csv);
    const header = (table[0] || []).map(lower);
    const missing = COLUMNS.filter(column => !header.includes(column));
    if (missing.length) {
      setRows([]);
      setMessage(`Missing columns: ${missing.join(', ')}. Expected: ${COLUMNS.join(', ')}.`);
      return;
    }
    const [{ data: schools }, { data: programmes }, { data: courses }] = await Promise.all([
      supabase.from('schools').select('*'),
      supabase.from('programmes').select('*'),
      supabase.from('courses').select('*'),
    ]);
    const schoolList = schools as School[] || [];
    const programmeList = programmes as Programme[] || [];
    const courseCodes = new Set((courses as Course[] || []).map(course => normaliseCourseCode(course.course_code)));
    const seenSchools = new Set<string>();
    const seenProgrammes = new Set<string>();
    const seenCourses = new Set<string>();

    setRows(table.slice(1).map((cells, index): ImportRow => {
      const get = (column: typeof COLUMNS[number]) => cells[header.indexOf(column)] || '';
      const yearText = get('year_level');
      const semesterText = get('semester');
      const row: ImportRow = {
        line: index + 2,
        school: get('school'),
        program: get('program'),
        yearLevel: yearText ? Number(yearText) : null,
        courseCode: get('course_code').toUpperCase(),
        courseTitle: get('course_title'),
        semester: semesterText ? (Number(semesterText) as 1 | 2) : null,
        errors: [],
        notes: [],
      };
      if (!row.school) row.errors.push('school is required');
      if (!row.program) row.errors.push('program is required');
      if (!row.courseCode) row.errors.push('course_code is required');
      if (!row.courseTitle) row.errors.push('course_title is required');
      if (row.yearLevel !== null && (!Number.isInteger(row.yearLevel) || row.yearLevel < 1 || row.yearLevel > 10)) row.errors.push('year_level must be 1-10');
      if (row.semester !== null && row.semester !== 1 && row.semester !== 2) row.errors.push('semester must be 1 or 2');

      const school = schoolList.find(item => lower(item.name) === lower(row.school) || lower(item.short_name) === lower(row.school));
      if (!school && row.school && !seenSchools.has(lower(row.school))) row.notes.push('new school');
      seenSchools.add(lower(row.school));
      const programmeKey = `${lower(row.school)}|${lower(row.program)}`;
      const programme = school && programmeList.find(item => item.school_id === school.id && lower(item.name) === lower(row.program));
      if (!programme && row.program && !seenProgrammes.has(programmeKey)) row.notes.push('new programme');
      seenProgrammes.add(programmeKey);
      const code = normaliseCourseCode(row.courseCode);
      if (code && !courseCodes.has(code) && !seenCourses.has(code)) row.notes.push('new course');
      else if (code && courseCodes.has(code)) row.notes.push('existing course, will be linked');
      const linkKey = `${programmeKey}|${code}`;
      if (seenCourses.has(linkKey)) row.errors.push('duplicate row');
      seenCourses.add(code);
      seenCourses.add(linkKey);
      return row;
    }));
  }

  async function runImport() {
    const valid = rows.filter(row => row.errors.length === 0);
    if (!valid.length) return;
    setBusy(true); setMessage('');
    try {
      const { data: institution } = await supabase.from('institutions').select('id').eq('short_name', 'ARM').maybeSingle();
      const [{ data: schools }, { data: programmes }, { data: courses }] = await Promise.all([
        supabase.from('schools').select('*'),
        supabase.from('programmes').select('*'),
        supabase.from('courses').select('*'),
      ]);
      const schoolList = schools as School[] || [];
      const programmeList = programmes as Programme[] || [];
      const courseByCode = new Map((courses as Course[] || []).map(course => [normaliseCourseCode(course.course_code), course]));

      for (const row of valid) {
        let school = schoolList.find(item => lower(item.name) === lower(row.school) || lower(item.short_name) === lower(row.school));
        if (!school) {
          const shortName = row.school.split(/\s+/).map(word => word[0]).join('').toUpperCase().slice(0, 12);
          const { data, error } = await supabase.from('schools').insert({ name: row.school, short_name: shortName, description: '', institution_id: institution?.id ?? null }).select().single();
          if (error) throw new Error(`Line ${row.line}: ${error.message}`);
          school = data as School;
          schoolList.push(school);
        }
        let programme = programmeList.find(item => item.school_id === school.id && lower(item.name) === lower(row.program));
        if (!programme) {
          const { data, error } = await supabase.from('programmes').insert({ school_id: school.id, name: row.program }).select().single();
          if (error) throw new Error(`Line ${row.line}: ${error.message}`);
          programme = data as Programme;
          programmeList.push(programme);
        }
        const code = normaliseCourseCode(row.courseCode);
        let course = courseByCode.get(code);
        if (!course) {
          const { data, error } = await supabase.from('courses').insert({
            course_code: row.courseCode, title: row.courseTitle, description: '', year_of_study: row.yearLevel,
            school_id: school.id, programme_id: programme.id, created_by: profile?.id,
          }).select().single();
          if (error) throw new Error(`Line ${row.line}: ${error.message}`);
          course = data as Course;
          courseByCode.set(code, course);
        }
        const { error } = await supabase.from('programme_courses').upsert({ programme_id: programme.id, course_id: course.id, year_level: row.yearLevel, semester: row.semester });
        if (error) throw new Error(`Line ${row.line}: ${error.message}`);
      }
      setDone(true);
      setMessage(`Imported ${valid.length} rows.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed');
    }
    setBusy(false);
  }

  const validCount = rows.filter(row => row.errors.length === 0).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Import courses from CSV</h1>
        <p className="text-slate-500 mt-1">Columns: <code>{COLUMNS.join(', ')}</code>. Courses with the same code are shared across programmes.</p>
      </div>

      <Card className="p-6 space-y-4">
        <input type="file" accept=".csv,text/csv" onChange={handleFile} className="block text-sm" />
        <Textarea label="Or paste CSV" rows={8} value={csv} onChange={event => setCsv(event.target.value)} placeholder={`${COLUMNS.join(',')}\nSchool of Engineering,BEng Electrical,2,EEE 2110,Circuit Theory,1`} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={validate} disabled={!csv.trim()}><FileSpreadsheet className="w-4 h-4" />Preview and validate</Button>
          <Button onClick={runImport} disabled={busy || done || validCount === 0}>{busy ? 'Importing...' : `Import ${validCount} valid rows`}</Button>
          <Link to="/courses"><Button variant="ghost">Back to courses</Button></Link>
        </div>
        {message && (
          <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${done ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            {done ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{message}
          </div>
        )}
      </Card>

      {rows.length > 0 && (
        <Card className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr><th className="p-3">Line</th><th className="p-3">School</th><th className="p-3">Programme</th><th className="p-3">Year</th><th className="p-3">Sem</th><th className="p-3">Course</th><th className="p-3">Result</th></tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.line} className="border-t border-slate-100">
                  <td className="p-3 text-slate-400">{row.line}</td>
                  <td className="p-3">{row.school}</td>
                  <td className="p-3">{row.program}</td>
                  <td className="p-3">{row.yearLevel ?? '-'}</td>
                  <td className="p-3">{row.semester ?? '-'}</td>
                  <td className="p-3"><span className="font-semibold">{row.courseCode}</span> {row.courseTitle}</td>
                  <td className={`p-3 ${row.errors.length ? 'text-red-600' : 'text-emerald-700'}`}>{row.errors.length ? row.errors.join('; ') : row.notes.join(', ') || 'ok'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
