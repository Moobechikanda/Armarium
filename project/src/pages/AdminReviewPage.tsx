import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, Trash2 } from 'lucide-react';
import { supabase, type FileReport, type Paper } from '@/lib/supabase';
import { extractPdfText } from '@/lib/pdf-text';
import { createPrivateFileUrl } from '@/lib/storage';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';

type PaperWithCourse = Paper & { courses: { course_code: string; title: string } | null };
type ReportWithPaper = FileReport & { papers: PaperWithCourse | null };
type AuditEntry = { id: string; action: string; table_name: string; details: { title?: string }; created_at: string };

export function AdminReviewPage() {
  const [pending, setPending] = useState<PaperWithCourse[]>([]);
  const [reports, setReports] = useState<ReportWithPaper[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unindexed, setUnindexed] = useState(0);
  const [indexing, setIndexing] = useState(false);
  const [indexed, setIndexed] = useState(0);
  const stopIndexing = useRef(false);

  async function countUnindexed() {
    const { count } = await supabase.from('papers').select('id', { count: 'exact', head: true }).is('extracted_text', null).is('deleted_at', null).not('file_path', 'is', null);
    setUnindexed(count || 0);
  }

  // Reads each file in the browser (text layer first, OCR for scans) so its content becomes searchable.
  async function runIndexing() {
    setIndexing(true); stopIndexing.current = false; setIndexed(0);
    while (!stopIndexing.current) {
      const { data } = await supabase.from('papers').select('id, file_path, file_name, storage_provider').is('extracted_text', null).is('deleted_at', null).not('file_path', 'is', null).order('created_at').limit(3);
      const batch = data as Pick<Paper, 'id' | 'file_path' | 'file_name' | 'storage_provider'>[] || [];
      if (batch.length === 0) break;
      for (const paper of batch) {
        let text = '';
        try {
          const { data: signed } = await createPrivateFileUrl(paper.file_path!, paper.storage_provider, 600);
          if (signed) {
            const blob = await (await fetch(signed.signedUrl)).blob();
            text = await extractPdfText(new File([blob], paper.file_name || 'file.pdf', { type: blob.type }));
          }
        } catch { /* leave empty so this file is not retried forever */ }
        await supabase.from('papers').update({ extracted_text: text }).eq('id', paper.id);
        setIndexed(count => count + 1);
      }
    }
    setIndexing(false);
    await countUnindexed();
  }

  async function load() {
    const [pendingResult, reportResult, auditResult] = await Promise.all([
      supabase.from('papers').select('*, courses(course_code, title)').eq('status', 'pending').is('deleted_at', null).order('created_at'),
      supabase.from('file_reports').select('*, papers(*, courses(course_code, title))').eq('status', 'open').order('created_at'),
      supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(15),
    ]);
    setPending(pendingResult.data as PaperWithCourse[] || []);
    setReports(reportResult.data as ReportWithPaper[] || []);
    setAudit(auditResult.data as AuditEntry[] || []);
    setLoading(false);
  }

  useEffect(() => { void load(); void countUnindexed(); }, []);

  async function run(action: PromiseLike<{ error: { message: string } | null }>) {
    setError('');
    const { error: actionError } = await action;
    if (actionError) setError(actionError.message);
    await load();
  }

  const review = (paper: Paper, status: 'approved' | 'rejected') => run(supabase.from('papers').update({ status }).eq('id', paper.id));
  const resolve = (report: FileReport) => run(supabase.from('file_reports').update({ status: 'resolved' }).eq('id', report.id));
  const removeReported = async (report: ReportWithPaper) => {
    if (!confirm('Remove this file from the repository? It can be restored from the database.')) return;
    await run(supabase.from('papers').update({ deleted_at: new Date().toISOString() }).eq('id', report.paper_id));
    await resolve(report);
  };

  if (loading) return <div className="py-16 flex justify-center"><Spinner /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Review queue</h1>
        <p className="text-slate-500 mt-1">Approve student submissions and handle file reports.</p>
        {error && <p className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</p>}
      </div>

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Pending submissions ({pending.length})</h2>
        {pending.length === 0 ? <Card className="p-6 text-sm text-slate-500">Nothing waiting for review.</Card> : (
          <div className="space-y-3">
            {pending.map(paper => (
              <Card key={paper.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <Link to={`/papers/${paper.id}`} className="font-semibold text-slate-900 hover:text-emerald-700">{paper.title}</Link>
                  <p className="text-xs text-slate-500">{paper.courses?.course_code} · {paper.paper_type.replace(/_/g, ' ')}{paper.year ? ` · ${paper.year}` : ''}{paper.semester ? ` · Sem ${paper.semester}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => review(paper, 'approved')}><Check className="w-4 h-4" />Approve</Button>
                  <Button size="sm" variant="danger" onClick={() => review(paper, 'rejected')}><X className="w-4 h-4" />Reject</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Open reports ({reports.length})</h2>
        {reports.length === 0 ? <Card className="p-6 text-sm text-slate-500">No open reports.</Card> : (
          <div className="space-y-3">
            {reports.map(report => (
              <Card key={report.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <Link to={`/papers/${report.paper_id}`} className="font-semibold text-slate-900 hover:text-emerald-700">{report.papers?.title || 'Removed file'}</Link>
                  <p className="text-sm text-slate-600">{report.reason}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => resolve(report)}>Dismiss</Button>
                  {report.papers && <Button size="sm" variant="danger" onClick={() => removeReported(report)}><Trash2 className="w-4 h-4" />Remove file</Button>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Search indexing</h2>
        <Card className="p-4 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-slate-600">
            {unindexed} file{unindexed === 1 ? '' : 's'} not yet searchable by their content.
            {indexing && ` Indexed ${indexed} so far. Keep this page open.`}
          </p>
          {indexing
            ? <Button size="sm" variant="outline" onClick={() => { stopIndexing.current = true; }}>Stop</Button>
            : <Button size="sm" onClick={runIndexing} disabled={unindexed === 0}>Index files</Button>}
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Recent activity</h2>
        <Card className="divide-y divide-slate-100">
          {audit.length === 0 && <p className="p-4 text-sm text-slate-500">No activity yet.</p>}
          {audit.map(entry => (
            <div key={entry.id} className="px-4 py-2.5 text-sm flex justify-between gap-4">
              <span><span className="font-semibold">{entry.action.replace(/_/g, ' ')}</span> {entry.details.title || entry.table_name}</span>
              <span className="text-xs text-slate-400 flex-shrink-0">{new Date(entry.created_at).toLocaleString()}</span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
