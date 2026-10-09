// Màn ⑦ — Phân cảnh: chia mỗi beat của một cảnh thành các shot (máy quay chọn trong danh sách cố định, mô tả tiếng Việt).
import type { TaskDef } from '../framework';
import { genreHeader, sectionFor } from '../genre';
import { arr, obj, str } from '../util';
import { briefText } from '../format';
import type { Brief, Character, KichBanData, PhanCanhBeat, Shot } from '../../../shared/project';
import { toTag } from '../../../shared/project';
import { beatsOf, dauBeat, normBeatId, trangThaiText } from '../../../shared/kichBan';
import { CO_CANH, GOC_MAY, CHUYEN_DONG, tronNuaGiay, shotId } from '../../../shared/phanCanh';
import { checkPhanCanhCanh, normName } from '../../../shared/checks';
import { parseBrief, parseCharacters } from './nhanVat';
import { parseKichBan } from './raSoat';

interface PhanCanhInput {
  brief: Brief;
  nhanVat: Character[];
  kichBan: Pick<KichBanData, 'danY' | 'canh'>;
  canhId: string;
  /** Sửa theo yêu cầu: shot hiện có của cảnh */
  sua?: { truoc: Record<string, PhanCanhBeat>; yeuCau: string };
}

/** Đọc lựa chọn máy quay: mã ("can-trung") hoặc tên tiếng Việt ("Cận trung"). Không đọc được → giữ nguyên để code kiểm báo lỗi. */
function chon<T extends string>(list: { id: T; vi: string; en: string }[], v: unknown): T {
  const s = str(v, 60);
  const n = normName(s);
  return (list.find((x) => x.id === s || normName(x.vi) === n || normName(x.en) === n)?.id || s) as T;
}

/** Shot hiện có (từ giao diện, chế độ sửa). */
export function parseShots(v: unknown): Shot[] {
  return arr(v).map((x) => {
    const o = obj(x);
    return {
      id: str(o.id, 30),
      giay: tronNuaGiay(Number(o.giay)),
      coCanh: chon(CO_CANH, o.coCanh),
      gocMay: chon(GOC_MAY, o.gocMay),
      chuyenDong: chon(CHUYEN_DONG, o.chuyenDong),
      moTa: str(o.moTa, 1200),
      trongKhung: Array.from(new Set(arr(o.trongKhung).map((t) => toTag(str(t, 40))).filter(Boolean))),
      thoai: arr(o.thoai).map((k) => Math.round(Number(k))).filter((k) => Number.isFinite(k) && k >= 0),
    };
  });
}

const beatsCuaCanh = (i: PhanCanhInput) => beatsOf(i.kichBan as KichBanData, i.canhId);
const diaDiemCua = (i: PhanCanhInput) => Array.from(new Set(i.kichBan.danY.canh.flatMap((c) => [c.diaDiem, c.tagDiaDiem]).filter(Boolean)));

const ds = (list: { id: string; vi: string; en: string }[]) => list.map((x) => `"${x.id}" = ${x.vi} (${x.en})`).join(' · ');

export const phanCanh: TaskDef<PhanCanhInput, Record<string, PhanCanhBeat>> = {
  id: 'phan-canh',
  promptFile: '07-phan-canh.md',
  temperature: 0.6,
  schema: {
    type: 'OBJECT',
    properties: {
      beats: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            ma: { type: 'STRING', description: 'Mã beat (B001…)' },
            shots: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  giay: { type: 'NUMBER', description: 'Số giây, bước 0,5' },
                  coCanh: { type: 'STRING', format: 'enum', enum: CO_CANH.map((x) => x.id) },
                  gocMay: { type: 'STRING', format: 'enum', enum: GOC_MAY.map((x) => x.id) },
                  chuyenDong: { type: 'STRING', format: 'enum', enum: CHUYEN_DONG.map((x) => x.id) },
                  moTa: { type: 'STRING' },
                  trongKhung: { type: 'ARRAY', items: { type: 'STRING' } },
                  thoai: { type: 'ARRAY', items: { type: 'INTEGER' }, description: 'Số thứ tự câu thoại của beat (1, 2, …)' },
                },
                required: ['giay', 'coCanh', 'gocMay', 'chuyenDong', 'moTa', 'trongKhung', 'thoai'],
              },
            },
          },
          required: ['ma', 'shots'],
        },
      },
    },
    required: ['beats'],
  },
  parseInput: (body) => {
    const o = obj(body);
    const nhanVat = parseCharacters(o.nhanVat);
    const kichBan = parseKichBan(o.kichBan, nhanVat);
    const canhId = str(o.canhId, 20);
    if (!kichBan.danY.canh.some((c) => c.id === canhId)) throw new Error(`Không có cảnh ${canhId || '(trống)'} trong kịch bản.`);
    if (!beatsOf(kichBan as KichBanData, canhId).length) throw new Error('Cảnh này chưa có beat nào.');
    const s = obj(o.sua);
    const yeuCau = str(s.yeuCau, 2000);
    const truoc: Record<string, PhanCanhBeat> = {};
    Object.entries(obj(s.truoc)).forEach(([k, v]) => (truoc[k] = { shots: parseShots(obj(v).shots), soShot: Math.max(1, Math.round(Number(obj(v).soShot)) || 1) }));
    return { brief: parseBrief(o.brief), nhanVat, kichBan, canhId, sua: yeuCau ? { truoc, yeuCau } : undefined };
  },
  genreId: (i) => i.brief.theLoai,
  vars: (i, ctx) => {
    const k = i.kichBan.danY.canh.findIndex((c) => c.id === i.canhId);
    const c = i.kichBan.danY.canh[k];
    const beats = beatsCuaCanh(i);
    const ten = (ai: string) => i.nhanVat.find((x) => x.tag === ai)?.ten || ai;
    return {
      the_loai: genreHeader(ctx.genre),
      huong_dan: sectionFor(ctx.genre, 'phanCanh'),
      brief: briefText(i.brief),
      ti_le: i.brief.tiLe,
      so_canh: k + 1,
      canh: `Cảnh ${k + 1} [${c.id}] · ${c.diaDiem} · ${c.thoiDiem} · Chuyển biến: ${c.chuyenBien}`,
      beats: beats
        .map((b, j) =>
          [
            `[${b.id}] ${b.giay} giây — ${b.hanhDong}`,
            `  Có mặt: ${b.coMat.map((t) => `@${t}`).join(', ') || '(không ai)'}`,
            `  Đầu beat: ${trangThaiText(dauBeat(c, beats, j), '; ') || '—'}`,
            `  Cuối beat: ${trangThaiText(b.cuoiBeat, '; ') || '—'}`,
            ...b.thoai.map((t, n) => `  Thoại ${n + 1}) ${ten(t.ai).toUpperCase()}${b.coMat.includes(t.ai) ? ` (@${t.ai})` : ''}${t.cachNoi ? ` (${t.cachNoi})` : ''}: "${t.cau}"`),
            b.camXuc ? `  Cảm xúc / nhịp: ${b.camXuc}` : '',
          ]
            .filter(Boolean)
            .join('\n')
        )
        .join('\n'),
      co_canh: ds(CO_CANH),
      goc_may: ds(GOC_MAY),
      chuyen_dong: ds(CHUYEN_DONG),
      ban_truoc: i.sua
        ? beats
            .map((b) => [`[${b.id}]`, ...(i.sua!.truoc[b.id]?.shots || []).map((s, n) => `  Shot ${n + 1}: ${s.giay}s · ${s.coCanh} · ${s.gocMay} · ${s.chuyenDong} · ${s.moTa} · khung: ${s.trongKhung.map((t) => `@${t}`).join(', ')} · thoại: ${s.thoai.map((x) => x + 1).join(', ') || '—'}`)].join('\n'))
            .join('\n')
        : '',
      yeu_cau_sua: i.sua?.yeuCau || '',
    };
  },
  normalize: (raw, i) => {
    const rows = arr(obj(raw).beats).map(obj);
    const out: Record<string, PhanCanhBeat> = {};
    beatsCuaCanh(i).forEach((b) => {
      const r = rows.find((x) => normBeatId(str(x.ma, 20)) === b.id);
      const shots = parseShots(r ? r.shots : []).map((s, k) => ({ ...s, id: shotId(b.id, k + 1), thoai: s.thoai.map((n) => n - 1).filter((n) => n >= 0) }));
      out[b.id] = { shots, soShot: shots.length + 1 };
    });
    return out;
  },
  check: (out, i) => {
    const r = checkPhanCanhCanh(beatsCuaCanh(i), { beats: out, dauVao: '', updatedAt: 0 }, { diaDiem: diaDiemCua(i) });
    return { errors: r.errors, warnings: r.warnings };
  },
  isEmpty: (out) => Object.values(out).every((b) => !b.shots.length),
};

