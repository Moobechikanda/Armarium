import { AwsClient } from 'aws4fetch';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  APP_ORIGINS: string;
}

type User = { id: string; role: string };
type Resource = {
  table: 'papers' | 'notes' | 'recommended_books' | 'answers';
  uploaded_by?: string | null;
  posted_by?: string | null;
  recommended_by?: string | null;
  status?: string;
  deleted_at?: string | null;
};

function corsHeaders(request: Request, env: Env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.APP_ORIGINS.split(',').map(value => value.trim()).filter(Boolean);
  return {
    'Access-Control-Allow-Origin': !origin ? '*' : allowed.includes(origin) ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Apikey',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

function validKey(key: unknown): key is string {
  if (typeof key !== 'string' || key.length < 3 || key.length > 1024 || key.startsWith('/')) return false;
  const parts = key.split('/');
  return parts.every(part => part && part !== '.' && part !== '..' && part.length <= 255 && !/[\\\u0000-\u001f]/.test(part));
}

async function authenticate(request: Request, env: Env): Promise<User | null> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: authorization },
  });
  if (!response.ok) return null;
  const authUser = await response.json() as { id?: string };
  if (!authUser.id) return null;
  const profileUrl = new URL('/rest/v1/profiles', env.SUPABASE_URL);
  profileUrl.searchParams.set('select', 'role');
  profileUrl.searchParams.set('id', `eq.${authUser.id}`);
  profileUrl.searchParams.set('limit', '1');
  const profileResponse = await fetch(profileUrl, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!profileResponse.ok) return null;
  const profiles = await profileResponse.json() as { role?: string }[];
  return profiles[0] ? { id: authUser.id, role: profiles[0].role || 'student' } : null;
}

async function findResource(key: string, env: Env): Promise<Resource | null> {
  for (const table of ['papers', 'notes', 'recommended_books', 'answers'] as const) {
    const url = new URL(`/rest/v1/${table}`, env.SUPABASE_URL);
    url.searchParams.set('select', table === 'papers' ? 'uploaded_by,status,deleted_at' : table === 'notes' ? 'posted_by' : table === 'recommended_books' ? 'recommended_by' : 'posted_by');
    url.searchParams.set('file_path', `eq.${key}`);
    url.searchParams.set('limit', '1');
    const response = await fetch(url, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!response.ok) continue;
    const rows = await response.json() as Omit<Resource, 'table'>[];
    if (rows[0]) return { ...rows[0], table };
  }
  return null;
}

function resourceOwner(resource: Resource) {
  return resource.uploaded_by || resource.posted_by || resource.recommended_by || null;
}

function signer(env: Env) {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
    retries: 0,
  });
}

function objectUrl(key: string, env: Env) {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${encodeURIComponent(env.R2_BUCKET)}/${encodedKey}`;
}

async function presign(key: string, method: 'GET' | 'PUT' | 'DELETE', env: Env, contentType?: string) {
  const url = new URL(objectUrl(key, env));
  url.searchParams.set('X-Amz-Expires', String(method === 'PUT' ? 900 : 600));
  const headers = contentType ? { 'Content-Type': contentType } : undefined;
  const signed = await signer(env).sign(url.toString(), {
    method,
    headers,
    aws: { signQuery: true },
  });
  return signed.url;
}

async function handle(request: Request, env: Env) {
  const headers = corsHeaders(request, env);
  if (request.method === 'OPTIONS') {
    if (headers['Access-Control-Allow-Origin'] === 'null') return new Response(null, { status: 403, headers });
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers);
  if (headers['Access-Control-Allow-Origin'] === 'null') return json({ error: 'Origin not allowed' }, 403, headers);

  const user = await authenticate(request, env);
  if (!user) return json({ error: 'Sign in is required' }, 401, headers);
  let body: { key?: unknown; contentType?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return json({ error: 'Invalid JSON body' }, 400, headers); }
  const key = body.key;
  if (!validKey(key)) return json({ error: 'Invalid object key' }, 400, headers);

  const path = new URL(request.url).pathname;
  const isAdmin = user.role === 'admin';
  if (path === '/upload-url') {
    const contentType = typeof body.contentType === 'string' ? body.contentType : '';
    const allowedTypes = new Set(['application/pdf', 'text/plain', 'text/markdown', 'image/png', 'image/jpeg', 'image/webp']);
    if (!allowedTypes.has(contentType)) return json({ error: 'Unsupported file type' }, 415, headers);
    const [courseId, ownerId] = key.split('/');
    if (!/^[0-9a-f-]{36}$/i.test(courseId)) return json({ error: 'File key must start with a course id' }, 400, headers);
    if (!isAdmin && ownerId !== user.id) return json({ error: 'Uploads must use your account path' }, 403, headers);
    const courseUrl = new URL('/rest/v1/courses', env.SUPABASE_URL);
    courseUrl.searchParams.set('select', 'id');
    courseUrl.searchParams.set('id', `eq.${courseId}`);
    courseUrl.searchParams.set('limit', '1');
    const courseResponse = await fetch(courseUrl, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!courseResponse.ok || !(await courseResponse.json() as unknown[]).length) return json({ error: 'Course not found' }, 404, headers);
    const url = await presign(key, 'PUT', env, contentType);
    return json({ url, headers: { 'Content-Type': contentType }, expiresIn: 900 }, 200, headers);
  }

  const resource = await findResource(key, env);
  if (!resource && path === '/delete' && (isAdmin || key.split('/')[1] === user.id)) {
    const url = await presign(key, 'DELETE', env);
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) return json({ error: 'R2 could not delete the object' }, 502, headers);
    return new Response(null, { status: 204, headers });
  }
  if (!resource) return json({ error: 'File is not attached to an available resource' }, 404, headers);
  if (resource.table === 'papers' && (resource.deleted_at || (resource.status !== 'approved' && resourceOwner(resource) !== user.id && !isAdmin))) {
    return json({ error: 'This paper is not available to your account' }, 403, headers);
  }

  if (path === '/download-url') {
    return json({ url: await presign(key, 'GET', env) }, 200, headers);
  }
  if (path === '/delete') {
    if (!isAdmin && resourceOwner(resource) !== user.id) return json({ error: 'Only the uploader or an administrator can delete this file' }, 403, headers);
    const url = await presign(key, 'DELETE', env);
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) return json({ error: 'R2 could not delete the object' }, 502, headers);
    return new Response(null, { status: 204, headers });
  }
  return json({ error: 'Not found' }, 404, headers);
}

export default { fetch: handle };
