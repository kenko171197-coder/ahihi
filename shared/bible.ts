// Màn ⑥ — Bible: bóc tách từ kịch bản chốt (code, không gọi AI), ghép prompt ảnh (code chép nguyên văn phần cố định).
// Thuần, không thư viện ngoài — dùng chung cho server và giao diện.
import type { AnhSangCanh, BibleBoiCanh, BibleData, BibleDaoCu, BibleNhanVat, BienTheBoiCanh, BoDo, Character, KichBanData } from './project';
import { toTag, uniqueTag } from './project';
import { beatsOf } from './kichBan';

/* ---------- Khuôn cố định (code ghép, không để AI chép lại) ---------- */

export const SHEET_TEMPLATE =
  'A professional character reference sheet, 4x2 grid layout, pure white background, high resolution. The subject is a single consistent character in all panels. Studio lighting, sharp focus, no text. Top Row: 1. Front view of the head. 2. Side profile of the head. 3. Back view of the head. 4. Top-down view of the head. Bottom Row: 1. Full-body front view. 2. Full-body side view. 3. Full-body back view. 4. Close-up of both hands and forearms. Character details:';
export const PROP_SUFFIX = 'no text, no letters, no logos, no engraving or writing on the surface';
export const LOCATION_SUFFIX = 'empty scene with no people, no text, no letters, no logos';

/** Nối các câu: bỏ dấu chấm cuối từng phần, nối bằng ". ", kết bằng dấu chấm. */
export function noiCau(...parts: string[]): string {
  const out = parts
    .map((p) => String(p || '').trim().replace(/[.\s]+$/, ''))
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  return out.length ? `${out.join('. ')}.` : '';
}

export const promptNhanVat = (bo: BoDo, style: string) => noiCau(bo.moTa, bo.khungAnh, style);
export const promptSheet = (bo: BoDo, style: string) => `${SHEET_TEMPLATE} ${noiCau(bo.moTa, style)}`;
export const promptDaoCu = (d: BibleDaoCu, style: string) => noiCau(d.moTa, d.khungAnh, style, PROP_SUFFIX);
export const promptBoiCanh = (b: BibleBoiCanh, v: BienTheBoiCanh, style: string, tiLe: string) => noiCau(b.moTa, v.khungAnh, style, `aspect ratio ${tiLe}`, LOCATION_SUFFIX);

/* ---------- Danh sách ảnh tham chiếu ---------- */

export type LoaiAnh = 'character' | 'prop' | 'location';

export interface MucAnh {
  tag: string;
  loai: LoaiAnh;
  /** Tên hiển thị tiếng Việt */
  ten: string;
  note: string;
  vaiTro: string;
  /** Các prompt ảnh đã ghép */
  prompts: { label: string; text: string }[];
  khongDung?: boolean;
}

export function mucAnh(b: BibleData, tiLe: string): MucAnh[] {
  return [
    ...b.nhanVat.flatMap((n) =>
      n.bo.map((bo) => ({
        tag: bo.tag,
        loai: 'character' as const,
        ten: `${n.ten}${n.bo.length > 1 ? ` — ${bo.ten}` : ''}`,
        note: bo.note,
        vaiTro: bo.vaiTro,
        prompts: [
          { label: 'prompt ảnh chính', text: promptNhanVat(bo, b.style) },
          { label: 'reference sheet', text: promptSheet(bo, b.style) },
        ],
        khongDung: n.khongDung || !n.canh.length,
      }))
    ),
    ...b.daoCu.map((d) => ({ tag: d.tag, loai: 'prop' as const, ten: d.moTaKichBan || d.tag, note: d.note, vaiTro: d.vaiTro, prompts: [{ label: 'prompt ảnh', text: promptDaoCu(d, b.style) }], khongDung: d.khongDung })),
    ...b.boiCanh.flatMap((c) =>
      c.bienThe.map((v) => ({
        tag: v.tag,
        loai: 'location' as const,
        ten: `${c.ten} — ${v.thoiDiem || 'không rõ thời điểm'}`,
        note: v.note,
        vaiTro: v.vaiTro,
        prompts: [{ label: 'prompt ảnh', text: promptBoiCanh(c, v, b.style, tiLe) }],
        khongDung: c.khongDung || v.khongDung,
      }))
    ),
  ];
}

/* ---------- Bóc tách từ kịch bản ---------- */

const norm = (s: string) =>
  String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const emptyBible = (): BibleData => ({ style: '', phuongAnStyle: [], nhanVat: [], daoCu: [], boiCanh: [], anhSang: [], anh: {} });

/** Mọi tag đang dùng trong bible (để đặt tag mới không trùng). */
export function tagsDaDung(b: BibleData): Set<string> {
  return new Set([
    ...b.nhanVat.flatMap((n) => [n.tag, ...n.bo.map((x) => x.tag)]),
    ...b.daoCu.map((d) => d.tag),
    ...b.boiCanh.flatMap((c) => [c.tag, ...c.bienThe.map((v) => v.tag)]),
  ]);
}

/** Khoá ánh sáng: cảnh cùng địa điểm + thời điểm + ánh sáng tiếng Việt thì dùng cùng một câu. */
export const khoaAnhSang = (a: Pick<AnhSangCanh, 'diaDiem' | 'thoiDiem' | 'goc'>) => `${a.diaDiem}|${norm(a.thoiDiem)}|${norm(a.goc)}`;

/**
 * Bóc tách bible từ kịch bản chốt. `old`: bible cũ — mục còn trong kịch bản giữ phần đã làm (mô tả, ảnh);
 * mục không còn dùng được giữ lại với cờ khongDung.
 */
export function bocTach(kb: KichBanData, chars: Character[], old: BibleData = emptyBible()): BibleData {
  const order = kb.danY.canh.map((c) => c.id);
  const sortCanh = (ids: Iterable<string>) => Array.from(new Set(ids)).filter((id) => order.includes(id)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const allBeats = kb.danY.canh.flatMap((c) => beatsOf(kb, c.id).map((b) => ({ canh: c.id, b })));

  /* --- Nhân vật --- */
  const nhanVat: BibleNhanVat[] = [];
  chars.forEach((ch) => {
    const canh = sortCanh([...kb.danY.canh.filter((c) => c.coMat.includes(ch.tag)).map((c) => c.id), ...allBeats.filter((x) => x.b.coMat.includes(ch.tag)).map((x) => x.canh)]);
    const coThoai = allBeats.some((x) => x.b.thoai.some((t) => t.ai === ch.tag));
    if (!canh.length && !coThoai) return;
    const prev = old.nhanVat.find((n) => n.tag === ch.tag);
    let bo: BoDo[] = (prev?.bo || []).map((x) => ({ ...x, canh: x.canh.filter((id) => canh.includes(id)) }));
    if (canh.length) {
      if (!bo.length) bo = [{ tag: ch.tag, ten: 'mặc định', canh: [], moTa: '', note: '', khungAnh: '', vaiTro: '' }];
      const covered = new Set(bo.flatMap((x) => x.canh));
      const missing = canh.filter((id) => !covered.has(id));
      // Cảnh mới chưa thuộc bộ nào → vào bộ mang tag nhân vật (hoặc bộ đầu)
      const k = Math.max(0, bo.findIndex((x) => x.tag === ch.tag));
      bo = bo.map((x, i) => (i === k ? { ...x, canh: sortCanh([...x.canh, ...missing]) } : x));
    }
    // Không còn xuất hiện trên hình (chỉ có giọng): bộ đồ cũ vẫn giữ (cảnh rỗng) để không mất phần đã làm
    nhanVat.push({ tag: ch.tag, ten: ch.ten, canh, coThoai, giong: prev?.giong || '', bo });
  });

  /* --- Đạo cụ --- */
  const daoCu: BibleDaoCu[] = [];
  allBeats.forEach(({ b }) =>
    b.daoCuMoi.forEach((d) => {
      if (!d.tag || daoCu.some((x) => x.tag === d.tag)) return;
      const prev = old.daoCu.find((x) => x.tag === d.tag);
      daoCu.push({ tag: d.tag, moTaKichBan: d.moTa, trangThai: [], canh: [], moTa: prev?.moTa || '', note: prev?.note || '', khungAnh: prev?.khungAnh || '', vaiTro: prev?.vaiTro || '' });
    })
  );
  daoCu.forEach((d) => {
    const states: string[] = [];
    const add = (s: string) => {
      if (s && !states.some((x) => norm(x) === norm(s))) states.push(s);
    };
    allBeats.forEach(({ b }) => b.thayDoi.filter((t) => t.tag === d.tag).forEach((t) => (add(t.truoc), add(t.sau))));
    d.trangThai = states;
    d.canh = sortCanh(allBeats.filter((x) => x.b.coMat.includes(d.tag) || x.b.daoCuMoi.some((y) => y.tag === d.tag)).map((x) => x.canh));
  });

  /* --- Bối cảnh (biến thể theo thời điểm) --- */
  const boiCanh: BibleBoiCanh[] = [];
  // Tag của mục mới (không được chiếm) và tag đã từng dùng / đã có ảnh (không cấp lại cho mục mới)
  const taken = new Set<string>([...chars.map((c) => c.tag), ...daoCu.map((d) => d.tag), ...kb.danY.canh.map((c) => c.tagDiaDiem).filter(Boolean)]);
  nhanVat.forEach((n) => n.bo.forEach((x) => taken.add(x.tag)));
  const reserved = new Set<string>([...tagsDaDung(old), ...Object.keys(old.anh)]);
  kb.danY.canh.forEach((c) => {
    if (!c.tagDiaDiem) return;
    let loc = boiCanh.find((x) => x.tag === c.tagDiaDiem);
    if (!loc) {
      loc = { tag: c.tagDiaDiem, ten: c.diaDiem, canh: [], moTa: old.boiCanh.find((x) => x.tag === c.tagDiaDiem)?.moTa || '', bienThe: [] };
      boiCanh.push(loc);
    }
    loc.canh.push(c.id);
    let v = loc.bienThe.find((x) => norm(x.thoiDiem) === norm(c.thoiDiem));
    if (!v) {
      v = { tag: '', thoiDiem: c.thoiDiem, canh: [], note: '', khungAnh: '', vaiTro: '' };
      loc.bienThe.push(v);
    }
    v.canh.push(c.id);
  });
  // Đặt tag biến thể: lượt 1 giữ tag cũ (cùng thời điểm), lượt 2 cấp tag cho biến thể mới
  boiCanh.forEach((loc) => {
    const prevLoc = old.boiCanh.find((x) => x.tag === loc.tag);
    const used = new Set<string>();
    loc.bienThe.forEach((v) => {
      const prev = prevLoc?.bienThe.find((x) => norm(x.thoiDiem) === norm(v.thoiDiem));
      if (prev?.tag && !used.has(prev.tag) && (prev.tag === loc.tag || !taken.has(prev.tag))) {
        Object.assign(v, { tag: prev.tag, note: prev.note, khungAnh: prev.khungAnh, vaiTro: prev.vaiTro });
        used.add(prev.tag);
        taken.add(prev.tag);
      }
    });
    // Biến thể cũ không còn (đổi thời điểm): giữ lại, đánh dấu — tag của nó không cấp cho biến thể mới
    (prevLoc?.bienThe || [])
      .filter((x) => !loc.bienThe.some((v) => v.tag === x.tag) && !used.has(x.tag))
      .forEach((x) => {
        loc.bienThe.push({ ...x, canh: [], khongDung: true });
        used.add(x.tag);
      });
    loc.bienThe.forEach((v) => {
      if (v.tag) return;
      const free = !used.has(loc.tag) && !old.anh[loc.tag]?.imageId;
      v.tag = free ? loc.tag : uniqueTag(`${loc.tag}${toTag(v.thoiDiem) || 'b'}`, new Set([...taken, ...used, ...reserved]));
      used.add(v.tag);
      taken.add(v.tag);
    });
  });

  /* --- Ánh sáng theo cảnh --- */
  const anhSang: AnhSangCanh[] = kb.danY.canh.map((c) => {
    const a = { canh: c.id, diaDiem: c.tagDiaDiem, thoiDiem: c.thoiDiem, goc: c.anhSang, moTa: '' };
    const prev = old.anhSang.find((x) => x.canh === c.id);
    return { ...a, moTa: prev && khoaAnhSang(prev) === khoaAnhSang(a) ? prev.moTa : '' };
  });

  /* --- Mục không còn dùng: giữ lại, đánh dấu --- */
  const gone = <T extends { tag: string }>(list: T[], now: T[]) => list.filter((x) => !now.some((y) => y.tag === x.tag)).map((x) => ({ ...x, khongDung: true }));

  return {
    style: old.style,
    phuongAnStyle: old.phuongAnStyle,
    nhanVat: [...nhanVat, ...gone(old.nhanVat, nhanVat)],
    daoCu: [...daoCu, ...gone(old.daoCu, daoCu)],
    boiCanh: [...boiCanh, ...gone(old.boiCanh, boiCanh)],
    anhSang,
    anh: old.anh,
  };
}

/** Ánh sáng: chép cùng một câu cho mọi cảnh cùng khoá (lấy câu đầu tiên không rỗng). */
export function dongBoAnhSang(list: AnhSangCanh[]): AnhSangCanh[] {
  const first = new Map<string, string>();
  list.forEach((a) => {
    if (a.moTa && !first.has(khoaAnhSang(a))) first.set(khoaAnhSang(a), a.moTa);
  });
  return list.map((a) => ({ ...a, moTa: first.get(khoaAnhSang(a)) || a.moTa }));
}
