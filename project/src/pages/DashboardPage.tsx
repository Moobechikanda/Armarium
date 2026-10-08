import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, Brain, MessageSquare, Upload, ArrowRight, GraduationCap } from 'lucide-react';
import { supabase, type Course, type Paper, type School } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function DashboardPage() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [schools, setSchools] = useState<(School & { programmes: { id: string }[] })[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    async function loadData() {
      const { data: schoolData } = await supabase.from('schools').select('*, programmes(id)').order('name');
      setSchools(schoolData as (School & { programmes: { id: string }[] })[] || []);
      if (isAdmin) {
        const { data: myCourses } = await supabase
          .from('courses')
          .select('*')
          .order('created_at', { ascending: false });
        setCourses(myCourses as Course[] || []);

        const { data: myPapers } = await supabase
          .from('papers')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);
        setPapers(myPapers as Paper[] || []);
      } else {
        const { data: allCourses } = await supabase
          .from('courses')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(6);
        setCourses(allCourses as Course[] || []);
      }
      setLoading(false);
    }
    if (profile) loadData();
  }, [profile, isAdmin]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {profile?.full_name?.split(' ')[0]}
        </h1>
        <p className="text-slate-500 mt-1">
          {isAdmin ? 'Manage courses and repository resources' : 'Upload study material and solve with AI'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={BookOpen} label="Courses" value={loading ? '—' : courses.length} color="emerald" />
        <StatCard icon={FileText} label={isAdmin ? "Repository Papers" : "Your Recent Papers"} value={loading ? '—' : papers.length || '—'} color="blue" />
        <StatCard icon={Brain} label="AI Solver" value="Available" color="amber" />
        <StatCard icon={MessageSquare} label="Questions" value="Open" color="slate" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {isAdmin ? (
          <>
            <QuickAction icon={BookOpen} title="Create Course" description="Add a course to a programme" link="/courses/new" />
            <QuickAction icon={Upload} title="Bulk Upload" description="Drop many files and auto-map them to courses" link="/admin/upload" />
            <QuickAction icon={BookOpen} title="Import CSV" description="Bulk add programmes and courses" link="/admin/import" />
            <QuickAction icon={FileText} title="Review Queue" description="Approve submissions and handle reports" link="/admin/review" />
            <QuickAction icon={MessageSquare} title="Answer Questions" description="Help students with their questions" link="/questions" />
          </>
        ) : (
          <>
            <QuickAction icon={BookOpen} title="Browse Courses" description="Find your course" link="/courses" />
            <QuickAction icon={Upload} title="Add Materials" description="Share papers, tests, assignments or notes" link="/contribute" />
            <QuickAction icon={Brain} title="AI Solver" description="Attach a document and get an explanation" link="/ai-solver" />
            <QuickAction icon={MessageSquare} title="Ask a Question" description="Get help from the study community" link="/questions" />
            <QuickAction icon={MessageSquare} title="Study Groups" description="Join or start a group for your school" link="/groups" />
          </>
        )}
      </div>

      {/* Recent courses */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Browse by school</h2>
          <Link to="/courses">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : schools.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No schools have been added yet.</p>
            {isAdmin && (
              <Link to="/schools/new" className="inline-block mt-4">
                <Button variant="primary" size="sm">Add the first school</Button>
              </Link>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {schools.map(school => (
              <Link key={school.id} to={`/courses?school=${school.id}`}>
                <Card hoverable className="p-5 h-full">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                    <GraduationCap className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-slate-900 leading-snug">{school.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{school.programmes.length} programme{school.programmes.length !== 1 ? 's' : ''}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof BookOpen; label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <Card className="p-5">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </Card>
  );
}

function QuickAction({ icon: Icon, title, description, link }: { icon: typeof BookOpen; title: string; description: string; link: string }) {
  return (
    <Link to={link}>
      <Card hoverable className="p-5">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
        </div>
      </Card>
    </Link>
  );
}
