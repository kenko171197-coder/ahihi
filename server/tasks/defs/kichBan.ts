// Màn ④ — Kịch bản: dàn ý cảnh (gọi 1 lần) và viết beat từng cảnh (gọi 1 lần mỗi cảnh).
import type { TaskDef } from '../framework';
import { genreHeader, sectionFor, beatGiayOf } from '../genre';
import { arr, obj, str, int, parseSua } from '../util';
import { briefText, charactersText, treatmentText, caiDungText, danYText, danYNgan, canhDanYText, daoCuText, beatText } from '../format';
import type { Beat, Brief, CanhDanY, Character, DanY, DaoCu, DongTrangThai, TreatmentData } from '../../../shared/project';
import { BEAT_MAX, BEAT_MIN, fmtGiay, toTag } from '../../../shared/project';
import { canhId, beatId, idNum, normBeatId, normCanhId, trangThaiText } from '../../../shared/kichBan';
import { checkDanY, checkCanh, canhCtx } from '../../../shared/checks';
import { parseBrief, parseCharacters } from './nhanVat';
import { parseTreatmentData } from './treatment';

/* ---------- Đọc dữ liệu (đầu vào từ giao diện và kết quả AI) ---------- */

const tags = (v: unknown): string[] => Array.from(new Set(arr(v).map((x) => toTag(str(x, 40))).filter(Boolean)));

export const parseDong = (v: unknown): DongTrangThai[] =>
  arr(v)
    .map((x) => {
      const o = obj(x);
      return { tag: toTag(str(o.tag, 40)), moTa: str(o.moTa, 400) };
    })
    .filter((l) => l.tag);

const parseDaoCu = (v: unknown): DaoCu[] =>
  arr(v)
    .map((x) => {
      const o = obj(x);
      return { tag: toTag(str(o.tag, 40)), moTa: str(o.moTa, 400) };
    })
    .filter((d) => d.tag);

function parseCanhDanY(v: unknown): CanhDanY {
  const o = obj(v);
  return {
    id: str(o.id, 20),
    phan: str(o.phan, 20),
    diaDiem: str(o.diaDiem, 120),
    tagDiaDiem: toTag(str(o.tagDiaDiem, 40)),
    thoiDiem: str(o.thoiDiem, 80),
    anhSang: str(o.anhSang, 300),
    chuyenBien: str(o.chuyenBien, 400),
    coMat: tags(o.coMat),
    batDau: int(o.batDau),
    ketThuc: int(o.ketThuc),
    dauCanh: parseDong(o.dauCanh),
    cuoiCanh: parseDong(o.cuoiCanh),
  };
}

export function parseDanY(v: unknown): DanY {
  const o = obj(v);
  return {
    canh: arr(o.canh).map(parseCanhDanY),
    caiDung: arr(o.caiDung).map((c) => {
      const x = obj(c);
      return { id: str(x.id, 20), cai: str(x.cai, 20), dung: str(x.dung, 20) };
    }),
  };
}

/** Một beat. charTags: để đọc người nói (tag nhân vật, hoặc giữ tên người không có ở màn ②). */
export function parseBeat(v: unknown, charTags: Set<string>): Beat {
  const o = obj(v);
  const daoCuMoi = parseDaoCu(o.daoCuMoi);
  const coMat = Array.from(new Set([...tags(o.coMat), ...daoCuMoi.map((d) => d.tag)]));
  return {
    id: str(o.id, 20),
    giay: int(o.giay),
    hanhDong: str(o.hanhDong, 1500),
    thoai: arr(o.thoai)
      .map((t) => {
        const x = obj(t);
        const raw = str(x.ai, 80).replace(/^@/, '');
        return { ai: charTags.has(toTag(raw)) ? toTag(raw) : raw, cachNoi: str(x.cachNoi, 120), cau: str(x.cau, 600) };
      })
      .filter((t) => t.cau || t.ai),
    amThanh: str(o.amThanh, 400),
    camXuc: str(o.camXuc, 200),
    coMat,
    daoCuMoi,
    thayDoi: arr(o.thayDoi)
      .map((t) => {
        const x = obj(t);
        return { tag: toTag(str(x.tag, 40)), truoc: str(x.truoc, 200), sau: str(x.sau, 200) };
      })
      .filter((t) => t.tag),
    caiDung: Array.from(new Set(arr(o.caiDung).map((x) => str(x, 20).toUpperCase().replace(/\s+/g, '')).filter((x) => /^C\d+$/.test(x)))),
    cuoiBeat: parseDong(o.cuoiBeat),
  };
}

const charTagSet = (list: Character[]) => new Set(list.map((c) => c.tag));

/* ---------- Khuôn trả về ---------- */

const DONG = { type: 'ARRAY', items: { type: 'OBJECT', properties: { tag: { type: 'STRING' }, moTa: { type: 'STRING' } }, required: ['tag', 'moTa'] } };

/* ============================ Dàn ý cảnh ============================ */

interface DanYInput {
  brief: Brief;
  nhanVat: Character[];
  treatment: TreatmentData;
  /** Số tiếp theo cho mã cảnh */
  soCanh: number;
  sua?: { truoc: DanY; yeuCau: string };
}

export const danYCanh: TaskDef<DanYInput, DanY> = {
  id: 'dan-y-canh',
  promptFile: '04a-dan-y-canh.md',
  temperature: 0.7,
  schema: {
    type: 'OBJECT',
    properties: {
      canh: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            ma: { type: 'STRING', description: 'Mã cảnh cũ (S1…) khi sửa theo yêu cầu; cảnh mới để trống' },
            phan: { type: 'INTEGER', description: 'Số thứ tự phần của treatment (1, 2, …)' },
            diaDiem: { type: 'STRING' },
            tagDiaDiem: { type: 'STRING' },
            thoiDiem: { type: 'STRING' },
            anhSang: { type: 'STRING' },
            chuyenBien: { type: 'STRING' },
            coMat: { type: 'ARRAY', items: { type: 'STRING' } },
            batDau: { type: 'INTEGER' },
            ketThuc: { type: 'INTEGER' },
            dauCanh: DONG,
            cuoiCanh: DONG,
          },
          required: ['ma', 'phan', 'diaDiem', 'tagDiaDiem', 'thoiDiem', 'anhSang', 'chuyenBien', 'coMat', 'batDau', 'ketThuc', 'dauCanh', 'cuoiCanh'],
        },
      },
      caiDung: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            ma: { type: 'STRING', description: 'Mã dòng Cài – Dùng của treatment (C1…)' },
            canhCai: { type: 'INTEGER', description: 'Số thứ tự cảnh cài (1, 2, …)' },
            canhDung: { type: 'INTEGER', description: 'Số thứ tự cảnh dùng (1, 2, …)' },
          },
          required: ['ma', 'canhCai', 'canhDung'],
        },
      },
    },
    required: ['canh', 'caiDung'],
  },
  parseInput: (body) => {
    const o = obj(body);
    const nhanVat = parseCharacters(o.nhanVat);
    if (!nhanVat.length) throw new Error('Chưa có nhân vật. Duyệt màn ② trước.');
    const sua = parseSua(o.sua);
    return {
      brief: parseBrief(o.brief),
      nhanVat,
      treatment: parseTreatmentData(o.treatment),
      soCanh: Math.max(1, int(o.soCanh) || 1),
      sua: sua ? { truoc: parseDanY(sua.truoc), yeuCau: sua.yeuCau } : undefined,
    };
  },
  genreId: (i) => i.brief.theLoai,
  vars: (i, ctx) => {
    const bg = beatGiayOf(ctx.genre);
    return {
      the_loai: genreHeader(ctx.genre),
      huong_dan: sectionFor(ctx.genre, 'kichBan'),
      brief: briefText(i.brief),
      nhan_vat: charactersText(i.nhanVat),
      treatment: treatmentText(i.treatment),
      cai_dung: caiDungText(i.treatment),
      tong_giay: i.brief.thoiLuongGiay,
      tong_thoi_luong: fmtGiay(i.brief.thoiLuongGiay),
      beat_giay: bg ? `${bg[0]}–${bg[1]}` : '',
      ban_truoc: i.sua ? danYText(i.sua.truoc, i.treatment) : '',
      yeu_cau_sua: i.sua?.yeuCau || '',
    };
  },
  normalize: (raw, input) => {
    const o = obj(raw);
    const prevIds = new Set((input.sua?.truoc.canh || []).map((c) => c.id));
    let next = Math.max(input.soCanh, ...Array.from(prevIds).map((id) => idNum(id) + 1));
    const used = new Set<string>();
    const canh: CanhDanY[] = arr(o.canh).map((v) => {
      const x = obj(v);
      const ma = normCanhId(str(x.ma, 20));
      let id = prevIds.has(ma) && !used.has(ma) ? ma : '';
      while (!id || used.has(id) || (prevIds.has(id) && id !== ma)) id = canhId(next++);
      used.add(id);
      const k = int(x.phan);
      return {
        ...parseCanhDanY(x),
        id,
        phan: Number.isFinite(k) && k >= 1 && k <= input.treatment.phan.length ? input.treatment.phan[k - 1].id : '',
      };
    });
    const sceneAt = (n: unknown) => {
      const k = int(n);
      return Number.isFinite(k) && k >= 1 && k <= canh.length ? canh[k - 1].id : '';
    };
    const rows = arr(o.caiDung).map(obj);
    const caiDung = input.treatment.caiDung.map((r) => {
      const x = rows.find((y) => str(y.ma, 20).toUpperCase().replace(/\s+/g, '') === r.id);
      return { id: r.id, cai: x ? sceneAt(x.canhCai) : '', dung: x ? sceneAt(x.canhDung) : '' };
    });
    return { canh, caiDung };
  },
  check: (out, input) => checkDanY(out, { total: input.brief.thoiLuongGiay, treatment: input.treatment, nhanVat: input.nhanVat }),
  isEmpty: (out) => out.canh.length === 0,
};

/* ============================ Viết beat một cảnh ============================ */

interface VietCanhInput {
  brief: Brief;
  nhanVat: Character[];
  treatment: TreatmentData;
  danY: DanY;
  canhId: string;
  /** Trạng thái cuối và 1–2 beat cuối của cảnh trước (null nếu là cảnh đầu) */
  canhTruoc: { cuoi: DongTrangThai[]; beats: Beat[] } | null;
  daoCuTruoc: DaoCu[];
  /** Số tiếp theo cho mã beat */
  soBeat: number;
  sua?: { truoc: Beat[]; yeuCau: string };
}

export const vietCanh: TaskDef<VietCanhInput, Beat[]> = {
  id: 'viet-canh',
  promptFile: '04b-viet-canh.md',
  temperature: 0.8,
  schema: {
    type: 'OBJECT',
    properties: {
      beats: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            ma: { type: 'STRING', description: 'Mã beat cũ (B001…) khi sửa theo yêu cầu; beat mới để trống' },
            giay: { type: 'INTEGER' },
            hanhDong: { type: 'STRING' },
            thoai: {
              type: 'ARRAY',
              items: { type: 'OBJECT', properties: { ai: { type: 'STRING' }, cachNoi: { type: 'STRING' }, cau: { type: 'STRING' } }, required: ['ai', 'cachNoi', 'cau'] },
            },
            amThanh: { type: 'STRING' },
            camXuc: { type: 'STRING' },
            coMat: { type: 'ARRAY', items: { type: 'STRING' } },
            daoCuMoi: DONG,
            thayDoi: {
              type: 'ARRAY',
              items: { type: 'OBJECT', properties: { tag: { type: 'STRING' }, truoc: { type: 'STRING' }, sau: { type: 'STRING' } }, required: ['tag', 'truoc', 'sau'] },
            },
            caiDung: { type: 'ARRAY', items: { type: 'STRING' } },
            cuoiBeat: DONG,
          },
          required: ['ma', 'giay', 'hanhDong', 'thoai', 'amThanh', 'camXuc', 'coMat', 'daoCuMoi', 'thayDoi', 'caiDung', 'cuoiBeat'],
        },
      },
    },
    required: ['beats'],
  },
  parseInput: (body) => {
    const o = obj(body);
    const nhanVat = parseCharacters(o.nhanVat);
    if (!nhanVat.length) throw new Error('Chưa có nhân vật. Duyệt màn ② trước.');
    const danY = parseDanY(o.danY);
    const id = str(o.canhId, 20);
    if (!danY.canh.some((c) => c.id === id)) throw new Error(`Không có cảnh ${id || '(trống)'} trong dàn ý.`);
    const ct = o.canhTruoc ? obj(o.canhTruoc) : null;
    const tagsNv = charTagSet(nhanVat);
    const sua = parseSua(o.sua);
    return {
      brief: parseBrief(o.brief),
      nhanVat,
      treatment: parseTreatmentData(o.treatment),
      danY,
      canhId: id,
      canhTruoc: ct ? { cuoi: parseDong(ct.cuoi), beats: arr(ct.beats).slice(-2).map((b) => parseBeat(b, tagsNv)) } : null,
      daoCuTruoc: parseDaoCu(o.daoCuTruoc),
      soBeat: Math.max(1, int(o.soBeat) || 1),
      sua: sua ? { truoc: arr(sua.truoc).map((b) => parseBeat(b, tagsNv)), yeuCau: sua.yeuCau } : undefined,
    };
  },
  genreId: (i) => i.brief.theLoai,
  vars: (i, ctx) => {
    const k = i.danY.canh.findIndex((c) => c.id === i.canhId);
    const c = i.danY.canh[k];
    const bg = beatGiayOf(ctx.genre);
    const cc = canhCtx(i.danY, i.canhId, { treatment: i.treatment, nhanVat: i.nhanVat, daoCuTruoc: i.daoCuTruoc, mucThoai: i.brief.thoai.mucDo, nhacNen: i.brief.nhacNen });
    const truoc = i.canhTruoc
      ? [...i.canhTruoc.beats.map((b) => beatText(b, i.nhanVat)), `Trạng thái cuối cảnh trước: ${trangThaiText(i.canhTruoc.cuoi, '; ')}`].join('\n')
      : '';
    // Các tag đã dùng — đạo cụ mới không được trùng
    const used = Array.from(new Set([...i.nhanVat.map((x) => x.tag), ...i.danY.canh.map((x) => x.tagDiaDiem).filter(Boolean), ...i.daoCuTruoc.map((d) => d.tag)]));
    return {
      the_loai: genreHeader(ctx.genre),
      huong_dan: sectionFor(ctx.genre, 'kichBan'),
      brief: briefText(i.brief),
      nhan_vat: charactersText(i.nhanVat),
      treatment: treatmentText(i.treatment),
      dan_y: danYNgan(i.danY),
      canh: canhDanYText(i.danY, k, i.treatment),
      so_canh: k + 1,
      giay_canh: c.ketThuc - c.batDau,
      beat_min: BEAT_MIN,
      beat_max: BEAT_MAX,
      beat_giay: bg ? `${bg[0]}–${bg[1]}` : '',
      canh_truoc: truoc,
      dao_cu: daoCuText(i.daoCuTruoc),
      tag_da_dung: used.map((t) => `@${t}`).join(', '),
      khong_thoai: i.brief.thoai.mucDo === 'khong' ? 'có' : '',
      khong_nhac: i.brief.nhacNen === 'khong' ? 'có' : '',
      cai_dung: (cc?.caiDung || []).map((x) => `- ${x.id} "${x.chiTiet}": ${x.vai} ở cảnh này`).join('\n'),
      ban_truoc: i.sua ? i.sua.truoc.map((b) => beatText(b, i.nhanVat)).join('\n') : '',
      yeu_cau_sua: i.sua?.yeuCau || '',
    };
  },
  normalize: (raw, input) => {
    const tagsNv = charTagSet(input.nhanVat);
    const prevIds = new Set((input.sua?.truoc || []).map((b) => b.id));
    let next = Math.max(input.soBeat, ...Array.from(prevIds).map((id) => idNum(id) + 1));
    const used = new Set<string>();
    return arr(obj(raw).beats).map((v) => {
      const x = obj(v);
      const ma = normBeatId(str(x.ma, 20));
      let id = prevIds.has(ma) && !used.has(ma) ? ma : '';
      while (!id || used.has(id) || (prevIds.has(id) && id !== ma)) id = beatId(next++);
      used.add(id);
      return { ...parseBeat(x, tagsNv), id };
    });
  },
  check: (out, input, ctx) => {
    const cc = canhCtx(input.danY, input.canhId, {
      treatment: input.treatment,
      nhanVat: input.nhanVat,
      daoCuTruoc: input.daoCuTruoc,
      mucThoai: input.brief.thoai.mucDo,
      nhacNen: input.brief.nhacNen,
      beatGiay: beatGiayOf(ctx.genre),
    });
    return cc ? checkCanh(out, cc) : { errors: ['Không có cảnh này trong dàn ý.'], warnings: [] };
  },
  isEmpty: (out) => out.length === 0,
};
