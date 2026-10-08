import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, BookOpen, GraduationCap, Layers } from 'lucide-react';
import { supabase, buildCourseLinker, type School, type Course, type Programme } from '@/lib/supabase';

type ProgrammeWithCourses = Programme & { courses: Course[]; streams: ProgrammeWithCourses[] };
type SchoolWithProgrammes = School & { programmes: ProgrammeWithCourses[]; unassignedCourses: Course[] };

export function Sidebar({ institutionId }: { institutionId?: string }) {
  const [schools, setSchools] = useState<SchoolWithProgrammes[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSchools, setExpandedSchools] = useState<Set<string>>(new Set());
  const [expandedProgrammes, setExpandedProgrammes] = useState<Set<string>>(new Set());
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const location = useLocation();

  useEffect(() => {
    async function loadData() {
      const { data: schoolsData } = await supabase
        .from('schools')
        .select('*')
        .order('name');
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .order('course_code');
      const { data: programmesData } = await supabase
        .from('programmes')
        .select('*')
        .order('name');
      const schools = schoolsData as School[] || [];
      const courses = coursesData as Course[] || [];
      const programmes = programmesData as Programme[] || [];
      const linker = await buildCourseLinker(courses);
      const combined: SchoolWithProgrammes[] = schools
        .filter(s => !institutionId || s.institution_id === institutionId)
        .map(s => ({
          ...s,
          programmes: programmes.filter(programme => programme.school_id === s.id && !programme.parent_programme_id).map(programme => ({
            ...programme,
            courses: linker.coursesFor(programme.id),
            streams: programmes.filter(stream => stream.parent_programme_id === programme.id).map(stream => ({
              ...stream,
              courses: linker.coursesFor(stream.id),
              streams: [],
            })),
          })),
          unassignedCourses: linker.unlinkedFor(s.id),
        }));
      setSchools(combined);

      // Auto-expand the school that contains the current course
      const match = location.pathname.match(/\/courses\/([^/]+)/);
      if (match) {
        const courseId = match[1];
        for (const s of combined) {
          const programme = s.programmes.find(item => item.courses.some(course => course.id === courseId) || item.streams.some(stream => stream.courses.some(course => course.id === courseId)));
          const stream = programme?.streams.find(item => item.courses.some(course => course.id === courseId));
          if (programme || s.unassignedCourses.some(course => course.id === courseId)) {
            setExpandedSchools(new Set([s.id]));
            if (programme) setExpandedProgrammes(new Set([programme.id, ...(stream ? [stream.id] : [])]));
            const course = stream?.courses.find(item => item.id === courseId) || programme?.courses.find(item => item.id === courseId) || s.unassignedCourses.find(item => item.id === courseId);
            if (course?.year_of_study) {
              setExpandedYears(new Set([`${stream?.id || programme?.id || s.id}-${course.year_of_study}`]));
            }
            break;
          }
        }
      }
      setLoading(false);
    }
    loadData();
  }, [location.pathname, institutionId]);

  function toggleSchool(schoolId: string) {
    setExpandedSchools(prev => {
      const next = new Set(prev);
      if (next.has(schoolId)) next.delete(schoolId);
      else next.add(schoolId);
      return next;
    });
  }

  function toggleProgramme(programmeId: string) {
    setExpandedProgrammes(prev => {
      const next = new Set(prev);
      if (next.has(programmeId)) next.delete(programmeId);
      else next.add(programmeId);
      return next;
    });
  }

  function renderCourseYears(courses: Course[], groupId: string) {
    const years = Array.from(new Set(courses.flatMap(course => course.year_of_study === null ? [] : [course.year_of_study]))).sort();
    return (
      <>
        {years.map(year => {
          const yearKey = `${groupId}-${year}`;
          const expanded = expandedYears.has(yearKey);
          const yearCourses = courses.filter(course => course.year_of_study === year);
          return <div key={yearKey} className="ml-3 mb-0.5">
            <button onClick={() => toggleYear(yearKey)} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-500 rounded-lg hover:bg-slate-50">
              {expanded ? <ChevronDown className="w-3 h-3 text-slate-300" /> : <ChevronRight className="w-3 h-3 text-slate-300" />}
              Year {year}<span className="ml-auto text-slate-400">{yearCourses.length}</span>
            </button>
            {expanded && yearCourses.map(course => <Link key={course.id} to={`/courses/${course.id}`} className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors ${location.pathname === `/courses/${course.id}` ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}><BookOpen className="w-3 h-3 flex-shrink-0 text-slate-400" /><span className="truncate">{course.course_code}</span></Link>)}
          </div>;
        })}
        {courses.filter(course => course.year_of_study === null).map(course => <Link key={course.id} to={`/courses/${course.id}`} className={`ml-3 flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors ${location.pathname === `/courses/${course.id}` ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}><BookOpen className="w-3 h-3 flex-shrink-0 text-slate-400" /><span className="truncate">{course.course_code}</span></Link>)}
      </>
    );
  }

  function toggleYear(key: string) {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (loading) {
    return (
      <aside className="w-64 flex-shrink-0 hidden lg:block">
        <div className="sticky top-20 bg-white rounded-2xl border border-slate-200 p-4 animate-pulse h-96" />
      </aside>
    );
  }

  return (
    <aside className="w-64 flex-shrink-0 hidden lg:block">
      <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Layers className="w-4 h-4 text-emerald-600" />
            Browse Catalogue
          </div>
        </div>

        <div className="p-2">
          {schools.map(school => {
            const isExpanded = expandedSchools.has(school.id);
            const courseCount = school.programmes.reduce((total, programme) => total + programme.courses.length + programme.streams.reduce((streamTotal, stream) => streamTotal + stream.courses.length, 0), school.unassignedCourses.length);

            return (
              <div key={school.id} className="mb-1">
                <button
                  onClick={() => toggleSchool(school.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                  <GraduationCap className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="truncate text-left">{school.short_name}</span>
                  <span className="ml-auto text-xs text-slate-400">{courseCount}</span>
                </button>

                {isExpanded && (
                  <div className="ml-4 mt-0.5 mb-1 border-l border-slate-100 pl-2">
                    {school.programmes.map(programme => {
                      const isProgrammeExpanded = expandedProgrammes.has(programme.id);
                      const totalCourses = programme.courses.length + programme.streams.reduce((total, stream) => total + stream.courses.length, 0);
                      return (
                        <div key={programme.id} className="mb-0.5">
                          <button onClick={() => toggleProgramme(programme.id)} className="w-full flex items-start gap-1.5 px-2 py-1.5 text-xs font-semibold text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-left" title={programme.name}>
                            {isProgrammeExpanded ? <ChevronDown className="w-3 h-3 mt-0.5 text-slate-300" /> : <ChevronRight className="w-3 h-3 mt-0.5 text-slate-300" />}
                            <span className="flex-1">{programme.name}</span><span className="text-slate-400">{totalCourses}</span>
                          </button>
                          {isProgrammeExpanded && <div className="ml-2">
                            {renderCourseYears(programme.courses, programme.id)}
                            {programme.streams.map(stream => {
                              const streamExpanded = expandedProgrammes.has(stream.id);
                              return <div key={stream.id} className="ml-2">
                                <button onClick={() => toggleProgramme(stream.id)} className="w-full flex items-start gap-1.5 px-2 py-1.5 text-xs text-slate-500 rounded-lg hover:bg-slate-50 text-left" title={stream.name}>
                                  {streamExpanded ? <ChevronDown className="w-3 h-3 mt-0.5 text-slate-300" /> : <ChevronRight className="w-3 h-3 mt-0.5 text-slate-300" />}
                                  <span className="flex-1">{stream.name}</span><span className="text-slate-400">{stream.courses.length}</span>
                                </button>
                                {streamExpanded && renderCourseYears(stream.courses, stream.id)}
                              </div>;
                            })}
                          </div>}
                        </div>
                      );
                    })}

                    {school.unassignedCourses.map(course => {
                      const isActive = location.pathname === `/courses/${course.id}`;
                      return <Link key={course.id} to={`/courses/${course.id}`} className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg transition-colors ${isActive ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}><BookOpen className="w-3 h-3 flex-shrink-0 text-slate-400" /><span className="truncate">{course.course_code}</span></Link>;
                    })}

                    {school.programmes.length === 0 && school.unassignedCourses.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-400 italic">No programmes yet</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
