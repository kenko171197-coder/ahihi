// Màn ① — hai tác vụ: Hỏi lại, Đề xuất logline.
import type { TaskDef } from '../framework';
import { genreHeader, sectionFor } from '../genre';
import { arr, obj, str, int, sentenceCount, pretty, parseSua, SuaYeuCau } from '../util';
import { briefInputText, cauHoiText } from '../format';
import type { BriefInput, HoiLaiCau, LoglineOption } from '../../../shared/project';

export const THOI_LUONG_MIN = 15;
export const THOI_LUONG_MAX = 720;

/** Đọc và kiểm các ô người dùng nhập ở màn ①. */
export function parseBriefInput(v: unknown): BriefInput {
  const o = obj(v);
  const thoai = obj(o.thoai);
  const b: BriefInput = {
    yTuong: str(o.yTuong, 3000),
    theLoai: str(o.theLoai, 80),
    nenTang: o.nenTang === 'ngang' ? 'ngang' : 'doc',
    thoiLuongGiay: int(o.thoiLuongGiay),
    hinhThuc: o.hinhThuc === 'hoat-hinh-3d' || o.hinhThuc === 'hoat-hinh-2d' ? o.hinhThuc : 'nguoi-that',
    thoai: {
      mucDo: thoai.mucDo === 'khong' || thoai.mucDo === 'nhieu' ? thoai.mucDo : 'it',
      ngonNgu: str(thoai.ngonNgu, 40) || 'tiếng Việt',
    },
    nhacNen: o.nhacNen === 'khong' || o.nhacNen === 'co' ? o.nhacNen : 'ai-de-xuat',
    ghiChu: str(o.ghiChu, 2000),
  };
  if (!b.yTuong) throw new Error('Chưa nhập ý tưởng.');
  if (!b.theLoai) throw new Error('Chưa chọn thể loại.');
  if (!Number.isFinite(b.thoiLuongGiay) || b.thoiLuongGiay < THOI_LUONG_MIN || b.thoiLuongGiay > THOI_LUONG_MAX) {
    throw new Error(`Thời lượng phải từ ${THOI_LUONG_MIN} giây tới ${THOI_LUONG_MAX / 60} phút.`);
  }
  return b;
}

/* ============================ HỎI LẠI ============================ */

interface HoiLaiInput {
  brief: BriefInput;
}

export const hoiLai: TaskDef<HoiLaiInput, HoiLaiCau[]> = {
  id: 'hoi-lai',
  promptFile: '01a-hoi-lai.md',
  temperature: 0.5,
  schema: {
    type: 'OBJECT',
    properties: {
      cauHoi: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { cauHoi: { type: 'STRING' }, luaChon: { type: 'ARRAY', items: { type: 'STRING' } } },
          required: ['cauHoi', 'luaChon'],
        },
      },
    },
    required: ['cauHoi'],
  },
  parseInput: (body) => ({ brief: parseBriefInput(obj(body).brief) }),
  genreId: (i) => i.brief.theLoai,
  vars: (i, ctx) => ({
    the_loai: genreHeader(ctx.genre),
    dinh_huong: sectionFor(ctx.genre, 'brief'),
    brief: briefInputText(i.brief),
  }),
  normalize: (raw) =>
    arr(obj(raw).cauHoi)
      .slice(0, 5)
      .map((q, i) => {
        const o = obj(q);
        const luaChon = Array.from(new Set(arr(o.luaChon).map((x) => str(x, 200)).filter(Boolean))).slice(0, 4);
        return { id: `q${i + 1}`, cauHoi: str(o.cauHoi, 300), luaChon, traLoi: '' };
      }),
  check: (out) => {
    const errors: string[] = [];
    if (out.length < 3) errors.push(`Cần 3–5 câu hỏi, mới có ${out.length}.`);
    out.forEach((q, i) => {
      if (!q.cauHoi) errors.push(`Câu ${i + 1} bị trống.`);
      if (q.luaChon.length < 3) errors.push(`Câu ${i + 1} cần 3–4 lựa chọn khác nhau, mới có ${q.luaChon.length}.`);
    });
    return { errors, warnings: [] };
  },
  isEmpty: (out) => out.length === 0,
};

/* ============================ LOGLINE ============================ */

interface LoglineInput {
  brief: BriefInput;
  cauHoi: HoiLaiCau[];
  sua?: SuaYeuCau;
}

export interface LoglineOutput {
  nhanXet: string;
  phuongAn: LoglineOption[];
}

export const logline: TaskDef<LoglineInput, LoglineOutput> = {
  id: 'logline',
  promptFile: '01b-logline.md',
  temperature: 0.9,
  schema: {
    type: 'OBJECT',
    properties: {
      nhanXet: { type: 'STRING' },
      phuongAn: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            logline: { type: 'STRING' },
            thongDiep: { type: 'STRING' },
            camXuc: { type: 'STRING' },
            khanGia: { type: 'STRING' },
            viSaoHop: { type: 'STRING' },
          },
          required: ['logline', 'thongDiep', 'camXuc', 'khanGia', 'viSaoHop'],
        },
      },
    },
    required: ['nhanXet', 'phuongAn'],
  },
  parseInput: (body) => {
    const o = obj(body);
    const cauHoi = arr(o.cauHoi).map((c, i) => {
      const x = obj(c);
      return { id: str(x.id, 20) || `q${i + 1}`, cauHoi: str(x.cauHoi, 300), luaChon: [], traLoi: str(x.traLoi, 500) };
    });
    return { brief: parseBriefInput(o.brief), cauHoi, sua: parseSua(o.sua) };
  },
  genreId: (i) => i.brief.theLoai,
  vars: (i, ctx) => ({
    the_loai: genreHeader(ctx.genre),
    dinh_huong: sectionFor(ctx.genre, 'brief'),
    brief: briefInputText(i.brief),
    tra_loi: cauHoiText(i.cauHoi),
    ban_truoc: i.sua ? pretty(i.sua.truoc) : '',
    yeu_cau_sua: i.sua?.yeuCau || '',
  }),
  normalize: (raw) => {
    const o = obj(raw);
    return {
      nhanXet: str(o.nhanXet, 1500),
      phuongAn: arr(o.phuongAn)
        .slice(0, 3)
        .map((p) => {
          const x = obj(p);
          return {
            logline: str(x.logline, 600),
            thongDiep: str(x.thongDiep, 300),
            camXuc: str(x.camXuc, 200),
            khanGia: str(x.khanGia, 200),
            viSaoHop: str(x.viSaoHop, 400),
          };
        }),
    };
  },
  check: (out) => {
    const errors: string[] = [];
    if (out.phuongAn.length !== 3) errors.push(`Cần đúng 3 phương án, đang có ${out.phuongAn.length}.`);
    if (!out.nhanXet) errors.push('Thiếu nhận xét nhanh về ý tưởng.');
    out.phuongAn.forEach((p, i) => {
      const empty = (Object.keys(p) as (keyof LoglineOption)[]).filter((k) => !p[k]);
      if (empty.length) errors.push(`Phương án ${i + 1} còn trống: ${empty.join(', ')}.`);
      if (p.logline && sentenceCount(p.logline) > 2) errors.push(`Logline phương án ${i + 1} dài quá 2 câu.`);
    });
    return { errors, warnings: [] };
  },
  isEmpty: (out) => out.phuongAn.length === 0,
};
