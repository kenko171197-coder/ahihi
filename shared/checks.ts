// Code kiểm dùng chung: server kiểm kết quả AI, giao diện kiểm bản người dùng sửa tay. Thuần, không thư viện ngoài.
import type { Beat, CanhDanY, Character, DanY, DaoCu, DongTrangThai, KichBanData, MucThoai, NhacNen, RaSoatData, TreatmentData } from './project';
import { BEAT_MAX, BEAT_MIN, PHAN_DOAN_TU_GIAY, fmtGiay, maxNhanVat } from './project';
import { beatsOf, daoCuTruoc, tinhTrangCanh, tongGiayBeat, viTriCanh } from './kichBan';

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
