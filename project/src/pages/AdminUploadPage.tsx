import { useEffect, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { UploadCloud, CheckCircle2 } from 'lucide-react';
import { supabase, PAPER_TYPES, parsePaperFilename, normaliseCourseCode, sha256Hex, type Course, type Paper } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { saveExtractedText } from '@/lib/pdf-text';
import { uploadPrivateFile, removePrivateFile } from '@/lib/storage';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';

type UploadRow = {
  id: string;
  file: File;
  hash: string;
  courseId: string;
  paperType: Paper['paper_type'];
  year: string;
  semester: string;
  duplicate: boolean;
  state: 'ready' | 'uploading' | 'done' | 'error';
  error?: string;
};

export function AdminUploadPage() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('courses').select('*').order('course_code').then(({ data }) => setCourses(data as Course[] || []));
  }, []);

  async function addFiles(files: File[]) {
    const pdfs = files.filter(file => file.type === 'application/pdf' || /\.(pdf|png|jpe?g)$/i.test(file.name));
    const added: UploadRow[] = [];
    for (const file of pdfs) {
      const parsed = parsePaperFilename(file.name);
      const course = courses.find(item => normaliseCourseCode(item.course_code) === parsed.code);
      added.push({
        id: crypto.randomUUID(),
        file,
        hash: await sha256Hex(file),
        courseId: course?.id || '',
        paperType: parsed.paperType || 'past_paper',
        year: parsed.year ? String(parsed.year) : '',
        semester: parsed.semester ? String(parsed.semester) : '',
        duplicate: false,
        state: 'ready',
      });
    }
    setRows(current => markDuplicates([...current, ...added]));
    const courseIds = Array.from(new Set(added.map(row => row.courseId).filter(Boolean)));
    if (courseIds.length) {
      const { data } = await supabase.from('papers').select('course_id, file_hash').in('course_id', courseIds).is('deleted_at', null);
      const known = new Set((data as Pick<Paper, 'course_id' | 'file_hash'>[] || []).map(paper => `${paper.course_id}|${paper.file_hash}`));
      setRows(current => current.map(row => known.has(`${row.courseId}|${row.hash}`) ? { ...row, duplicate: true } : row));
    }
  }

  function markDuplicates(list: UploadRow[]) {
    const seen = new Set<string>();
    return list.map(row => {
      const key = `${row.courseId}|${row.hash}`;
      const duplicate = row.duplicate || (Boolean(row.courseId) && seen.has(key));
      seen.add(key);
      return { ...row, duplicate };
    });
  }

  function update(id: string, patch: Partial<UploadRow>) {
    setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row));
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void addFiles(Array.from(event.dataTransfer.files));
  }

  async function uploadAll() {
    setBusy(true);
    for (const row of rows.filter(item => item.state !== 'done' && item.courseId && !item.duplicate)) {
      update(row.id, { state: 'uploading', error: undefined });
      const course = courses.find(item => item.id === row.courseId);
      const typeLabel = PAPER_TYPES.find(type => type.value === row.paperType)?.label || row.paperType;
      const filePath = `${row.courseId}/${profile?.id}/${Date.now()}-${row.file.name}`;
      const uploaded = await uploadPrivateFile(filePath, row.file);
      if (uploaded.error || !uploaded.data) { update(row.id, { state: 'error', error: uploaded.error?.message || 'Upload failed' }); continue; }
      const { data: inserted, error } = await supabase.from('papers').insert({
        course_id: row.courseId,
        title: [course?.course_code, typeLabel, row.year, row.semester && `Sem ${row.semester}`].filter(Boolean).join(' '),
        paper_type: row.paperType,
        year: row.year ? Number(row.year) : null,
        semester: row.semester ? Number(row.semester) : null,
        file_hash: row.hash,
        storage_provider: uploaded.data.provider,
        file_path: filePath,
        file_name: row.file.name,
        uploaded_by: profile?.id,
      }).select('id').single();
      if (error) {
        await removePrivateFile(filePath, uploaded.data.provider);
        update(row.id, { state: 'error', error: error.code === '23505' ? 'Duplicate file' : error.message });
      } else {
        saveExtractedText(inserted.id, row.file, text => supabase.from('papers').update({ extracted_text: text }).eq('id', inserted.id));
        update(row.id, { state: 'done' });
      }
    }
    setBusy(false);
  }

  const readyCount = rows.filter(row => row.state !== 'done' && row.courseId && !row.duplicate).length;
  const unmatched = rows.filter(row => !row.courseId).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Bulk upload resources</h1>
        <p className="text-slate-500 mt-1">Name files like <code>EEE2110_2023_S1_EndSemester.pdf</code> to map them automatically. Fix anything unmatched below.</p>
      </div>

      <label
        onDragOver={event => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-2 p-10 rounded-2xl border-2 border-dashed cursor-pointer text-center transition-colors ${dragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white'}`}
      >
        <UploadCloud className="w-8 h-8 text-emerald-600" />
        <span className="text-sm font-semibold text-slate-700">Drop files here or click to choose</span>
        <span className="text-xs text-slate-400">PDF or image files</span>
        <input type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={event => { void addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
      </label>

      {rows.length > 0 && (
        <>
          <div className="flex items-center gap-3 mt-6 flex-wrap">
            <Button onClick={uploadAll} disabled={busy || readyCount === 0}>{busy ? 'Uploading...' : `Upload ${readyCount} files`}</Button>
            <Button variant="outline" onClick={() => setRows([])} disabled={busy}>Clear</Button>
            <Link to="/courses"><Button variant="ghost">Back to courses</Button></Link>
            {unmatched > 0 && <span className="text-sm text-amber-700">{unmatched} unmatched: choose a course</span>}
          </div>

          <div className="mt-4 space-y-3">
            {rows.map(row => (
              <Card key={row.id} className={`p-4 ${!row.courseId || row.duplicate || row.state === 'error' ? 'border-amber-300' : ''}`}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-sm font-semibold text-slate-800 truncate">{row.file.name}</p>
                  <span className="text-xs flex-shrink-0">
                    {row.state === 'done' && <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-4 h-4" />Uploaded</span>}
                    {row.state === 'uploading' && 'Uploading...'}
                    {row.state === 'error' && <span className="text-red-600">{row.error}</span>}
                    {row.state === 'ready' && row.duplicate && <span className="text-amber-700">Duplicate, will be skipped</span>}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Select value={row.courseId} onChange={event => setRows(current => markDuplicates(current.map(item => item.id === row.id ? { ...item, courseId: event.target.value, duplicate: false } : item)))} disabled={row.state === 'done'}>
                    <option value="">Choose course</option>
                    {courses.map(course => <option key={course.id} value={course.id}>{course.course_code} · {course.title}</option>)}
                  </Select>
                  <Select value={row.paperType} onChange={event => update(row.id, { paperType: event.target.value as Paper['paper_type'] })} disabled={row.state === 'done'}>
                    {PAPER_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </Select>
                  <input value={row.year} onChange={event => update(row.id, { year: event.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="Year" className="px-4 py-2.5 text-sm border border-slate-300 rounded-lg" disabled={row.state === 'done'} />
                  <Select value={row.semester} onChange={event => update(row.id, { semester: event.target.value })} disabled={row.state === 'done'}>
                    <option value="">Semester</option>
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                  </Select>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
