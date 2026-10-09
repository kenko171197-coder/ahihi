// Màn ③ — Viết treatment: các phần theo khung thể loại, phân đoạn (phim ≥ 3 phút), bảng Cài – Dùng.
import type { TaskDef } from '../framework';
import { genreHeader, sectionFor } from '../genre';
import { checkTreatment } from '../../../shared/checks';
import { arr, obj, str, int, pretty, parseSua, SuaYeuCau } from '../util';
import { briefText, charactersText } from '../format';
import type { Brief, Character, TreatmentData, PhanTruyen } from '../../../shared/project';
import { PHAN_DOAN_TU_GIAY, fmtGiay } from '../../../shared/project';

export { checkTreatment };
import { parseBrief, parseCharacters } from './nhanVat';

interface TreatmentInput {
  brief: Brief;
  nhanVat: Character[];
  sua?: SuaYeuCau;
}

const SEQ_ITEM = {
  type: 'OBJECT',
  properties: {
    ten: { type: 'STRING' },
    mucTieu: { type: 'STRING' },
    batDau: { type: 'INTEGER' },
    ketThuc: { type: 'INTEGER' },
    tomTat: { type: 'STRING' },
  },
  required: ['ten', 'mucTieu', 'batDau', 'ketThuc', 'tomTat'],
};

export const treatment: TaskDef<TreatmentInput, TreatmentData> = {
  id: 'treatment',
  promptFile: '03-treatment.md',
  temperature: 0.8,
  schema: {
    type: 'OBJECT',
    properties: {
      phan: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            ten: { type: 'STRING' },
            vaiTro: { type: 'STRING' },
            batDau: { type: 'INTEGER' },
            ketThuc: { type: 'INTEGER' },
            tomTat: { type: 'STRING' },
            mocTruyen: { type: 'ARRAY', items: { type: 'STRING' } },
            phanDoan: { type: 'ARRAY', items: SEQ_ITEM },
          },
          required: ['ten', 'vaiTro', 'batDau', 'ketThuc', 'tomTat', 'mocTruyen', 'phanDoan'],
        },
      },
      caiDung: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            chiTiet: { type: 'STRING' },
            phanCai: { type: 'INTEGER', description: 'Số thứ tự phần cài (1, 2, …)' },
            phanDung: { type: 'INTEGER', description: 'Số thứ tự phần dùng (1, 2, …)' },
          },
          required: ['chiTiet', 'phanCai', 'phanDung'],
        },
      },
    },
    required: ['phan', 'caiDung'],
  },
  parseInput: (body) => {
    const o = obj(body);
    const nhanVat = parseCharacters(o.nhanVat);
    if (!nhanVat.length) throw new Error('Chưa có nhân vật. Duyệt màn ② trước.');
    return { brief: parseBrief(o.brief), nhanVat, sua: parseSua(o.sua) };
  },
  genreId: (i) => i.brief.theLoai,
  vars: (i, ctx) => {
    const total = i.brief.thoiLuongGiay;
    return {
      the_loai: genreHeader(ctx.genre),
      huong_dan: sectionFor(ctx.genre, 'treatment'),
      cac_phan: ctx.genre?.cacPhan.length ? ctx.genre.cacPhan.join(' → ') : '',
      brief: briefText(i.brief),
      nhan_vat: charactersText(i.nhanVat),
      tong_giay: total,
      tong_thoi_luong: fmtGiay(total),
      co_phan_doan: total >= PHAN_DOAN_TU_GIAY ? 'có' : '',
      ban_truoc: i.sua ? pretty(i.sua.truoc) : '',
      yeu_cau_sua: i.sua?.yeuCau || '',
    };
  },
  normalize: (raw, input) => {
    const o = obj(raw);
    const needSeq = input.brief.thoiLuongGiay >= PHAN_DOAN_TU_GIAY;
    const phan: PhanTruyen[] = arr(o.phan).map((p, i) => {
      const x = obj(p);
      return {
        id: `P${i + 1}`,
        ten: str(x.ten, 120),
        vaiTro: str(x.vaiTro, 300),
        batDau: int(x.batDau),
        ketThuc: int(x.ketThuc),
        tomTat: str(x.tomTat, 3000),
        mocTruyen: arr(x.mocTruyen).map((m) => str(m, 300)).filter(Boolean),
        phanDoan: needSeq
          ? arr(x.phanDoan).map((s, j) => {
              const y = obj(s);
              return { id: `P${i + 1}.${j + 1}`, ten: str(y.ten, 120), mucTieu: str(y.mucTieu, 300), batDau: int(y.batDau), ketThuc: int(y.ketThuc), tomTat: str(y.tomTat, 1500) };
            })
          : [],
      };
    });
    const idOf = (n: unknown) => {
      const k = int(n);
      return Number.isFinite(k) && k >= 1 && k <= phan.length ? phan[k - 1].id : '';
    };
    const caiDung = arr(o.caiDung).map((c, k) => {
      const x = obj(c);
      return { id: `C${k + 1}`, chiTiet: str(x.chiTiet, 300), cai: idOf(x.phanCai), dung: idOf(x.phanDung) };
    });
    return { phan, caiDung };
  },
  check: (out, input, ctx) => checkTreatment(out, input.brief.thoiLuongGiay, ctx.genre?.cacPhan || []),
  isEmpty: (out) => out.phan.length === 0,
};
