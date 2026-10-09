// Tiện ích cho kịch bản (màn ④ ⑤) — dùng chung cho server và giao diện. Thuần, không thư viện ngoài.
// Mã cảnh / beat, trạng thái đầu beat, cờ "cần xem lại" theo cảnh, đạo cụ đã khai.
import type { Beat, CanhDanY, CanhViet, DanY, DaoCu, DongTrangThai, KichBanData, ThayDoi, ThoaiCau } from './project';
import { toTag } from './project';

/* ---------- Mã cố định ---------- */

export const canhId = (n: number) => `S${n}`;
export const beatId = (n: number) => `B${String(n).padStart(3, '0')}`;
/** Số ở cuối mã: "B007" → 7. */
export const idNum = (id: string) => Number(/(\d+)$/.exec(String(id || ''))?.[1] || 0);

/** Đọc mã cảnh người / AI viết ("S3", "s 3", "Cảnh S3") → "S3"; không đọc được thì trả nguyên. */
export function normCanhId(v: string): string {
  const m = /S\s*(\d+)/i.exec(String(v || ''));
  return m ? canhId(Number(m[1])) : String(v || '').trim();
}

/** Đọc mã beat ("B7", "b007") → "B007". */
export function normBeatId(v: string): string {
  const m = /B\s*(\d+)/i.exec(String(v || ''));
  return m ? beatId(Number(m[1])) : String(v || '').trim();
}

export const emptyKichBan = (): KichBanData => ({ danY: { canh: [], caiDung: [] }, danYDuyet: false, canh: {}, soCanh: 1, soBeat: 1 });

/* ---------- Trạng thái ---------- */

/** "@lan: ngồi bệt cạnh thùng" — mỗi dòng một người / vật. */
export const trangThaiText = (lines: DongTrangThai[], sep = '\n') => lines.map((l) => `@${l.tag}: ${l.moTa}`).join(sep);

/** Đọc ô chữ trạng thái (mỗi dòng "@tag: mô tả") → danh sách dòng. Dòng không có tag bị bỏ. */
export function parseTrangThai(text: string): DongTrangThai[] {
  return String(text || '')
    .split('\n')
    .map((line) => /^\s*@?([^\s:—–-]+)\s*[:—–-]\s*(.*)$/.exec(line))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ tag: toTag(m[1]), moTa: m[2].trim() }))
    .filter((l) => l.tag);
}

/** Ô chữ danh sách tag: "@lan, @thungxop" → ["lan", "thungxop"]. */
export const parseTags = (text: string) => Array.from(new Set(String(text || '').split(/[\s,;]+/).map(toTag).filter(Boolean)));

/** "@thungxop: đóng → mở", mỗi dòng một thay đổi. */
export const thayDoiText = (list: ThayDoi[]) => list.map((x) => `@${x.tag}: ${x.truoc} → ${x.sau}`).join('\n');

export function parseThayDoi(text: string): ThayDoi[] {
  return parseTrangThai(text).map((l) => {
    const [truoc, ...rest] = l.moTa.split(/\s*(?:→|->)\s*/);
    return { tag: l.tag, truoc: (truoc || '').trim(), sau: rest.join(' → ').trim() };
  });
}

/** Thoại, mỗi dòng một câu: "@lan (khẽ): câu nói" — người không có ở màn ② ghi tên không có @. */
export const thoaiText = (list: ThoaiCau[], charTags: Set<string>) =>
  list.map((t) => `${charTags.has(t.ai) ? '@' : ''}${t.ai}${t.cachNoi ? ` (${t.cachNoi})` : ''}: ${t.cau}`).join('\n');

export function parseThoai(text: string, charTags: Set<string>): ThoaiCau[] {
  return String(text || '')
    .split('\n')
    .map((line) => /^\s*(@?[^():]+?)\s*(?:\(([^)]*)\))?\s*:\s*(.+)$/.exec(line))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => {
      const who = m[1].replace(/^@/, '').trim();
      return { ai: charTags.has(toTag(who)) ? toTag(who) : who, cachNoi: (m[2] || '').trim(), cau: m[3].trim() };
    });
}

/** Khoảng giây từ chữ "4–8 giây" → [4, 8]. */
export function parseKhoangGiay(text: string): [number, number] | null {
  const m = /(\d+)\s*[–-]\s*(\d+)/.exec(String(text || ''));
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a > 0 && b >= a ? [a, b] : null;
}

/* ---------- Thứ tự cảnh ---------- */

export const viTriCanh = (d: DanY, id: string) => d.canh.findIndex((c) => c.id === id);

export const beatsOf = (kb: KichBanData, id: string): Beat[] => kb.canh[id]?.beats || [];

/** Trạng thái cuối thật của một cảnh: beat cuối nếu đã viết, không thì trạng thái cuối trong dàn ý. */
export function cuoiCanhThat(kb: KichBanData, c: CanhDanY): DongTrangThai[] {
  const beats = beatsOf(kb, c.id);
  return beats.length ? beats[beats.length - 1].cuoiBeat : c.cuoiCanh;
}

/** Trạng thái đầu beat thứ i của cảnh: beat đầu lấy đầu cảnh trong dàn ý, beat sau lấy cuối beat trước. */
export function dauBeat(c: CanhDanY, beats: Beat[], i: number): DongTrangThai[] {
  return i <= 0 ? c.dauCanh : beats[i - 1]?.cuoiBeat || [];
}

/* ---------- Cờ "cần xem lại" theo cảnh ---------- */

/** Băm chuỗi (FNV-1a 32 bit) — chỉ để so sánh "có đổi không". */
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Dấu đầu vào của cảnh: dòng dàn ý của cảnh, các dòng Cài – Dùng đặt ở cảnh, trạng thái cuối thật của cảnh trước. */
export function dauVaoCanh(kb: KichBanData, id: string): string {
  const i = viTriCanh(kb.danY, id);
  if (i < 0) return '';
  const c = kb.danY.canh[i];
  const prev = i > 0 ? cuoiCanhThat(kb, kb.danY.canh[i - 1]) : null;
  const cd = kb.danY.caiDung.filter((x) => x.cai === id || x.dung === id).map((x) => [x.id, x.cai === id, x.dung === id]);
  return hash(JSON.stringify([c, cd, prev]));
}

export type TinhTrangCanh = 'chua-viet' | 'da-viet' | 'can-xem-lai';

export function tinhTrangCanh(kb: KichBanData, id: string): TinhTrangCanh {
  const v: CanhViet | undefined = kb.canh[id];
  if (!v || !v.beats.length) return 'chua-viet';
  return v.dauVao === dauVaoCanh(kb, id) ? 'da-viet' : 'can-xem-lai';
}

/* ---------- Đạo cụ ---------- */

/** Đạo cụ đã khai ở các cảnh đứng TRƯỚC cảnh này (theo thứ tự dàn ý). Khai trùng thì lấy lần đầu. */
export function daoCuTruoc(kb: KichBanData, id: string): DaoCu[] {
  const end = viTriCanh(kb.danY, id);
  const out: DaoCu[] = [];
  const seen = new Set<string>();
  kb.danY.canh.slice(0, end < 0 ? kb.danY.canh.length : end).forEach((c) =>
    beatsOf(kb, c.id).forEach((b) =>
      b.daoCuMoi.forEach((d) => {
        if (d.tag && !seen.has(d.tag)) {
          seen.add(d.tag);
          out.push(d);
        }
      })
    )
  );
  return out;
}

/** Mọi đạo cụ của kịch bản (theo thứ tự xuất hiện). */
export const tatCaDaoCu = (kb: KichBanData): DaoCu[] => daoCuTruoc(kb, '');

/* ---------- Ghi beat vào kịch bản ---------- */

/** Đảm bảo mã beat không trùng beat của cảnh khác; beat thiếu mã / trùng mã nhận số mới. Trả beat đã sửa và số tiếp theo. */
export function ganMaBeat(kb: KichBanData, id: string, beats: Beat[]): { beats: Beat[]; soBeat: number } {
  const taken = new Set<string>();
  Object.entries(kb.canh).forEach(([k, v]) => {
    if (k !== id) v.beats.forEach((b) => taken.add(b.id));
  });
  let next = Math.max(kb.soBeat, ...beats.map((b) => idNum(b.id) + 1), 1);
  const out = beats.map((b) => {
    if (b.id && /^B\d+$/.test(b.id) && !taken.has(b.id)) {
      taken.add(b.id);
      return b;
    }
    let nid = beatId(next++);
    while (taken.has(nid)) nid = beatId(next++);
    taken.add(nid);
    return { ...b, id: nid };
  });
  return { beats: out, soBeat: Math.max(next, ...out.map((b) => idNum(b.id) + 1)) };
}

/** Ghi beat của một cảnh (kết quả AI hoặc bản sửa) — đặt lại dấu đầu vào theo dàn ý hiện tại. */
export function ghiCanh(kb: KichBanData, id: string, beats: Beat[], now: number, dauVao?: string): KichBanData {
  const g = ganMaBeat(kb, id, beats);
  return { ...kb, soBeat: g.soBeat, canh: { ...kb.canh, [id]: { beats: g.beats, dauVao: dauVao ?? dauVaoCanh(kb, id), updatedAt: now } } };
}

/** Sửa tay beat của một cảnh: giữ dấu đầu vào cũ (cảnh vẫn dựa trên cùng dàn ý). */
export function suaCanh(kb: KichBanData, id: string, beats: Beat[], now: number): KichBanData {
  const old = kb.canh[id];
  return ghiCanh(kb, id, beats, now, old ? old.dauVao : dauVaoCanh(kb, id));
}

export const tongGiayBeat = (beats: Beat[]) => beats.reduce((s, b) => s + (Number.isFinite(b.giay) ? b.giay : 0), 0);

export const blankBeat = (id: string, giay = 5): Beat => ({ id, giay, hanhDong: '', thoai: [], amThanh: '', camXuc: '', coMat: [], daoCuMoi: [], thayDoi: [], caiDung: [], cuoiBeat: [] });

export const blankCanh = (id: string, batDau: number, ketThuc: number, phan = ''): CanhDanY => ({
  id,
  phan,
  diaDiem: '',
  tagDiaDiem: '',
  thoiDiem: '',
  anhSang: '',
  chuyenBien: '',
  coMat: [],
  batDau,
  ketThuc,
  dauCanh: [],
  cuoiCanh: [],
});
