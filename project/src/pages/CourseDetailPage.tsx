import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, FileText, Upload, MessageSquare, Calendar,
  Trash2, Eye, Notebook, BookOpen, BookMarked, GraduationCap,
  ClipboardList, FileQuestion, PencilLine,
} from 'lucide-react';
import { supabase, sha256Hex, type Course, type Programme, type School, type Paper, type Note, type RecommendedBook, PAPER_TYPES } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/Sidebar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { saveExtractedText } from '@/lib/pdf-text';
import { createPrivateFileUrl, uploadPrivateFile, removePrivateFile, type StorageProvider } from '@/lib/storage';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';

type Tab = 'papers' | 'notes' | 'books';
type PaperTypeKey = Paper['paper_type'];

const PAPER_TYPE_META: Record<PaperTypeKey, { label: string; icon: typeof FileText; color: string }> = {
  past_paper: { label: 'Past Papers', icon: FileText, color: 'text-emerald-600 bg-emerald-50' },
  deferred_exam: { label: 'Deferred Exams', icon: FileText, color: 'text-red-600 bg-red-50' },
  mid_semester_exam: { label: 'Mid-Semester Exams', icon: FileText, color: 'text-orange-600 bg-orange-50' },
  end_of_semester_exam: { label: 'End-of-Semester Exams', icon: FileText, color: 'text-blue-600 bg-blue-50' },
  end_of_year_exam: { label: 'End-of-Year Exams', icon: FileText, color: 'text-teal-600 bg-teal-50' },
  test: { label: 'Tests', icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
  quiz: { label: 'Quizzes', icon: FileQuestion, color: 'text-amber-600 bg-amber-50' },
  assignment: { label: 'Assignments', icon: PencilLine, color: 'text-purple-600 bg-purple-50' },
};

async function signedFileMap<T extends { id: string; file_path: string | null; storage_provider: StorageProvider }>(items: T[]) {
  const entries = await Promise.all(items.map(async item => {
    if (!item.file_path) return [item.id, ''] as const;
    const { data } = await createPrivateFileUrl(item.file_path, item.storage_provider);
    return [item.id, data?.signedUrl || ''] as const;
  }));
  return Object.fromEntries(entries) as Record<string, string>;
}

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { profile } = useAuth();
  const [course, setCourse] = useState<(Course & { schools?: School; programmes?: Programme }) | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [books, setBooks] = useState<RecommendedBook[]>([]);
  const [noteUrls, setNoteUrls] = useState<Record<string, string>>({});
  const [bookUrls, setBookUrls] = useState<Record<string, string>>({});
  const [readerAsset, setReaderAsset] = useState<{ title: string; url: string; fileName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('papers');
  const [showGuidance, setShowGuidance] = useState(false);
  const [guidance, setGuidance] = useState('');
  const [guidanceSaving, setGuidanceSaving] = useState(false);
  const [guidanceError, setGuidanceError] = useState('');

  // Upload paper modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState('past_paper');
  const [uploadYear, setUploadYear] = useState('');
  const [uploadSemester, setUploadSemester] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Add note modal
  const [showNote, setShowNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteFile, setNoteFile] = useState<File | null>(null);
  const [noteUploading, setNoteUploading] = useState(false);
  const [noteError, setNoteError] = useState('');

  // Add book modal
  const [showBook, setShowBook] = useState(false);
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [bookIsbn, setBookIsbn] = useState('');
  const [bookDescription, setBookDescription] = useState('');
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [bookSubmitting, setBookSubmitting] = useState(false);
  const [bookError, setBookError] = useState('');

  const isAdmin = profile?.role === 'admin';
  const canAccess = Boolean(profile);

  useEffect(() => {
    async function loadData() {
      const { data: courseData } = await supabase
        .from('courses')
        .select('*, schools(*), programmes(*)')
        .eq('id', courseId)
        .maybeSingle();
      const loadedCourse = courseData as (Course & { schools?: School; programmes?: Programme }) | null;
      setCourse(loadedCourse);
      setGuidance(loadedCourse?.ai_guidance || '');

      const { data: papersData } = await supabase
        .from('papers')
        .select('*')
        .eq('course_id', courseId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      setPapers(papersData as Paper[] || []);

      const { data: notesData } = await supabase
        .from('notes')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });
      setNotes(notesData as Note[] || []);
      setNoteUrls(await signedFileMap(notesData as Note[] || []));

      const { data: booksData } = await supabase
        .from('recommended_books')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });
      setBooks(booksData as RecommendedBook[] || []);
      setBookUrls(await signedFileMap(booksData as RecommendedBook[] || []));

      setLoading(false);
    }
    if (courseId) loadData();
  }, [courseId]);

  async function refreshPapers() {
    const { data } = await supabase.from('papers').select('*').eq('course_id', courseId).is('deleted_at', null).order('created_at', { ascending: false });
    setPapers(data as Paper[] || []);
  }
  async function refreshNotes() {
    const { data } = await supabase.from('notes').select('*').eq('course_id', courseId).order('created_at', { ascending: false });
    setNotes(data as Note[] || []);
    setNoteUrls(await signedFileMap(data as Note[] || []));
  }
  async function refreshBooks() {
    const { data } = await supabase.from('recommended_books').select('*').eq('course_id', courseId).order('created_at', { ascending: false });
    setBooks(data as RecommendedBook[] || []);
    setBookUrls(await signedFileMap(data as RecommendedBook[] || []));
  }

  async function saveAiGuidance(event: FormEvent) {
    event.preventDefault();
    if (!course || !isAdmin) return;
    setGuidanceSaving(true);
    setGuidanceError('');
    const { error } = await supabase.from('courses').update({ ai_guidance: guidance }).eq('id', course.id);
    if (error) {
      setGuidanceError(error.message);
    } else {
      setCourse({ ...course, ai_guidance: guidance });
      setShowGuidance(false);
    }
    setGuidanceSaving(false);
  }

  async function handleUploadPaper(e: FormEvent) {
    e.preventDefault();
    setUploadError('');
    if (!uploadFile) { setUploadError('Choose a document to upload'); return; }
    setUploading(true);
    try {
      const fileHash = await sha256Hex(uploadFile);
      const { data: existing } = await supabase.from('papers').select('id').eq('course_id', courseId).eq('file_hash', fileHash).is('deleted_at', null).limit(1);
      if (existing?.length) { setUploadError('This file is already in the repository for this course.'); return; }
      const filePath = `${courseId}/${profile?.id}/${Date.now()}-${uploadFile.name.replace(/[^\w.-]+/g, '_')}`;
      const uploaded = await uploadPrivateFile(filePath, uploadFile);
      if (uploaded.error || !uploaded.data) { setUploadError(uploaded.error?.message || 'Upload failed'); return; }
      const { data: inserted, error: insertErr } = await supabase.from('papers').insert({
        course_id: courseId, title: uploadTitle, paper_type: uploadType,
        year: uploadYear ? parseInt(uploadYear) : null, file_path: filePath,
        semester: uploadSemester ? parseInt(uploadSemester) : null, file_hash: fileHash,
        storage_provider: uploaded.data.provider,
        file_name: uploadFile.name, uploaded_by: profile?.id,
      }).select('id').single();
      if (insertErr) {
        await removePrivateFile(filePath, uploaded.data.provider);
        setUploadError(insertErr.message);
        return;
      }
      saveExtractedText(inserted.id, uploadFile, text => supabase.from('papers').update({ extracted_text: text }).eq('id', inserted.id));
      await refreshPapers();
      setShowUpload(false);
      setUploadTitle(''); setUploadType('past_paper'); setUploadYear(''); setUploadSemester(''); setUploadFile(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeletePaper(paper: Paper) {
    if (!confirm(`Remove "${paper.title}"?`)) return;
    const { error } = await supabase.from('papers').update({ deleted_at: new Date().toISOString() }).eq('id', paper.id);
    if (error) { alert(error.message); return; }
    setPapers(papers.filter(p => p.id !== paper.id));
  }

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    setNoteError('');
    if (!noteTitle.trim()) { setNoteError('Please enter a title'); return; }
    setNoteUploading(true);
    let filePath: string | null = null; let fileName: string | null = null;
    let noteStorageProvider: StorageProvider = 'supabase';
    if (noteFile) {
      filePath = `${courseId}/${profile?.id}/notes/${Date.now()}-${noteFile.name.replace(/[^\w.-]+/g, '_')}`;
      const uploaded = await uploadPrivateFile(filePath, noteFile);
      if (uploaded.error || !uploaded.data) { setNoteError(uploaded.error?.message || 'Upload failed'); setNoteUploading(false); return; }
      noteStorageProvider = uploaded.data.provider;
      fileName = noteFile.name;
    }
    const { error: insErr } = await supabase.from('notes').insert({
      course_id: courseId, title: noteTitle, content: noteContent,
      file_path: filePath, file_name: fileName, storage_provider: noteStorageProvider, posted_by: profile?.id,
    });
    if (insErr) {
      if (filePath) await removePrivateFile(filePath, noteStorageProvider);
      setNoteError(insErr.message); setNoteUploading(false); return;
    }
    await refreshNotes();
    setNoteUploading(false); setShowNote(false);
    setNoteTitle(''); setNoteContent(''); setNoteFile(null);
  }

  async function handleDeleteNote(note: Note) {
    if (!confirm(`Delete "${note.title}"?`)) return;
    if (note.file_path) await removePrivateFile(note.file_path, note.storage_provider);
    await supabase.from('notes').delete().eq('id', note.id);
    setNotes(notes.filter(n => n.id !== note.id));
  }

  async function handleAddBook(e: FormEvent) {
    e.preventDefault();
    setBookError(''); setBookSubmitting(true);
    let filePath: string | null = null;
    let bookStorageProvider: StorageProvider = 'supabase';
    if (bookFile) {
      filePath = `${courseId}/${profile?.id}/books/${Date.now()}-${bookFile.name.replace(/[^\w.-]+/g, '_')}`;
      const uploaded = await uploadPrivateFile(filePath, bookFile);
      if (uploaded.error || !uploaded.data) { setBookError(uploaded.error?.message || 'Upload failed'); setBookSubmitting(false); return; }
      bookStorageProvider = uploaded.data.provider;
    }
    const { error } = await supabase.from('recommended_books').insert({
      course_id: courseId, title: bookTitle, author: bookAuthor,
      isbn: bookIsbn || null, description: bookDescription,
      link: null, file_path: filePath, file_name: bookFile?.name || null,
      storage_provider: bookStorageProvider, recommended_by: profile?.id,
    });
    if (error) {
      if (filePath) await removePrivateFile(filePath, bookStorageProvider);
      setBookError(error.message); setBookSubmitting(false); return;
    }
    await refreshBooks();
    setBookSubmitting(false); setShowBook(false);
    setBookTitle(''); setBookAuthor(''); setBookIsbn(''); setBookDescription(''); setBookFile(null);
  }

  async function handleDeleteBook(book: RecommendedBook) {
    if (!confirm(`Remove "${book.title}" from recommendations?`)) return;
    if (book.file_path) await removePrivateFile(book.file_path, book.storage_provider);
    await supabase.from('recommended_books').delete().eq('id', book.id);
    setBooks(books.filter(b => b.id !== book.id));
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-8">
        <Sidebar />
        <div className="flex-1 flex justify-center py-20"><Spinner size={32} /></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900">Course not found</h1>
        <Link to="/courses" className="inline-block mt-4"><Button variant="primary" size="sm">Back to Courses</Button></Link>
      </div>
    );
  }

  // Group papers by type
  const papersByType: Record<PaperTypeKey, Paper[]> = {
    past_paper: papers.filter(p => p.paper_type === 'past_paper'),
    deferred_exam: papers.filter(p => p.paper_type === 'deferred_exam'),
    mid_semester_exam: papers.filter(p => p.paper_type === 'mid_semester_exam'),
    end_of_semester_exam: papers.filter(p => p.paper_type === 'end_of_semester_exam'),
    end_of_year_exam: papers.filter(p => p.paper_type === 'end_of_year_exam'),
    test: papers.filter(p => p.paper_type === 'test'),
    quiz: papers.filter(p => p.paper_type === 'quiz'),
    assignment: papers.filter(p => p.paper_type === 'assignment'),
  };

  const tabs: { key: Tab; label: string; icon: typeof FileText; count: number }[] = [
    { key: 'papers', label: 'Papers', icon: FileText, count: papers.length },
    { key: 'notes', label: 'Notes', icon: Notebook, count: notes.length },
    { key: 'books', label: 'Recommended Books', icon: BookOpen, count: books.length },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex gap-8">
        <Sidebar />

        <div className="flex-1 min-w-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-4 flex-wrap">
            <Link to="/courses" className="hover:text-slate-700 inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Courses
            </Link>
            {course.schools && (
              <>
                <span className="text-slate-300">/</span>
                <span className="text-slate-500">{course.schools.short_name}</span>
              </>
            )}
            {course.programmes && (
              <>
                <span className="text-slate-300">/</span>
                <span className="text-slate-500">{course.programmes.name}</span>
              </>
            )}
            {course.year_of_study && (
              <>
                <span className="text-slate-300">/</span>
                <span className="text-slate-500">Year {course.year_of_study}</span>
              </>
            )}
          </div>

          {/* Course header */}
          <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge variant="emerald"><span>{course.course_code}</span></Badge>
                {course.year_of_study && <Badge variant="slate">Year {course.year_of_study}</Badge>}
                {course.schools && (
                  <Badge variant="blue">
                    <GraduationCap className="w-3 h-3 inline mr-1" />
                    {course.schools.short_name}
                  </Badge>
                )}
                {course.programmes && <Badge variant="slate">{course.programmes.name}</Badge>}
              </div>
              <h1 className="text-3xl font-bold text-slate-900">{course.title}</h1>
              <p className="text-slate-500 mt-2 max-w-2xl">{course.description || 'No description available'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!profile && activeTab === 'papers' && (
                <Link to="/signin"><Button variant="primary"><Upload className="w-4 h-4" /> Sign in to upload</Button></Link>
              )}
              {profile && activeTab === 'papers' && (
                <Button variant="primary" onClick={() => setShowUpload(true)}>
                  <Upload className="w-4 h-4" /> Upload Paper
                </Button>
              )}
              {isAdmin && <Button variant="outline" onClick={() => setShowGuidance(true)}>AI Method</Button>}
            </div>
            {profile && activeTab === 'notes' && (
              <Button variant="primary" onClick={() => setShowNote(true)}>
                <Plus className="w-4 h-4" /> Add Note
              </Button>
            )}
            {profile && activeTab === 'books' && (
              <Button variant="primary" onClick={() => setShowBook(true)}>
                <Plus className="w-4 h-4" /> Recommend Book
              </Button>
            )}
          </div>

          {!profile && (
            <Card className="p-6 mb-6 bg-amber-50 border-amber-200">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <p className="text-sm text-amber-800">Sign in to view course files, upload resources, and use the AI solver.</p>
                <Link to="/signin"><Button size="sm" variant="primary">Sign In</Button></Link>
              </div>
            </Card>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-6 border-b border-slate-200">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? 'text-emerald-700 border-emerald-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Papers tab — grouped by type */}
          {activeTab === 'papers' && (
            <div className="mb-6 space-y-6">
              {papers.length === 0 ? (
                <Card className="p-12 text-center">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No papers uploaded yet.</p>
                  {isAdmin && (
                    <Button variant="primary" size="sm" className="mt-4" onClick={() => setShowUpload(true)}>
                      <Plus className="w-4 h-4" /> Upload the first paper
                    </Button>
                  )}
                </Card>
              ) : (
                (Object.keys(PAPER_TYPE_META) as PaperTypeKey[]).map(typeKey => {
                  const typePapers = papersByType[typeKey];
                  if (typePapers.length === 0) return null;
                  const meta = PAPER_TYPE_META[typeKey];
                  return (
                    <div key={typeKey}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.color}`}>
                          <meta.icon className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">{meta.label}</h3>
                        <span className="text-xs text-slate-400">({typePapers.length})</span>
                      </div>
                      <div className="space-y-2">
                        {typePapers.map(paper => (
                          <Card key={paper.id} className="p-4">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                                  <meta.icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-slate-900 text-sm truncate">{paper.title}</h4>
                                  {paper.status !== 'approved' && <Badge variant="amber">{paper.status === 'pending' ? 'Awaiting review' : 'Rejected'}</Badge>}
                                  {paper.semester && <span className="text-xs text-slate-400 mr-2">Sem {paper.semester}</span>}
                                  {paper.year && (
                                    <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                      <Calendar className="w-3 h-3" />{paper.year}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {canAccess && paper.file_path && (
                                  <>
                                    <Link to={`/papers/${paper.id}`}>
                                      <Button size="sm" variant="outline"><Eye className="w-4 h-4" />Read in Armarium</Button>
                                    </Link>
                                  </>
                                )}
                                {(isAdmin || paper.uploaded_by === profile?.id) && (
                                  <Button size="sm" variant="ghost" onClick={() => handleDeletePaper(paper)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Notes tab */}
          {activeTab === 'notes' && (
            <div className="mb-6">
              {notes.length === 0 ? (
                <Card className="p-12 text-center">
                  <Notebook className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No notes shared yet.</p>
                  <Button variant="primary" size="sm" className="mt-4" onClick={() => setShowNote(true)}>
                    <Plus className="w-4 h-4" /> Share the first note
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {notes.map(note => (
                    <Card key={note.id} className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                          <Notebook className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900">{note.title}</h3>
                          {note.content && <p className="text-sm text-slate-500 mt-1 line-clamp-3">{note.content}</p>}
                          <div className="flex items-center gap-2 mt-3">
                            {note.file_path && noteUrls[note.id] && (
                              <Button size="sm" variant="outline" onClick={() => setReaderAsset({ title: note.title, url: noteUrls[note.id], fileName: note.file_name || note.title })}>
                                <Eye className="w-4 h-4" />Open in Armarium
                              </Button>
                            )}
                            {(note.posted_by === profile?.id || isAdmin) && (
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteNote(note)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Books tab */}
          {activeTab === 'books' && (
            <div className="mb-6">
              {books.length === 0 ? (
                <Card className="p-12 text-center">
                  <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No recommended books yet.</p>
                  <Button variant="primary" size="sm" className="mt-4" onClick={() => setShowBook(true)}>
                    <Plus className="w-4 h-4" /> Recommend the first book
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {books.map(book => (
                    <Card key={book.id} className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <BookMarked className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900">{book.title}</h3>
                          <p className="text-sm text-slate-500 mt-0.5">by {book.author}</p>
                          {book.isbn && <p className="text-xs text-slate-400 mt-1">ISBN: {book.isbn}</p>}
                          {book.description && <p className="text-sm text-slate-600 mt-2">{book.description}</p>}
                          <div className="flex items-center gap-2 mt-3">
                            {book.file_path && bookUrls[book.id] ? (
                              <Button size="sm" variant="outline" onClick={() => setReaderAsset({ title: book.title, url: bookUrls[book.id], fileName: book.file_name || book.title })}>
                                <BookOpen className="w-4 h-4" />Read in Armarium
                              </Button>
                            ) : <span className="text-xs text-slate-400">No in-platform copy attached</span>}
                            {(book.recommended_by === profile?.id || isAdmin) && (
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteBook(book)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Q&A link */}
          <Card className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Questions & Answers</h3>
                  <p className="text-sm text-slate-500">Ask questions about this course or its papers</p>
                </div>
              </div>
              <Link to={`/questions?course=${courseId}`}>
                <Button variant="outline" size="sm">Go to Q&A<ArrowLeft className="w-4 h-4 rotate-180" /></Button>
              </Link>
            </div>
          </Card>

          {/* Modals */}
          <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Upload Paper">
            <form onSubmit={handleUploadPaper} className="space-y-4">
              {uploadError && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{uploadError}</div>}
              <Input label="Paper Title" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="e.g. Final Exam 2024" required />
              <Select label="Paper Type" value={uploadType} onChange={e => setUploadType(e.target.value)}>
                {PAPER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
              <Input label="Year (optional)" type="number" value={uploadYear} onChange={e => setUploadYear(e.target.value)} placeholder="e.g. 2024" />
              <Select label="Semester (optional)" value={uploadSemester} onChange={e => setUploadSemester(e.target.value)}>
                <option value="">Not specified</option>
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </Select>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">File</label>
                <input type="file" accept=".pdf,.txt,.md,image/png,image/jpeg,image/webp" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" required />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" variant="primary" disabled={uploading}><Upload className="w-4 h-4" />{uploading ? 'Uploading...' : 'Upload'}</Button>
                <Button type="button" variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
              </div>
            </form>
          </Modal>

          <Modal open={showGuidance} onClose={() => setShowGuidance(false)} title="Course AI Method">
            <form onSubmit={saveAiGuidance} className="space-y-4">
              {guidanceError && <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{guidanceError}</div>}
              <p className="text-sm text-slate-600">Set the preferred solution method, notation, course rules, or required references. The AI solver uses this guidance with the course notes and prescribed texts.</p>
              <Textarea label="Instructions for the AI solver" value={guidance} onChange={event => setGuidance(event.target.value)} placeholder="For example: show all algebra steps, use the notation from the course notes, and cite the prescribed text chapter when relevant." rows={7} />
              <div className="flex gap-3">
                <Button type="submit" variant="primary" disabled={guidanceSaving}>{guidanceSaving ? 'Saving...' : 'Save guidance'}</Button>
                <Button type="button" variant="outline" onClick={() => setShowGuidance(false)}>Cancel</Button>
              </div>
            </form>
          </Modal>

          <Modal open={showNote} onClose={() => setShowNote(false)} title="Add Note">
            <form onSubmit={handleAddNote} className="space-y-4">
              {noteError && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{noteError}</div>}
              <Input label="Note Title" value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="e.g. Chapter 1 Summary" required />
              <Textarea label="Content (optional)" value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Write your note here, or upload a file below..." rows={5} />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">File (optional)</label>
                <input type="file" accept=".pdf,.txt,.md,image/png,image/jpeg,image/webp" onChange={e => setNoteFile(e.target.files?.[0] || null)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" variant="primary" disabled={noteUploading}>{noteUploading ? 'Saving...' : 'Save Note'}</Button>
                <Button type="button" variant="outline" onClick={() => setShowNote(false)}>Cancel</Button>
              </div>
            </form>
          </Modal>

          <Modal open={showBook} onClose={() => setShowBook(false)} title="Recommend a Text">
            <form onSubmit={handleAddBook} className="space-y-4">
              {bookError && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{bookError}</div>}
              <Input label="Book Title" value={bookTitle} onChange={e => setBookTitle(e.target.value)} placeholder="e.g. Introduction to Algorithms" required />
              <Input label="Author" value={bookAuthor} onChange={e => setBookAuthor(e.target.value)} placeholder="e.g. Cormen, Leiserson, Rivest, Stein" required />
              <Input label="ISBN (optional)" value={bookIsbn} onChange={e => setBookIsbn(e.target.value)} placeholder="e.g. 978-0262033848" />
              <Textarea label="Why recommend it? (optional)" value={bookDescription} onChange={e => setBookDescription(e.target.value)} placeholder="Brief description..." rows={3} />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">In-platform copy (optional)</label>
                <input type="file" accept=".pdf,.txt,.md,image/png,image/jpeg,image/webp" onChange={e => setBookFile(e.target.files?.[0] || null)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-800" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" variant="primary" disabled={bookSubmitting}>{bookSubmitting ? 'Adding...' : 'Add Book'}</Button>
                <Button type="button" variant="outline" onClick={() => setShowBook(false)}>Cancel</Button>
              </div>
            </form>
          </Modal>

          <Modal open={Boolean(readerAsset)} onClose={() => setReaderAsset(null)} title={readerAsset?.title || 'Document Reader'} size="lg">
            {readerAsset && (
              <div className="space-y-3">
                {readerAsset.fileName.toLowerCase().endsWith('.pdf') || /\.(txt|md)$/i.test(readerAsset.fileName) ? (
                  <iframe title={readerAsset.title} src={readerAsset.url} className="w-full h-[70vh] rounded-lg border border-slate-200" />
                ) : /\.(png|jpe?g|webp)$/i.test(readerAsset.fileName) ? (
                  <img src={readerAsset.url} alt={readerAsset.title} className="max-h-[70vh] max-w-full mx-auto object-contain" />
                ) : (
                  <div className="p-6 text-center text-sm text-slate-600">This format cannot be previewed in the browser.</div>
                )}
                <a href={readerAsset.url} download={readerAsset.fileName} className="inline-flex text-sm text-emerald-700 hover:underline">Save a copy</a>
              </div>
            )}
          </Modal>
        </div>
      </div>
    </div>
  );
}
