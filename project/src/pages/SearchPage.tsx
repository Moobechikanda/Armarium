import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { supabase, PAPER_TYPES } from '@/lib/supabase';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';

type Result = {
  kind: 'course' | 'paper';
  id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  title: string;
  paper_type: string;
  year: number | null;
  semester: 1 | 2 | null;
  snippet: string;
};

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const [text, setText] = useState(query);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [resourceType, setResourceType] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    supabase.rpc('search_resources', { q: query }).then(({ data, error: searchError }) => {
      setError(searchError?.message || '');
      setResults(data as Result[] || []);
      setLoading(false);
    });
  }, [query]);

  const filteredResults = results.filter(result =>
    (!year || String(result.year) === year) &&
    (!semester || String(result.semester) === semester) &&
    (!resourceType || result.kind === 'course' || result.paper_type === resourceType));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-4">Search resources</h1>
      <form onSubmit={event => { event.preventDefault(); setParams(text.trim() ? { q: text.trim() } : {}); }} className="relative mb-6">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <Input value={text} onChange={event => setText(event.target.value)} placeholder="Course code, title, resource type or text inside a paper" className="pl-10" autoFocus />
      </form>

      {query && results.some(result => result.kind === 'paper') && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <Select aria-label="Filter by academic year" value={year} onChange={event => setYear(event.target.value)}>
            <option value="">All years</option>
            {Array.from(new Set(results.flatMap(result => result.year ? [result.year] : []))).sort((a, b) => b - a).map(value => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Select aria-label="Filter by semester" value={semester} onChange={event => setSemester(event.target.value)}>
            <option value="">All semesters</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
          </Select>
          <Select aria-label="Filter by resource type" value={resourceType} onChange={event => setResourceType(event.target.value)}>
            <option value="">All resource types</option>
            {PAPER_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
          </Select>
        </div>
      )}

      {!query && <p className="text-sm text-slate-500">Type a course code (like CSC 2000), a course title, or words from a paper to find courses and files.</p>}
      {loading && <div className="py-8 flex justify-center"><Spinner /></div>}
      {error && <p className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</p>}
      {!loading && query && !error && filteredResults.length === 0 && <p className="text-slate-500 text-sm">No courses or files found for "{query}" with these filters.</p>}

      <div className="space-y-3">
        {filteredResults.map(result => (
          <Link key={`${result.kind}-${result.id}`} to={result.kind === 'course' ? `/courses/${result.id}` : `/papers/${result.id}`}>
            <Card hoverable className="p-4">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="emerald">{result.course_code}</Badge>
                <Badge variant={result.kind === 'course' ? 'amber' : 'blue'}>{result.kind === 'course' ? 'Course' : PAPER_TYPES.find(type => type.value === result.paper_type)?.label || result.paper_type}</Badge>
                {result.year && <Badge variant="slate">{result.year}</Badge>}
                {result.semester && <Badge variant="slate">Semester {result.semester}</Badge>}
              </div>
              <h2 className="font-semibold text-slate-900">{result.title}</h2>
              {result.kind === 'paper' && <p className="text-xs text-slate-500">{result.course_title}</p>}
              {result.snippet && <p className="text-sm text-slate-600 mt-2 line-clamp-2">{result.snippet.replace(/<[^>]+>/g, '')}</p>}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
