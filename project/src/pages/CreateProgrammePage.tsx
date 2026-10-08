import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, type School } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Input';

export function CreateProgrammePage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [programmes, setProgrammes] = useState<{ id: string; name: string }[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [parentProgrammeId, setParentProgrammeId] = useState('');
  const [name, setName] = useState('');
  const [qualification, setQualification] = useState('');
  const [durationYears, setDurationYears] = useState('');
  const [aiGuidance, setAiGuidance] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('schools').select('*').order('name').then(({ data }) => {
      const options = data as School[] || [];
      setSchools(options);
      setSchoolId(current => current || options[0]?.id || '');
    });
  }, []);

  useEffect(() => {
    setParentProgrammeId('');
    if (!schoolId) {
      setProgrammes([]);
      return;
    }
    supabase.from('programmes').select('id, name').eq('school_id', schoolId).order('name').then(({ data }) => {
      setProgrammes(data || []);
    });
  }, [schoolId]);

  if (profile?.role !== 'admin') {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center"><h1 className="text-xl font-bold text-slate-900">Admin access required</h1><Link to="/courses" className="inline-block mt-4"><Button variant="primary" size="sm">Back to Catalogue</Button></Link></div>;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSaving(true);
    const { error: insertError } = await supabase.from('programmes').insert({
      school_id: schoolId,
      parent_programme_id: parentProgrammeId || null,
      name: name.trim(),
      qualification: qualification.trim() || null,
      duration_years: durationYears ? Number(durationYears) : null,
      ai_guidance: aiGuidance.trim(),
    });
    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }
    navigate('/courses');
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">Add Programme</h1><p className="mt-1 text-sm text-slate-500">Create a programme under a school, then add its year-based courses.</p></div>
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div role="alert" className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>}
          <Select label="School" value={schoolId} onChange={event => setSchoolId(event.target.value)} required>
            <option value="">Choose a school</option>
            {schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
          </Select>
          <Select label="Parent programme (optional; choose this to create a stream)" value={parentProgrammeId} onChange={event => setParentProgrammeId(event.target.value)} disabled={!schoolId || programmes.length === 0}>
            <option value="">Top-level programme</option>
            {programmes.map(programme => <option key={programme.id} value={programme.id}>{programme.name}</option>)}
          </Select>
          <Input label="Programme name" value={name} onChange={event => setName(event.target.value)} required />
          <Input label="Qualification (optional)" value={qualification} onChange={event => setQualification(event.target.value)} placeholder="Bachelor, Diploma, Masters" />
          <Select label="Duration in years (optional)" value={durationYears} onChange={event => setDurationYears(event.target.value)}>
            <option value="">Not specified</option>
            {Array.from({ length: 10 }, (_, index) => index + 1).map(year => <option key={year} value={year}>{year} years</option>)}
          </Select>
          <Textarea label="Preferred AI method or programme guidance (optional)" value={aiGuidance} onChange={event => setAiGuidance(event.target.value)} rows={4} placeholder="Add the preferred method, notation, or programme requirements students should follow." />
          <div className="flex gap-3"><Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving...' : 'Add Programme'}</Button><Button type="button" variant="outline" onClick={() => navigate('/courses')}>Cancel</Button></div>
        </form>
      </Card>
    </div>
  );
}
