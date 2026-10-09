// Màn ② — Đề xuất nhân vật.
import type { TaskDef } from '../framework';
import { genreHeader, sectionFor } from '../genre';
import { arr, obj, str, pretty, parseSua, SuaYeuCau } from '../util';
import { briefText } from '../format';
import type { Brief, Character, VaiNhanVat } from '../../../shared/project';
import { maxNhanVat, toTag, uniqueTag, tiLeCua } from '../../../shared/project';
import { checkCharacters } from '../../../shared/checks';
import { parseBriefInput } from './brief';

/** Đọc brief đã duyệt (các màn sau gửi lên). */
export function parseBrief(v: unknown): Brief {
  const o = obj(v);
  const input = parseBriefInput(o);
  const b: Brief = {
    ...input,
    tiLe: tiLeCua(input.nenTang),
    logline: str(o.logline, 600),
    thongDiep: str(o.thongDiep, 300),
    camXuc: str(o.camXuc, 200),
    khanGia: str(o.khanGia, 200),
  };
  if (!b.logline) throw new Error('Brief chưa có logline. Duyệt màn ① trước.');
  return b;
}

/** Đọc danh sách nhân vật đã duyệt. */
export function parseCharacters(v: unknown): Character[] {
  return arr(v).map((c) => {
    const o = obj(c);
    return {
      id: str(o.id, 40),
      ten: str(o.ten, 80),
      tag: toTag(str(o.tag, 40)),
      vai: normVai(o.vai),
      tuoi: str(o.tuoi, 40),
      muon: str(o.muon, 400),
      can: str(o.can, 400),
      tinhCach: str(o.tinhCach, 300),
      chiTiet: str(o.chiTiet, 400),
      quanHe: str(o.quanHe, 400),
      ghiChuThietKe: str(o.ghiChuThietKe, 400),
    };
  });
}

export function normVai(v: unknown): VaiNhanVat {
  const t = toTag(String(v ?? ''));
  if (t.includes('giantiep') || t.startsWith('gian') || t.includes('indirect')) return 'gian-tiep';
  if (t.includes('chinh') || t.includes('main') || t.includes('lead') || t.includes('protagonist')) return 'chinh';
  return 'phu';
}

interface NhanVatInput {
  brief: Brief;
  sua?: SuaYeuCau;
}

export const nhanVat: TaskDef<NhanVatInput, Character[]> = {
  id: 'nhan-vat',
  promptFile: '02-nhan-vat.md',
  temperature: 0.8,
  schema: {
    type: 'OBJECT',
    properties: {
      nhanVat: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            ten: { type: 'STRING' },
            vai: { type: 'STRING', description: 'Đúng một trong ba giá trị: chinh, phu, gian-tiep' },
            tuoi: { type: 'STRING' },
            muon: { type: 'STRING' },
            can: { type: 'STRING' },
            tinhCach: { type: 'STRING' },
            chiTiet: { type: 'STRING' },
            quanHe: { type: 'STRING' },
            ghiChuThietKe: { type: 'STRING' },
          },
          required: ['ten', 'vai', 'tuoi', 'muon', 'can', 'tinhCach', 'chiTiet', 'quanHe', 'ghiChuThietKe'],
        },
      },
    },
    required: ['nhanVat'],
  },
  parseInput: (body) => {
    const o = obj(body);
    return { brief: parseBrief(o.brief), sua: parseSua(o.sua) };
  },
  genreId: (i) => i.brief.theLoai,
  vars: (i, ctx) => ({
    the_loai: genreHeader(ctx.genre),
    huong_dan: sectionFor(ctx.genre, 'nhanVat'),
    brief: briefText(i.brief),
    toi_da: maxNhanVat(i.brief.thoiLuongGiay),
    ban_truoc: i.sua ? pretty(i.sua.truoc) : '',
    yeu_cau_sua: i.sua?.yeuCau || '',
  }),
  normalize: (raw, input) => {
    // Khi sửa theo yêu cầu: nhân vật cùng tên giữ nguyên id và tag cũ
    const previous = input.sua ? parseCharacters(obj(input.sua.truoc).list ?? input.sua.truoc) : [];
    const taken = new Set<string>();
    const usedIds = new Set<string>();
    let next = previous.reduce((m, c) => Math.max(m, Number(/(\d+)$/.exec(c.id)?.[1] || 0)), 0);
    return arr(obj(raw).nhanVat).map((c) => {
      const o = obj(c);
      const ten = str(o.ten, 80);
      // Chỉ giữ id/tag cũ khi trùng tên (không rỗng) và id đó chưa bị nhân vật khác dùng
      const old = toTag(ten) ? previous.find((p) => toTag(p.ten) === toTag(ten) && !usedIds.has(p.id)) : undefined;
      const tag = old && old.tag && !taken.has(old.tag) ? old.tag : uniqueTag(ten, taken);
      taken.add(tag);
      let id = old?.id || '';
      while (!id || usedIds.has(id)) id = `nv${++next}`;
      usedIds.add(id);
      return {
        id,
        ten,
        tag,
        vai: normVai(o.vai),
        tuoi: str(o.tuoi, 40),
        muon: str(o.muon, 400),
        can: str(o.can, 400),
        tinhCach: str(o.tinhCach, 300),
        chiTiet: str(o.chiTiet, 400),
        quanHe: str(o.quanHe, 400),
        ghiChuThietKe: str(o.ghiChuThietKe, 400),
      };
    });
  },
  check: (out, input) => checkCharacters(out, input.brief.thoiLuongGiay),
  isEmpty: (out) => out.length === 0,
};
