import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Brain, FileText, Download, MessageSquare, Sparkles, AlertCircle, CheckCircle, Flag } from 'lucide-react';
import { supabase, type Paper, type Answer, type Course, PAPER_TYPES } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { createPrivateFileUrl } from '@/lib/storage';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

export function PaperDetailPage() {
  const { paperId } = useParams<{ paperId: string }>();
  const { profile } = useAuth();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [answerFileUrls, setAnswerFileUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [aiSolution, setAiSolution] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [signedFileUrl, setSignedFileUrl] = useState('');
  const [textPreview, setTextPreview] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportMessage, setReportMessage] = useState('');

  const canAccess = Boolean(profile);

  useEffect(() => {
    async function loadData() {
      const { data: paperData } = await supabase
        .from('papers')
        .select('*, courses(*)')
        .eq('id', paperId)
        .maybeSingle();

      if (paperData) {
        const paperWithCourse = paperData as Paper & { courses: Course | Course[] | null };
        setPaper(paperWithCourse);
        setCourse(Array.isArray(paperWithCourse.courses) ? paperWithCourse.courses[0] || null : paperWithCourse.courses);
        if (paperWithCourse.file_path) {
          const { data: fileData } = await createPrivateFileUrl(paperWithCourse.file_path, paperWithCourse.storage_provider);
          setSignedFileUrl(fileData?.signedUrl || '');
          if (fileData?.signedUrl && /\.(txt|md)$/i.test(paperWithCourse.file_name || '')) {
            const textResponse = await fetch(fileData.signedUrl);
            if (textResponse.ok) setTextPreview((await textResponse.text()).slice(0, 100000));
          }
        }
      }

      const { data: answersData } = await supabase
        .from('answers')
        .select('*')
        .eq('paper_id', paperId)
        .order('created_at', { ascending: false });
      const loadedAnswers = answersData as Answer[] || [];
      setAnswers(loadedAnswers);
      const signedAnswers = await Promise.all(loadedAnswers.map(async answer => {
        if (!answer.file_path) return [answer.id, ''] as const;
        const { data } = await createPrivateFileUrl(answer.file_path, answer.storage_provider);
        return [answer.id, data?.signedUrl || ''] as const;
      }));
      setAnswerFileUrls(Object.fromEntries(signedAnswers));

      setLoading(false);
    }
    if (paperId) loadData();
  }, [paperId]);

  async function handleAiSolve() {
    setAiLoading(true);
    setAiError('');

    try {
      const { data, error } = await supabase.functions.invoke('ai-solve', { body: { paper_id: paperId } });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setAiSolution(data.solution);
      setAiModel(data.model || '');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900">Paper not found</h1>
        <Link to="/courses" className="inline-block mt-4">
          <Button variant="primary" size="sm">Back to Courses</Button>
        </Link>
      </div>
    );
  }

  const typeInfo = PAPER_TYPES.find(t => t.value === paper.paper_type);

  async function submitReport() {
    if (!paper || !profile || !reportReason.trim()) return;
    const { error } = await supabase.from('file_reports').insert({ paper_id: paper.id, reported_by: profile.id, reason: reportReason.trim() });
    setReportMessage(error ? error.message : 'Thanks, an administrator will review this file.');
    if (!error) { setReporting(false); setReportReason(''); }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to={`/courses/${paper.course_id}`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to {course?.title || 'Course'}
      </Link>

      {/* Paper header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="blue">{typeInfo?.label || 'Paper'}</Badge>
            {paper.year && <Badge variant="slate">{paper.year}</Badge>}
            {course && <Badge variant="emerald">{course.course_code}</Badge>}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{paper.title}</h1>
          {course && <p className="text-slate-500 mt-1">{course.title}</p>}
        </div>

        {canAccess && signedFileUrl && <a href={signedFileUrl} download={paper.file_name || undefined}><Button variant="outline"><Download className="w-4 h-4" />Save a copy</Button></a>}
      </div>

      {profile && (
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => setReporting(!reporting)}><Flag className="w-4 h-4" />Report this file</Button>
          {reporting && (
            <div className="mt-2 flex gap-2">
              <input value={reportReason} onChange={event => setReportReason(event.target.value)} placeholder="What is wrong? (broken, wrong course, unreadable...)" className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg" />
              <Button size="sm" onClick={submitReport} disabled={!reportReason.trim()}>Send</Button>
            </div>
          )}
          {reportMessage && <p className="mt-2 text-sm text-slate-600">{reportMessage}</p>}
        </div>
      )}

      {!canAccess && (
        <Card className="p-6 mb-6 bg-amber-50 border-amber-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <p className="text-sm text-amber-800">Sign in to view this course document and use the AI solver.</p>
            <Link to="/signin"><Button size="sm" variant="primary">Sign In</Button></Link>
          </div>
        </Card>
      )}

      {/* File preview */}
      {canAccess && paper.file_path && signedFileUrl && (
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-900">Paper File</h2>
          </div>
          <p className="text-sm text-slate-500 mb-3">{paper.file_name || 'Course document'}</p>
          {paper.file_name?.toLowerCase().endsWith('.pdf') ? (
            <iframe title={paper.title} src={signedFileUrl} className="w-full h-[70vh] rounded-lg border border-slate-200" />
          ) : paper.file_name?.match(/\.(png|jpe?g|webp)$/i) ? (
            <img src={signedFileUrl} alt={paper.title} className="max-h-[70vh] max-w-full mx-auto object-contain" />
          ) : /\.(txt|md)$/i.test(paper.file_name || '') ? (
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-5 text-sm leading-relaxed text-slate-700">{textPreview}</pre>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
              <FileText className="w-6 h-6 text-slate-500" />
              <p className="text-sm text-slate-600">This file type is available to save, but your browser cannot preview it inline.</p>
            </div>
          )}
        </Card>
      )}

      {/* AI Solver */}
      {profile && (
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">AI Solver</h2>
                <p className="text-xs text-slate-500">Get AI-powered solutions for this paper</p>
              </div>
            </div>
            {!aiSolution && !aiLoading && (
              <Button variant="primary" onClick={handleAiSolve}>
                <Sparkles className="w-4 h-4" />
                Solve with AI
              </Button>
            )}
          </div>

          {aiLoading && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl">
              <Spinner size={20} />
              <p className="text-sm text-emerald-700">AI is analyzing and solving this paper...</p>
            </div>
          )}

          {aiError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {aiError}
            </div>
          )}

          {aiSolution && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">AI Solution Generated{aiModel ? ` · ${aiModel}` : ''}</span>
              </div>
              <div className="prose prose-sm max-w-none p-4 bg-slate-50 rounded-xl overflow-y-auto max-h-[500px]">
                <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">{aiSolution}</pre>
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={handleAiSolve} disabled={aiLoading}>
                <Sparkles className="w-4 h-4" />
                Regenerate Solution
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Answer keys */}
      {canAccess && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Answer Keys</h2>
          {answers.length === 0 ? (
            <Card className="p-8 text-center">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No answer keys have been posted for this paper yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {answers.map(answer => (
                <Card key={answer.id} className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="emerald">Answer Key</Badge>
                    {answer.file_name && (
                      <a href={answerFileUrls[answer.id] || '#'} download={answer.file_name || undefined}>
                        <Badge variant="blue">
                          <Download className="w-3 h-3 inline mr-1" />
                          {answer.file_name}
                        </Badge>
                      </a>
                    )}
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">{answer.content}</div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Q&A link */}
      <Card className="p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-slate-900">Have a question about this paper?</h3>
              <p className="text-sm text-slate-500">Ask the community or request an AI explanation</p>
            </div>
          </div>
          <Link to={`/questions?course=${paper.course_id}&paper=${paper.id}`}>
            <Button variant="outline" size="sm">Ask a Question</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
