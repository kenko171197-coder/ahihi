// Màn ⑦ — Phân cảnh: danh sách máy quay cố định (kèm câu tiếng Anh cho màn ⑧), mốc giây, cờ "cần xem lại" theo cảnh.
// Thuần, không thư viện ngoài — dùng chung cho server và giao diện.
import type { Beat, ChuyenDong, CoCanh, GocMay, KichBanData, PhanCanhData, Shot } from './project';
import { beatsOf, dauBeat, hash } from './kichBan';

export const CO_CANH: { id: CoCanh; vi: string; en: string }[] = [
  { id: 'toan', vi: 'Toàn cảnh', en: 'Wide shot' },
  { id: 'toan-trung', vi: 'Toàn trung', en: 'Medium wide shot' },
  { id: 'trung', vi: 'Trung cảnh', en: 'Medium shot' },
  { id: 'can-trung', vi: 'Cận trung', en: 'Medium close-up' },
  { id: 'can', vi: 'Cận cảnh', en: 'Close-up' },
  { id: 'dac-ta', vi: 'Đặc tả', en: 'Extreme close-up' },
];
export const GOC_MAY: { id: GocMay; vi: string; en: string }[] = [
  { id: 'ngang', vi: 'Ngang tầm mắt', en: 'eye level' },
  { id: 'thap', vi: 'Máy thấp', en: 'low angle' },
  { id: 'cao', vi: 'Máy cao', en: 'high angle' },
  { id: 'tren-xuong', vi: 'Từ trên xuống', en: 'top-down overhead angle' },
  { id: 'qua-vai', vi: 'Qua vai', en: 'over-the-shoulder' },
  { id: 'goc-nhin', vi: 'Góc nhìn nhân vật', en: 'point-of-view' },
];
export const CHUYEN_DONG: { id: ChuyenDong; vi: string; en: string }[] = [
  { id: 'tinh', vi: 'Máy tĩnh', en: 'static camera' },
  { id: 'lia-ngang', vi: 'Lia ngang', en: 'slow pan' },
  { id: 'lia-doc', vi: 'Lia dọc', en: 'slow tilt' },
  { id: 'day-vao', vi: 'Đẩy vào', en: 'slow dolly in' },
  { id: 'keo-ra', vi: 'Kéo ra', en: 'slow dolly out' },
  { id: 'di-theo', vi: 'Đi theo', en: 'tracking shot following the subject' },
  { id: 'cam-tay', vi: 'Cầm tay nhẹ', en: 'subtle handheld camera' },
];

/** Câu máy tiếng Anh do code ghép (màn ⑧ chép nguyên văn). */
export function cauMay(s: Pick<Shot, 'coCanh' | 'gocMay' | 'chuyenDong'>): string {
  const c = CO_CANH.find((x) => x.id === s.coCanh)?.en || '';
  const g = GOC_MAY.find((x) => x.id === s.gocMay)?.en || '';
  const d = CHUYEN_DONG.find((x) => x.id === s.chuyenDong)?.en || '';
  return [c, g, d].filter(Boolean).join(', ');
}

/** Làm tròn về bước 0,5 giây. */
export const tronNuaGiay = (n: number) => (Number.isFinite(n) ? Math.round(n * 2) / 2 : NaN);

/** "00:01.5" */
export function fmtMoc(s: number): string {
  const t = Math.max(0, Math.round(s * 2) / 2);
  const m = Math.floor(t / 60);
  const sec = t - m * 60;
  const whole = Math.floor(sec);
  return `${String(m).padStart(2, '0')}:${String(whole).padStart(2, '0')}${sec !== whole ? '.5' : ''}`;
}

/** Mốc giây từng shot trong beat: [00:00–00:03], [00:03–00:05.5]… */
export function mocGiay(shots: Shot[]): string[] {
  let t = 0;
  return shots.map((s) => {
    const a = t;
    t += Number.isFinite(s.giay) ? s.giay : 0;
    return `[${fmtMoc(a)}–${fmtMoc(t)}]`;
  });
}

export const shotId = (beat: string, n: number) => `${beat}.${n}`;

export const emptyPhanCanh = (): PhanCanhData => ({ canh: {} });

/** Dấu đầu vào của một cảnh ở màn ⑦: các beat (mã, giây, hành động, thoại, có mặt, trạng thái đầu / cuối). */
export function dauVaoPhanCanh(kb: KichBanData, id: string): string {
  const c = kb.danY.canh.find((x) => x.id === id);
  if (!c) return '';
  const beats = beatsOf(kb, id);
  return hash(JSON.stringify(beats.map((b, i) => [b.id, b.giay, b.hanhDong, b.thoai, b.coMat, dauBeat(c, beats, i), b.cuoiBeat])));
}

export type TinhTrangPhanCanh = 'chua-lam' | 'da-lam' | 'can-xem-lai';

export function tinhTrangPhanCanh(pc: PhanCanhData, kb: KichBanData, id: string): TinhTrangPhanCanh {
  const v = pc.canh[id];
  if (!v || !Object.values(v.beats).some((b) => b.shots.length)) return 'chua-lam';
  return v.dauVao === dauVaoPhanCanh(kb, id) ? 'da-lam' : 'can-xem-lai';
}

/** Gán mã cho shot chưa có mã (shot mới / tách), không đánh lại số shot cũ. */
export function ganMaShot(beat: Beat['id'], shots: Shot[], soShot: number): { shots: Shot[]; soShot: number } {
  let next = Math.max(soShot, 1, ...shots.map((s) => Number(/\.(\d+)$/.exec(s.id)?.[1] || 0) + 1));
  const seen = new Set<string>();
  const out = shots.map((s) => {
    if (s.id && s.id.startsWith(`${beat}.`) && !seen.has(s.id)) {
      seen.add(s.id);
      return s;
    }
    const id = shotId(beat, next++);
    seen.add(id);
    return { ...s, id };
  });
  return { shots: out, soShot: next };
}

export const blankShot = (giay: number, trongKhung: string[] = []): Shot => ({ id: '', giay, coCanh: 'trung', gocMay: 'ngang', chuyenDong: 'tinh', moTa: '', trongKhung, thoai: [] });
