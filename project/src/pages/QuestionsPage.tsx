import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Plus, Brain, Send, User as UserIcon, Bot } from 'lucide-react';
import { supabase, type Course, type Question, type QuestionAnswer } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';

export function QuestionsPage() {
  const [searchParams] = useSearchParams();
  const courseFilter = searchParams.get('course') || '';
  const { profile } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [questions, setQuestions] = useState<(Question & { course?: Course })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAsk, setShowAsk] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer[]>>({});

  // Form state
  const [qCourseId, setQCourseId] = useState(courseFilter);
  const [qPaperId, setQPaperId] = useState('');
  const [qTitle, setQTitle] = useState('');
  const [qBody, setQBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [aiAnswerLoading, setAiAnswerLoading] = useState<string | null>(null);
  const [aiAnswerErrors, setAiAnswerErrors] = useState<Record<string, string>>({});

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    async function loadData() {
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .order('title');
      setCourses(coursesData as Course[] || []);

      let query = supabase
        .from('questions')
        .select('*, courses(*)')
        .order('created_at', { ascending: false });

      if (courseFilter) {
        query = query.eq('course_id', courseFilter);
      }

      const { data: questionsData } = await query;
      const qs = questionsData as (Question & { courses: Course })[] || [];
      setQuestions(qs.map(q => ({ ...q, course: q.courses })));

      // Load answers for all questions
      if (qs.length > 0) {
        const { data: answersData } = await supabase
          .from('question_answers')
          .select('*')
          .in('question_id', qs.map(q => q.id))
          .order('created_at', { ascending: true });

        const answersMap: Record<string, QuestionAnswer[]> = {};
        (answersData as QuestionAnswer[] || []).forEach(a => {
          if (!answersMap[a.question_id]) answersMap[a.question_id] = [];
          answersMap[a.question_id].push(a);
        });
        setAnswers(answersMap);
      }

      setLoading(false);
    }
    loadData();
  }, [courseFilter]);

  async function handleAskQuestion(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const { data } = await supabase
      .from('questions')
      .insert({
        course_id: qCourseId,
        paper_id: qPaperId || null,
        title: qTitle,
        body: qBody,
        asked_by: profile?.id,
      })
      .select('*, courses(*)')
      .single();

    if (data) {
      const newQ = data as Question & { courses: Course };
      setQuestions([{ ...newQ, course: newQ.courses }, ...questions]);
    }

    setSubmitting(false);
    setShowAsk(false);
    setQTitle('');
    setQBody('');
    setQPaperId('');
  }

  async function handlePostAnswer(questionId: string) {
    if (!answerText.trim()) return;
    setSubmitting(true);

    const { data } = await supabase
      .from('question_answers')
      .insert({
        question_id: questionId,
        content: answerText,
        answered_by: profile?.id,
        is_ai_answer: false,
      })
      .select('*')
      .single();

    if (data) {
      setAnswers({
        ...answers,
        [questionId]: [...(answers[questionId] || []), data as QuestionAnswer],
      });
    }

    setAnswerText('');
    setSubmitting(false);
  }

  async function handleAiAnswer(question: Question) {
    setAiAnswerLoading(question.id);
    setAiAnswerErrors(current => ({ ...current, [question.id]: '' }));

    try {
      const { data, error } = await supabase.functions.invoke('ai-solve', {
        body: {
          course_id: question.course_id,
          paper_id: question.paper_id,
          question: `${question.title}\n\n${question.body}`,
          mode: 'question_answer',
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const { data: newAnswer } = await supabase
        .from('question_answers')
        .insert({
          question_id: question.id,
          content: data.solution,
          answered_by: null,
          is_ai_answer: true,
        })
        .select('*')
        .single();

      if (newAnswer) {
        setAnswers({
          ...answers,
          [question.id]: [...(answers[question.id] || []), newAnswer as QuestionAnswer],
        });
      }
    } catch (err) {
      setAiAnswerErrors(current => ({
        ...current,
        [question.id]: err instanceof Error ? err.message : 'The AI answer could not be generated.',
      }));
    } finally {
      setAiAnswerLoading(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Questions & Answers</h1>
          <p className="text-slate-500 mt-1">Ask questions and get help from the community or AI</p>
        </div>
        <Button variant="primary" onClick={() => { setQCourseId(courseFilter); setShowAsk(true); }}>
          <Plus className="w-4 h-4" />
          Ask a Question
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      ) : questions.length === 0 ? (
        <Card className="p-12 text-center">
          <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700">No questions yet</h3>
          <p className="text-slate-500 mt-2">Be the first to ask a question.</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={() => setShowAsk(true)}>
            <Plus className="w-4 h-4" />
            Ask a Question
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map(question => (
            <Card key={question.id} className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {question.course && <Badge variant="emerald">{question.course.course_code}</Badge>}
                    <Badge variant="slate">{new Date(question.created_at).toLocaleDateString()}</Badge>
                  </div>
                  <h3 className="font-bold text-slate-900">{question.title}</h3>
                  <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{question.body}</p>

                  {/* Answers */}
                  {(answers[question.id] || []).length > 0 && (
                    <div className="mt-4 space-y-3 pl-4 border-l-2 border-slate-100">
                      {answers[question.id].map(answer => (
                        <div key={answer.id} className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            answer.is_ai_answer ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-slate-100'
                          }`}>
                            {answer.is_ai_answer ? (
                              <Bot className="w-4 h-4 text-white" />
                            ) : (
                              <UserIcon className="w-4 h-4 text-slate-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-slate-700">
                                {answer.is_ai_answer ? 'AI Assistant' : 'Community member'}
                              </span>
                              {answer.is_ai_answer && <Badge variant="emerald">AI</Badge>}
                            </div>
                            <p className="text-sm text-slate-600 whitespace-pre-wrap">{answer.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    {aiAnswerErrors[question.id] && <p role="alert" className="w-full text-sm text-red-700">{aiAnswerErrors[question.id]}</p>}
                    {isAdmin && selectedQuestion === question.id ? (
                      <div className="w-full flex gap-2">
                        <input
                          type="text"
                          value={answerText}
                          onChange={e => setAnswerText(e.target.value)}
                          placeholder="Type your answer..."
                          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        />
                        <Button size="sm" variant="primary" onClick={() => handlePostAnswer(question.id)} disabled={submitting || !answerText.trim()}>
                          <Send className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedQuestion(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <>
                        {isAdmin && (
                          <Button size="sm" variant="outline" onClick={() => { setSelectedQuestion(question.id); setAnswerText(''); }}>
                            <MessageSquare className="w-4 h-4" />
                            Answer
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAiAnswer(question)}
                          disabled={aiAnswerLoading === question.id}
                        >
                          <Brain className="w-4 h-4" />
                          {aiAnswerLoading === question.id ? 'AI thinking...' : 'Ask AI'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Ask question modal */}
      <Modal open={showAsk} onClose={() => setShowAsk(false)} title="Ask a Question" size="lg">
        <form onSubmit={handleAskQuestion} className="space-y-4">
          <Select
            label="Course"
            value={qCourseId}
            onChange={e => setQCourseId(e.target.value)}
            required
          >
            <option value="">Select a course</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.course_code} — {c.title}</option>
            ))}
          </Select>

          <Input
            label="Question Title"
            value={qTitle}
            onChange={e => setQTitle(e.target.value)}
            placeholder="e.g. How do I implement a binary search tree?"
            required
          />

          <Textarea
            label="Details"
            value={qBody}
            onChange={e => setQBody(e.target.value)}
            placeholder="Provide more context about your question..."
            rows={4}
            required
          />

          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Posting...' : 'Post Question'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowAsk(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
