import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, BookOpen, Brain, MessageSquare, Upload, Search, ArrowRight, FileText, Users } from 'lucide-react';
import { supabase, type Course } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function LandingPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCourses() {
      const { data } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);
      setCourses(data as Course[] || []);
      setLoading(false);
    }
    loadCourses();
  }, []);

  return (
    <div className="bg-slate-900">
      {/* Hero section with dark background for transparent header */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `radial-gradient(circle at 25% 30%, rgba(16, 185, 129, 0.3) 0%, transparent 50%), radial-gradient(circle at 75% 70%, rgba(59, 130, 246, 0.2) 0%, transparent 50%)`
        }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-32">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="emerald" >
              <GraduationCap className="w-3 h-3 mr-1 inline" />
              Independent learning resource archive
            </Badge>
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
              Armarium
              <span className="block mt-2 bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                with AI-Powered Solutions
              </span>
            </h1>
            <p className="mt-6 text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
              Browse collections, programmes, and course units. Share study materials, open them in the built-in reader, and get guided AI solutions.
              Students upload course work; repository admins curate the catalogue.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup">
                <Button size="lg" variant="primary" className="w-full sm:w-auto">
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link to="/courses">
                <Button size="lg" variant="outline" className="w-full sm:w-auto bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30">
                  <Search className="w-5 h-5" />
                  Browse Courses
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-400">{courses.length || '—'}</div>
                <div className="text-sm text-slate-400 mt-1">Courses</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-400">AI</div>
                <div className="text-sm text-slate-400 mt-1">Solver</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-400">24/7</div>
                <div className="text-sm text-slate-400 mt-1">Access</div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave separator */}
        <div className="relative">
          <svg className="w-full h-12 text-slate-50" preserveAspectRatio="none" viewBox="0 0 1440 48">
            <path fill="currentColor" d="M0 48L1440 0V48H0Z" />
          </svg>
        </div>
      </section>

      {/* Features section */}
      <section className="bg-slate-50 py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-slate-900">Everything you need to excel</h2>
            <p className="mt-4 text-slate-600">An independent learning archive for students and educators</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={BookOpen}
              title="Organized by Course"
              description="Browse the repository by institution, school, programme, and course unit."
            />
            <FeatureCard
              icon={Upload}
              title="Shared Course Materials"
              description="Students contribute study materials; repository admins curate and moderate them."
            />
            <FeatureCard
              icon={Brain}
              title="AI Solver"
              description="Let AI read and solve papers for you. Get detailed, step-by-step solutions and grading instantly."
            />
            <FeatureCard
              icon={MessageSquare}
              title="Q&A Forum"
              description="Ask questions about any paper or topic and request an AI-generated explanation."
            />
            <FeatureCard
              icon={FileText}
              title="Multiple Paper Types"
              description="Past papers, tests, quizzes, and assignments — all categorized and searchable by year."
            />
            <FeatureCard
              icon={Users}
              title="Student & Admin Roles"
              description="Students upload and study course materials. Admins manage the catalogue and moderate resources."
            />
          </div>
        </div>
      </section>

      {/* Course preview section */}
      <section className="bg-white py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Featured Courses</h2>
              <p className="mt-2 text-slate-600">Explore course units and resources across the archive</p>
            </div>
            <Link to="/courses" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <Card className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700">No courses yet</h3>
              <p className="text-slate-500 mt-2">Courses will appear here as the catalogue grows.</p>
              <Link to="/signup" className="inline-block mt-4">
                <Button variant="primary" size="sm">Create an account</Button>
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map(course => (
                <Link key={course.id} to={`/courses/${course.id}`}>
                  <Card hoverable className="p-6 h-full">
                    <div className="flex items-start justify-between mb-4">
                      <Badge variant="emerald">{course.course_code}</Badge>
                      <ArrowRight className="w-4 h-4 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{course.title}</h3>
                    <p className="text-sm text-slate-500 line-clamp-2">{course.description || 'No description available'}</p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-900 py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-white">How it works</h2>
            <p className="mt-4 text-slate-400">Three simple steps to get started</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              step="1"
              title="Create an Account"
              description="Create a student account to upload materials, read documents, and use the AI solver."
            />
            <StepCard
              step="2"
              title="Browse & Download"
              description="Explore courses, find past papers, tests, and quizzes. Download or view them directly in your browser."
            />
            <StepCard
              step="3"
              title="Solve with AI"
              description="Use the AI solver to get detailed solutions and add questions to course discussions."
            />
          </div>

          <div className="text-center mt-12">
            <Link to="/signup">
              <Button size="lg" variant="primary">
                Create Your Account
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="bg-emerald-600 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white">Ready to ace your exams?</h2>
          <p className="mt-4 text-emerald-50 text-lg">Explore the Armarium catalogue and course resources.</p>
          <Link to="/signup" className="inline-block mt-8">
            <Button size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50">
              Get Started Now
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: typeof BookOpen; title: string; description: string }) {
  return (
    <Card className="p-6 h-full">
      <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-emerald-600" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
    </Card>
  );
}

function StepCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="relative">
      <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-bold text-lg flex items-center justify-center mb-4">
        {step}
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}
