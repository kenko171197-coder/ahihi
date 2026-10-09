// Tiện ích nhỏ dùng chung cho các tác vụ (thuần, không import thư viện ngoài).

export const str = (v: unknown, max = 4000): string => String(v ?? '').trim().slice(0, max);
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
export const int = (v: unknown): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : NaN;
};

export { sentenceCount } from '../../shared/checks';

/** In JSON gọn để đưa vào prompt. */
export const pretty = (v: unknown) => JSON.stringify(v, null, 2);

/** Khối "sửa theo yêu cầu" dùng chung: đầu vào tuỳ chọn { truoc, yeuCau }. */
export interface SuaYeuCau {
  truoc: unknown;
  yeuCau: string;
}

export function parseSua(v: unknown): SuaYeuCau | undefined {
  const o = obj(v);
  const yeuCau = str(o.yeuCau, 2000);
  if (!yeuCau || o.truoc === undefined) return undefined;
  return { truoc: o.truoc, yeuCau };
}
