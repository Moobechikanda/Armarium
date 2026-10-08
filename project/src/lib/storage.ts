import { supabase, STORAGE_BUCKET } from '@/lib/supabase';

export type StorageProvider = 'supabase' | 'r2';

type StorageResult<T> = { data: T | null; error: Error | null };
const workerUrl = (import.meta.env.VITE_R2_WORKER_URL as string | undefined)?.replace(/\/$/, '');

function contentType(file: File) {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return ({ pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' } as Record<string, string>)[extension || ''] || 'application/octet-stream';
}

async function workerRequest(path: string, body: unknown): Promise<Response> {
  if (!workerUrl) throw new Error('R2 storage is not configured. Set VITE_R2_WORKER_URL after deploying the storage Worker.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in to access private files.');
  return fetch(`${workerUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function responseError(response: Response) {
  const message = await response.text().catch(() => '');
  return new Error(message || `Storage request failed (${response.status})`);
}

export async function uploadPrivateFile(path: string, file: File): Promise<StorageResult<{ provider: StorageProvider }>> {
  try {
    if (!workerUrl) {
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file);
      return { data: error ? null : { provider: 'supabase' }, error };
    }
    const type = contentType(file);
    const response = await workerRequest('/upload-url', { key: path, contentType: type });
    if (!response.ok) return { data: null, error: await responseError(response) };
    const signed = await response.json() as { url: string; headers: Record<string, string> };
    const upload = await fetch(signed.url, { method: 'PUT', headers: signed.headers, body: file });
    if (!upload.ok) return { data: null, error: await responseError(upload) };
    return { data: { provider: 'r2' }, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('File upload failed') };
  }
}

export async function createPrivateFileUrl(path: string, provider: StorageProvider = 'supabase', expiresIn = 3600): Promise<StorageResult<{ signedUrl: string }>> {
  try {
    if (provider === 'supabase') {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, expiresIn);
      return { data: data ? { signedUrl: data.signedUrl } : null, error };
    }
    const response = await workerRequest('/download-url', { key: path });
    if (!response.ok) return { data: null, error: await responseError(response) };
    const data = await response.json() as { url: string };
    return { data: { signedUrl: data.url }, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('Could not access this file') };
  }
}

export async function removePrivateFile(path: string, provider: StorageProvider = 'supabase'): Promise<{ error: Error | null }> {
  try {
    if (provider === 'supabase') {
      const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
      return { error };
    }
    const response = await workerRequest('/delete', { key: path });
    return { error: response.ok ? null : await responseError(response) };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Could not delete this file') };
  }
}

export function activeStorageProvider(): StorageProvider {
  return workerUrl ? 'r2' : 'supabase';
}
