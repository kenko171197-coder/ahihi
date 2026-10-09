// Gọi Gemini phía server với NHÓM API KEY.
// - Hai nhóm key: MIỄN PHÍ và TRẢ PHÍ (người dùng nhập ở tab Cài đặt, gửi kèm mỗi request, server không lưu).
// - Luôn ưu tiên key MIỄN PHÍ. Chỉ dùng key TRẢ PHÍ khi mọi key miễn phí không gọi được model đó
//   (hết lượt, bị giới hạn, model không có ở bậc miễn phí, key lỗi).
// - Trong mỗi nhóm, các key được XOAY TUA để chia đều lượt gọi.
// - Key chạm giới hạn được "nghỉ" một lúc (theo loại lỗi) để lần sau khỏi thử lại vô ích.
// - Model chọn theo tác vụ; mọi key đều không gọi được model đó thì mới chuyển model dự phòng.
// - Đếm token thật theo model và theo nhóm key (chỉ nhóm trả phí mới tính tiền).
// - Cache chủ động cho phần prompt cố định (bước viết beat), có đường lui an toàn.
import { GoogleGenAI } from '@google/genai';
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import { TASKS, FALLBACK_CHAIN, modelInfo } from '../shared/models';

export type Tier = 'free' | 'paid';

export interface KeyPool {
  free: string[];
  paid: string[];
}

export interface UsageEntry {
  input: number;
  output: number;
  cached: number;
  calls: number;
}

export interface Usage extends UsageEntry {
  /** Theo "model|free" hoặc "model|paid" */
  byModel: Record<string, UsageEntry>;
}

export const newUsage = (): Usage => ({ input: 0, output: 0, cached: 0, calls: 0, byModel: {} });

export const requestContext = new AsyncLocalStorage<{ keys: KeyPool; usage: Usage; models: Record<string, string> }>();

export const MODELS = FALLBACK_CHAIN;

export const currentUsage = (): Usage => requestContext.getStore()?.usage || newUsage();

function addUsage(model: string, tier: Tier, meta: any) {
  const u = requestContext.getStore()?.usage;
  if (!u || !meta) return;
  const input = Number(meta.promptTokenCount) || 0;
  // token "suy nghĩ" của model được tính tiền như output
  const output = (Number(meta.candidatesTokenCount) || 0) + (Number(meta.thoughtsTokenCount) || 0);
  const cached = Number(meta.cachedContentTokenCount) || 0;
  u.input += input;
  u.output += output;
  u.cached += cached;
  u.calls += 1;
  const m = (u.byModel[`${model}|${tier}`] ||= { input: 0, output: 0, cached: 0, calls: 0 });
  m.input += input;
  m.output += output;
  m.cached += cached;
  m.calls += 1;
}

/* ======================= KEY: xoay tua + nghỉ khi chạm giới hạn ======================= */

const clients = new Map<string, GoogleGenAI>();
function clientFor(key: string): GoogleGenAI {
  let c = clients.get(key);
  if (!c) {
    c = new GoogleGenAI({ apiKey: key, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    clients.set(key, c);
  }
  return c;
}

const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

/** key|model → thời điểm được thử lại (key đang "nghỉ" với model đó) */
const cooldown = new Map<string, number>();
/** Con trỏ xoay tua của từng nhóm key */
const rotation = new Map<string, number>();

const coolKey = (key: string, model: string) => `${hash(key)}|${model}`;

/** Các key của một nhóm theo thứ tự xoay tua, bỏ key đang nghỉ với model này. */
function keysInTurn(keys: string[], tier: Tier, model: string): string[] {
  if (!keys.length) return [];
  const group = `${tier}|${hash(keys.join('\n'))}`;
  const start = (rotation.get(group) || 0) % keys.length;
  rotation.set(group, start + 1);
  const ordered = [...keys.slice(start), ...keys.slice(0, start)];
  const now = Date.now();
  return ordered.filter((k) => (cooldown.get(coolKey(k, model)) || 0) <= now);
}

type ErrorKind = 'rate' | 'daily' | 'unavailable' | 'badkey' | 'transient' | 'request' | 'other';

function classify(error: any): ErrorKind {
  const msg = String(error?.message || '').toLowerCase();
  const status = Number(error?.status) || 0;
  if (msg.includes('api key not valid') || msg.includes('api_key_invalid') || msg.includes('unauthenticated') || status === 401)
    return 'badkey';
  // Yêu cầu sai (khuôn trả lời, tham số…) — lỗi của app, KHÔNG phải của key: đổi key / đổi model cũng vô ích,
  // và tuyệt đối không cho key nghỉ (trước đây bị đoán nhầm là "không có model" → key nghỉ 6 tiếng).
  if (status === 400 || msg.includes('invalid_argument') || msg.includes('invalid argument') || msg.includes('too many states')) return 'request';
  // "limit: 0" = model không có trong bậc của key này (VD Pro với key miễn phí)
  if (msg.includes('limit: 0')) return 'unavailable';
  if (msg.includes('perday') || msg.includes('per day') || msg.includes('daily')) return 'daily';
  // "rate" phải là cụm riêng — chữ "generate" cũng chứa "rate"
  if (msg.includes('quota') || msg.includes('resource_exhausted') || /\brate[ _-]?limit/.test(msg) || status === 429) return 'rate';
  if (msg.includes('not found') || msg.includes('not supported') || msg.includes('permission') || msg.includes('not available') || status === 404 || status === 403)
    return 'unavailable';
  if (msg.includes('503') || msg.includes('500') || msg.includes('unavailable') || msg.includes('high demand') || status === 503 || status === 500)
    return 'transient';
  return 'other';
}

/** Câu lỗi gọn: Google hay trả cả khối JSON ({"error":{"message":…}}) — chỉ lấy câu message. */
function googleMessage(error: any): string {
  const raw = String(error?.message || error || '');
  try {
    const m = JSON.parse(raw)?.error?.message;
    if (typeof m === 'string' && m) return m;
  } catch {
    /* không phải JSON */
  }
  return raw;
}

/** Thời gian cho key nghỉ theo loại lỗi. */
const REST_MS: Record<ErrorKind, number> = {
  rate: 60_000, // giới hạn theo phút
  daily: 60 * 60_000, // hết lượt trong ngày → thử lại sau 1 giờ
  unavailable: 6 * 60 * 60_000, // model không có ở bậc/khu vực của key
  badkey: 24 * 60 * 60_000,
  transient: 0,
  request: 0,
  other: 0,
};

/** Key/model đang dùng được: dùng cho tin nhắn lỗi dễ hiểu */
function explain(kind: ErrorKind): string {
  return {
    rate: 'chạm giới hạn lượt/phút',
    daily: 'hết lượt trong ngày',
    unavailable: 'không có model này (VD model Pro không có ở bậc miễn phí)',
    badkey: 'key không hợp lệ',
    transient: 'máy chủ Google đang quá tải',
    request: 'yêu cầu không hợp lệ',
    other: 'lỗi',
  }[kind];
}

const pool = (): KeyPool => requestContext.getStore()?.keys || { free: [], paid: [] };

/* ======================= CHỌN MODEL ======================= */

/** Model người dùng chọn cho tác vụ (hoặc mặc định). Model đã ngừng thì bỏ qua. */
export function modelFor(task?: string): string {
  const chosen = task ? requestContext.getStore()?.models?.[task] : undefined;
  const info = chosen ? modelInfo(chosen) : undefined;
  if (chosen && info && info.text && info.status !== 'shutdown') return chosen;
  return TASKS.find((t) => t.key === task)?.model || FALLBACK_CHAIN[0];
}

const chainFor = (task?: string) => Array.from(new Set([modelFor(task), ...FALLBACK_CHAIN]));

/**
 * Chạy `attempt` lần lượt: với mỗi model trong chuỗi → key MIỄN PHÍ (xoay tua) → key TRẢ PHÍ (xoay tua).
 * Lỗi tạm thời thì thử lại cùng key; chạm giới hạn / không có model / key lỗi thì cho key nghỉ và sang key kế.
 */
async function runWithPool<T>(
  task: string | undefined,
  attempt: (ai: GoogleGenAI, model: string, key: string, tier: Tier) => Promise<T>,
  models = chainFor(task)
): Promise<T> {
  const { free, paid } = pool();
  if (!free.length && !paid.length) throw new Error('Chưa có API key. Vào tab Cài đặt để thêm key.');
  let lastError: any = null;
  const tried: string[] = [];

  for (const model of models) {
    for (const tier of ['free', 'paid'] as Tier[]) {
      for (const key of keysInTurn(tier === 'free' ? free : paid, tier, model)) {
        for (let retry = 0; retry < 2; retry++) {
          try {
            return await attempt(clientFor(key), model, key, tier);
          } catch (error: any) {
            lastError = error;
            const kind = classify(error);
            console.warn(`[${model} · key ${tier} …${key.slice(-4)}] ${explain(kind)}:`, error?.message || error);
            if (kind === 'request') {
              // Lỗi của chính yêu cầu → báo ngay, kèm thông báo gốc của Google
              throw new Error(`Gemini từ chối yêu cầu (lỗi của app, không phải của key): ${String(error?.message || error).slice(0, 400)}`);
            }
            if (kind === 'transient' && retry === 0) {
              await new Promise((r) => setTimeout(r, 1500));
              continue;
            }
            if (REST_MS[kind]) cooldown.set(coolKey(key, model), Date.now() + REST_MS[kind]);
            tried.push(`${model} · ${tier === 'free' ? 'miễn phí' : 'trả phí'} …${key.slice(-4)}: ${explain(kind)}`);
            break;
          }
        }
      }
    }
  }
  const detail = tried.length ? ` Đã thử: ${tried.slice(0, 6).join('; ')}${tried.length > 6 ? '…' : ''}.` : '';
  if (!tried.length && !lastError) {
    // Không thử được key nào: mọi key đang nghỉ với mọi model → nói rõ, kèm thời gian chờ
    const all = [...free, ...paid];
    const until = Math.min(...models.flatMap((m) => all.map((k) => cooldown.get(coolKey(k, m)) || 0)).filter((t) => t > Date.now()), Infinity);
    const wait = Number.isFinite(until) ? Math.ceil((until - Date.now()) / 60_000) : 0;
    throw new Error(
      `Mọi key đang tạm nghỉ sau lỗi trước đó${wait ? ` — thử lại sau khoảng ${wait} phút` : ''}. Thêm key khác ở tab Cài đặt, hoặc khởi động lại app để xoá trạng thái nghỉ.`
    );
  }
  if (lastError && classify(lastError) === 'badkey' && tried.every((t) => t.endsWith(explain('badkey'))))
    throw new Error(`Key không hợp lệ — kiểm tra lại key ở tab Cài đặt (bấm "Kiểm tra").${detail}`);
  throw new Error(`${googleMessage(lastError) || 'Không gọi được Gemini.'}${detail}`);
}

/** Gọi một prompt, tự chọn key/model theo ưu tiên. */
export async function generateWithFallback(params: any, task?: string) {
  return runWithPool(task, async (ai, model, _key, tier) => {
    const response = await ai.models.generateContent({ ...params, model });
    if (!response || !response.text) throw new Error('Gemini trả về nội dung rỗng.');
    addUsage(model, tier, (response as any).usageMetadata);
    return response;
  });
}

/** Thử một key cụ thể (tab Cài đặt → nút Kiểm tra). */
export async function testKey(key: string, model: string) {
  await clientFor(key).models.generateContent({ model, contents: [{ role: 'user', parts: [{ text: 'ping' }] }] });
}

/* ======================= CACHE CHỦ ĐỘNG ======================= */
// Phần cố định của prompt được lưu thành cache trên Google 30 phút; lần gọi sau chỉ gửi phần thay đổi.
// Cache gắn với từng key. Key không tạo được cache (thường là key miễn phí) → gửi đầy đủ, không tốn thêm lượt.

const CACHE_TTL_SECONDS = 1800;
const cacheRegistry = new Map<string, { name: string; expires: number }>();
const cacheUnsupported = new Map<string, number>();

async function getOrCreateCache(ai: GoogleGenAI, key: string, model: string, stable: string): Promise<string> {
  const id = crypto.createHash('sha256').update(`${key}\n${model}\n${stable}`).digest('hex');
  const hit = cacheRegistry.get(id);
  if (hit && hit.expires > Date.now() + 60_000) return hit.name;
  const cache: any = await (ai as any).caches.create({
    model,
    config: { contents: [{ role: 'user', parts: [{ text: stable }] }], ttl: `${CACHE_TTL_SECONDS}s`, displayName: `xuong-${id.slice(0, 12)}` },
  });
  if (!cache?.name) throw new Error('Không tạo được cache.');
  cacheRegistry.set(id, { name: cache.name, expires: Date.now() + CACHE_TTL_SECONDS * 1000 });
  return cache.name;
}

export async function generateWithCache(stable: string, variableParts: any[], config: any, task?: string) {
  const full = { contents: [{ role: 'user', parts: [{ text: stable }, ...variableParts] }], config };
  return runWithPool(task, async (ai, model, key, tier) => {
    const skip = `${hash(key)}|${model}`;

    // Cache chủ động KHÔNG có ở bậc miễn phí → key miễn phí gửi đầy đủ ngay, không thử tạo cache
    // (thử tạo cache bằng key miễn phí bị Google báo "quota", trước đây bị hiểu nhầm là key hết lượt).
    if (tier === 'paid' && (cacheUnsupported.get(skip) || 0) <= Date.now()) {
      // Bước 1: tạo / lấy cache. Mọi lỗi ở bước này chỉ có nghĩa "key này không dùng được cache" —
      // KHÔNG cho key nghỉ, gửi đầy đủ bằng chính key này.
      let cachedContent = '';
      try {
        cachedContent = await getOrCreateCache(ai, key, model, stable);
      } catch (error: any) {
        console.warn(`[cache ${model}] không tạo được cache, gửi đầy đủ:`, error?.message || error);
        cacheUnsupported.set(skip, Date.now() + 6 * 60 * 60_000);
      }
      // Bước 2: gọi với cache. Lỗi giới hạn thật của key → để runWithPool chuyển key.
      if (cachedContent) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: variableParts }],
            config: { ...config, cachedContent },
          });
          if (response && response.text) {
            addUsage(model, tier, (response as any).usageMetadata);
            return response;
          }
        } catch (error: any) {
          const kind = classify(error);
          if (/cach/i.test(String(error?.message || ''))) cacheUnsupported.set(skip, Date.now() + 6 * 60 * 60_000);
          else if (kind === 'rate' || kind === 'daily' || kind === 'badkey') throw error;
        }
      }
    }
    const response = await ai.models.generateContent({ ...full, model });
    if (!response || !response.text) throw new Error('Gemini trả về nội dung rỗng.');
    addUsage(model, tier, (response as any).usageMetadata);
    return response;
  });
}
