// Ghép đầu vào cho các tác vụ AI của màn ④ ⑤ từ dự án (chỉ đọc bản đã duyệt của màn trước).
import type { Beat, KichBanData, Project } from '../types';
import { beatsOf, cuoiCanhThat, daoCuTruoc, viTriCanh } from '../../shared/kichBan';
import type { KichBanCtx } from '../../shared/checks';

/** Ngữ cảnh kiểm kịch bản (cần brief, nhân vật, treatment đã có). */
export function kichBanCtx(p: Project, beatGiay?: [number, number] | null): KichBanCtx {
  const brief = p.sections.brief!.data;
  return {
    total: brief.thoiLuongGiay,
    treatment: p.sections.treatment!.data,
    nhanVat: p.sections.nhanVat!.data.list,
    mucThoai: brief.thoai.mucDo,
    nhacNen: brief.nhacNen,
    beatGiay,
  };
}

/** Đầu vào tác vụ viet-canh cho một cảnh. */
export function vietCanhInput(p: Project, kb: KichBanData, id: string, sua?: { truoc: Beat[]; yeuCau: string }) {
  const i = viTriCanh(kb.danY, id);
  const prev = i > 0 ? kb.danY.canh[i - 1] : null;
  return {
    brief: p.sections.brief!.data,
    nhanVat: p.sections.nhanVat!.data.list,
    treatment: p.sections.treatment!.data,
    danY: kb.danY,
    canhId: id,
    canhTruoc: prev ? { cuoi: cuoiCanhThat(kb, prev), beats: beatsOf(kb, prev.id).slice(-2) } : null,
    daoCuTruoc: daoCuTruoc(kb, id),
    soBeat: kb.soBeat,
    sua,
  };
}
