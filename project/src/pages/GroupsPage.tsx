import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { supabase, type School } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';

type GroupRow = {
  id: string;
  name: string;
  description: string;
  school_id: string;
  created_by: string;
  schools: Pick<School, 'name' | 'short_name'> | null;
  study_group_members: { user_id: string }[];
};

export function GroupsPage() {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const [groupResult, schoolResult] = await Promise.all([
      supabase.from('study_groups').select('*, schools(name, short_name), study_group_members(user_id)').order('created_at', { ascending: false }),
      supabase.from('schools').select('*').order('name'),
    ]);
    setGroups(groupResult.data as GroupRow[] || []);
    setSchools(schoolResult.data as School[] || []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true); setError('');
    const { error: createError } = await supabase.from('study_groups').insert({ name: name.trim(), description: description.trim(), school_id: schoolId, created_by: profile.id });
    if (createError) setError(createError.message);
    else { setShowCreate(false); setName(''); setDescription(''); setSchoolId(''); await load(); }
    setSaving(false);
  }

  async function join(group: GroupRow) {
    if (!profile) return;
    const { error: joinError } = await supabase.from('study_group_members').insert({ group_id: group.id, user_id: profile.id });
    if (joinError) setError(joinError.message);
    await load();
  }

  const visible = groups.filter(group =>
    (!schoolFilter || group.school_id === schoolFilter) &&
    (!mineOnly || group.study_group_members.some(member => member.user_id === profile?.id)));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Study groups</h1>
          <p className="text-slate-500 mt-1">Find or start a community for your school.</p>
        </div>
        {profile ? (
          <Button onClick={() => setShowCreate(!showCreate)}><Plus className="w-4 h-4" />New group</Button>
        ) : (
          <Link to="/signin"><Button>Sign in to join</Button></Link>
        )}
      </div>

      {showCreate && (
        <Card className="p-6 mb-6">
          <form onSubmit={createGroup} className="space-y-4">
            <Input label="Group name" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Year 2 Software Engineering" minLength={3} maxLength={80} required />
            <Select label="School" value={schoolId} onChange={event => setSchoolId(event.target.value)} required>
              <option value="">Choose a school</option>
              {schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
            </Select>
            <Textarea label="Description (optional)" value={description} onChange={event => setDescription(event.target.value)} rows={3} maxLength={500} />
            <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create group'}</Button>
          </form>
        </Card>
      )}

      <div className="flex gap-3 mb-4 flex-wrap items-end">
        <div className="w-64">
          <Select value={schoolFilter} onChange={event => setSchoolFilter(event.target.value)}>
            <option value="">All schools</option>
            {schools.map(school => <option key={school.id} value={school.id}>{school.short_name}</option>)}
          </Select>
        </div>
        {profile && (
          <label className="flex items-center gap-2 text-sm text-slate-600 pb-2.5">
            <input type="checkbox" checked={mineOnly} onChange={event => setMineOnly(event.target.checked)} />My groups
          </label>
        )}
      </div>

      {error && <p className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</p>}
      {loading ? <div className="py-12 flex justify-center"><Spinner /></div> : visible.length === 0 ? (
        <Card className="p-10 text-center text-slate-500 text-sm">No groups yet. Start the first one.</Card>
      ) : (
        <div className="space-y-3">
          {visible.map(group => {
            const joined = group.study_group_members.some(member => member.user_id === profile?.id);
            return (
              <Card key={group.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="blue">{group.schools?.short_name}</Badge>
                    <span className="flex items-center gap-1 text-xs text-slate-500"><Users className="w-3 h-3" />{group.study_group_members.length}</span>
                  </div>
                  <h2 className="font-semibold text-slate-900">{group.name}</h2>
                  {group.description && <p className="text-sm text-slate-500 line-clamp-2">{group.description}</p>}
                </div>
                {joined ? (
                  <Link to={`/groups/${group.id}`}><Button variant="outline" size="sm">Open</Button></Link>
                ) : profile ? (
                  <Button size="sm" onClick={() => join(group)}>Join</Button>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
