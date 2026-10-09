// Nhóm API key: MIỄN PHÍ và TRẢ PHÍ. Lưu trong trình duyệt, gửi kèm mỗi lần gọi server.
// Server luôn thử key miễn phí trước (xoay tua), hết cách mới dùng key trả phí.

export type Tier = 'free' | 'paid';

export interface ApiKeyItem {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  /** Kết quả lần kiểm tra gần nhất */
  status?: 'ok' | 'error';
  message?: string;
  /** Key này gọi được model Pro không (lần kiểm tra gần nhất) */
  pro?: string;
  checkedAt?: number;
}

export interface KeyBook {
  free: ApiKeyItem[];
  paid: ApiKeyItem[];
}

const KEY = 'xuong_api_keys';
const LEGACY = 'prompt_lab_gemini_api_key';

const newId = () => `key_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export function loadKeys(): KeyBook {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const b = JSON.parse(raw);
      return { free: Array.isArray(b.free) ? b.free : [], paid: Array.isArray(b.paid) ? b.paid : [] };
    }
    // Chuyển key cũ (một key) sang nhóm miễn phí — người dùng tự chuyển nhóm nếu là key trả phí
    const legacy = (localStorage.getItem(LEGACY) || '').trim();
    const book: KeyBook = { free: legacy ? [{ id: newId(), key: legacy, label: 'Key cũ', enabled: true }] : [], paid: [] };
    saveKeys(book);
    return book;
  } catch {
    return { free: [], paid: [] };
  }
}

const listeners = new Set<() => void>();
export const onKeysChange = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function saveKeys(book: KeyBook) {
  try {
    localStorage.setItem(KEY, JSON.stringify(book));
  } catch {
    /* bỏ qua */
  }
  listeners.forEach((fn) => fn());
}

export function addKey(book: KeyBook, tier: Tier, key: string, label: string): KeyBook {
  const k = key.trim();
  if (!k) return book;
  if ([...book.free, ...book.paid].some((x) => x.key === k)) throw new Error('Key này đã có trong danh sách.');
  const next = { ...book, [tier]: [...book[tier], { id: newId(), key: k, label: label.trim(), enabled: true }] };
  saveKeys(next);
  return next;
}

export const activeKeys = (book = loadKeys()) => ({
  free: book.free.filter((k) => k.enabled).map((k) => k.key),
  paid: book.paid.filter((k) => k.enabled).map((k) => k.key),
});

export const hasAnyKey = () => {
  const a = activeKeys();
  return a.free.length + a.paid.length > 0;
};

export const keysHeader = () => encodeURIComponent(JSON.stringify(activeKeys()));

export const mask = (k: string) => (k.length > 10 ? `${k.slice(0, 6)}…${k.slice(-4)}` : '••••');

/* ---------- Xuất / nhập key ra file ---------- */

/** Tải file chứa toàn bộ key (hai nhóm). File là chữ thường — giữ kín như mật khẩu. */
export function exportKeys() {
  const book = loadKeys();
  const strip = (list: ApiKeyItem[]) => list.map(({ key, label, enabled }) => ({ key, label, enabled }));
  const data = {
    app: 'xuong-phim-ai-keys',
    version: 1,
    exportedAt: new Date().toISOString(),
    free: strip(book.free),
    paid: strip(book.paid),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `xuong-phim-ai_api-keys_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Gộp key từ file vào danh sách hiện có (key đã có thì bỏ qua). Trả về số key thêm mới mỗi nhóm. */
export function importKeys(json: string): { free: number; paid: number } {
  const data = JSON.parse(json);
  if (data?.app !== 'xuong-phim-ai-keys') throw new Error('File này không phải file API key của Xưởng phim AI.');
  const book = loadKeys();
  const existing = new Set([...book.free, ...book.paid].map((k) => k.key));
  const added = { free: 0, paid: 0 };
  for (const tier of ['free', 'paid'] as Tier[]) {
    for (const item of Array.isArray(data[tier]) ? data[tier] : []) {
      const key = String(item?.key || '').trim();
      if (key.length < 10 || existing.has(key)) continue;
      existing.add(key);
      book[tier].push({ id: newId(), key, label: String(item?.label || ''), enabled: item?.enabled !== false });
      added[tier] += 1;
    }
  }
  saveKeys(book);
  return added;
}
