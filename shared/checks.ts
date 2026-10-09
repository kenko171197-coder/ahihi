// Code kiểm dùng chung: server kiểm kết quả AI, giao diện kiểm bản người dùng sửa tay. Thuần, không thư viện ngoài.
import type { PhanCanhCanh, PhanCanhData, AnhSangCanh, BibleBoiCanh, BibleData, BibleDaoCu, BibleNhanVat, Beat, CanhDanY, Character, DanY, DaoCu, DongTrangThai, KichBanData, MucThoai, NhacNen, RaSoatData, TreatmentData } from './project';
import { BEAT_MAX, BEAT_MIN, PHAN_DOAN_TU_GIAY, fmtGiay, maxNhanVat } from './project';
import { beatsOf, daoCuTruoc, tinhTrangCanh, tongGiayBeat, viTriCanh } from './kichBan';
import { bocTach } from './bible';
import { CO_CANH, GOC_MAY, CHUYEN_DONG, tinhTrangPhanCanh } from './phanCanh';

export interface CheckResult {
  errors: string[];
  warnings: string[];
}

/** Chuẩn hoá tên để so sánh: bỏ dấu, chữ thường, chỉ giữ chữ và số. */
export const normName = (s: string) =>
  String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Kiểm các khoảng giây nối liền nhau từ `from` tới `to`. */
export function checkSpans(spans: { batDau: number; ketThuc: number }[], from: number, to: number, label: (i: number) => string): string[] {
  const errors: string[] = [];
  if (!spans.length) return errors;
  if (spans[0].batDau !== from) errors.push(`${label(0)} phải bắt đầu ở ${fmtGiay(from)} (đang là ${fmtGiay(spans[0].batDau)}).`);
  spans.forEach((s, i) => {
    if (!Number.isFinite(s.batDau) || !Number.isFinite(s.ketThuc)) errors.push(`${label(i)} thiếu số giây.`);
    else if (s.ketThuc <= s.batDau) errors.push(`${label(i)} kết thúc phải sau khi bắt đầu.`);
    if (i > 0 && s.batDau !== spans[i - 1].ketThuc) {
      errors.push(`${label(i)} phải bắt đầu đúng lúc ${label(i - 1).toLowerCase()} kết thúc (${fmtGiay(spans[i - 1].ketThuc)}), không chồng, không hở.`);
    }
  });
  const last = spans[spans.length - 1];
  if (last.ketThuc !== to) errors.push(`${label(spans.length - 1)} phải kết thúc ở ${fmtGiay(to)} (đang là ${fmtGiay(last.ketThuc)}).`);
  return errors;
}

/** Kiểm treatment: giây nối liền và đủ tổng, đúng các phần của thể loại, phân đoạn, bảng Cài – Dùng. */
export function checkTreatment(t: TreatmentData, total: number, requiredParts: string[]): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!t.phan.length) errors.push('Chưa có phần nào.');
  errors.push(...checkSpans(t.phan, 0, total, (i) => `Phần ${i + 1}`));

  if (requiredParts.length) {
    if (t.phan.length !== requiredParts.length) {
      errors.push(`Thể loại này cần đúng ${requiredParts.length} phần theo thứ tự: ${requiredParts.join(' → ')}.`);
    } else {
      t.phan.forEach((p, i) => {
        if (!normName(p.ten).includes(normName(requiredParts[i]))) errors.push(`Phần ${i + 1} phải là "${requiredParts[i]}" (đang là "${p.ten}").`);
      });
    }
  }

  const needSeq = total >= PHAN_DOAN_TU_GIAY;
  t.phan.forEach((p, i) => {
    if (!p.tomTat) errors.push(`Phần ${i + 1} chưa có tóm tắt.`);
    if (needSeq) {
      if (p.phanDoan.length < 2) errors.push(`Phim từ ${fmtGiay(PHAN_DOAN_TU_GIAY)} trở lên: phần ${i + 1} cần ít nhất 2 phân đoạn.`);
      else errors.push(...checkSpans(p.phanDoan, p.batDau, p.ketThuc, (j) => `Phân đoạn ${i + 1}.${j + 1}`));
      p.phanDoan.forEach((s, j) => {
        if (!s.tomTat) errors.push(`Phân đoạn ${i + 1}.${j + 1} chưa có tóm tắt.`);
      });
    }
  });

  const index = new Map(t.phan.map((p, i) => [p.id, i]));
  if (!t.caiDung.length) warnings.push('Chưa có chi tiết nào trong bảng Cài – Dùng.');
  t.caiDung.forEach((c, k) => {
    const a = index.get(c.cai);
    const b = index.get(c.dung);
    if (!c.chiTiet) errors.push(`Dòng Cài – Dùng ${k + 1} chưa ghi chi tiết.`);
    if (a === undefined || b === undefined) errors.push(`Dòng Cài – Dùng ${k + 1}${c.chiTiet ? ` ("${c.chiTiet}")` : ''} phải chỉ rõ phần cài và phần dùng.`);
    else if (a > b) errors.push(`"${c.chiTiet}": phần cài (${a + 1}) phải đứng trước hoặc trùng phần dùng (${b + 1}).`);
  });
  return { errors, warnings };
}

/** Kiểm danh sách nhân vật. */
export function checkCharacters(list: Character[], totalGiay: number): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!list.length) errors.push('Chưa có nhân vật nào.');
  if (list.length && !list.some((c) => c.vai === 'chinh')) errors.push('Cần ít nhất một nhân vật chính.');
  const seen = new Set<string>();
  list.forEach((c, i) => {
    const name = c.ten || `Nhân vật ${i + 1}`;
    if (!c.ten) errors.push(`Nhân vật ${i + 1} chưa có tên.`);
    if (!c.tag) errors.push(`${name} chưa có tag.`);
    else if (c.tag.length > 15 || !/^[a-z0-9]+$/.test(c.tag)) errors.push(`Tag @${c.tag} phải viết liền, không dấu, chữ thường, tối đa 15 ký tự.`);
    else if (seen.has(c.tag)) errors.push(`Tag @${c.tag} bị trùng.`);
    seen.add(c.tag);
    if (c.vai !== 'gian-tiep') {
      const missing = [!c.muon && 'muốn', !c.tinhCach && 'tính cách', !c.chiTiet && 'chi tiết riêng'].filter(Boolean);
      if (missing.length) errors.push(`${name} còn thiếu: ${missing.join(', ')}.`);
    }
  });
  const max = maxNhanVat(totalGiay);
  if (list.length > max) warnings.push(`${list.length} nhân vật là nhiều so với phim ${fmtGiay(totalGiay)} (nên tối đa ${max}).`);
  return { errors, warnings };
}

/** Đếm câu: dấu . ! ? (không tính dấu ba chấm "..." hay "…") theo sau là khoảng trắng hoặc hết chuỗi. */
export function sentenceCount(text: string): number {
  const t = String(text || '').trim();
  if (!t) return 0;
  const ends = t.match(/(?:[!?]+|(?<!\.)\.(?!\.))(?=\s|$)/g) || [];
  return Math.max(1, ends.length + (/(?:[!?]|(?<!\.)\.(?!\.))\s*$/.test(t) ? 0 : 1));
}

/* ============================ MÀN ④ — KỊCH BẢN ============================ */

const TAG_RE = /^[a-z0-9]{1,15}$/;
const tagErr = (t: string) => `Tag @${t} phải viết liền, không dấu, chữ thường, tối đa 15 ký tự.`;

/** Các tag có ở cả hai bên mà mô tả khác nhau; `all` = tính cả tag chỉ có ở bên a. */
export function diffTrangThai(a: DongTrangThai[], b: DongTrangThai[], all = false): string[] {
  const mb = new Map(b.map((l) => [l.tag, normName(l.moTa)]));
  return a.filter((l) => (mb.has(l.tag) ? mb.get(l.tag) !== normName(l.moTa) : all)).map((l) => `@${l.tag}`);
}

export interface DanYCtx {
  total: number;
  treatment: TreatmentData;
  nhanVat: Character[];
}

/** Kiểm dàn ý cảnh. */
export function checkDanY(d: DanY, ctx: DanYCtx): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!d.canh.length) errors.push('Chưa có cảnh nào.');
  errors.push(...checkSpans(d.canh, 0, ctx.total, (i) => `Cảnh ${i + 1}`));
  const chars = new Map(ctx.nhanVat.map((c) => [c.tag, c]));
  const parts = new Map(ctx.treatment.phan.map((p, i) => [p.id, i]));
  const tagOfName = new Map<string, string>();
  const nameOfTag = new Map<string, string>();

  d.canh.forEach((c, i) => {
    const L = `Cảnh ${i + 1}`;
    const len = c.ketThuc - c.batDau;
    if (Number.isFinite(len) && len > 0 && len < BEAT_MIN) errors.push(`${L} chỉ dài ${len}s — mỗi cảnh ít nhất ${BEAT_MIN} giây (một beat).`);
    if (!parts.has(c.phan)) errors.push(`${L} chưa chọn thuộc phần nào của treatment.`);
    if (!c.diaDiem) errors.push(`${L} chưa có địa điểm.`);
    if (!c.tagDiaDiem) errors.push(`${L} chưa có tag địa điểm.`);
    else if (!TAG_RE.test(c.tagDiaDiem)) errors.push(`${L}: ${tagErr(c.tagDiaDiem)}`);
    else if (chars.has(c.tagDiaDiem)) errors.push(`${L}: tag địa điểm @${c.tagDiaDiem} trùng tag nhân vật.`);
    const n = normName(c.diaDiem);
    if (n && c.tagDiaDiem) {
      const t = tagOfName.get(n);
      const nm = nameOfTag.get(c.tagDiaDiem);
      if (t && t !== c.tagDiaDiem) errors.push(`"${c.diaDiem}" có hai tag @${t} và @${c.tagDiaDiem} — cùng địa điểm phải cùng tag.`);
      else if (nm && nm !== n) errors.push(`Tag @${c.tagDiaDiem} đang dùng cho hai địa điểm khác tên — cùng nơi thì ghi cùng tên, khác nơi thì đổi tag (${L}).`);
      if (!t) tagOfName.set(n, c.tagDiaDiem);
      if (!nm) nameOfTag.set(c.tagDiaDiem, n);
    }
    if (!c.chuyenBien) errors.push(`${L} chưa ghi chuyển biến (đầu cảnh → cuối cảnh).`);
    if (!c.dauCanh.length) errors.push(`${L} chưa có trạng thái đầu cảnh.`);
    if (!c.cuoiCanh.length) errors.push(`${L} chưa có trạng thái cuối cảnh.`);
    [...c.dauCanh, ...c.cuoiCanh].forEach((l) => {
      if (!TAG_RE.test(l.tag)) errors.push(`${L}: ${tagErr(l.tag)}`);
    });
    c.coMat.forEach((t) => {
      const ch = chars.get(t);
      if (!ch) errors.push(`${L}: @${t} không có ở màn 2. Người không có ở màn 2 chỉ xuất hiện trong câu tả hành động, không ghi vào "có mặt".`);
      else if (ch.vai === 'gian-tiep') warnings.push(`${L}: ${ch.ten} (@${t}) là nhân vật gián tiếp mà lại có mặt trong cảnh.`);
    });
    if (i > 0) {
      const prev = d.canh[i - 1];
      if (prev.tagDiaDiem && prev.tagDiaDiem === c.tagDiaDiem) {
        const diff = diffTrangThai(c.dauCanh, prev.cuoiCanh);
        if (diff.length) warnings.push(`${L} cùng địa điểm với cảnh ${i}, nhưng trạng thái đầu cảnh khác cuối cảnh trước: ${diff.join(', ')}.`);
      }
    }
  });

  const idx = new Map(d.canh.map((c, i) => [c.id, i]));
  ctx.treatment.caiDung.forEach((row) => {
    const r = d.caiDung.find((x) => x.id === row.id);
    const a = r ? idx.get(r.cai) : undefined;
    const b = r ? idx.get(r.dung) : undefined;
    const name = row.chiTiet || row.id;
    if (a === undefined || b === undefined) {
      errors.push(`Cài – Dùng "${name}" chưa chọn đủ cảnh cài và cảnh dùng.`);
      return;
    }
    if (a > b) errors.push(`"${name}": cảnh cài (${a + 1}) phải đứng trước hoặc trùng cảnh dùng (${b + 1}).`);
    if (row.cai && parts.has(row.cai) && d.canh[a].phan !== row.cai) warnings.push(`"${name}": treatment cài ở phần ${(parts.get(row.cai) ?? 0) + 1}, dàn ý lại cài ở cảnh ${a + 1} thuộc phần khác.`);
    if (row.dung && parts.has(row.dung) && d.canh[b].phan !== row.dung) warnings.push(`"${name}": treatment dùng ở phần ${(parts.get(row.dung) ?? 0) + 1}, dàn ý lại dùng ở cảnh ${b + 1} thuộc phần khác.`);
  });
  return { errors, warnings };
}

export interface CanhCtx {
  canh: CanhDanY;
  /** Các dòng Cài – Dùng đặt ở cảnh này */
  caiDung: { id: string; chiTiet: string; vai: string }[];
  nhanVat: Character[];
  /** Đạo cụ đã khai ở các cảnh trước */
  daoCuTruoc: DaoCu[];
  /** Mọi tag địa điểm của dàn ý */
  tagDiaDiem: string[];
  mucThoai: MucThoai;
  nhacNen: NhacNen;
  /** Khoảng giây thể loại khuyên cho mỗi beat (chỉ cảnh báo) */
  beatGiay?: [number, number] | null;
}

/** Ngữ cảnh kiểm một cảnh, lấy từ dàn ý + kịch bản. */
export function canhCtx(
  danY: DanY,
  id: string,
  base: { treatment: TreatmentData; nhanVat: Character[]; daoCuTruoc: DaoCu[]; mucThoai: MucThoai; nhacNen: NhacNen; beatGiay?: [number, number] | null }
): CanhCtx | null {
  const canh = danY.canh.find((c) => c.id === id);
  if (!canh) return null;
  const caiDung = danY.caiDung
    .filter((x) => x.cai === id || x.dung === id)
    .map((x) => ({
      id: x.id,
      chiTiet: base.treatment.caiDung.find((r) => r.id === x.id)?.chiTiet || x.id,
      vai: x.cai === id && x.dung === id ? 'cài và dùng' : x.cai === id ? 'cài' : 'dùng',
    }));
  return { canh, caiDung, nhanVat: base.nhanVat, daoCuTruoc: base.daoCuTruoc, tagDiaDiem: danY.canh.map((c) => c.tagDiaDiem).filter(Boolean), mucThoai: base.mucThoai, nhacNen: base.nhacNen, beatGiay: base.beatGiay };
}

/** Số chữ (tiếng): đếm theo khoảng trắng. */
const soChu = (s: string) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
/** Người nói tự nhiên khoảng 3 chữ mỗi giây. */
export const CHU_MOI_GIAY = 3;

/** Kiểm các beat của một cảnh. */
export function checkCanh(beats: Beat[], ctx: CanhCtx): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const c = ctx.canh;
  if (!beats.length) errors.push('Cảnh chưa có beat nào.');
  const len = c.ketThuc - c.batDau;
  const sum = tongGiayBeat(beats);
  if (beats.length && Number.isFinite(len) && sum !== len) errors.push(`Tổng giây các beat là ${sum}s, cảnh dài ${len}s — phải bằng nhau.`);

  const chars = new Map(ctx.nhanVat.map((x) => [x.tag, x]));
  const locs = new Set(ctx.tagDiaDiem);
  const props = new Set(ctx.daoCuTruoc.map((d) => d.tag));
  const known = (t: string) => chars.has(t) || props.has(t);

  beats.forEach((b, i) => {
    const L = `Beat ${i + 1} (${b.id})`;
    if (!Number.isFinite(b.giay) || b.giay < BEAT_MIN || b.giay > BEAT_MAX) errors.push(`${L} dài ${Number.isFinite(b.giay) ? `${b.giay}s` : '—'} — mỗi beat ${BEAT_MIN}–${BEAT_MAX} giây (một lần tạo video).`);
    else if (ctx.beatGiay && (b.giay < ctx.beatGiay[0] || b.giay > ctx.beatGiay[1])) warnings.push(`${L} dài ${b.giay}s — thể loại khuyên ${ctx.beatGiay[0]}–${ctx.beatGiay[1]} giây.`);
    if (!b.hanhDong) errors.push(`${L} chưa có hành động.`);

    b.daoCuMoi.forEach((d) => {
      if (!TAG_RE.test(d.tag)) errors.push(`${L}: ${tagErr(d.tag)}`);
      else if (chars.has(d.tag)) errors.push(`${L}: đạo cụ @${d.tag} trùng tag nhân vật.`);
      else if (locs.has(d.tag)) errors.push(`${L}: đạo cụ @${d.tag} trùng tag địa điểm.`);
      else if (props.has(d.tag)) errors.push(`${L}: đạo cụ @${d.tag} đã có (khai ở cảnh hoặc beat trước) — không khai lại, chỉ ghi vào "có mặt".`);
      if (!d.moTa) errors.push(`${L}: đạo cụ @${d.tag} chưa có mô tả.`);
      props.add(d.tag);
    });

    const need = (t: string, where: string) => {
      if (!known(t)) errors.push(`${L}: @${t} (${where}) không phải nhân vật ở màn 2 hay đạo cụ đã khai.`);
    };
    b.coMat.forEach((t) => {
      need(t, 'có mặt');
      const ch = chars.get(t);
      if (ch?.vai === 'gian-tiep') warnings.push(`${L}: ${ch.ten} (@${t}) là nhân vật gián tiếp mà lại có mặt.`);
    });
    b.thayDoi.forEach((x) => need(x.tag, 'thay đổi trạng thái'));
    b.cuoiBeat.forEach((x) => need(x.tag, 'trạng thái cuối'));
    const endTags = new Set(b.cuoiBeat.map((x) => x.tag));
    const missing = b.coMat.filter((t) => !endTags.has(t));
    if (missing.length) warnings.push(`${L}: ${missing.map((t) => `@${t}`).join(', ')} có mặt nhưng chưa có dòng trạng thái cuối beat.`);

    if (ctx.mucThoai === 'khong' && b.thoai.length) errors.push(`${L} có thoại, nhưng brief chọn "không thoại".`);
    b.thoai.forEach((t) => {
      if (!t.cau) errors.push(`${L}: có câu thoại để trống.`);
      if (t.ai && !chars.has(t.ai)) warnings.push(`${L}: "${t.ai}" nói thoại nhưng không có ở màn 2 — nên thêm vào màn 2 nếu cần giọng riêng.`);
      if (!t.ai) errors.push(`${L}: câu thoại chưa ghi ai nói.`);
    });
    const words = b.thoai.reduce((s, t) => s + soChu(t.cau), 0);
    if (Number.isFinite(b.giay) && b.giay > 0 && words > CHU_MOI_GIAY * b.giay) warnings.push(`${L}: thoại ${words} chữ, nói không kịp trong ${b.giay}s (nên tối đa khoảng ${CHU_MOI_GIAY * b.giay} chữ).`);
    if (ctx.nhacNen === 'khong' && /nhạc/i.test(b.amThanh)) warnings.push(`${L}: ô âm thanh có nhạc, nhưng brief chọn "không nhạc nền".`);
    b.caiDung.forEach((id) => {
      if (!ctx.caiDung.some((x) => x.id === id)) warnings.push(`${L} ghi chi tiết Cài – Dùng ${id}, nhưng dàn ý không đặt chi tiết này ở cảnh này.`);
    });
  });

  ctx.caiDung.forEach((cd) => {
    if (!beats.some((b) => b.caiDung.includes(cd.id))) errors.push(`Chưa có beat nào thể hiện chi tiết Cài – Dùng "${cd.chiTiet}" (${cd.vai} ở cảnh này).`);
  });

  if (beats.length) {
    const undeclared = Array.from(new Set([...c.dauCanh, ...c.cuoiCanh].map((l) => l.tag))).filter((t) => !known(t));
    if (undeclared.length) warnings.push(`Trạng thái trong dàn ý có ${undeclared.map((t) => `@${t}`).join(', ')}, nhưng không phải nhân vật và chưa beat nào khai đạo cụ này.`);
    const diff = diffTrangThai(c.cuoiCanh, beats[beats.length - 1].cuoiBeat, true);
    if (diff.length) warnings.push(`Trạng thái cuối beat cuối khác trạng thái cuối cảnh trong dàn ý: ${diff.join(', ')}.`);
  }
  return { errors, warnings };
}

export interface KichBanCtx extends DanYCtx {
  mucThoai: MucThoai;
  nhacNen: NhacNen;
  beatGiay?: [number, number] | null;
}

/** Kiểm cả kịch bản (điều kiện duyệt màn ④). Lỗi / cảnh báo của từng cảnh ghi kèm số cảnh. */
export function checkKichBan(kb: KichBanData, ctx: KichBanCtx): CheckResult & { theoCanh: Record<string, CheckResult> } {
  const d = checkDanY(kb.danY, ctx);
  const errors = d.errors.map((e) => `Dàn ý: ${e}`);
  const warnings = d.warnings.map((e) => `Dàn ý: ${e}`);
  if (!kb.danYDuyet) errors.unshift('Dàn ý chưa duyệt.');
  const theoCanh: Record<string, CheckResult> = {};
  kb.danY.canh.forEach((c, i) => {
    const L = `Cảnh ${i + 1}`;
    const st = tinhTrangCanh(kb, c.id);
    if (st === 'chua-viet') {
      errors.push(`${L} chưa viết.`);
      return;
    }
    if (st === 'can-xem-lai') errors.push(`${L} cần xem lại (dàn ý hoặc cảnh trước đã đổi) — viết lại, hoặc bấm "Vẫn đúng".`);
    const cc = canhCtx(kb.danY, c.id, { ...ctx, daoCuTruoc: daoCuTruoc(kb, c.id) });
    if (!cc) return;
    const r = checkCanh(beatsOf(kb, c.id), cc);
    theoCanh[c.id] = r;
    errors.push(...r.errors.map((e) => `${L}: ${e}`));
    warnings.push(...r.warnings.map((e) => `${L}: ${e}`));
  });
  return { errors, warnings, theoCanh };
}

/* ============================ MÀN ⑤ — RÀ SOÁT ============================ */

export const tongDiem = (r: Pick<RaSoatData, 'diem'>) => r.diem.reduce((s, x) => s + (Number.isFinite(x.diem) ? x.diem : 0), 0);
export const diemToiDa = (r: Pick<RaSoatData, 'diem'>) => r.diem.reduce((s, x) => s + (Number.isFinite(x.toiDa) ? x.toiDa : 0), 0);

/** Kiểm kết quả rà soát của AI. */
export function checkRaSoat(r: RaSoatData, ctx: { canhIds: string[]; beatIds: string[]; soTieuChi: number }): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const canh = new Set(ctx.canhIds);
  const beat = new Set(ctx.beatIds);
  if (ctx.soTieuChi && r.diem.length !== ctx.soTieuChi) errors.push(`Cần chấm đủ ${ctx.soTieuChi} tiêu chí của thang thể loại.`);
  r.diem.forEach((x, i) => {
    const L = `Tiêu chí ${i + 1}${x.ten ? ` ("${x.ten}")` : ''}`;
    if (!Number.isFinite(x.diem)) errors.push(`${L} chưa có điểm.`);
    else if (x.diem < 0 || x.diem > x.toiDa) errors.push(`${L}: điểm ${x.diem} nằm ngoài thang 0–${x.toiDa}.`);
    if (!x.nhanXet) errors.push(`${L} chưa có nhận xét.`);
  });
  r.vanDe.forEach((v, k) => {
    const L = `Vấn đề ${k + 1}`;
    if (!v.moTa) errors.push(`${L} chưa có mô tả.`);
    if (!v.deXuat) errors.push(`${L} chưa có đề xuất sửa.`);
    v.canh.filter((id) => !canh.has(id)).forEach((id) => errors.push(`${L}: không có cảnh ${id} trong kịch bản.`));
    v.beat.filter((id) => !beat.has(id)).forEach((id) => errors.push(`${L}: không có beat ${id} trong kịch bản.`));
    if (!v.canSuaDanY && !v.canh.length) errors.push(`${L} chưa chỉ ra cảnh nào (hoặc đánh dấu là cần sửa dàn ý).`);
  });
  const toiDa = diemToiDa(r);
  if (r.diem.length && r.diem.every((x) => Number.isFinite(x.diem)) && tongDiem(r) < r.nguong) warnings.push(`Điểm ${tongDiem(r)}/${toiDa} — dưới mức đạt (${r.nguong}).`);
  return { errors, warnings };
}

/** Điều kiện duyệt màn ⑤: không còn vấn đề mức "cao" chưa xử lý, không còn bản sửa chờ nhận. */
export function raSoatBlocking(r: RaSoatData): string[] {
  const out: string[] = [];
  r.vanDe.forEach((v, k) => {
    if (v.muc === 'cao' && (v.xuLy === 'chua' || v.xuLy === 'nhan')) out.push(`Vấn đề ${k + 1} (mức cao) chưa xử lý: sửa, hoặc bỏ qua có ghi lại.`);
  });
  if (r.banSua.length) out.push(`Còn ${r.banSua.length} bản sửa chờ bạn nhận hoặc bỏ.`);
  return out;
}

/** Vị trí cảnh để hiện "Cảnh 3" thay vì mã. */
export const soCanh = (d: DanY, id: string) => viTriCanh(d, id) + 1;

/* ============================ MÀN ⑥ — BIBLE ============================ */

/** Chữ tiếng Việt có dấu (phần cố định phải viết tiếng Anh). */
const VIET_RE = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;
export const coTiengViet = (s: string) => VIET_RE.test(String(s || ''));
export const soTu = (s: string) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

/** Giới hạn số từ của từng loại ô (tiếng Anh). */
export const GIOI_HAN_TU = { moTaNhanVat: 60, moTaDaoCu: 40, moTaBoiCanh: 60, khungAnh: 40, giong: 30, anhSang: 30, style: 50, vaiTro: 10 };

const TINH_CACH_RE = /\b(kind|kindhearted|shy|brave|gentle|cheerful|lazy|friendly|stubborn|caring|honest|smart|clever|loving|generous|selfish|grumpy|optimistic|pessimistic|introverted|extroverted|hardworking|diligent|independent)\b/i;
const NGUOI_RE = /\b(person|people|man|men|woman|women|girl|boy|child|children|someone|figure|crowd|she|he)\b/i;

/** Tên nhân vật xuất hiện trong chữ (so theo từ, không dấu). */
function nhacTen(text: string, names: { tag: string; ten: string }[]): string[] {
  const words = ` ${normName(text)} `;
  return names.filter((n) => n.ten && normName(n.ten).length > 1 && words.includes(` ${normName(n.ten)} `)).map((n) => n.ten);
}

export interface BibleCtx {
  /** Nhân vật màn ② (để kiểm tên) */
  nhanVat: Character[];
  /** id cảnh theo thứ tự dàn ý */
  canhIds: string[];
  /** Kịch bản chốt hiện tại — có thì kiểm bible còn khớp kịch bản không */
  kichBan?: KichBanData;
}

/** Mọi tag trong bible và màn ② (dùng kiểm tag bộ đồ không trùng). */
export function tagNgoaiBoDo(b: Pick<BibleData, 'nhanVat' | 'daoCu' | 'boiCanh'>, chars: Character[]): Set<string> {
  return new Set([...chars.map((c) => c.tag), ...b.nhanVat.map((n) => n.tag), ...b.daoCu.map((d) => d.tag), ...b.boiCanh.flatMap((c) => [c.tag, ...c.bienThe.map((v) => v.tag)])]);
}

/** Kiểm một ô tiếng Anh: không trống, không tiếng Việt, không quá dài. */
function oTiengAnh(errors: string[], label: string, text: string, max: number, required = true) {
  if (!String(text || '').trim()) {
    if (required) errors.push(`${label} còn trống.`);
    return;
  }
  if (coTiengViet(text)) errors.push(`${label} phải viết tiếng Anh (đang có chữ tiếng Việt có dấu).`);
  const n = soTu(text);
  if (n > max) errors.push(`${label} dài ${n} từ — tối đa ${max} từ.`);
}

/** Kiểm phần style (dùng cho kết quả AI đề xuất và ô style đã chọn). */
export function checkStyle(style: string, nhanVat: Character[], label = 'Style'): string[] {
  const errors: string[] = [];
  oTiengAnh(errors, label, style, GIOI_HAN_TU.style);
  if (style.includes('@')) errors.push(`${label} không được có tag (@…).`);
  const ten = nhacTen(style, nhanVat);
  if (ten.length) errors.push(`${label} không được nhắc tên nhân vật (${ten.join(', ')}).`);
  return errors;
}

export function checkBibleNhanVat(list: BibleNhanVat[], ctx: BibleCtx, tagKhac: Set<string>): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  // Tag bộ đồ trùng nhau (tính cả nhân vật không còn dùng)
  const dem = new Map<string, number>();
  list.forEach((n) => n.bo.forEach((bo) => dem.set(bo.tag, (dem.get(bo.tag) || 0) + 1)));
  list.forEach((n) => {
    if (n.khongDung) {
      warnings.push(`${n.ten} (@${n.tag}) không còn trong kịch bản — xoá nếu không cần.`);
      return;
    }
    const others = ctx.nhanVat.filter((c) => c.tag !== n.tag);
    if (n.coThoai) oTiengAnh(errors, `Giọng của ${n.ten}`, n.giong, GIOI_HAN_TU.giong);
    if (!n.canh.length) {
      if (n.bo.length) warnings.push(`${n.ten} không còn xuất hiện trên hình (chỉ có giọng) — các bộ đồ cũ được giữ lại, xoá nếu không cần.`);
      return;
    }
    if (!n.bo.length) errors.push(`${n.ten} có mặt trong phim nhưng chưa có bộ đồ nào.`);
    else if (n.bo.filter((bo) => bo.tag === n.tag).length !== 1) errors.push(`${n.ten}: đúng một bộ đồ phải mang tag @${n.tag} — đổi tag một bộ sang @${n.tag} ở ô "Tag ảnh".`);
    if (n.bo.length > 4) warnings.push(`${n.ten} có ${n.bo.length} bộ đồ — nhiều bộ thì khó giữ nhân vật đồng nhất.`);
    n.bo.forEach((bo, i) => {
      const L = `${n.ten} — bộ "${bo.ten || i + 1}"`;
      if (!/^[a-z0-9]{1,15}$/.test(bo.tag)) errors.push(`${L}: ${tagErr(bo.tag)}`);
      else if ((dem.get(bo.tag) || 0) > 1 || (bo.tag !== n.tag && tagKhac.has(bo.tag))) errors.push(`${L}: tag @${bo.tag} bị trùng.`);
      oTiengAnh(errors, `${L}: mô tả cố định`, bo.moTa, GIOI_HAN_TU.moTaNhanVat);
      oTiengAnh(errors, `${L}: khung ảnh`, bo.khungAnh, GIOI_HAN_TU.khungAnh);
      oTiengAnh(errors, `${L}: vai trò ảnh`, bo.vaiTro, GIOI_HAN_TU.vaiTro);
      if (!bo.note) errors.push(`${L}: ô Note còn trống.`);
      if (`${bo.moTa} ${bo.khungAnh}`.includes('@')) errors.push(`${L}: mô tả không được có tag (@…).`);
      const ten = nhacTen(`${bo.moTa} ${bo.khungAnh}`, others);
      if (ten.length) errors.push(`${L}: mô tả không được nhắc nhân vật khác (${ten.join(', ')}).`);
      if (TINH_CACH_RE.test(bo.moTa)) warnings.push(`${L}: mô tả có từ chỉ tính cách ("${TINH_CACH_RE.exec(bo.moTa)![0]}") — chỉ nên tả cái nhìn thấy.`);
      if (!bo.canh.length) warnings.push(`${L}: chưa dùng ở cảnh nào.`);
    });
    // Mỗi cảnh có mặt thuộc đúng một bộ đồ
    n.canh.forEach((id) => {
      const k = n.bo.filter((bo) => bo.canh.includes(id)).length;
      const no = ctx.canhIds.indexOf(id) + 1;
      if (k === 0) errors.push(`${n.ten}: cảnh ${no} chưa chọn bộ đồ.`);
      if (k > 1) errors.push(`${n.ten}: cảnh ${no} đang thuộc ${k} bộ đồ — mỗi cảnh một bộ.`);
    });
  });
  return { errors, warnings };
}

export function checkBibleDaoCu(list: BibleDaoCu[], ctx: BibleCtx): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  list.forEach((d) => {
    const L = `Đạo cụ @${d.tag}`;
    if (d.khongDung) {
      warnings.push(`${L} không còn trong kịch bản — xoá nếu không cần.`);
      return;
    }
    oTiengAnh(errors, `${L}: mô tả cố định`, d.moTa, GIOI_HAN_TU.moTaDaoCu);
    oTiengAnh(errors, `${L}: khung ảnh`, d.khungAnh, GIOI_HAN_TU.khungAnh);
    oTiengAnh(errors, `${L}: vai trò ảnh`, d.vaiTro, GIOI_HAN_TU.vaiTro);
    if (!d.note) errors.push(`${L}: ô Note còn trống.`);
    if (`${d.moTa} ${d.khungAnh}`.includes('@')) errors.push(`${L}: mô tả không được có tag (@…).`);
    const ten = nhacTen(`${d.moTa} ${d.khungAnh}`, ctx.nhanVat);
    if (ten.length) errors.push(`${L}: mô tả không được nhắc tên nhân vật (${ten.join(', ')}).`);
  });
  return { errors, warnings };
}

export function checkBibleBoiCanh(list: BibleBoiCanh[], anhSang: AnhSangCanh[], ctx: BibleCtx): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  list.forEach((c) => {
    const L = `Bối cảnh "${c.ten}" (@${c.tag})`;
    if (c.khongDung) {
      warnings.push(`${L} không còn trong kịch bản — xoá nếu không cần.`);
      return;
    }
    oTiengAnh(errors, `${L}: mô tả cố định`, c.moTa, GIOI_HAN_TU.moTaBoiCanh);
    const ten = nhacTen(c.moTa, ctx.nhanVat);
    if (ten.length) errors.push(`${L}: mô tả không được nhắc tên nhân vật (${ten.join(', ')}).`);
    if (c.moTa.includes('@')) errors.push(`${L}: mô tả không được có tag (@…).`);
    if (NGUOI_RE.test(c.moTa)) warnings.push(`${L}: mô tả có nhắc tới người ("${NGUOI_RE.exec(c.moTa)![0]}") — ảnh bối cảnh phải không có người.`);
    c.bienThe.forEach((v) => {
      const V = `${L} — ${v.thoiDiem || 'biến thể'} (@${v.tag})`;
      if (v.khongDung) {
        warnings.push(`${V}: thời điểm này không còn trong kịch bản — xoá nếu không cần.`);
        return;
      }
      oTiengAnh(errors, `${V}: khung ảnh`, v.khungAnh, GIOI_HAN_TU.khungAnh);
      oTiengAnh(errors, `${V}: vai trò ảnh`, v.vaiTro, GIOI_HAN_TU.vaiTro);
      if (!v.note) errors.push(`${V}: ô Note còn trống.`);
      if (NGUOI_RE.test(v.khungAnh)) warnings.push(`${V}: khung ảnh có nhắc tới người ("${NGUOI_RE.exec(v.khungAnh)![0]}").`);
    });
  });
  const first = new Map<string, string>();
  anhSang.forEach((a) => {
    const no = ctx.canhIds.indexOf(a.canh) + 1;
    oTiengAnh(errors, `Ánh sáng cảnh ${no}`, a.moTa, GIOI_HAN_TU.anhSang);
    const k = `${a.diaDiem}|${normName(a.thoiDiem)}|${normName(a.goc)}`;
    if (a.moTa && first.has(k) && first.get(k) !== a.moTa) warnings.push(`Ánh sáng cảnh ${no} giống cảnh trước (cùng địa điểm, thời điểm, ánh sáng) mà câu tiếng Anh khác — nên dùng cùng một câu.`);
    if (a.moTa && !first.has(k)) first.set(k, a.moTa);
  });
  return { errors, warnings };
}

/** Bible còn khớp kịch bản chốt hiện tại không (so với một lần bóc tách mới). Trả các điểm lệch. */
export function lechKichBan(b: BibleData, kb: KichBanData, chars: Character[]): string[] {
  const moi = bocTach(kb, chars, b);
  const out: string[] = [];
  const dung = <T extends { khongDung?: boolean }>(l: T[]) => l.filter((x) => !x.khongDung);
  const so = (a: string[], c: string[]) => a.length === c.length && a.every((x, i) => x === c[i]);
  const nvCu = dung(b.nhanVat);
  const nvMoi = dung(moi.nhanVat);
  if (!so(nvCu.map((n) => n.tag).sort(), nvMoi.map((n) => n.tag).sort())) out.push('danh sách nhân vật');
  else if (nvMoi.some((n) => {
    const c = nvCu.find((x) => x.tag === n.tag)!;
    return !so(c.canh, n.canh) || c.coThoai !== n.coThoai;
  })) out.push('cảnh có mặt / có thoại của nhân vật');
  if (!so(dung(b.daoCu).map((d) => d.tag).sort(), dung(moi.daoCu).map((d) => d.tag).sort())) out.push('danh sách đạo cụ');
  const loc = (x: BibleData) => dung(x.boiCanh).map((c) => `${c.tag}:${dung(c.bienThe).map((v) => `${v.tag}=${normName(v.thoiDiem)}/${v.canh.join(',')}`).sort().join(';')}`).sort();
  if (!so(loc(b), loc(moi))) out.push('bối cảnh / thời điểm');
  const light = (x: BibleData) => x.anhSang.map((a) => `${a.canh}|${a.diaDiem}|${normName(a.thoiDiem)}|${normName(a.goc)}`);
  if (!so(light(b), light(moi))) out.push('ánh sáng từng cảnh');
  return out;
}

/** Kiểm cả bible (điều kiện duyệt màn ⑥). Thiếu ảnh chỉ cảnh báo. */
export function checkBible(b: BibleData, ctx: BibleCtx): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (ctx.kichBan) {
    const lech = lechKichBan(b, ctx.kichBan, ctx.nhanVat);
    if (lech.length) errors.push(`Bible chưa khớp kịch bản chốt hiện tại (${lech.join(', ')}) — bấm "Bóc tách lại từ kịch bản".`);
  }
  if (!b.style.trim()) errors.push('Chưa chọn style.');
  else errors.push(...checkStyle(b.style, ctx.nhanVat));
  const parts = [checkBibleNhanVat(b.nhanVat, ctx, tagNgoaiBoDo(b, ctx.nhanVat)), checkBibleDaoCu(b.daoCu, ctx), checkBibleBoiCanh(b.boiCanh, b.anhSang, ctx)];
  parts.forEach((r) => {
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  });
  const thieuAnh = [
    ...b.nhanVat.filter((n) => !n.khongDung && n.canh.length).flatMap((n) => n.bo.map((x) => x.tag)),
    ...b.daoCu.filter((d) => !d.khongDung).map((d) => d.tag),
    ...b.boiCanh.filter((c) => !c.khongDung).flatMap((c) => c.bienThe.filter((v) => !v.khongDung).map((v) => v.tag)),
  ].filter((t) => !b.anh[t]?.imageId);
  if (thieuAnh.length) warnings.push(`Còn ${thieuAnh.length} tag chưa có ảnh tham chiếu: ${thieuAnh.map((t) => `@${t}`).join(', ')}. Màn 8 sẽ cần đủ ảnh.`);
  return { errors, warnings };
}

/* ============================ MÀN ⑦ — PHÂN CẢNH ============================ */

const ANH_SANG_RE = /(ánh sáng|ánh đèn|đèn tuýp|đèn bàn|nắng|ngược sáng|tối om|sáng rực)/i;
/** Nói không cần thấy mặt (qua điện thoại, giọng đọc…). */
const GIONG_NGOAI_RE = /(điện thoại|qua loa|giọng đọc|lồng tiếng|tin nhắn thoại|đọc thư|qua thư|ngoài khung|ngoài hình)/i;

export interface PhanCanhCtx {
  /** Mọi tên và tag địa điểm (để cảnh báo ô Mô tả tả lại bối cảnh) */
  diaDiem: string[];
}

/** Kiểm shot của một cảnh. */
export function checkPhanCanhCanh(beats: Beat[], pc: PhanCanhCanh | undefined, ctx: PhanCanhCtx): CheckResult & { theoBeat: Record<string, CheckResult> } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const theoBeat: Record<string, CheckResult> = {};
  // Tên địa điểm so cả dấu (tránh "cho" khớp "Chợ"); tag chỉ khi viết dạng @tag
  const ten = ctx.diaDiem.filter((x) => !/^[a-z0-9]+$/.test(x)).map((x) => x.toLowerCase().trim()).filter((x) => x.length >= 3);
  const tags = ctx.diaDiem.filter((x) => /^[a-z0-9]+$/.test(x));
  beats.forEach((b, i) => {
    const e: string[] = [];
    const w: string[] = [];
    const shots = pc?.beats[b.id]?.shots || [];
    if (!shots.length) e.push('Chưa có shot nào.');
    const sum = shots.reduce((s, x) => s + (Number.isFinite(x.giay) ? x.giay : 0), 0);
    if (shots.length && Math.abs(sum - b.giay) > 0.001) e.push(`Tổng giây các shot là ${sum}s, beat dài ${b.giay}s — phải bằng nhau.`);
    const dem = new Map<number, number>();
    shots.forEach((s, k) => {
      const L = `Shot ${k + 1}`;
      if (!Number.isFinite(s.giay) || s.giay < 1) e.push(`${L} dài ${Number.isFinite(s.giay) ? s.giay : '—'}s — mỗi shot ít nhất 1 giây.`);
      else if (Math.abs(s.giay * 2 - Math.round(s.giay * 2)) > 0.001) e.push(`${L}: số giây đi theo bước 0,5 (ví dụ 1,5 hoặc 2).`);
      else if (s.giay < 1.5) w.push(`${L} chỉ ${s.giay}s — rất ngắn, máy video có thể bỏ qua.`);
      if (!s.moTa.trim()) e.push(`${L} chưa có mô tả.`);
      if (!CO_CANH.some((x) => x.id === s.coCanh)) e.push(`${L}: cỡ cảnh không có trong danh sách.`);
      if (!GOC_MAY.some((x) => x.id === s.gocMay)) e.push(`${L}: góc máy không có trong danh sách.`);
      if (!CHUYEN_DONG.some((x) => x.id === s.chuyenDong)) e.push(`${L}: chuyển động máy không có trong danh sách.`);
      s.trongKhung.filter((t) => !b.coMat.includes(t)).forEach((t) => e.push(`${L}: @${t} không có mặt ở beat này.`));
      s.thoai.forEach((k2) => {
        if (k2 < 0 || k2 >= b.thoai.length) e.push(`${L}: câu thoại số ${k2 + 1} không có trong beat.`);
        dem.set(k2, (dem.get(k2) || 0) + 1);
      });
      const words = s.thoai.reduce((n, k2) => n + soTu(b.thoai[k2]?.cau || ''), 0);
      if (Number.isFinite(s.giay) && s.giay > 0 && words > CHU_MOI_GIAY * s.giay) w.push(`${L}: thoại ${words} chữ, dài so với ${s.giay}s (nên tối đa khoảng ${Math.floor(CHU_MOI_GIAY * s.giay)} chữ).`);
      if (ANH_SANG_RE.test(s.moTa)) w.push(`${L}: mô tả nhắc ánh sáng ("${ANH_SANG_RE.exec(s.moTa)![0]}") — ánh sáng đã có ở bible, không cần tả lại.`);
      const m = ` ${s.moTa.toLowerCase().replace(/[.,;:!?…"“”()]/g, ' ')} `;
      const trung = ten.find((x) => m.includes(` ${x} `)) || tags.find((t) => s.moTa.toLowerCase().includes(`@${t}`));
      if (trung) w.push(`${L}: mô tả nhắc tên địa điểm — bối cảnh đã có ở bible, không cần tả lại.`);
      s.thoai.forEach((k2) => {
        const t = b.thoai[k2];
        if (t && b.coMat.includes(t.ai) && !s.trongKhung.includes(t.ai) && !GIONG_NGOAI_RE.test(t.cachNoi)) w.push(`${L}: @${t.ai} nói "${t.cau.slice(0, 30)}…" nhưng không ở trong khung.`);
      });
    });
    b.thoai.forEach((t, k2) => {
      const n = dem.get(k2) || 0;
      if (shots.length && n === 0) e.push(`Câu thoại ${k2 + 1} ("${t.cau.slice(0, 30)}") chưa thuộc shot nào.`);
      if (n > 1) e.push(`Câu thoại ${k2 + 1} đang thuộc ${n} shot — mỗi câu thuộc đúng một shot.`);
    });
    theoBeat[b.id] = { errors: e, warnings: w };
    errors.push(...e.map((x) => `Beat ${i + 1} (${b.id}): ${x}`));
    warnings.push(...w.map((x) => `Beat ${i + 1} (${b.id}): ${x}`));
  });
  return { errors, warnings, theoBeat };
}

/** Kiểm cả màn ⑦ (điều kiện duyệt). */
export function checkPhanCanh(pc: PhanCanhData, kb: KichBanData): CheckResult & { theoCanh: Record<string, ReturnType<typeof checkPhanCanhCanh>> } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const theoCanh: Record<string, ReturnType<typeof checkPhanCanhCanh>> = {};
  const diaDiem = Array.from(new Set(kb.danY.canh.flatMap((c) => [c.diaDiem, c.tagDiaDiem]).filter(Boolean)));
  kb.danY.canh.forEach((c, i) => {
    const L = `Cảnh ${i + 1}`;
    const st = tinhTrangPhanCanh(pc, kb, c.id);
    if (st === 'chua-lam') {
      errors.push(`${L} chưa phân cảnh.`);
      return;
    }
    if (st === 'can-xem-lai') errors.push(`${L} cần xem lại (beat của cảnh đã đổi ở màn 4 / 5) — làm lại, hoặc bấm "Vẫn đúng".`);
    const r = checkPhanCanhCanh(beatsOf(kb, c.id), pc.canh[c.id], { diaDiem });
    theoCanh[c.id] = r;
    errors.push(...r.errors.map((e) => `${L}: ${e}`));
    warnings.push(...r.warnings.map((e) => `${L}: ${e}`));
  });
  return { errors, warnings, theoCanh };
}
