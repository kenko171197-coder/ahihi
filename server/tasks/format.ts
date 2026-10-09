// Đổi dữ liệu dự án thành đoạn chữ tiếng Việt để đưa vào prompt.
import type { Brief, BriefInput, Character, HoiLaiCau, TreatmentData } from '../../shared/project';
import { fmtGiay } from '../../shared/project';

const NEN_TANG: Record<string, string> = { doc: 'TikTok / Reels, khung dọc 9:16', ngang: 'YouTube, khung ngang 16:9' };
const HINH_THUC: Record<string, string> = { 'nguoi-that': 'người thật', 'hoat-hinh-3d': 'hoạt hình 3D', 'hoat-hinh-2d': 'hoạt hình 2D' };
const THOAI: Record<string, string> = { khong: 'không thoại', it: 'ít thoại', nhieu: 'nhiều thoại' };
const NHAC: Record<string, string> = { khong: 'không nhạc nền', co: 'có nhạc nền', 'ai-de-xuat': 'nhạc nền: để biên kịch đề xuất' };
const VAI: Record<string, string> = { chinh: 'chính', phu: 'phụ', 'gian-tiep': 'gián tiếp (chỉ hiện qua đồ vật, giọng nói…)' };

export function briefInputText(b: BriefInput): string {
  return [
    `Ý tưởng: ${b.yTuong}`,
    `Nền tảng: ${NEN_TANG[b.nenTang] || b.nenTang}`,
    `Thời lượng: ${fmtGiay(b.thoiLuongGiay)} (${b.thoiLuongGiay} giây)`,
    `Hình thức: ${HINH_THUC[b.hinhThuc] || b.hinhThuc}`,
    `Thoại: ${THOAI[b.thoai.mucDo] || b.thoai.mucDo}${b.thoai.mucDo !== 'khong' && b.thoai.ngonNgu ? `, ${b.thoai.ngonNgu}` : ''}`,
    `Nhạc: ${NHAC[b.nhacNen] || b.nhacNen}`,
    b.ghiChu ? `Ghi chú của người dùng: ${b.ghiChu}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function cauHoiText(list: HoiLaiCau[]): string {
  return list
    .filter((c) => c.traLoi.trim())
    .map((c) => `- ${c.cauHoi} → ${c.traLoi}`)
    .join('\n');
}

export function briefText(b: Brief): string {
  return [
    briefInputText(b),
    `Logline: ${b.logline}`,
    `Thông điệp: ${b.thongDiep}`,
    `Cảm xúc đọng lại: ${b.camXuc}`,
    `Khán giả chính: ${b.khanGia}`,
  ].join('\n');
}

export function characterText(c: Character): string {
  return [
    `@${c.tag} — ${c.ten} (vai ${VAI[c.vai] || c.vai}${c.tuoi ? `, ${c.tuoi}` : ''})`,
    c.muon ? `  Muốn: ${c.muon}` : '',
    c.can ? `  Cần: ${c.can}` : '',
    c.tinhCach ? `  Tính cách: ${c.tinhCach}` : '',
    c.chiTiet ? `  Chi tiết riêng: ${c.chiTiet}` : '',
    c.quanHe ? `  Quan hệ: ${c.quanHe}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const charactersText = (list: Character[]) => list.map(characterText).join('\n');

export function treatmentText(t: TreatmentData): string {
  const parts = t.phan.map((p, i) => {
    const seq = p.phanDoan.map((s) => `    · ${s.ten} (${fmtGiay(s.batDau)}–${fmtGiay(s.ketThuc)}): ${s.tomTat}`).join('\n');
    return `Phần ${i + 1}. ${p.ten} (${fmtGiay(p.batDau)}–${fmtGiay(p.ketThuc)}) — ${p.vaiTro}\n  ${p.tomTat}${seq ? `\n${seq}` : ''}`;
  });
  const cd = t.caiDung.map((c) => `- ${c.chiTiet}: cài ở ${c.cai}, dùng ở ${c.dung}`).join('\n');
  return `${parts.join('\n')}${cd ? `\nCài – Dùng:\n${cd}` : ''}`;
}
