import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Brain, FileText, Sparkles } from 'lucide-react';
import { supabase, type Course, PAPER_TYPES } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { uploadPrivateFile, removePrivateFile } from '@/lib/storage';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';

export function AiSolverPage() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolledProgrammeIds, setEnrolledProgrammeIds] = useState<Set<string>>(new Set());
  const [courseId, setCourseId] = useState(searchParams.get('course') || '');
  const [title, setTitle] = useState('');
  const [paperType, setPaperType] = useState('assignment');
  const [file, setFile] = useState<File | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [solving, setSolving] = useState(false);
  const [error, setError] = useState('');
  const [solution, setSolution] = useState('');
  const [usedModel, setUsedModel] = useState('');
  const [createdPaperId, setCreatedPaperId] = useState('');

  useEffect(() => {
    async function loadCourses() {
      const [{ data: coursesData }, { data: enrollment }] = await Promise.all([
        supabase.from('courses').select('*').order('course_code'),
        profile?.programme_id
          ? supabase.from('programmes').select('parent_programme_id').eq('id', profile.programme_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const availableCourses = coursesData as Course[] || [];
      const programmeIds = [profile?.programme_id, enrollment?.parent_programme_id].filter((id): id is string => Boolean(id));
      const programmeIdSet = new Set(programmeIds);
      setCourses(availableCourses);
      setEnrolledProgrammeIds(programmeIdSet);
      const enrolledCourses = availableCourses.filter(course => course.programme_id && programmeIdSet.has(course.programme_id));
      setCourseId(current => current || enrolledCourses[0]?.id || availableCourses[0]?.id || '');
      setLoadingCourses(false);
    }
    loadCourses();
  }, [profile?.programme_id]);

  const enrolledCourses = courses.filter(course => course.programme_id && enrolledProgrammeIds.has(course.programme_id));
  const otherCourses = courses.filter(course => !course.programme_id || !enrolledProgrammeIds.has(course.programme_id));

  async function handleSolve(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSolution('');
    setUsedModel('');
    setCreatedPaperId('');
    if (!profile) {
      setError('Sign in before uploading a document for solving.');
      return;
    }
    if (!file || !courseId || !title.trim()) {
      setError('Choose a course, enter a title, and attach a PDF, text, or image file.');
      return;
    }

    setSolving(true);
    const filePath = `${courseId}/${profile.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
    const uploaded = await uploadPrivateFile(filePath, file);
    if (uploaded.error || !uploaded.data) {
      setError(uploaded.error?.message || 'Upload failed');
      setSolving(false);
      return;
    }

    const { data: paper, error: insertError } = await supabase.from('papers').insert({
      course_id: courseId,
      title: title.trim(),
      paper_type: paperType,
      file_path: filePath,
      storage_provider: uploaded.data.provider,
      file_name: file.name,
      uploaded_by: profile.id,
    }).select('id').single();

    if (insertError || !paper) {
      await removePrivateFile(filePath, uploaded.data.provider);
      setError(insertError?.message || 'The upload could not be added to this course.');
      setSolving(false);
      return;
    }

    setCreatedPaperId(paper.id);
    const { data, error: solveError } = await supabase.functions.invoke('ai-solve', {
      body: { paper_id: paper.id },
    });
    if (solveError || data?.error) {
      setError(data?.error || solveError?.message || 'The solver could not process this document.');
      setSolving(false);
      return;
    }

    setSolution(data.solution || 'No solution was returned.');
    setUsedModel(data.model || '');
    setSolving(false);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex gap-8">
        <Sidebar />
        <main className="flex-1 min-w-0 max-w-4xl">
          <Link to="/courses" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-5">
            <ArrowLeft className="w-4 h-4" /> Browse catalogue
          </Link>
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Armarium AI Solver</h1>
              <p className="text-slate-500 mt-1">Attach a course document to get a worked explanation.</p>
              {profile?.programme_id && <p className="text-xs text-slate-500 mt-2">Your programme and year are included automatically. The solver also reads this course's AI guidance, notes, and attached recommended texts.</p>}
            </div>
          </div>

          <Card className="p-6 mb-6">
            <form onSubmit={handleSolve} className="space-y-4">
              {error && <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
              <Select label="Course" value={courseId} onChange={event => setCourseId(event.target.value)} disabled={loadingCourses}>
                <option value="">Select a course</option>
                {enrolledCourses.length > 0 && <optgroup label="Courses in your programme">{enrolledCourses.map(course => <option key={course.id} value={course.id}>{course.course_code} · {course.title}</option>)}</optgroup>}
                {otherCourses.length > 0 && <optgroup label="Other course units">{otherCourses.map(course => <option key={course.id} value={course.id}>{course.course_code} · {course.title}</option>)}</optgroup>}
              </Select>
              <Input label="Document title" value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. CSC 2901 revision questions" required />
              <Select label="Material type" value={paperType} onChange={event => setPaperType(event.target.value)}>
                {PAPER_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
              </Select>
              <div className="space-y-1.5">
                <label htmlFor="solver-file" className="block text-sm font-medium text-slate-700">Attach document</label>
                <input id="solver-file" type="file" accept=".pdf,.txt,.md,image/png,image/jpeg,image/webp" onChange={event => setFile(event.target.files?.[0] || null)} required className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-800" />
                <p className="text-xs text-slate-500">PDF, plain text, Markdown, or image. The original is saved under the selected course.</p>
              </div>
              <Button type="submit" variant="primary" disabled={solving || loadingCourses || courses.length === 0}>
                {solving ? <Spinner size={16} /> : <Sparkles className="w-4 h-4" />}
                {solving ? 'Solving...' : 'Upload and solve'}
              </Button>
            </form>
          </Card>

          {createdPaperId && (
            <p className="text-sm text-slate-500 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Document saved to this course. <Link className="text-emerald-700 hover:underline" to={`/papers/${createdPaperId}`}>Open document</Link>
            </p>
          )}

          {solution && (
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4 text-emerald-700">
                <Sparkles className="w-4 h-4" />
                <h2 className="font-bold">Worked solution</h2>
                {usedModel && <span className="text-xs text-slate-500">Model: {usedModel}</span>}
              </div>
              <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">{solution}</pre>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
