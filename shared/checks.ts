// Code kiểm dùng chung: server kiểm kết quả AI, giao diện kiểm bản người dùng sửa tay. Thuần, không thư viện ngoài.
import type { Character, TreatmentData } from './project';
import { PHAN_DOAN_TU_GIAY, fmtGiay, maxNhanVat } from './project';

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
