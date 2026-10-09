// Xuất file .txt (màn ⑧): prompt của mọi beat theo thứ tự, và kịch bản dạng đọc. Thuần — dùng chung, test được.
import type { Brief, Character, KichBanData } from './project';
import { fmtGiay } from './project';
import { beatsOf, tongGiayBeat } from './kichBan';
import { ghepCanh, GhepCtx, FRAME_TAG, tinhTrangPrompt } from './prompt';

const LINE = '='.repeat(60);

const tieuDe = (no: number, diaDiem: string, thoiDiem: string) => `CẢNH ${no} · ${(diaDiem || 'chưa có địa điểm').toUpperCase()}${thoiDiem ? ` — ${thoiDiem.toUpperCase()}` : ''}`;

/** File prompt: mỗi beat có danh sách ảnh cần nạp và prompt. Beat chưa dịch / còn lỗi được ghi rõ. */
export function xuatPromptTxt(ctx: GhepCtx & { title: string; tiLe: string; chuaChot?: string }): string {
  const out: string[] = [];
  const all = ctx.kb.danY.canh.flatMap((c) => beatsOf(ctx.kb, c.id));
  out.push(`XƯỞNG PHIM AI — PROMPT VIDEO`, `Dự án: ${ctx.title}`, `Khung hình: ${ctx.tiLe} · ${all.length} beat · ${fmtGiay(tongGiayBeat(all))}`, '');
  out.push('Mỗi beat = một lần tạo video trên Omni Flash: nạp đúng các ảnh trong danh sách (đặt đúng tên @tag), dán prompt, tạo.');
  out.push(`Ảnh @${FRAME_TAG} là frame cuối của video beat trước (bạn chụp ở Flow, dán vào app).`, '');
  if (ctx.chuaChot) out.push(`LƯU Ý: ${ctx.chuaChot}`, '');
  ctx.kb.danY.canh.forEach((c, i) => {
    out.push(LINE, `${tieuDe(i + 1, c.diaDiem, c.thoiDiem)} (${c.id})`, LINE, '');
    if (tinhTrangPrompt(ctx.prompt, ctx.kb, ctx.pc, c.id, ctx.brief.nhacNen) === 'can-dich-lai') out.push('CẦN DỊCH LẠI: chữ tiếng Việt của cảnh đã đổi sau khi dịch — prompt dưới đây có thể chưa khớp kịch bản.', '');
    ghepCanh(ctx, c.id).forEach((r) => {
      out.push(`--- ${r.beatId} · ${r.giay}s · ${r.soShot} shot ---`);
      out.push(`Ảnh cần nạp: ${r.anh.map((a) => `@${a.tag}${a.loai === 'frame' ? ` (frame cuối ${r.beatTruoc})` : a.imageId ? '' : ' (CHƯA CÓ ẢNH)'}`).join(', ') || '(không có)'}`);
      if (r.chuaCoFrame) out.push(`Chưa có frame nối từ ${r.beatTruoc} — độ khớp thấp hơn.`);
      if (r.errors.length) out.push(`CẦN SỬA: ${r.errors.join(' · ')}`);
      out.push('', r.text || (r.soShot ? '(Beat chưa dịch — vào màn 8 để dịch.)' : '(Beat chưa có shot — phân cảnh ở màn 7 trước.)'), '');
    });
  });
  return out.join('\n');
}

/** File kịch bản: tiêu đề cảnh, beat có giây, hành động, thoại, âm thanh. */
export function xuatKichBanTxt(p: { title: string; brief: Brief; nhanVat: Character[]; kb: KichBanData }): string {
  const ten = (ai: string) => p.nhanVat.find((c) => c.tag === ai)?.ten || ai;
  const all = p.kb.danY.canh.flatMap((c) => beatsOf(p.kb, c.id));
  const out: string[] = [p.title.toUpperCase(), '', `Logline: ${p.brief.logline}`, `Thời lượng: ${fmtGiay(tongGiayBeat(all))} · ${all.length} beat · khung ${p.brief.tiLe}`, ''];
  p.kb.danY.canh.forEach((c, i) => {
    out.push(LINE, `${tieuDe(i + 1, c.diaDiem, c.thoiDiem)}`, `${fmtGiay(c.batDau)}–${fmtGiay(c.ketThuc)} · ${c.chuyenBien}`, LINE, '');
    const beats = beatsOf(p.kb, c.id);
    if (!beats.length) out.push('(chưa viết)', '');
    beats.forEach((b) => {
      out.push(`[${b.id} · ${b.giay}s] ${b.hanhDong}`);
      b.thoai.forEach((t) => out.push(`    ${ten(t.ai).toUpperCase()}${t.cachNoi ? ` (${t.cachNoi})` : ''}: ${t.cau}`));
      if (b.amThanh) out.push(`    Âm thanh: ${b.amThanh}`);
      out.push('');
    });
  });
  return out.join('\n');
}
