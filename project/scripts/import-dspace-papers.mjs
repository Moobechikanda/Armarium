// Imports the UNZA "Examination Past Papers" DSpace community into Armarium.
// Usage: SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-dspace-papers.mjs [--dry-run]
// Optional: SUPABASE_URL (default local), CONCURRENCY (default 3).
import { createHash } from 'node:crypto';

const API = 'https://dspace.unza.zm/server/api';
const COMMUNITY = '52660a3a-d906-437f-93d6-c99e421dc43c';
const SB_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:55321';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONCURRENCY = Number(process.env.CONCURRENCY || 1);
const dryRun = process.argv.includes('--dry-run');

if (!dryRun && !KEY) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY');

const SCHOOL_RULES = [
  [/natural/, 'School of Natural and Applied Sciences'],
  [/agricult/, 'School of Agricultural Sciences'],
  [/veterin/, 'School of Veterinary Medicine'],
  [/engineering/, 'School of Engineering'],
  [/mines/, 'School of Mines'],
  [/\blaw\b/, 'School of Law'],
  [/medicine|medical/, 'School of Medicine'],
  [/humanities|library|psycholog|social/, 'School of Humanities and Social Sciences'],
  [/business|gsb/, 'Graduate School of Business'],
  [/education/, 'School of Education'],
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function retry(task, label) {
  for (let attempt = 1; ; attempt++) {
    try { return await task(); } catch (error) {
      if (attempt >= 7) throw new Error(`${label}: ${error.message}`);
      await sleep(2000 * attempt);
    }
  }
}

async function dspace(path) {
  return retry(async () => {
    const response = await fetch(path.startsWith('http') ? path : `${API}${path}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }, path);
}

async function sb(path, init = {}) {
  const response = await fetch(`${SB_URL}${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, ...(init.headers || {}) },
  });
  return response;
}

async function listItems() {
  const items = [];
  for (let page = 0; ; page++) {
    const data = await dspace(`/discover/search/objects?scope=${COMMUNITY}&dsoType=ITEM&size=100&page=${page}`);
    const objects = data._embedded.searchResult._embedded.objects;
    items.push(...objects.map(object => object._embedded.indexableObject));
    if (page + 1 >= data._embedded.searchResult.page.totalPages) return items;
  }
}

async function describe(item) {
  const collection = await dspace(`/core/items/${item.uuid}/owningCollection`).catch(() => ({ name: '' }));
  const bundles = await dspace(`/core/items/${item.uuid}/bundles`);
  const original = bundles._embedded.bundles.find(bundle => bundle.name === 'ORIGINAL');
  const streams = original ? (await dspace(`${original._links.bitstreams.href}?size=200`))._embedded.bitstreams : [];
  const context = `${collection.name} ${item.name}`.toLowerCase();
  const school = (SCHOOL_RULES.find(([pattern]) => pattern.test(context)) || [])[1] || 'Other Past Papers';
  const year = (item.name.match(/\b(19|20)\d{2}\b/) || collection.name.match(/\b(19|20)\d{2}\b/) || [])[0];
  return {
    id: item.uuid,
    title: item.name.replace(/\s+/g, ' ').trim(),
    school,
    paperType: /deferred|supplementary/.test(context) ? 'deferred_exam'
      : /mid[\s-]*(year|sem)/.test(context) ? 'mid_semester_exam'
      : /full[\s-]*year/.test(context) ? 'end_of_year_exam'
      : 'end_of_semester_exam',
    year: year ? Number(year) : null,
    semester: /first\s*semester/.test(context) ? 1 : /second\s*semester/.test(context) ? 2 : null,
    files: streams
      .filter(stream => /\.pdf$/i.test(stream.name))
      .map(stream => ({ id: stream.uuid, name: stream.name, size: stream.sizeBytes, url: stream._links.content.href })),
  };
}

async function pool(tasks, limit) {
  const queue = [...tasks];
  const results = [];
  await Promise.all(Array.from({ length: limit }, async () => {
    while (queue.length) results.push(await queue.shift()());
  }));
  return results;
}

async function ensureSchool(name, schools) {
  let school = schools.find(item => item.name === name);
  if (school) return school;
  const { id: institutionId } = schools[0] ? { id: schools[0].institution_id } : { id: null };
  const response = await sb('/rest/v1/schools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ name, short_name: 'Other', description: 'Past papers not tied to a single school.', institution_id: institutionId }),
  });
  if (!response.ok) throw new Error(`create school: ${await response.text()}`);
  school = (await response.json())[0];
  schools.push(school);
  return school;
}

async function ensureArchiveCourse(school) {
  const code = `${school.short_name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase()}-PAPERS`;
  const existing = await (await sb(`/rest/v1/courses?course_code=eq.${code}&select=id`)).json();
  if (existing[0]) return existing[0].id;
  const response = await sb('/rest/v1/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      course_code: code,
      title: `${school.name} Past Paper Archive`,
      description: 'Scanned examination bundles from the university repository. Each file may hold several courses, so use search or reassign files to individual courses.',
      school_id: school.id,
    }),
  });
  if (!response.ok) throw new Error(`create course: ${await response.text()}`);
  return (await response.json())[0].id;
}

async function importFile(item, file, courseId) {
  const path = `${courseId}/dspace/${file.id}.pdf`;
  const known = await (await sb(`/rest/v1/papers?file_path=eq.${encodeURIComponent(path)}&select=id`)).json();
  if (known.length) return 'skipped';

  const bytes = await retry(async () => {
    const response = await fetch(file.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }, file.name);
  const hash = createHash('sha256').update(bytes).digest('hex');

  const upload = await sb(`/storage/v1/object/papers/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
    body: bytes,
  });
  if (!upload.ok) return `failed: upload ${upload.status} ${(await upload.text()).slice(0, 120)}`;

  const insert = await sb('/rest/v1/papers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      course_id: courseId,
      title: `${item.title} - ${file.name.replace(/\.pdf$/i, '')}`,
      paper_type: item.paperType,
      year: item.year,
      semester: item.semester,
      file_path: path,
      file_name: file.name,
      file_hash: hash,
      status: 'approved',
    }),
  });
  if (insert.ok) return 'imported';
  await sb(`/storage/v1/object/papers/${path}`, { method: 'DELETE' });
  const text = await insert.text();
  return text.includes('23505') ? 'duplicate' : `failed: insert ${text.slice(0, 120)}`;
}

const items = await pool((await listItems()).map(item => () => describe(item)), 6);
const withFiles = items.filter(item => item.files.length);
const totalFiles = withFiles.reduce((sum, item) => sum + item.files.length, 0);
const totalBytes = withFiles.reduce((sum, item) => sum + item.files.reduce((inner, file) => inner + file.size, 0), 0);
console.log(`${items.length} items, ${totalFiles} PDFs, ${(totalBytes / 1024 / 1024).toFixed(0)} MiB`);
const bySchool = {};
for (const item of withFiles) bySchool[item.school] = (bySchool[item.school] || 0) + item.files.length;
console.table(bySchool);
const oversized = withFiles.flatMap(item => item.files).filter(file => file.size > 50 * 1024 * 1024).length;
if (oversized) console.log(`${oversized} files exceed 50 MiB (default storage limit)`);
if (dryRun) process.exit(0);

const schools = await (await sb('/rest/v1/schools?select=id,name,short_name,institution_id')).json();
const courseIds = new Map();
const tasks = [];
for (const item of withFiles) {
  if (!courseIds.has(item.school)) courseIds.set(item.school, await ensureArchiveCourse(await ensureSchool(item.school, schools)));
  for (const file of item.files) tasks.push(() => importFile(item, file, courseIds.get(item.school)).catch(error => `failed: ${error.message}`).then(result => { console.log(`${result.padEnd(9)} ${item.title} / ${file.name}`); return result; }));
}
const results = await pool(tasks, CONCURRENCY);
const summary = {};
for (const result of results) { const key = result.startsWith('failed') ? 'failed' : result; summary[key] = (summary[key] || 0) + 1; }
console.log(summary);
