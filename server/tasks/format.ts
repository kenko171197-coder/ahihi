// Đổi dữ liệu dự án thành đoạn chữ tiếng Việt để đưa vào prompt.
import type { Beat, Brief, BriefInput, Character, DanY, DaoCu, HoiLaiCau, KichBanData, TreatmentData } from '../../shared/project';
import { fmtGiay } from '../../shared/project';
import { trangThaiText } from '../../shared/kichBan';

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

/** Số thứ tự phần ("Phần 2. Gợn sóng") theo id. */
function phanLabel(t: TreatmentData, id: string): string {
  const i = t.phan.findIndex((p) => p.id === id);
  return i >= 0 ? `phần ${i + 1} (${t.phan[i].ten})` : '(chưa chọn phần)';
}

/** Bảng Cài – Dùng của treatment, có mã dòng (C1…). */
export const caiDungText = (t: TreatmentData) => t.caiDung.map((c) => `- ${c.id} "${c.chiTiet}": cài ở ${phanLabel(t, c.cai)}, dùng ở ${phanLabel(t, c.dung)}`).join('\n');

export function treatmentText(t: TreatmentData): string {
  const parts = t.phan.map((p, i) => {
    const seq = p.phanDoan.map((s) => `    · ${s.ten} (${fmtGiay(s.batDau)}–${fmtGiay(s.ketThuc)}): ${s.tomTat}`).join('\n');
    return `Phần ${i + 1}. ${p.ten} (${p.batDau}s–${p.ketThuc}s) — ${p.vaiTro}\n  ${p.tomTat}${seq ? `\n${seq}` : ''}`;
  });
  const cd = caiDungText(t);
  return `${parts.join('\n')}${cd ? `\nCài – Dùng:\n${cd}` : ''}`;
}

/* ---------- Kịch bản (màn ④ ⑤) ---------- */

const tagList = (tags: string[]) => tags.map((t) => `@${t}`).join(', ');

/** Một cảnh của dàn ý, đủ các ô. */
export function canhDanYText(d: DanY, i: number, t: TreatmentData): string {
  const c = d.canh[i];
  const idx = (id: string) => d.canh.findIndex((x) => x.id === id) + 1;
  const cd = d.caiDung
    .filter((x) => x.cai === c.id || x.dung === c.id)
    .map((x) => `${x.id} "${t.caiDung.find((r) => r.id === x.id)?.chiTiet || ''}" (${x.cai === c.id && x.dung === c.id ? 'cài và dùng' : x.cai === c.id ? `cài, dùng ở cảnh ${idx(x.dung)}` : `dùng, đã cài ở cảnh ${idx(x.cai)}`})`);
  return [
    `Cảnh ${i + 1} [${c.id}] · ${phanLabel(t, c.phan)} · ${c.batDau}s–${c.ketThuc}s (${c.ketThuc - c.batDau} giây)`,
    `  Địa điểm: ${c.diaDiem} (@${c.tagDiaDiem}) · Thời điểm: ${c.thoiDiem} · Ánh sáng: ${c.anhSang}`,
    `  Có mặt: ${tagList(c.coMat) || '(không nhân vật nào)'}`,
    `  Chuyển biến: ${c.chuyenBien}`,
    `  Đầu cảnh: ${trangThaiText(c.dauCanh, '; ')}`,
    `  Cuối cảnh: ${trangThaiText(c.cuoiCanh, '; ')}`,
    cd.length ? `  Cài – Dùng: ${cd.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const danYText = (d: DanY, t: TreatmentData) => d.canh.map((_, i) => canhDanYText(d, i, t)).join('\n');

/** Dàn ý gọn: mỗi cảnh một dòng. */
export const danYNgan = (d: DanY) =>
  d.canh.map((c, i) => `Cảnh ${i + 1} [${c.id}] ${c.batDau}s–${c.ketThuc}s · ${c.diaDiem}, ${c.thoiDiem} · ${c.chuyenBien}`).join('\n');

export const daoCuText = (list: DaoCu[]) => list.map((d) => `- @${d.tag}: ${d.moTa}`).join('\n');

/** Một beat, đủ các ô. Thoại ghi tên nhân vật. */
export function beatText(b: Beat, chars: Character[]): string {
  const name = (ai: string) => chars.find((c) => c.tag === ai)?.ten || ai;
  return [
    `[${b.id}] ${b.giay}s — ${b.hanhDong}`,
    ...b.thoai.map((t) => `  Thoại: ${name(t.ai).toUpperCase()}${t.ai && chars.some((c) => c.tag === t.ai) ? ` (@${t.ai})` : ''}${t.cachNoi ? ` (${t.cachNoi})` : ''}: "${t.cau}"`),
    b.amThanh ? `  Âm thanh: ${b.amThanh}` : '',
    b.camXuc ? `  Cảm xúc / nhịp: ${b.camXuc}` : '',
    b.coMat.length ? `  Có mặt: ${tagList(b.coMat)}` : '',
    b.daoCuMoi.length ? `  Đạo cụ mới: ${b.daoCuMoi.map((d) => `@${d.tag} — ${d.moTa}`).join('; ')}` : '',
    b.thayDoi.length ? `  Thay đổi: ${b.thayDoi.map((x) => `@${x.tag}: ${x.truoc} → ${x.sau}`).join('; ')}` : '',
    b.caiDung.length ? `  Cài – Dùng: ${b.caiDung.join(', ')}` : '',
    `  Cuối beat: ${trangThaiText(b.cuoiBeat, '; ')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Toàn bộ kịch bản: tiêu đề cảnh + các beat. */
export function kichBanText(kb: Pick<KichBanData, 'danY' | 'canh'>, t: TreatmentData, chars: Character[]): string {
  return kb.danY.canh
    .map((c, i) => {
      const beats = kb.canh[c.id]?.beats || [];
      return `===== ${canhDanYText(kb.danY, i, t)}\n${beats.length ? beats.map((b) => beatText(b, chars)).join('\n') : '(chưa viết)'}`;
    })
    .join('\n\n');
}
