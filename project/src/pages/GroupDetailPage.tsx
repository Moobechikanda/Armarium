import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Link2, Send, Trash2, UserPlus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';

type Group = {
  id: string;
  name: string;
  description: string;
  created_by: string;
  schools: { name: string } | null;
  study_group_members: { user_id: string; profiles: { full_name: string } | null }[];
};
type Message = { id: string; user_id: string; body: string; created_at: string; profiles: { full_name: string } | null };
type Person = { id: string; full_name: string };

export function GroupDetailPage() {
  const { groupId } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [personQuery, setPersonQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [copied, setCopied] = useState(false);

  const loadGroup = useCallback(async () => {
    const { data } = await supabase.from('study_groups').select('*, schools(name), study_group_members(user_id, profiles(full_name))').eq('id', groupId).maybeSingle();
    setGroup(data as Group | null);
  }, [groupId]);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase.from('group_messages').select('*, profiles(full_name)').eq('group_id', groupId).order('created_at').limit(200);
    setMessages(data as Message[] || []);
  }, [groupId]);

  useEffect(() => {
    async function load() {
      await loadGroup();
      await loadMessages();
      setLoading(false);
    }
    void load();
    const timer = setInterval(() => void loadMessages(), 5000);
    return () => clearInterval(timer);
  }, [groupId, loadGroup, loadMessages]);

  useEffect(() => {
    const term = personQuery.trim();
    if (term.length < 2) { setPeople([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').ilike('full_name', `%${term.replace(/[%_]/g, '')}%`).limit(8);
      setPeople(data as Person[] || []);
    }, 250);
    return () => clearTimeout(timer);
  }, [personQuery]);

  async function addPerson(person: Person) {
    setError('');
    const { error: addError } = await supabase.from('study_group_members').insert({ group_id: groupId, user_id: person.id });
    if (addError) { setError(addError.message); return; }
    setPersonQuery('');
    await loadGroup();
  }

  async function removePerson(userId: string) {
    await supabase.from('study_group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    await loadGroup();
  }

  async function joinGroup() {
    if (!profile) return;
    const { error: joinError } = await supabase.from('study_group_members').insert({ group_id: groupId, user_id: profile.id });
    if (joinError) setError(joinError.message);
    await loadGroup();
    await loadMessages();
  }

  async function copyInvite() {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!profile || !text.trim()) return;
    setError('');
    const { error: sendError } = await supabase.from('group_messages').insert({ group_id: groupId, user_id: profile.id, body: text.trim() });
    if (sendError) { setError(sendError.message); return; }
    setText('');
    await loadMessages();
  }

  async function removeMessage(id: string) {
    await supabase.from('group_messages').delete().eq('id', id);
    await loadMessages();
  }

  async function leave() {
    if (!profile || !confirm('Leave this group?')) return;
    await supabase.from('study_group_members').delete().eq('group_id', groupId).eq('user_id', profile.id);
    navigate('/groups');
  }

  async function removeGroup() {
    if (!confirm('Delete this group and all its messages?')) return;
    await supabase.from('study_groups').delete().eq('id', groupId);
    navigate('/groups');
  }

  if (loading) return <div className="py-16 flex justify-center"><Spinner /></div>;
  if (!group) return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-slate-500">Group not found.</div>;

  const isMember = group.study_group_members.some(member => member.user_id === profile?.id);
  const isOwner = group.created_by === profile?.id;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/groups" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4"><ArrowLeft className="w-4 h-4" />All groups</Link>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{group.name}</h1>
          <p className="text-sm text-slate-500">{group.schools?.name} · {group.study_group_members.length} members</p>
          {group.description && <p className="text-slate-600 mt-2">{group.description}</p>}
        </div>
        <div className="flex gap-2">
          {isMember && !isOwner && <Button variant="outline" size="sm" onClick={leave}>Leave</Button>}
          {(isOwner || profile?.role === 'admin') && <Button variant="danger" size="sm" onClick={removeGroup}>Delete group</Button>}
        </div>
      </div>

      {!isMember && profile?.role !== 'admin' ? (
        <Card className="p-6 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-slate-600">Join this group to read and post messages.</p>
          <Button onClick={joinGroup}>Join group</Button>
        </Card>
      ) : (
        <>
        {isMember && (
          <Card className="p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><UserPlus className="w-4 h-4" />Add people</h2>
              <Button variant="outline" size="sm" onClick={copyInvite}><Link2 className="w-4 h-4" />{copied ? 'Link copied' : 'Copy invite link'}</Button>
            </div>
            <input value={personQuery} onChange={event => setPersonQuery(event.target.value)} placeholder="Search students by name" className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg" />
            {personQuery.trim().length >= 2 && (
              <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
                {people.filter(person => !group.study_group_members.some(member => member.user_id === person.id)).map(person => (
                  <li key={person.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{person.full_name}</span>
                    <Button size="sm" onClick={() => addPerson(person)}>Add</Button>
                  </li>
                ))}
                {people.filter(person => !group.study_group_members.some(member => member.user_id === person.id)).length === 0 && <li className="px-3 py-2 text-sm text-slate-400">No matching students who are not already in the group.</li>}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {group.study_group_members.map(member => (
                <span key={member.user_id} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 rounded-full px-3 py-1">
                  {member.profiles?.full_name || 'Student'}
                  {isOwner && member.user_id !== group.created_by && <button onClick={() => removePerson(member.user_id)} aria-label="Remove member"><X className="w-3 h-3" /></button>}
                </span>
              ))}
            </div>
          </Card>
        )}
        <Card className="flex flex-col h-[60vh]">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && <p className="text-sm text-slate-400 text-center mt-8">No messages yet. Say hello.</p>}
            {messages.map(message => {
              const mine = message.user_id === profile?.id;
              return (
                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${mine ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                    <p className={`text-xs mb-0.5 ${mine ? 'text-emerald-100' : 'text-slate-500'}`}>
                      {message.profiles?.full_name || 'Student'} · {new Date(message.created_at).toLocaleString()}
                      {(mine || isOwner || profile?.role === 'admin') && <button onClick={() => removeMessage(message.id)} className="ml-2 align-middle opacity-70 hover:opacity-100" aria-label="Delete message"><Trash2 className="w-3 h-3 inline" /></button>}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          {isMember && (
            <form onSubmit={send} className="border-t border-slate-100 p-3 flex gap-2">
              <input value={text} onChange={event => setText(event.target.value)} maxLength={2000} placeholder="Write a message" className="flex-1 px-4 py-2.5 text-sm border border-slate-300 rounded-lg" />
              <Button type="submit" disabled={!text.trim()}><Send className="w-4 h-4" /></Button>
            </form>
          )}
          {error && <p className="px-4 pb-3 text-sm text-red-600">{error}</p>}
        </Card>
        </>
      )}
    </div>
  );
}
