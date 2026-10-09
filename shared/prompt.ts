// Màn ⑧ — Prompt video: ghép prompt 6 phần cho từng beat, frame nối, code kiểm (docs/QUYET-DINH.md mục 6, docs/LUOT-4.md).
// Code chép mọi phần cố định (ảnh + vai trò, style, bối cảnh, ánh sáng, mốc giây, câu máy, giọng, câu thoại nguyên văn);
// AI chỉ dịch phần tiếng Việt (tác vụ prompt-canh). Thuần, không thư viện ngoài — dùng chung cho server và giao diện.
// Ghi chú: code kiểm của màn ⑧ đặt ở đây (không ở checks.ts) để checks.ts không phải import ngược file này.
import type { Beat, BibleData, BoDo, Brief, CanhDanY, Character, DongTrangThai, KichBanData, PhanCanhCanh, PhanCanhData, PromptBeat, PromptData, Shot } from './project';
import { BEAT_MAX, BEAT_MIN, fmtGiay, toTag } from './project';
import { beatsOf, dauBeat, hash } from './kichBan';
import { cauMay, mocGiay } from './phanCanh';
import { noiCau } from './bible';
import { coTiengViet, normName, soTu } from './checks';
import type { CheckResult } from './checks';

/* ---------- Câu cố định ---------- */

export const FRAME_TAG = 'noitiep';
export const FRAME_CAU = `@${FRAME_TAG} is the final frame of the previous clip: start from this exact moment, with the same positions, outfits and lighting.`;
export const MOT_SHOT = 'Filmed in a single continuous shot with no scene cuts.';
export const KHONG_CHU = 'No subtitles, no captions, no on-screen text.';
export const nhieuShot = (n: number) => `Exactly ${n} shots, joined by hard cuts.`;

/** Khoảng số từ hợp lý của một prompt (ngoài khoảng chỉ cảnh báo). Mục tiêu 150–220 từ cho beat 2 shot. */
export const TU_MIN = 120;
export const TU_MAX = 320;
export const GIU_DUNG_MAX = 3;
export const GIU_DUNG_TU = 12;
export const HANH_DONG_TU = 45;

export const emptyPrompt = (): PromptData => ({ canh: {}, frame: {}, frameTheo: {}, daTao: {} });

/** Dữ liệu lưu từ bản trước có thể thiếu trường mới. */
export const docPrompt = (p?: Partial<PromptData>): PromptData => ({ ...emptyPrompt(), ...(p || {}) });

/** Dấu của một prompt đã ghép (để biết prompt có đổi sau khi tạo video / dán frame không). */
export const dauPrompt = (text: string) => (text ? hash(text) : '');

export const gocThoai = (t: { ai: string; cau: string }) => `${t.ai}|${t.cau}`;

/* ---------- Tiện ích chữ ---------- */

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** Bỏ khoảng trắng thừa, thêm dấu chấm cuối nếu chưa có. */
export function cham(s: string): string {
  const t = String(s || '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return /[.!?…"”]$/.test(t) ? t : `${t}.`;
}
const boCham = (s: string) => String(s || '').trim().replace(/[.\s]+$/, '');

/** Các @tag xuất hiện trong chữ. */
export function tagsTrong(text: string): string[] {
  const out: string[] = [];
  String(text || '').replace(/@([A-Za-z0-9]+)/g, (_m, t: string) => {
    const x = toTag(t);
    if (x && !out.includes(x)) out.push(x);
    return '';
  });
  return out;
}

/** Đổi @tag theo bảng (tag nhân vật → tag bộ đồ của cảnh). */
export const doiTag = (text: string, map: Map<string, string>) => String(text || '').replace(/@([A-Za-z0-9]+)/g, (_m, t: string) => `@${map.get(toTag(t)) || toTag(t)}`);

/** Ngôn ngữ thoại của brief → tên tiếng Anh. Không nhận ra thì bỏ trống (không ghi chữ tiếng Việt vào prompt). */
export function ngonNguEn(s: string): string {
  const w = ` ${normName(s)} `;
  const bang: [RegExp, string][] = [
    [/ (viet|vietnamese) /, 'Vietnamese'],
    [/ (anh|english) /, 'English'],
    [/ (nhat|japanese) /, 'Japanese'],
    [/ (han|korean) /, 'Korean'],
    [/ (trung|hoa|chinese|mandarin) /, 'Chinese'],
    [/ (phap|french) /, 'French'],
    [/ (thai) /, 'Thai'],
  ];
  return bang.find(([re]) => re.test(w))?.[1] || '';
}

/* ---------- Nguồn tiếng Việt của từng beat ---------- */

export interface NguonBeat {
  beat: Beat;
  shots: Shot[];
  /** Tag người / vật trong khung (gộp các shot, theo thứ tự) */
  khung: string[];
  /** Trạng thái đầu beat của những ai / vật có trong khung */
  dau: DongTrangThai[];
}

export function trongKhungBeat(shots: Shot[]): string[] {
  const out: string[] = [];
  shots.forEach((s) => s.trongKhung.forEach((t) => !out.includes(t) && out.push(t)));
  return out;
}

export function nguonCanh(kb: KichBanData, pcCanh: PhanCanhCanh | undefined, canhId: string): NguonBeat[] {
  const c = kb.danY.canh.find((x) => x.id === canhId);
  if (!c) return [];
  const beats = beatsOf(kb, canhId);
  return beats.map((b, i) => {
    const shots = pcCanh?.beats[b.id]?.shots || [];
    const khung = trongKhungBeat(shots);
    return { beat: b, shots, khung, dau: dauBeat(c, beats, i).filter((l) => khung.includes(l.tag)) };
  });
}

/** Dấu chữ tiếng Việt mà AI dịch. Đổi → cảnh "cần dịch lại". Phần code tự ghép (giây, máy, ảnh, bible) không nằm trong dấu. */
export function dauVaoPrompt(nguon: NguonBeat[], nhacNen: Brief['nhacNen']): string {
  return hash(
    JSON.stringify([
      nhacNen === 'khong',
      nguon.map((n) => [n.beat.id, n.dau, n.shots.map((s) => [s.id, s.moTa, s.trongKhung]), n.beat.amThanh, n.beat.thoai.map((t) => [t.ai, t.cachNoi])]),
    ])
  );
}

export type TinhTrangPrompt = 'chua-dich' | 'da-dich' | 'can-dich-lai';

export function tinhTrangPrompt(prompt: PromptData, kb: KichBanData, pc: PhanCanhData, canhId: string, nhacNen: Brief['nhacNen']): TinhTrangPrompt {
  const v = prompt.canh[canhId];
  if (!v || !Object.keys(v.beats).length) return 'chua-dich';
  return v.dauVao === dauVaoPrompt(nguonCanh(kb, pc.canh[canhId], canhId), nhacNen) ? 'da-dich' : 'can-dich-lai';
}

export const blankDich = (): PromptBeat => ({ lucBatDau: [], shots: {}, ambient: '', music: '', thoai: [], giuDung: [] });

/** Khớp phần dịch với nguồn hiện tại: giữ câu đã có theo mã shot / tag / vị trí thoại, thêm ô trống cho phần mới, bỏ phần không còn. */
export function khopDich(nguon: NguonBeat[], old: Record<string, PromptBeat> = {}): Record<string, PromptBeat> {
  const out: Record<string, PromptBeat> = {};
  nguon.forEach((n) => {
    const o = old[n.beat.id] || blankDich();
    const shots: Record<string, string> = {};
    n.shots.forEach((s) => (shots[s.id] = o.shots[s.id] || ''));
    out[n.beat.id] = {
      lucBatDau: n.dau.map((l) => ({ tag: l.tag, cau: o.lucBatDau.find((x) => x.tag === l.tag)?.cau || '' })),
      shots,
      ambient: o.ambient,
      music: o.music,
      // Thoại: khớp theo câu gốc; bản dịch cũ chưa ghi câu gốc thì khớp theo vị trí
      thoai: n.beat.thoai.map((t, k) => {
        const g = gocThoai(t);
        const cu = o.thoai.find((x) => x.goc === g) || (o.thoai[k] && !o.thoai[k].goc ? o.thoai[k] : undefined);
        return { cachNoi: cu?.cachNoi || '', nguoiNoi: cu?.nguoiNoi || '', goc: g };
      }),
      giuDung: o.giuDung.slice(0, GIU_DUNG_MAX),
    };
  });
  return out;
}

/* ---------- Tra bible ---------- */

/** Bộ đồ nhân vật mặc ở cảnh (mỗi cảnh đúng một bộ). */
export function boDoCua(bible: BibleData, charTag: string, canhId: string): BoDo | undefined {
  const n = bible.nhanVat.find((x) => x.tag === charTag);
  if (!n) return undefined;
  return n.bo.find((x) => x.canh.includes(canhId)) || n.bo.find((x) => x.tag === charTag) || n.bo[0];
}

export function boiCanhCua(bible: BibleData, canh: CanhDanY) {
  const loc = bible.boiCanh.find((x) => x.tag === canh.tagDiaDiem && !x.khongDung);
  const bt = loc?.bienThe.find((v) => v.canh.includes(canh.id) && !v.khongDung);
  return { loc, bt };
}

export const anhSangCua = (bible: BibleData, canhId: string) => bible.anhSang.find((a) => a.canh === canhId)?.moTa || '';

/** Phần ② Không gian: style + bối cảnh + ánh sáng của cảnh — giống từng chữ ở mọi beat cùng cảnh. */
export const khongGian = (bible: BibleData, canh: CanhDanY) => noiCau(bible.style, boiCanhCua(bible, canh).loc?.moTa || '', anhSangCua(bible, canh.id));

export interface AnhNap {
  /** Tag ảnh (bộ đồ, đạo cụ, bối cảnh, frame nối) */
  tag: string;
  /** Tag trong kịch bản (tag nhân vật / đạo cụ / địa điểm); rỗng với frame nối */
  nguon: string;
  loai: 'character' | 'prop' | 'location' | 'frame';
  vaiTro: string;
  imageId?: string;
  /** Tag không có trong bible */
  khongBible?: boolean;
}

/** Ảnh cần nạp cho một beat: người (bộ đồ của cảnh) và vật trong khung, ảnh bối cảnh của cảnh, frame nối nếu có. */
export function anhCanNap(bible: BibleData, canh: CanhDanY, khung: string[], frameId?: string): AnhNap[] {
  const nguoi: AnhNap[] = [];
  const vat: AnhNap[] = [];
  khung.forEach((t) => {
    const n = bible.nhanVat.find((x) => x.tag === t);
    if (n) {
      const bo = boDoCua(bible, t, canh.id);
      if (bo) nguoi.push({ tag: bo.tag, nguon: t, loai: 'character', vaiTro: bo.vaiTro, imageId: bible.anh[bo.tag]?.imageId });
      else nguoi.push({ tag: t, nguon: t, loai: 'character', vaiTro: '', khongBible: true });
      return;
    }
    const d = bible.daoCu.find((x) => x.tag === t);
    if (d) vat.push({ tag: t, nguon: t, loai: 'prop', vaiTro: d.vaiTro, imageId: bible.anh[t]?.imageId });
    else vat.push({ tag: t, nguon: t, loai: 'prop', vaiTro: '', khongBible: true });
  });
  const out = [...nguoi, ...vat];
  const { bt } = boiCanhCua(bible, canh);
  if (bt) out.push({ tag: bt.tag, nguon: canh.tagDiaDiem, loai: 'location', vaiTro: bt.vaiTro, imageId: bible.anh[bt.tag]?.imageId });
  if (frameId) out.push({ tag: FRAME_TAG, nguon: '', loai: 'frame', vaiTro: 'the final frame of the previous clip', imageId: frameId });
  return out;
}

/* ---------- Ghép prompt một beat ---------- */

export interface GhepCtx {
  brief: Pick<Brief, 'nhacNen' | 'thoai'>;
  nhanVat: Character[];
  kb: KichBanData;
  pc: PhanCanhData;
  bible: BibleData;
  prompt: PromptData;
}

export interface PromptKetQua {
  canhId: string;
  beatId: string;
  giay: number;
  soShot: number;
  /** Prompt hoàn chỉnh (rỗng khi beat chưa dịch) */
  text: string;
  /** Phần ② — để kiểm giống nhau trong cảnh */
  khongGian: string;
  anh: AnhNap[];
  soTu: number;
  chuaDich: boolean;
  /** Không phải beat đầu cảnh, mà beat trước chưa có frame cuối */
  chuaCoFrame: boolean;
  /** Mã beat trước trong cùng cảnh (nơi dán frame nối) */
  beatTruoc: string;
  errors: string[];
  warnings: string[];
}

// Cảnh báo câu hành động tả lại ánh sáng / ngoại hình / bối cảnh (đã có ở ② và ảnh tham chiếu). Hẹp để ít báo nhầm hành động thật.
const ANH_SANG_EN = /\b(lighting|sunlight|moonlight|lamplight|neon|glow(?:ing|s)?|(?:dim|soft|warm|cold|harsh|bright|golden|pale) (?:light|glow)|lit by|bathed in)\b/i;
const NGOAI_HINH_EN = /\b(wearing|dressed in|clad in)\b/i;
const BOI_CANH_EN = /\b(?:in|inside|at|across|of) (?:the|a|an|her|his|their|this) (?:[a-z-]+ ){0,3}(room|kitchen|bedroom|bathroom|apartment|flat|house|office|cafe|restaurant|market|street|alley|park|corridor|hallway|balcony|shop|store|classroom|hospital)\b/i;

export function ghepBeat(ctx: GhepCtx, canhId: string, beatId: string): PromptKetQua {
  const canh = ctx.kb.danY.canh.find((c) => c.id === canhId);
  const nguon = canh ? nguonCanh(ctx.kb, ctx.pc.canh[canhId], canhId) : [];
  const i = nguon.findIndex((n) => n.beat.id === beatId);
  const kg = canh ? khongGian(ctx.bible, canh) : '';
  const base = { canhId, beatId, khongGian: kg, beatTruoc: i > 0 ? nguon[i - 1].beat.id : '' };
  if (!canh || i < 0) return { ...base, giay: 0, soShot: 0, text: '', anh: [], soTu: 0, chuaDich: true, chuaCoFrame: false, errors: ['Không tìm thấy beat trong kịch bản.'], warnings: [] };

  const { beat: b, shots, khung, dau } = nguon[i];
  const errors: string[] = [];
  const warnings: string[] = [];
  const frameId = i > 0 ? ctx.prompt.frame[nguon[i - 1].beat.id] : undefined;
  const anh = anhCanNap(ctx.bible, canh, khung, frameId);
  const map = new Map(anh.filter((a) => a.nguon && a.loai !== 'location').map((a) => [a.nguon, a.tag]));
  const dich = ctx.prompt.canh[canhId]?.beats[b.id];

  // Kiểm phần không cần bản dịch
  if (!shots.length) errors.push('Beat chưa có shot ở màn 7.');
  const sum = shots.reduce((s, x) => s + (Number.isFinite(x.giay) ? x.giay : 0), 0);
  if (shots.length && Math.abs(sum - b.giay) > 0.001) errors.push(`Tổng giây các shot là ${sum}s, beat dài ${b.giay}s — sửa ở màn 7.`);
  if (!(b.giay >= BEAT_MIN && b.giay <= BEAT_MAX)) errors.push(`Beat dài ${fmtGiay(b.giay)} — mỗi lần tạo video ${BEAT_MIN}–${BEAT_MAX} giây.`);
  anh.forEach((a) => {
    if (a.khongBible) warnings.push(`@${a.nguon} chưa có trong bible (màn 6) nên chưa có ảnh và vai trò.`);
    else if (a.loai !== 'frame' && !a.imageId) warnings.push(`Chưa có ảnh @${a.tag} ở màn 6.`);
    if (a.loai !== 'frame' && !a.khongBible && !a.vaiTro.trim()) warnings.push(`Ảnh @${a.tag} chưa có vai trò (màn 6).`);
  });
  if (!anh.some((a) => a.loai === 'location')) warnings.push('Cảnh chưa có ảnh bối cảnh trong bible (màn 6).');

  const chuaCoFrame = i > 0 && !frameId;
  const bt = anh.find((a) => a.loai === 'location')?.tag || '';
  const ket = (text: string): PromptKetQua => ({ ...base, giay: b.giay, soShot: shots.length, text, anh, soTu: soTu(text), chuaDich: !dich, chuaCoFrame, errors, warnings });
  if (!dich) {
    errors.push('Beat chưa dịch.');
    return ket('');
  }
  if (!shots.length) return ket('');

  /* ① Ảnh tham chiếu */
  const ds = anh.filter((a) => a.loai !== 'frame').map((a) => `@${a.tag}${a.vaiTro.trim() ? ` as ${boCham(a.vaiTro)}` : ''}`);
  const p1 = [ds.length ? `Using the provided images: ${ds.join(', ')}.` : '', frameId ? FRAME_CAU : ''].filter(Boolean).join(' ');

  /* ③ Lúc bắt đầu */
  const batDau = dau.map((l) => {
    const cau = dich.lucBatDau.find((x) => x.tag === l.tag)?.cau || '';
    if (!cau.trim()) errors.push(`Chưa có câu "lúc bắt đầu" cho @${l.tag}.`);
    return cham(doiTag(cau, map));
  });
  const p3 = batDau.filter(Boolean).length ? `At the start: ${batDau.filter(Boolean).join(' ')}` : '';

  /* ④ Các shot */
  const moc = mocGiay(shots);
  const hanhDong = shots.map((s, k) => {
    const cau = dich.shots[s.id] || '';
    if (!cau.trim()) errors.push(`Shot ${k + 1} chưa có câu hành động.`);
    if (ANH_SANG_EN.test(cau)) warnings.push(`Shot ${k + 1}: câu hành động nhắc ánh sáng ("${ANH_SANG_EN.exec(cau)![0]}") — ánh sáng đã có ở phần không gian.`);
    if (NGOAI_HINH_EN.test(cau)) warnings.push(`Shot ${k + 1}: câu hành động tả ngoại hình / trang phục ("${NGOAI_HINH_EN.exec(cau)![0]}") — ảnh tham chiếu đã lo phần này.`);
    if (BOI_CANH_EN.test(cau) || (bt && cau.toLowerCase().includes(`@${bt.toLowerCase()}`))) warnings.push(`Shot ${k + 1}: câu hành động tả lại bối cảnh ("${BOI_CANH_EN.exec(cau)?.[0] || `@${bt}`}") — bối cảnh đã có ở phần không gian.`);
    tagsTrong(cau)
      .filter((t) => khung.includes(t) && !s.trongKhung.includes(t))
      .forEach((t) => warnings.push(`Shot ${k + 1}: nhắc @${t} nhưng @${t} không ở trong khung shot này.`));
    const may = cap(cauMay(s));
    return `${moc[k]} ${may ? `${may}. ` : ''}${cham(doiTag(cau, map))}`.trim();
  });
  const p4 = hanhDong.join(' Hard cut to ');

  /* ⑤ Âm thanh */
  const am: string[] = [];
  if (dich.ambient.trim()) am.push(`Ambient: ${cham(doiTag(dich.ambient, map))}`);
  am.push(ctx.brief.nhacNen === 'khong' || !dich.music.trim() ? 'Music: none.' : `Music: ${cham(doiTag(dich.music, map))}`);
  const lang = ngonNguEn(ctx.brief.thoai.ngonNgu);
  b.thoai.forEach((t, k) => {
    const si = shots.findIndex((s) => s.thoai.includes(k));
    const d = dich.thoai[k] || { cachNoi: '', nguoiNoi: '' };
    const loaded = map.get(t.ai);
    const isChar = ctx.nhanVat.some((c) => c.tag === t.ai);
    const nguoi = loaded ? `@${loaded}` : boCham(doiTag(d.nguoiNoi, map));
    if (!nguoi) errors.push(`Câu thoại ${k + 1}: chưa có tên người nói (tiếng Anh).`);
    const giong = isChar ? boCham(ctx.bible.nhanVat.find((x) => x.tag === t.ai)?.giong || '') : '';
    const how = boCham(d.cachNoi);
    am.push(`Dialogue${si >= 0 ? ` ${moc[si]}` : ''}: ${nguoi || t.ai}${giong ? ` (${giong})` : ''} says${how ? ` ${how}` : ''}${lang ? ` in ${lang}` : ''}: "${t.cau.replace(/"/g, "'")}"`);
  });
  const p5 = am.join(' ');

  /* ⑥ Giữ đúng */
  if (!dich.giuDung.filter((x) => x.trim()).length) warnings.push('Chưa có điều riêng cần giữ đúng của beat.');
  const p6 = [shots.length === 1 ? MOT_SHOT : nhieuShot(shots.length), ...dich.giuDung.filter((x) => x.trim()).map((x) => cham(doiTag(x, map))), KHONG_CHU].join(' ');

  const text = [p1, kg, p3, p4, p5, p6].filter(Boolean).join('\n\n');

  /* Kiểm cả prompt */
  const body = [kg, p3, p4, p5, p6].join('\n');
  const coAnh = new Set(anh.map((a) => a.tag));
  tagsTrong(body)
    .filter((t) => !coAnh.has(t))
    .forEach((t) => errors.push(`@${t} có trong prompt nhưng không có trong danh sách ảnh nạp.`));
  anh
    .filter((a) => (a.loai === 'character' || a.loai === 'prop') && !tagsTrong(body).includes(a.tag))
    .forEach((a) => warnings.push(`Ảnh @${a.tag} được nạp nhưng không được nhắc trong lúc bắt đầu, các shot hay thoại.`));
  const khongNgoac = text.replace(/"[^"]*"/g, '');
  if (coTiengViet(khongNgoac)) errors.push('Phần tiếng Anh còn chữ tiếng Việt có dấu (ngoài câu thoại).');
  const n = soTu(text);
  if (n < TU_MIN || n > TU_MAX) warnings.push(`Prompt dài ${n} từ — nên khoảng ${TU_MIN}–${TU_MAX} từ (mục tiêu 150–220 cho beat 2 shot).`);

  return ket(text);
}

/** Ghép mọi beat của một cảnh; kiểm phần ② giống từng chữ ở mọi beat. */
export function ghepCanh(ctx: GhepCtx, canhId: string): PromptKetQua[] {
  const list = beatsOf(ctx.kb, canhId).map((b) => ghepBeat(ctx, canhId, b.id));
  const kg = list[0]?.khongGian;
  list.forEach((r) => {
    if (r.khongGian !== kg) r.errors.push('Phần không gian khác các beat khác cùng cảnh.');
  });
  return list;
}

/* ---------- Kiểm phần AI dịch (tác vụ prompt-canh) ---------- */

/** Kiểm bản dịch của một cảnh. errors → gửi lại AI; warnings → chỉ báo. */
export function checkPromptDich(nguon: NguonBeat[], dich: Record<string, PromptBeat>): CheckResult & { theoBeat: Record<string, CheckResult> } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const theoBeat: Record<string, CheckResult> = {};
  nguon.forEach((n, i) => {
    const e: string[] = [];
    const w: string[] = [];
    const d = dich[n.beat.id];
    if (!d) e.push('Thiếu bản dịch của beat này.');
    else {
      const en = (label: string, text: string) => {
        if (coTiengViet(text)) e.push(`${label} phải viết tiếng Anh (đang có chữ tiếng Việt có dấu).`);
        tagsTrong(text)
          .filter((t) => !n.khung.includes(t))
          .forEach((t) => e.push(`${label}: @${t} không có trong khung beat này — chỉ dùng ${n.khung.map((x) => `@${x}`).join(', ') || '(không tag nào)'}.`));
      };
      n.dau.forEach((l) => {
        const c = d.lucBatDau.find((x) => x.tag === l.tag)?.cau || '';
        if (!c.trim()) e.push(`Thiếu câu "lúc bắt đầu" cho @${l.tag}.`);
        else en(`Lúc bắt đầu (@${l.tag})`, c);
      });
      n.shots.forEach((s, k) => {
        const c = d.shots[s.id] || '';
        if (!c.trim()) e.push(`Shot ${k + 1} (${s.id}) chưa có câu hành động.`);
        else {
          en(`Shot ${k + 1}`, c);
          if (soTu(c) > HANH_DONG_TU) w.push(`Shot ${k + 1}: câu hành động dài ${soTu(c)} từ — nên gọn dưới ${HANH_DONG_TU} từ.`);
          if (ANH_SANG_EN.test(c)) w.push(`Shot ${k + 1}: câu hành động nhắc ánh sáng.`);
          if (NGOAI_HINH_EN.test(c)) w.push(`Shot ${k + 1}: câu hành động tả ngoại hình / trang phục.`);
          if (BOI_CANH_EN.test(c)) w.push(`Shot ${k + 1}: câu hành động tả lại bối cảnh ("${BOI_CANH_EN.exec(c)![0]}").`);
        }
      });
      en('Âm thanh môi trường', d.ambient);
      en('Nhạc', d.music);
      n.beat.thoai.forEach((_, k) => {
        const t = d.thoai[k];
        if (!t || !t.nguoiNoi.trim()) e.push(`Câu thoại ${k + 1}: thiếu người nói (tiếng Anh).`);
        else en(`Người nói câu ${k + 1}`, t.nguoiNoi);
        if (t) en(`Cách nói câu ${k + 1}`, t.cachNoi);
      });
      const g = d.giuDung.filter((x) => x.trim());
      if (!g.length) e.push('Thiếu điều cần giữ đúng (2–3 điều riêng của beat).');
      g.forEach((x, k) => {
        en(`Điều giữ đúng ${k + 1}`, x);
        if (soTu(x) > GIU_DUNG_TU) w.push(`Điều giữ đúng ${k + 1} dài ${soTu(x)} từ — nên tối đa ${GIU_DUNG_TU} từ.`);
      });
    }
    theoBeat[n.beat.id] = { errors: e, warnings: w };
    errors.push(...e.map((x) => `Beat ${i + 1} (${n.beat.id}): ${x}`));
    warnings.push(...w.map((x) => `Beat ${i + 1} (${n.beat.id}): ${x}`));
  });
  return { errors, warnings, theoBeat };
}
