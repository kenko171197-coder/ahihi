// Bộ đếm token THẬT: số liệu lấy từ usageMetadata Gemini trả về sau mỗi lần gọi.
import { costOf } from '../../shared/models';

export interface Usage {
  input: number;
  output: number;
  cached: number;
  calls: number;
  /** Chi phí ước tính (USD) — chỉ tính lượt chạy bằng key TRẢ PHÍ */
  cost?: number;
  /** Số lượt chạy bằng key miễn phí / trả phí */
  freeCalls?: number;
  paidCalls?: number;
}

export interface UsageBook {
  since: number;
  total: Usage;
  byFeature: Record<string, Usage>;
  byProject: Record<string, Usage>;
}

const KEY = 'xuong_usage';
const zero = (): Usage => ({ input: 0, output: 0, cached: 0, calls: 0, cost: 0, freeCalls: 0, paidCalls: 0 });
const empty = (): UsageBook => ({ since: Date.now(), total: zero(), byFeature: {}, byProject: {} });

/** Tên chức năng hiện trong bảng, theo đường dẫn API. */
export const FEATURE_NAMES: Record<string, string> = {
  '/api/task/hoi-lai': '① Hỏi lại',
  '/api/task/logline': '① Logline',
  '/api/task/nhan-vat': '② Nhân vật',
  '/api/task/treatment': '③ Treatment',
  '/api/task/dan-y-canh': '④ Dàn ý cảnh',
  '/api/task/viet-canh': '④ Viết cảnh',
  '/api/task/ra-soat': '⑤ Rà soát',
  '/api/design': '⑥ Thiết kế (bản tạm)',
  '/api/match-images': '⑥ Quét ảnh gán @tag',
  '/api/test-key': 'Kiểm tra key',
};

export function loadUsage(): UsageBook {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

const listeners = new Set<() => void>();
export const onUsageChange = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const add = (a: Usage | undefined, b: Usage): Usage => ({
  input: (a?.input || 0) + b.input,
  output: (a?.output || 0) + b.output,
  cached: (a?.cached || 0) + b.cached,
  calls: (a?.calls || 0) + b.calls,
  cost: (a?.cost || 0) + (b.cost || 0),
  freeCalls: (a?.freeCalls || 0) + (b.freeCalls || 0),
  paidCalls: (a?.paidCalls || 0) + (b.paidCalls || 0),
});

export function recordUsage(url: string, u: any, projectId?: string) {
  if (!u || typeof u !== 'object') return;
  const usage: Usage = {
    input: Number(u.input) || 0,
    output: Number(u.output) || 0,
    cached: Number(u.cached) || 0,
    calls: Number(u.calls) || 0,
    // byModel theo "model|free" hoặc "model|paid": key miễn phí không mất tiền
    cost: Object.entries((u.byModel || {}) as Record<string, any>).reduce((t, [id, m]) => {
      const [model, tier] = id.split('|');
      return tier === 'free' ? t : t + costOf(model, Number(m.input) || 0, Number(m.output) || 0, Number(m.cached) || 0);
    }, 0),
    freeCalls: Object.entries((u.byModel || {}) as Record<string, any>).reduce((t, [id, m]) => t + (id.endsWith('|free') ? Number(m.calls) || 0 : 0), 0),
    paidCalls: Object.entries((u.byModel || {}) as Record<string, any>).reduce((t, [id, m]) => t + (id.endsWith('|free') ? 0 : Number(m.calls) || 0), 0),
  };
  if (!usage.calls) return;
  const book = loadUsage();
  book.total = add(book.total, usage);
  book.byFeature[url] = add(book.byFeature[url], usage);
  if (projectId) book.byProject[projectId] = add(book.byProject[projectId], usage);
  try {
    localStorage.setItem(KEY, JSON.stringify(book));
  } catch {
    /* bỏ qua */
  }
  listeners.forEach((fn) => fn());
}

export function resetUsage() {
  try {
    localStorage.setItem(KEY, JSON.stringify(empty()));
  } catch {
    /* bỏ qua */
  }
  listeners.forEach((fn) => fn());
}

export const fmtUSD = (n = 0) => (n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);

/** 12345 → "12,3K"; 1234567 → "1,23M" */
export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}M`;
  if (n >= 1000) return `${(n / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}K`;
  return String(n);
}
