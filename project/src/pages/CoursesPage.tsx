import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, BookOpen, ArrowRight, GraduationCap, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase, buildCourseLinker, type Course, type Institution, type Programme, type School } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/Sidebar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';

type ProgrammeWithCourses = Programme & { courses: Course[]; streams: ProgrammeWithCourses[] };
type SchoolWithProgrammes = School & { programmes: ProgrammeWithCourses[]; unassignedCourses: Course[] };

export function CoursesPage() {
  const { profile } = useAuth();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState('');
  const [schools, setSchools] = useState<SchoolWithProgrammes[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedSchools, setExpandedSchools] = useState<Set<string>>(new Set());
  const [expandedProgrammes, setExpandedProgrammes] = useState<Set<string>>(new Set());
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());

  const isAdmin = profile?.role === 'admin';
  const [params, setParams] = useSearchParams();
  const selectedSchool = schools.find(school => school.id === params.get('school'));
  const selectedProgramme = selectedSchool?.programmes.find(programme => programme.id === params.get('programme'));
  const selectedStream = selectedProgramme?.streams.find(stream => stream.id === params.get('stream'));
  const countCourses = (programme: ProgrammeWithCourses) => programme.courses.length + programme.streams.reduce((total, stream) => total + stream.courses.length, 0);

  useEffect(() => {
    async function loadData() {
      const { data: institutionsData } = await supabase
        .from('institutions')
        .select('*')
        .order('name');
      const institutionList = institutionsData as Institution[] || [];
      setInstitutions(institutionList);
      const armarium = institutionList.find(institution => institution.short_name === 'ARM');
      setSelectedInstitutionId(current => current || armarium?.id || institutionList[0]?.id || '');

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
      const sList = schoolsData as School[] || [];
      const cList = coursesData as Course[] || [];
      const pList = programmesData as Programme[] || [];
      const linker = await buildCourseLinker(cList);
      const combinedSchools = sList.map(s => ({
        ...s,
        programmes: pList.filter(programme => programme.school_id === s.id && !programme.parent_programme_id).map(programme => ({
          ...programme,
          courses: linker.coursesFor(programme.id),
          streams: pList.filter(stream => stream.parent_programme_id === programme.id).map(stream => ({
            ...stream,
            courses: linker.coursesFor(stream.id),
            streams: [],
          })),
        })),
        unassignedCourses: linker.unlinkedFor(s.id),
      }));
      setSchools(combinedSchools);
      setExpandedSchools(new Set(combinedSchools.filter(school => school.programmes.some(programme => programme.courses.length > 0)).map(school => school.id)));
      setExpandedProgrammes(new Set(combinedSchools.flatMap(school => school.programmes.flatMap(programme => [programme, ...programme.streams]).filter(programme => programme.courses.length > 0).map(programme => programme.id))));
      setLoading(false);
    }
    loadData();
  }, []);

  function toggleSchool(schoolId: string) {
    setExpandedSchools(prev => {
      const next = new Set(prev);
      if (next.has(schoolId)) next.delete(schoolId);
      else next.add(schoolId);
      return next;
    });
  }

  function toggleYear(key: string) {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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

  const query = search.trim().toLowerCase();
  const filteredSchools = schools
    .filter(school => !selectedInstitutionId || school.institution_id === selectedInstitutionId)
    .map(school => {
      const schoolMatches = !query || school.name.toLowerCase().includes(query) || school.short_name.toLowerCase().includes(query);
      const programmes = school.programmes.map(programme => {
        const programmeMatches = !query || programme.name.toLowerCase().includes(query);
        const streams = programme.streams.map(stream => {
          const streamMatches = !query || stream.name.toLowerCase().includes(query);
          return {
            ...stream,
            courses: schoolMatches || programmeMatches || streamMatches || !query
              ? stream.courses
              : stream.courses.filter(course => course.title.toLowerCase().includes(query) || course.course_code.toLowerCase().includes(query)),
          };
        }).filter(stream => !query || schoolMatches || programmeMatches || stream.name.toLowerCase().includes(query) || stream.courses.length > 0);
        return {
          ...programme,
          courses: schoolMatches || programmeMatches || !query
            ? programme.courses
            : programme.courses.filter(course => course.title.toLowerCase().includes(query) || course.course_code.toLowerCase().includes(query)),
          streams,
        };
      }).filter(programme => !query || schoolMatches || programme.name.toLowerCase().includes(query) || programme.courses.length > 0 || programme.streams.length > 0);
      const unassignedCourses = school.unassignedCourses.filter(course => !query || schoolMatches || course.title.toLowerCase().includes(query) || course.course_code.toLowerCase().includes(query));
      return { ...school, programmes, unassignedCourses };
    })
    .filter(school => !query || school.name.toLowerCase().includes(query) || school.short_name.toLowerCase().includes(query) || school.programmes.length > 0 || school.unassignedCourses.length > 0);

  function renderCourseGroups(courses: Course[], groupId: string, open = false) {
    const years = Array.from(new Set(courses.flatMap(course => course.year_of_study === null ? [] : [course.year_of_study]))).sort();
    const unassigned = courses.filter(course => course.year_of_study === null);
    const renderCourses = (items: Course[]) => (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50/50">
        {items.map(course => (
          <Link key={course.id} to={`/courses/${course.id}`}>
            <Card hoverable className="p-4">
              <div className="flex items-start justify-between mb-2">
                <Badge variant="emerald">{course.course_code}</Badge>
                <ArrowRight className="w-4 h-4 text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">{course.title}</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{course.description || 'No description'}</p>
            </Card>
          </Link>
        ))}
      </div>
    );

    return (
      <>
        {years.map(year => {
          const yearKey = `${groupId}-${year}`;
          const isYearExpanded = open || expandedYears.has(yearKey) || !!query;
          const yearCourses = courses.filter(course => course.year_of_study === year);
          return (
            <div key={yearKey}>
              <button onClick={() => toggleYear(yearKey)} className="w-full flex items-center gap-2 px-5 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50">
                {isYearExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                <span className="text-sm font-semibold text-slate-700">Year {year}</span>
                <span className="ml-auto text-xs text-slate-400">{yearCourses.length}</span>
              </button>
              {isYearExpanded && renderCourses(yearCourses)}
            </div>
          );
        })}
        {unassigned.length > 0 && renderCourses(unassigned)}
      </>
    );
  }

  function renderBrowse() {
    const visibleSchools = schools.filter(school => !selectedInstitutionId || school.institution_id === selectedInstitutionId);
    const box = 'text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-emerald-400 hover:shadow-md transition-all';
    const crumbs = (
      <nav className="flex items-center gap-2 text-sm text-slate-500 mb-4 flex-wrap">
        <button onClick={() => setParams({})} className="hover:text-emerald-700">All schools</button>
        {selectedSchool && <><ChevronRight className="w-3 h-3" /><button onClick={() => setParams({ school: selectedSchool.id })} className="hover:text-emerald-700">{selectedSchool.short_name}</button></>}
        {selectedProgramme && <><ChevronRight className="w-3 h-3" /><button onClick={() => setParams({ school: selectedSchool!.id, programme: selectedProgramme.id })} className="hover:text-emerald-700">{selectedProgramme.name}</button></>}
        {selectedStream && <><ChevronRight className="w-3 h-3" /><span className="font-semibold text-slate-700">{selectedStream.name}</span></>}
      </nav>
    );

    if (!selectedSchool) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleSchools.map(school => (
            <button key={school.id} onClick={() => setParams({ school: school.id })} className={box}>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center mb-3"><GraduationCap className="w-5 h-5 text-emerald-600" /></div>
              <h2 className="font-bold text-slate-900 leading-snug">{school.name}</h2>
              <p className="text-xs text-slate-500 mt-1">{school.programmes.length} programme{school.programmes.length !== 1 ? 's' : ''} · {school.programmes.reduce((total, programme) => total + countCourses(programme), school.unassignedCourses.length)} courses</p>
            </button>
          ))}
        </div>
      );
    }

    if (!selectedProgramme) {
      return (
        <div>
          {crumbs}
          <h2 className="text-lg font-bold text-slate-900 mb-3">{selectedSchool.name}</h2>
          {selectedSchool.programmes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
              {selectedSchool.programmes.map(programme => (
                <button key={programme.id} onClick={() => setParams({ school: selectedSchool.id, programme: programme.id })} className={box}>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3"><BookOpen className="w-5 h-5 text-blue-600" /></div>
                  <h3 className="font-semibold text-slate-900 leading-snug">{programme.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{programme.streams.length > 0 ? `${programme.streams.length} streams · ` : ''}{countCourses(programme)} courses</p>
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400 mb-6">No programmes have been added to this school yet.</p>}
          {selectedSchool.unassignedCourses.length > 0 && (
            <Card className="overflow-hidden">
              <h3 className="px-5 py-3 text-xs font-semibold uppercase text-slate-400 border-b border-slate-50">Archives and courses without a programme</h3>
              {renderCourseGroups(selectedSchool.unassignedCourses, `${selectedSchool.id}-unassigned`, true)}
            </Card>
          )}
        </div>
      );
    }

    const current = selectedStream || selectedProgramme;
    return (
      <div>
        {crumbs}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-lg font-bold text-slate-900">{current.name}</h2>
          {isAdmin && <Link to={`/courses/new?school=${selectedSchool.id}&programme=${current.id}`}><Button variant="outline" size="sm"><Plus className="w-4 h-4" />Add course</Button></Link>}
        </div>
        {!selectedStream && selectedProgramme.streams.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            {selectedProgramme.streams.map(stream => (
              <button key={stream.id} onClick={() => setParams({ school: selectedSchool.id, programme: selectedProgramme.id, stream: stream.id })} className={box}>
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3"><BookOpen className="w-5 h-5 text-amber-600" /></div>
                <h3 className="font-semibold text-slate-900 leading-snug">{stream.name}</h3>
                <p className="text-xs text-slate-500 mt-1">{stream.courses.length} courses</p>
              </button>
            ))}
          </div>
        )}
        {current.courses.length > 0 ? (
          <Card className="overflow-hidden">
            {!selectedStream && selectedProgramme.streams.length > 0 && <h3 className="px-5 py-3 text-xs font-semibold uppercase text-slate-400 border-b border-slate-50">Shared courses</h3>}
            {renderCourseGroups(current.courses, current.id, true)}
          </Card>
        ) : selectedProgramme.streams.length === 0 || selectedStream ? (
          <p className="text-sm text-slate-400">No course units are listed here yet.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex gap-8">
        <Sidebar />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Courses</h1>
              <p className="text-slate-500 mt-1">Browse schools, programmes, and courses</p>
            </div>
            {isAdmin && (
              <div className="flex flex-wrap gap-2">
                <Link to="/schools/new">
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4" />
                    Add School
                  </Button>
                </Link>
                <Link to="/programmes/new">
                  <Button variant="outline" size="sm"><Plus className="w-4 h-4" />Add Programme</Button>
                </Link>
                <Link to="/courses/new">
                  <Button variant="primary" size="sm">
                    <Plus className="w-4 h-4" />
                    Create Course
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            {institutions.length > 1 && (
              <select
                aria-label="Select institution"
                value={selectedInstitutionId}
                onChange={event => setSelectedInstitutionId(event.target.value)}
                className="px-3 py-3 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                {institutions.map(institution => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
              </select>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search schools, programmes, course codes, or titles..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Spinner size={32} />
            </div>
          ) : filteredSchools.length === 0 ? (
            <Card className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700">
                {search ? 'No courses match your search' : 'No courses yet'}
              </h3>
              <p className="text-slate-500 mt-2">
                {search ? 'Try a different search term' : 'Courses will appear here as the catalogue grows.'}
              </p>
              {isAdmin && !search && (
                <Link to="/courses/new" className="inline-block mt-4">
                  <Button variant="primary" size="sm">Create the first course</Button>
                </Link>
              )}
            </Card>
          ) : !query ? renderBrowse() : (
            <div className="space-y-4">
              {filteredSchools.map(school => {
                const isExpanded = expandedSchools.has(school.id) || !!query;
                const courseCount = school.programmes.reduce((total, programme) => total + programme.courses.length + programme.streams.reduce((streamTotal, stream) => streamTotal + stream.courses.length, 0), school.unassignedCourses.length);

                return (
                  <Card key={school.id} className="overflow-hidden">
                    {/* School header */}
                    <button
                      onClick={() => toggleSchool(school.id)}
                      className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                        <GraduationCap className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 text-left">
                        <h2 className="font-bold text-slate-900">{school.name}</h2>
                        <p className="text-xs text-slate-500">{school.programmes.length} programme{school.programmes.length !== 1 ? 's' : ''} · {courseCount} course{courseCount !== 1 ? 's' : ''}</p>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-100">
                        {school.programmes.map(programme => {
                          const isProgrammeExpanded = expandedProgrammes.has(programme.id) || (!!query && programme.name.toLowerCase().includes(query));
                          return (
                            <div key={programme.id} className="flex flex-wrap items-stretch border-b border-slate-50">
                              <button
                                onClick={() => toggleProgramme(programme.id)}
                                className="flex flex-1 min-w-0 items-center gap-2 px-5 py-3 hover:bg-slate-50 transition-colors text-left"
                              >
                                {isProgrammeExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                <BookOpen className="w-4 h-4 text-emerald-600" />
                                <span className="text-sm font-semibold text-slate-700 flex-1">{programme.name}</span>
                                {programme.qualification && <span className="text-xs text-slate-400">{programme.qualification}</span>}
                                <span className="text-xs text-slate-400">{programme.courses.length + programme.streams.reduce((count, stream) => count + stream.courses.length, 0)}</span>
                              </button>
                              {isAdmin && <Link to={`/courses/new?school=${school.id}&programme=${programme.id}`} aria-label={`Add course to ${programme.name}`} title={`Add course to ${programme.name}`} className="flex items-center px-4 text-slate-400 hover:text-emerald-700"><Plus className="w-4 h-4" /></Link>}
                              {isProgrammeExpanded && (
                                <div className="w-full">
                                  {programme.courses.length > 0 && renderCourseGroups(programme.courses, programme.id)}
                                  {programme.streams.map(stream => {
                                    const streamExpanded = expandedProgrammes.has(stream.id) || (!!query && stream.name.toLowerCase().includes(query));
                                    return (
                                      <div key={stream.id} className="border-t border-slate-50">
                                        <div className="flex items-center">
                                          <button onClick={() => toggleProgramme(stream.id)} className="flex flex-1 min-w-0 items-center gap-2 pl-12 pr-4 py-3 text-left hover:bg-slate-50">
                                            {streamExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                            <span className="text-sm font-medium text-slate-700 flex-1">{stream.name}</span>
                                            <span className="text-xs text-slate-400">{stream.courses.length}</span>
                                          </button>
                                          {isAdmin && <Link to={`/courses/new?school=${school.id}&programme=${stream.id}`} aria-label={`Add course to ${stream.name}`} title={`Add course to ${stream.name}`} className="px-4 text-slate-400 hover:text-emerald-700"><Plus className="w-4 h-4" /></Link>}
                                        </div>
                                        {streamExpanded && (stream.courses.length > 0
                                          ? renderCourseGroups(stream.courses, stream.id)
                                          : <p className="pl-16 pr-4 py-3 text-xs text-slate-400">No courses in this stream yet.</p>)}
                                      </div>
                                    );
                                  })}
                                  {programme.courses.length === 0 && programme.streams.length === 0 && <p className="px-12 py-3 text-xs text-slate-400">No course units are listed for this programme yet.</p>}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {school.unassignedCourses.length > 0 && (
                          <div>
                            <h3 className="px-5 py-3 text-xs font-semibold uppercase text-slate-400 border-b border-slate-50">Courses not assigned to a programme</h3>
                            {renderCourseGroups(school.unassignedCourses, `${school.id}-unassigned`)}
                          </div>
                        )}

                        {school.programmes.length === 0 && school.unassignedCourses.length === 0 && (
                          <p className="px-5 py-4 text-sm text-slate-400">No programme catalogue entries are available.</p>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CreateCoursePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const [courseCode, setCourseCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [aiGuidance, setAiGuidance] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [schoolId, setSchoolId] = useState(searchParams.get('school') || '');
  const [programmeId, setProgrammeId] = useState(searchParams.get('programme') || '');
  const [schools, setSchools] = useState<School[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    supabase.from('schools').select('*').order('name').then(({ data }) => {
      setSchools(data as School[] || []);
    });
  }, []);

  useEffect(() => {
    if (!schoolId) {
      setProgrammes([]);
      setProgrammeId('');
      return;
    }
    supabase.from('programmes').select('*').eq('school_id', schoolId).order('name').then(({ data }) => {
      const options = data as Programme[] || [];
      setProgrammes(options);
      setProgrammeId(current => options.some(programme => programme.id === current) ? current : '');
    });
  }, [schoolId]);

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900">Admin access required</h1>
        <p className="text-slate-500 mt-2">Repository administrators manage the course catalogue.</p>
        <Link to="/dashboard" className="inline-block mt-4">
          <Button variant="primary" size="sm">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error } = await supabase
      .from('courses')
      .insert({
        course_code: courseCode.toUpperCase(),
        title,
        description,
        ai_guidance: aiGuidance.trim(),
        year_of_study: yearOfStudy ? parseInt(yearOfStudy) : null,
        school_id: schoolId || null,
        programme_id: programmeId || null,
        created_by: profile?.id,
      })
      .select()
      .single();

    if (data && programmeId) {
      await supabase.from('programme_courses').upsert({ programme_id: programmeId, course_id: data.id, year_level: yearOfStudy ? parseInt(yearOfStudy) : null });
    }

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate(`/courses/${data.id}`);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Create a Course</h1>
        <p className="text-slate-500 mt-1">Add a new course to the repository</p>
      </div>

      <Card className="p-8">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Select
            label="School / Department"
            value={schoolId}
            onChange={e => { setSchoolId(e.target.value); setProgrammeId(''); }}
            required
          >
            <option value="">Select a school</option>
            {schools.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>

          <Select
            label="Programme"
            value={programmeId}
            onChange={e => setProgrammeId(e.target.value)}
            disabled={!schoolId || programmes.length === 0}
            required
          >
            <option value="">Select a programme</option>
            {programmes.map(programme => <option key={programme.id} value={programme.id}>{programme.name}</option>)}
          </Select>

          <Input
            label="Course Code"
            value={courseCode}
            onChange={e => setCourseCode(e.target.value)}
            placeholder="e.g. CSC 201"
            required
          />

          <Input
            label="Course Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Data Structures and Algorithms"
            required
          />

          <Select
            label="Year of Study"
            value={yearOfStudy}
            onChange={e => setYearOfStudy(e.target.value)}
            required
          >
            <option value="">Select year</option>
            <option value="1">First Year</option>
            <option value="2">Second Year</option>
            <option value="3">Third Year</option>
            <option value="4">Fourth Year</option>
            <option value="5">Fifth Year</option>
            <option value="6">Sixth Year</option>
            <option value="7">Seventh Year</option>
          </Select>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of the course..."
              rows={4}
              className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Preferred AI method (optional)</label>
            <textarea value={aiGuidance} onChange={event => setAiGuidance(event.target.value)} placeholder="Add solution steps, notation, or instructor requirements for this course." rows={4} className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-y" />
          </div>

          <div className="flex gap-3">
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Course'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/courses')}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function CreateSchoolPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [description, setDescription] = useState('');
  const [aiGuidance, setAiGuidance] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = profile?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900">Admin access required</h1>
        <Link to="/courses" className="inline-block mt-4">
          <Button variant="primary" size="sm">Back to Courses</Button>
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase
      .from('schools')
      .insert({ name, short_name: shortName, description, ai_guidance: aiGuidance.trim() });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/courses');
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Add a School / Department</h1>
        <p className="text-slate-500 mt-1">Add a new school to organize courses</p>
      </div>

      <Card className="p-8">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="School Name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. School of Engineering"
            required
          />
          <Input
            label="Short Name"
            value={shortName}
            onChange={e => setShortName(e.target.value)}
            placeholder="e.g. Engineering"
            required
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of the school..."
              rows={3}
              className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors resize-y"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">School AI guidance (optional)</label>
            <textarea value={aiGuidance} onChange={event => setAiGuidance(event.target.value)} placeholder="Describe school-wide methods, notation, or expectations for AI explanations." rows={4} className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-y" />
          </div>

          <div className="flex gap-3">
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add School'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/courses')}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
