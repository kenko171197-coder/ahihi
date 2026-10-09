// Màn ⑤ — Rà soát: chấm theo thang của thể loại, liệt kê vấn đề kèm đề xuất sửa.
import type { TaskDef } from '../framework';
import { genreHeader, sectionFor, thangChamOf } from '../genre';
import { arr, obj, str } from '../util';
import { briefText, charactersText, treatmentText, kichBanText } from '../format';
import type { Brief, Character, DanY, KichBanData, MucVanDe, RaSoatData, TreatmentData, VanDe } from '../../../shared/project';
import { LOAI_VAN_DE, toTag } from '../../../shared/project';
import { normBeatId, normCanhId } from '../../../shared/kichBan';
import { checkRaSoat, normName } from '../../../shared/checks';
import { parseBrief, parseCharacters } from './nhanVat';
import { parseTreatmentData } from './treatment';
import { parseDanY, parseBeat } from './kichBan';

interface RaSoatInput {
  brief: Brief;
  nhanVat: Character[];
  treatment: TreatmentData;
  kichBan: Pick<KichBanData, 'danY' | 'canh'>;
  /** Mô tả các vấn đề người dùng đã bỏ qua — không nêu lại */
  daBoQua: string[];
}

/** Thang khi file thể loại không có thang chấm. */
const THANG_CHUNG = { tieuChi: [{ ten: 'Chấm chung', toiDa: 10 }], nguong: 7 };

export function normLoai(v: string): string {
  const n = normName(v);
  return LOAI_VAN_DE.find((l) => n && (normName(l) === n || n.includes(normName(l)) || normName(l).includes(n))) || (n.includes('video') || n.split(' ').includes('ai') ? 'khó với AI video' : 'khác');
}

export function normMuc(v: string): MucVanDe {
  const t = toTag(v);
  if (t.includes('cao') || t.includes('high') || t.includes('nang') || t.includes('nghiem') || t.includes('critical') || t.includes('serious')) return 'cao';
  if (t.includes('thap') || t.includes('low') || t.includes('nhe')) return 'thap';
  return 'vua';
}

const parseKichBan = (v: unknown, chars: Character[]): Pick<KichBanData, 'danY' | 'canh'> => {
  const o = obj(v);
  const danY: DanY = parseDanY(o.danY);
  const src = obj(o.canh);
  const tags = new Set(chars.map((c) => c.tag));
  const canh: KichBanData['canh'] = {};
  danY.canh.forEach((c) => {
    const beats = arr(obj(src[c.id]).beats).map((b) => parseBeat(b, tags));
    if (beats.length) canh[c.id] = { beats, dauVao: '', updatedAt: 0 };
  });
  return { danY, canh };
};

export const raSoat: TaskDef<RaSoatInput, RaSoatData> = {
  id: 'ra-soat',
  promptFile: '05-ra-soat.md',
  temperature: 0.4,
  schema: {
    type: 'OBJECT',
    properties: {
      diem: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            tieuChi: { type: 'INTEGER', description: 'Số thứ tự tiêu chí (1, 2, …)' },
            diem: { type: 'NUMBER' },
            nhanXet: { type: 'STRING' },
          },
          required: ['tieuChi', 'diem', 'nhanXet'],
        },
      },
      nhanXet: { type: 'STRING' },
      vanDe: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            loai: { type: 'STRING', format: 'enum', enum: [...LOAI_VAN_DE] },
            muc: { type: 'STRING', format: 'enum', enum: ['cao', 'vua', 'thap'] },
            canh: { type: 'ARRAY', items: { type: 'STRING' } },
            beat: { type: 'ARRAY', items: { type: 'STRING' } },
            moTa: { type: 'STRING' },
            deXuat: { type: 'STRING' },
            canSuaDanY: { type: 'BOOLEAN' },
          },
          required: ['loai', 'muc', 'canh', 'beat', 'moTa', 'deXuat', 'canSuaDanY'],
        },
      },
    },
    required: ['diem', 'nhanXet', 'vanDe'],
  },
  parseInput: (body) => {
    const o = obj(body);
    const nhanVat = parseCharacters(o.nhanVat);
    const kichBan = parseKichBan(o.kichBan, nhanVat);
    if (!kichBan.danY.canh.length) throw new Error('Chưa có kịch bản. Duyệt màn ④ trước.');
    return {
      brief: parseBrief(o.brief),
      nhanVat,
      treatment: parseTreatmentData(o.treatment),
      kichBan,
      daBoQua: arr(o.daBoQua).map((x) => str(x, 600)).filter(Boolean).slice(-30),
    };
  },
  genreId: (i) => i.brief.theLoai,
  vars: (i, ctx) => {
    const thang = thangChamOf(ctx.genre) || THANG_CHUNG;
    const tong = thang.tieuChi.reduce((s, x) => s + x.toiDa, 0);
    return {
      the_loai: genreHeader(ctx.genre),
      huong_dan: sectionFor(ctx.genre, 'raSoat'),
      brief: briefText(i.brief),
      nhan_vat: charactersText(i.nhanVat),
      treatment: treatmentText(i.treatment),
      kich_ban: kichBanText(i.kichBan, i.treatment, i.nhanVat),
      thang_cham: thang.tieuChi.map((x, k) => `${k + 1}. ${x.ten} — tối đa ${x.toiDa} điểm`).join('\n'),
      tong_diem: tong,
      nguong: thang.nguong,
      loai_van_de: LOAI_VAN_DE.map((l) => `"${l}"`).join(', '),
      bo_qua: i.daBoQua.map((x) => `- ${x}`).join('\n'),
    };
  },
  normalize: (raw, input, ctx) => {
    const o = obj(raw);
    const thang = thangChamOf(ctx.genre) || THANG_CHUNG;
    const rows = arr(o.diem).map(obj);
    const diem = thang.tieuChi.map((tc, k) => {
      const r = rows.find((x) => Number(x.tieuChi) === k + 1);
      const d = r ? Number(r.diem) : NaN;
      return { ten: tc.ten, toiDa: tc.toiDa, diem: Number.isFinite(d) ? Math.round(d * 2) / 2 : NaN, nhanXet: r ? str(r.nhanXet, 600) : '' };
    });
    // Beat thuộc cảnh nào — để tự thêm cảnh khi AI chỉ nêu beat
    const sceneOfBeat = new Map<string, string>();
    Object.entries(input.kichBan.canh).forEach(([id, v]) => v.beats.forEach((b) => sceneOfBeat.set(b.id, id)));
    const vanDe: VanDe[] = arr(o.vanDe).map((v, k) => {
      const x = obj(v);
      const beat = Array.from(new Set(arr(x.beat).map((b) => normBeatId(str(b, 20))).filter(Boolean)));
      const canh = Array.from(new Set([...arr(x.canh).map((c) => normCanhId(str(c, 20))), ...beat.map((b) => sceneOfBeat.get(b) || '')].filter(Boolean)));
      // Giữ thứ tự cảnh theo dàn ý
      const order = new Map(input.kichBan.danY.canh.map((c, i) => [c.id, i]));
      canh.sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9));
      return {
        id: `V${k + 1}`,
        loai: normLoai(str(x.loai, 60)),
        muc: normMuc(str(x.muc, 20)),
        canh,
        beat,
        moTa: str(x.moTa, 1200),
        deXuat: str(x.deXuat, 1200),
        canSuaDanY: x.canSuaDanY === true,
        daSuaCanh: [],
        xuLy: 'chua',
        lyDo: '',
      };
    });
    return { diem, nguong: thang.nguong, nhanXet: str(o.nhanXet, 1500), vanDe, banSua: [], daBoQua: [] };
  },
  check: (out, input, ctx) =>
    checkRaSoat(out, {
      canhIds: input.kichBan.danY.canh.map((c) => c.id),
      beatIds: Object.values(input.kichBan.canh).flatMap((v) => v.beats.map((b) => b.id)),
      soTieuChi: (thangChamOf(ctx.genre) || THANG_CHUNG).tieuChi.length,
    }),
  isEmpty: (out) => out.diem.every((d) => !Number.isFinite(d.diem)),
};
