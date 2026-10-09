import type { GenreInfo } from '../types';
import type { LoaiAnh } from '../../shared/bible';
import { recordUsage } from '../lib/usage';
import { modelPrefsHeader } from '../lib/modelPrefs';
import { keysHeader, hasAnyKey } from '../lib/apiKeys';

export const hasApiKey = hasAnyKey;
export const NO_API_KEY_MESSAGE = 'Chưa có API key. Vào tab Cài đặt để thêm key.';

async function post<T>(url: string, body: unknown, opts: { projectId?: string; skipKeyCheck?: boolean } = {}): Promise<T> {
  if (!opts.skipKeyCheck && !hasAnyKey()) throw new Error(NO_API_KEY_MESSAGE);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-gemini-keys': keysHeader(), 'x-gemini-models': modelPrefsHeader() },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Không kết nối được tới máy chủ của app. Kiểm tra app còn đang chạy (npm run dev).');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Lỗi máy chủ (${response.status}).`);
  if (data && typeof data === 'object' && 'usage' in data) {
    recordUsage(url, (data as any).usage, opts.projectId);
    delete (data as any).usage;
  }
  return data as T;
}

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { 'x-gemini-keys': keysHeader() } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Lỗi máy chủ (${response.status}).`);
  return data as T;
}

/** Kiểm tra một key: gọi thử Flash-Lite, và thử Pro để biết key có dùng được Pro không. */
export async function testApiKey(key: string): Promise<{ ok: boolean; message: string; pro?: string }> {
  try {
    const data = await post<{ ok: boolean; pro: string }>('/api/test-key', { key }, { skipKeyCheck: true });
    return { ok: true, message: 'Dùng được', pro: data.pro };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Không kết nối được tới máy chủ.' };
  }
}

export interface KnowledgeStatus {
  folders: { dir: string; files: string[] }[];
}

export const getKnowledgeStatus = () => get<KnowledgeStatus>('/api/knowledge-status');

/* ---------- Thể loại ---------- */

let genreCache: Promise<GenreInfo[]> | null = null;

/** Danh sách thể loại (nhớ tạm trong phiên; gọi lại với refresh = true để đọc lại thư mục). */
export function getGenres(refresh = false): Promise<GenreInfo[]> {
  if (!genreCache || refresh) {
    genreCache = get<{ genres: GenreInfo[] }>('/api/genres').then((d) => d.genres || []);
    genreCache.catch(() => (genreCache = null));
  }
  return genreCache;
}

/* ---------- Tác vụ AI của 8 màn ---------- */

export interface TaskResult<T> {
  output: T;
  /** Lỗi còn lại sau khi AI đã được gửi lại tối đa 2 lần */
  errors: string[];
  warnings: string[];
  logId: string;
}

export function runTask<T>(taskId: string, input: unknown, projectId: string): Promise<TaskResult<T>> {
  return post<TaskResult<T>>(`/api/task/${taskId}`, { input, projectId }, { projectId });
}

/* ---------- Nhật ký AI ---------- */

export interface LogSummary {
  id: string;
  at: number;
  task: string;
  projectId: string;
  ok: boolean;
  attempts: number;
  errors: string[];
  warnings: string[];
}

export interface LogDetail extends Omit<LogSummary, 'attempts'> {
  attempts: { prompt: string; raw: string; errors: string[]; ms: number }[];
}

export const getLogs = () => get<{ logs: LogSummary[] }>('/api/logs').then((d) => d.logs || []);
export const getLog = (id: string) => get<{ log: LogDetail }>(`/api/logs/${encodeURIComponent(id)}`).then((d) => d.log);

/* ---------- Màn ⑥ — quét ảnh tham chiếu, gán @tag ---------- */

export interface ImageMatch {
  index: number;
  tag: string;
  confidence: number;
  seen: string;
  warning: string;
}

export async function matchImages(
  images: { mime: string; data: string }[],
  tags: { tag: string; kind: LoaiAnh; note: string; description: string }[],
  projectId?: string
): Promise<ImageMatch[]> {
  const data = await post<{ matches: ImageMatch[] }>('/api/match-images', { images, tags }, { projectId });
  return data.matches;
}
