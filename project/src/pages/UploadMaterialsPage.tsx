import { useEffect, useState, type DragEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { UploadCloud, CheckCircle2, X } from 'lucide-react';
import { supabase, sha256Hex, PAPER_TYPES, type Course, type School } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { saveExtractedText } from '@/lib/pdf-text';
import { uploadPrivateFile, removePrivateFile } from '@/lib/storage';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';

type Outcome = { name: string; ok: boolean; message: string };

export function UploadMaterialsPage() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const [schools, setSchools] = useState<School[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [courseId, setCourseId] = useState(params.get('course') || '');
  const [kind, setKind] = useState('past_paper');
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    Promise.all([
      supabase.from('schools').select('*').order('name'),
      supabase.from('courses').select('*').order('course_code'),
    ]).then(([schoolResult, courseResult]) => {
      setSchools(schoolResult.data as School[] || []);
      const list = courseResult.data as Course[] || [];
      setCourses(list);
      const preset = list.find(course => course.id === params.get('course'));
      if (preset?.school_id) setSchoolId(preset.school_id);
    });
  }, [params]);

  const visibleCourses = courses.filter(course => !schoolId || course.school_id === schoolId);

  function addFiles(list: File[]) {
    setFiles(current => [...current, ...list.filter(file => !current.some(item => item.name === file.name && item.size === file.size))]);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    if (!courseId) { setError('Choose the course these materials belong to.'); return; }
    if (files.length === 0) { setError('Add at least one file.'); return; }
    setBusy(true); setError(''); setOutcomes([]);
    const results: Outcome[] = [];
    const typeLabel = kind === 'notes' ? 'Lecture notes' : PAPER_TYPES.find(type => type.value === kind)?.label || kind;
    const course = courses.find(item => item.id === courseId);

    for (const file of files) {
      try {
        const filePath = `${courseId}/${profile.id}/${kind === 'notes' ? 'notes/' : ''}${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
        const title = [course?.course_code, typeLabel, year, file.name.replace(/\.[^.]+$/, '')].filter(Boolean).join(' ');

        if (kind === 'notes') {
          const uploaded = await uploadPrivateFile(filePath, file);
          if (uploaded.error || !uploaded.data) throw uploaded.error || new Error('Upload failed');
          const { error: insertError } = await supabase.from('notes').insert({ course_id: courseId, title, content: '', file_path: filePath, file_name: file.name, storage_provider: uploaded.data.provider, posted_by: profile.id });
          if (insertError) { await removePrivateFile(filePath, uploaded.data.provider); throw insertError; }
          results.push({ name: file.name, ok: true, message: 'Added to course notes' });
          continue;
        }

        const hash = await sha256Hex(file);
        const { data: existing } = await supabase.from('papers').select('id').eq('course_id', courseId).eq('file_hash', hash).is('deleted_at', null).limit(1);
        if (existing?.length) { results.push({ name: file.name, ok: false, message: 'Already in the repository' }); continue; }

        const uploaded = await uploadPrivateFile(filePath, file);
        if (uploaded.error || !uploaded.data) throw uploaded.error || new Error('Upload failed');
        const { data: inserted, error: insertError } = await supabase.from('papers').insert({
          course_id: courseId, title, paper_type: kind, year: year ? Number(year) : null,
          semester: semester ? Number(semester) : null, file_hash: hash, file_path: filePath,
          storage_provider: uploaded.data.provider,
          file_name: file.name, uploaded_by: profile.id,
        }).select('id').single();
        if (insertError) { await removePrivateFile(filePath, uploaded.data.provider); throw insertError; }
        saveExtractedText(inserted.id, file, text => supabase.from('papers').update({ extracted_text: text }).eq('id', inserted.id));
        results.push({ name: file.name, ok: true, message: isAdmin ? 'Published' : 'Submitted, waiting for admin review' });
      } catch (uploadFailure) {
        results.push({ name: file.name, ok: false, message: uploadFailure instanceof Error ? uploadFailure.message : (uploadFailure as { message?: string }).message || 'Upload failed' });
      }
    }
    setOutcomes(results);
    setFiles(results.filter(result => !result.ok).map(result => files.find(file => file.name === result.name)!).filter(Boolean));
    setBusy(false);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Add materials</h1>
        <p className="text-slate-500 mt-1">Share past papers, tests, assignments or lecture notes. {isAdmin ? 'Admin uploads publish immediately.' : 'An admin reviews submissions before others see them.'}</p>
      </div>

      <Card className="p-6">
        <form onSubmit={submit} className="space-y-5">
          {error && <p className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="School" value={schoolId} onChange={event => { setSchoolId(event.target.value); setCourseId(''); }}>
              <option value="">All schools</option>
              {schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
            </Select>
            <Select label="Course" value={courseId} onChange={event => setCourseId(event.target.value)} required>
              <option value="">Choose a course</option>
              {visibleCourses.map(course => <option key={course.id} value={course.id}>{course.course_code} · {course.title}</option>)}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select label="Type" value={kind} onChange={event => setKind(event.target.value)}>
              {PAPER_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
              <option value="notes">Lecture notes</option>
            </Select>
            <Input label="Year" type="number" value={year} onChange={event => setYear(event.target.value)} placeholder="e.g. 2024" disabled={kind === 'notes'} />
            <Select label="Semester" value={semester} onChange={event => setSemester(event.target.value)} disabled={kind === 'notes'}>
              <option value="">Not specified</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </Select>
          </div>

          <label
            onDragOver={event => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-dashed cursor-pointer text-center transition-colors ${dragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}
          >
            <UploadCloud className="w-8 h-8 text-emerald-600" />
            <span className="text-sm font-semibold text-slate-700">Drop files here or click to choose</span>
            <span className="text-xs text-slate-400">PDF, images, text. You can pick several at once.</span>
            <input type="file" multiple accept=".pdf,.txt,.md,image/png,image/jpeg,image/webp" className="hidden" onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
          </label>

          {files.length > 0 && (
            <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
              {files.map(file => (
                <li key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="truncate">{file.name} <span className="text-slate-400">({(file.size / 1024 / 1024).toFixed(1)} MB)</span></span>
                  <button type="button" onClick={() => setFiles(files.filter(item => item !== file))} aria-label={`Remove ${file.name}`} disabled={busy}><X className="w-4 h-4 text-slate-400" /></button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={busy || files.length === 0}>{busy ? 'Uploading...' : `Upload ${files.length || ''} file${files.length === 1 ? '' : 's'}`}</Button>
            {courseId && <Link to={`/courses/${courseId}`}><Button type="button" variant="outline">View course</Button></Link>}
          </div>
        </form>
      </Card>

      {outcomes.length > 0 && (
        <Card className="mt-6 divide-y divide-slate-100">
          {outcomes.map(outcome => (
            <div key={outcome.name} className="flex items-center gap-3 px-4 py-3 text-sm">
              {outcome.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <X className="w-4 h-4 text-red-500 flex-shrink-0" />}
              <span className="flex-1 truncate">{outcome.name}</span>
              <span className={outcome.ok ? 'text-emerald-700' : 'text-red-600'}>{outcome.message}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
