import { Readable } from 'node:stream';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const required = [
  'SOURCE_SUPABASE_URL', 'SOURCE_SUPABASE_SERVICE_ROLE_KEY',
  'TARGET_SUPABASE_URL', 'TARGET_SUPABASE_SERVICE_ROLE_KEY',
  'R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY',
];
for (const name of required) if (!process.env[name]) throw new Error(`Set ${name}`);

const sourceUrl = process.env.SOURCE_SUPABASE_URL.replace(/\/$/, '');
const targetUrl = process.env.TARGET_SUPABASE_URL.replace(/\/$/, '');
const sourceKey = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY;
const targetKey = process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.R2_BUCKET;
const dryRun = process.argv.includes('--dry-run');
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});

function authHeaders(key, extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

async function listRows(base, key, table, select, filters = {}) {
  const result = [];
  for (let offset = 0; ; offset += 500) {
    const url = new URL(`/rest/v1/${table}`, base);
    url.searchParams.set('select', select);
    url.searchParams.set('storage_provider', 'eq.supabase');
    url.searchParams.set('file_path', 'not.is.null');
    url.searchParams.set('limit', '500');
    for (const [name, value] of Object.entries(filters)) url.searchParams.set(name, value);
    const response = await fetch(url, { headers: authHeaders(key, { Range: `${offset}-${offset + 499}` }) });
    if (!response.ok) throw new Error(`Read ${table}: ${response.status} ${await response.text()}`);
    const page = await response.json();
    result.push(...page);
    if (page.length < 500) return result;
  }
}

function one(value) {
  return Array.isArray(value) ? value[0] : value;
}

async function ensureTargetSchool(school) {
  const source = one(school);
  const name = source?.name || 'Other Past Papers';
  const shortName = source?.short_name || 'Other';
  const matches = await listTarget('/rest/v1/schools', { select: 'id', short_name: `eq.${shortName}` });
  if (matches[0]) return matches[0].id;
  const institutions = await listTarget('/rest/v1/institutions', { select: 'id', short_name: 'eq.ARM' });
  const response = await fetch(`${targetUrl}/rest/v1/schools`, {
    method: 'POST',
    headers: authHeaders(targetKey, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify({ name, short_name: shortName, description: 'Imported resource archive.', institution_id: institutions[0]?.id || null }),
  });
  if (!response.ok) throw new Error(`Create school ${name}: ${response.status} ${await response.text()}`);
  return (await response.json())[0].id;
}

async function listTarget(path, params) {
  const url = new URL(path, targetUrl);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url, { headers: authHeaders(targetKey) });
  if (!response.ok) throw new Error(`Target lookup ${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

async function ensureTargetCourse(sourceCourse) {
  const course = one(sourceCourse);
  if (!course) throw new Error('Source file has no course relation');
  const matches = await listTarget('/rest/v1/courses', { select: 'id', course_code: `eq.${course.course_code}` });
  if (matches[0]) return matches[0].id;
  const schoolId = await ensureTargetSchool(course.schools);
  const response = await fetch(`${targetUrl}/rest/v1/courses`, {
    method: 'POST',
    headers: authHeaders(targetKey, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify({
      course_code: course.course_code,
      title: course.title,
      description: course.description || '',
      year_of_study: course.year_of_study,
      school_id: schoolId,
      programme_id: null,
    }),
  });
  if (!response.ok) throw new Error(`Create course ${course.course_code}: ${response.status} ${await response.text()}`);
  return (await response.json())[0].id;
}

async function objectExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound' || error?.name === 'NoSuchKey') return false;
    throw error;
  }
}

async function copyObject(resource) {
  if (await objectExists(resource.file_path)) return;
  const objectPath = resource.file_path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${sourceUrl}/storage/v1/object/papers/${objectPath}`, { headers: authHeaders(sourceKey) });
  if (!response.ok || !response.body) throw new Error(`Source returned ${response.status}`);
  const extension = (resource.file_name || '').split('.').pop()?.toLowerCase();
  const contentType = ({ pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' })[extension] || 'application/octet-stream';
  await new Upload({
    client: s3,
    params: { Bucket: bucket, Key: resource.file_path, Body: Readable.fromWeb(response.body), ContentType: contentType },
    queueSize: 2,
    partSize: 16 * 1024 * 1024,
    leavePartsOnError: false,
  }).done();
}

function targetPayload(table, row, courseId) {
  const common = { id: row.id, course_id: courseId, file_path: row.file_path, file_name: row.file_name, storage_provider: 'r2', created_at: row.created_at };
  if (table === 'papers') return {
    ...common, title: row.title, paper_type: row.paper_type, year: row.year, semester: row.semester,
    file_hash: row.file_hash, extracted_text: row.extracted_text, status: row.status,
    uploaded_by: null, deleted_at: row.deleted_at,
  };
  if (table === 'notes') return { ...common, title: row.title, content: row.content, posted_by: null };
  if (table === 'recommended_books') return {
    ...common, title: row.title, author: row.author, isbn: row.isbn,
    description: row.description, recommended_by: null,
  };
  const paper = one(row.papers);
  if (!paper) throw new Error('Answer attachment has no paper relation');
  return { id: row.id, paper_id: paper.id, content: row.content, file_path: row.file_path, file_name: row.file_name, storage_provider: 'r2', posted_by: null, created_at: row.created_at };
}

async function saveMetadata(table, row, courseId) {
  const payload = targetPayload(table, row, courseId);
  const response = await fetch(`${targetUrl}/rest/v1/${table}?on_conflict=id`, {
    method: 'POST',
    headers: authHeaders(targetKey, { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Save ${table}/${row.id}: ${response.status} ${await response.text()}`);
}

const courseJoin = 'courses!inner(id,course_code,title,description,year_of_study,schools(name,short_name))';
const configs = [
  ['papers', `*,${courseJoin}`, { 'courses.course_code': 'not.is.null' }],
  ['notes', `*,${courseJoin}`, { 'courses.course_code': 'not.is.null' }],
  ['recommended_books', `*,${courseJoin}`, { 'courses.course_code': 'not.is.null' }],
  ['answers', '*,papers!inner(id,course_id,courses!inner(id,course_code,title,description,year_of_study,schools(name,short_name)))', {}],
];
const courseIds = new Map();
let copied = 0;
let skipped = 0;
let failed = 0;

for (const [table, select, filters] of configs) {
  const resources = await listRows(sourceUrl, sourceKey, table, select, filters);
  console.log(`${table}: ${resources.length} attached files`);
  if (dryRun) continue;
  for (const resource of resources) {
    try {
      const sourceCourse = table === 'answers' ? one(resource.papers)?.courses : resource.courses;
      const course = one(sourceCourse);
      if (!course) { skipped++; continue; }
      let targetCourseId = courseIds.get(course.course_code);
      if (!targetCourseId) {
        targetCourseId = await ensureTargetCourse(course);
        courseIds.set(course.course_code, targetCourseId);
      }
      await copyObject(resource);
      await saveMetadata(table, resource, targetCourseId);
      copied++;
      console.log(`copied ${table} ${course.course_code} / ${resource.file_name}`);
    } catch (error) {
      failed++;
      console.error(`failed ${table} ${resource.file_name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
console.log(`Finished: ${copied} records copied, ${skipped} skipped, ${failed} failed.`);
if (failed) process.exitCode = 1;
