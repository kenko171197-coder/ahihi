// Màn ⑥ — Bible: style (3 phương án), nhân vật (giọng + bộ đồ), đạo cụ, bối cảnh + ánh sáng từng cảnh.
// AI chỉ viết phần cố định của từng mục đã bóc tách; code giữ tag, ghép prompt ảnh, đồng bộ ánh sáng.
import type { TaskDef, TaskCtx } from '../framework';
import { genreHeader, sectionFor } from '../genre';
import { arr, obj, str, int } from '../util';
import { briefText, characterText, charactersText, danYNgan } from '../format';
import type { AnhSangCanh, BibleBoiCanh, BibleData, BibleDaoCu, BibleNhanVat, BoDo, Brief, Character, KichBanData } from '../../../shared/project';
import { toTag, uniqueTag } from '../../../shared/project';
import { normCanhId, beatsOf } from '../../../shared/kichBan';
import { dongBoAnhSang, emptyBible } from '../../../shared/bible';
import { checkStyle, checkBibleNhanVat, checkBibleDaoCu, checkBibleBoiCanh, normName } from '../../../shared/checks';
import { parseBrief, parseCharacters } from './nhanVat';
import { parseKichBan } from './raSoat';

/* ---------- Đọc dữ liệu từ giao diện ---------- */

const strs = (v: unknown, max = 40) => arr(v).map((x) => str(x, max)).filter(Boolean);

export function parseBible(v: unknown): BibleData {
  const o = obj(v);
  const base = emptyBible();
  return {
    style: str(o.style, 1200),
    phuongAnStyle: arr(o.phuongAnStyle).map((x) => ({ style: str(obj(x).style, 1200), giaiThich: str(obj(x).giaiThich, 600) })),
    nhanVat: arr(o.nhanVat).map((x) => {
      const n = obj(x);
      return {
        tag: toTag(str(n.tag, 40)),
        ten: str(n.ten, 80),
        canh: strs(n.canh),
        coThoai: n.coThoai === true,
        giong: str(n.giong, 600),
        bo: arr(n.bo).map((y) => {
          const b = obj(y);
          return { tag: toTag(str(b.tag, 40)), ten: str(b.ten, 80), canh: strs(b.canh), moTa: str(b.moTa, 1500), note: str(b.note, 600), khungAnh: str(b.khungAnh, 800), vaiTro: str(b.vaiTro, 200) };
        }),
        khongDung: n.khongDung === true || undefined,
      };
    }),
    daoCu: arr(o.daoCu).map((x) => {
      const d = obj(x);
      return {
        tag: toTag(str(d.tag, 40)),
        moTaKichBan: str(d.moTaKichBan, 400),
        trangThai: strs(d.trangThai, 200),
        canh: strs(d.canh),
        moTa: str(d.moTa, 1200),
        note: str(d.note, 600),
        khungAnh: str(d.khungAnh, 800),
        vaiTro: str(d.vaiTro, 200),
        khongDung: d.khongDung === true || undefined,
      };
    }),
    boiCanh: arr(o.boiCanh).map((x) => {
      const c = obj(x);
      return {
        tag: toTag(str(c.tag, 40)),
        ten: str(c.ten, 120),
        canh: strs(c.canh),
        moTa: str(c.moTa, 1500),
        bienThe: arr(c.bienThe).map((y) => {
          const b = obj(y);
          return { tag: toTag(str(b.tag, 40)), thoiDiem: str(b.thoiDiem, 80), canh: strs(b.canh), note: str(b.note, 600), khungAnh: str(b.khungAnh, 800), vaiTro: str(b.vaiTro, 200) };
        }),
        khongDung: c.khongDung === true || undefined,
      };
    }),
    anhSang: arr(o.anhSang).map((x) => {
      const a = obj(x);
      return { canh: str(a.canh, 20), diaDiem: toTag(str(a.diaDiem, 40)), thoiDiem: str(a.thoiDiem, 80), goc: str(a.goc, 300), moTa: str(a.moTa, 600) };
    }),
    anh: base.anh,
  };
}

interface BibleInput {
  brief: Brief;
  nhanVat: Character[];
  kichBan: Pick<KichBanData, 'danY' | 'canh'>;
  bible: BibleData;
  /** Sửa theo yêu cầu (bản trước là nhóm tương ứng trong bible) */
  yeuCau: string;
}

function parseBibleInput(body: unknown, needStyle: boolean): BibleInput {
  const o = obj(body);
  const nhanVat = parseCharacters(o.nhanVat);
  const kichBan = parseKichBan(o.kichBan, nhanVat);
  if (!kichBan.danY.canh.length) throw new Error('Chưa có kịch bản chốt. Duyệt màn ⑤ trước.');
  const bible = parseBible(o.bible);
  if (needStyle && !bible.style) throw new Error('Chưa chọn style. Chọn style trước rồi mới viết phần cố định.');
  return { brief: parseBrief(o.brief), nhanVat, kichBan, bible, yeuCau: str(obj(o.sua).yeuCau, 2000) };
}

/* ---------- Đoạn chữ đưa vào prompt ---------- */

const canhIds = (i: BibleInput) => i.kichBan.danY.canh.map((c) => c.id);
const soCanh = (i: BibleInput, ids: string[]) => ids.map((id) => canhIds(i).indexOf(id) + 1).filter((n) => n > 0);
const dsCanh = (i: BibleInput, ids: string[]) => (ids.length ? `cảnh ${soCanh(i, ids).join(', ')}` : 'không có cảnh nào');

/** Các cảnh (dòng dàn ý + hành động các beat) — chỉ những cảnh có tag cần. */
function canhText(i: BibleInput, chi?: (canhId: string) => boolean, chiBeat?: (coMat: string[]) => boolean): string {
  return i.kichBan.danY.canh
    .map((c, k) => ({ c, k }))
    .filter(({ c }) => !chi || chi(c.id))
    .map(({ c, k }) => {
      const beats = beatsOf(i.kichBan as KichBanData, c.id).filter((b) => !chiBeat || chiBeat(b.coMat));
      return [
        `Cảnh ${k + 1} [${c.id}] · ${c.diaDiem} (@${c.tagDiaDiem}) · ${c.thoiDiem} · ánh sáng: ${c.anhSang}`,
        `  Có mặt: ${c.coMat.map((t) => `@${t}`).join(', ') || '(không ai)'} · Chuyển biến: ${c.chuyenBien}`,
        ...beats.map((b) => `  [${b.id}] ${b.hanhDong}`),
      ].join('\n');
    })
    .join('\n');
}

const commonVars = (i: BibleInput, ctx: TaskCtx) => ({
  the_loai: genreHeader(ctx.genre),
  huong_dan: sectionFor(ctx.genre, 'bible'),
  brief: briefText(i.brief),
  style: i.bible.style,
  yeu_cau_sua: i.yeuCau,
});

const DONG_ANH = {
  moTa: { type: 'STRING' },
  note: { type: 'STRING' },
  khungAnh: { type: 'STRING' },
  vaiTro: { type: 'STRING' },
};

/** Tag đang dùng ngoài nhóm nhân vật (để đặt tag bộ đồ không trùng). */
const tagNgoaiNhanVat = (i: BibleInput) =>
  new Set([...i.bible.daoCu.map((d) => d.tag), ...i.bible.boiCanh.flatMap((c) => [c.tag, ...c.bienThe.map((v) => v.tag)]), ...i.nhanVat.map((c) => c.tag).filter((t) => !i.bible.nhanVat.some((n) => n.tag === t))]);

const ctxBible = (i: BibleInput) => ({ nhanVat: i.nhanVat, canhIds: canhIds(i) });

/* ============================ Style ============================ */

export const bibleStyle: TaskDef<BibleInput, { style: string; giaiThich: string }[]> = {
  id: 'bible-style',
  promptFile: '06a-bible-style.md',
  temperature: 0.9,
  schema: {
    type: 'OBJECT',
    properties: {
      phuongAn: { type: 'ARRAY', items: { type: 'OBJECT', properties: { style: { type: 'STRING' }, giaiThich: { type: 'STRING' } }, required: ['style', 'giaiThich'] } },
    },
    required: ['phuongAn'],
  },
  parseInput: (body) => parseBibleInput(body, false),
  genreId: (i) => i.brief.theLoai,
  vars: (i, ctx) => ({ ...commonVars(i, ctx), dan_y: danYNgan(i.kichBan.danY), nhan_vat: charactersText(i.nhanVat) }),
  normalize: (raw) =>
    arr(obj(raw).phuongAn)
      .map((x) => ({ style: str(obj(x).style, 1200), giaiThich: str(obj(x).giaiThich, 600) }))
      .filter((x) => x.style)
      .slice(0, 3),
  check: (out, i) => {
    const errors: string[] = [];
    if (out.length !== 3) errors.push('Cần đúng 3 phương án style.');
    out.forEach((p, k) => {
      errors.push(...checkStyle(p.style, i.nhanVat, `Phương án ${k + 1}`));
      if (!p.giaiThich) errors.push(`Phương án ${k + 1} chưa có giải thích.`);
    });
    return { errors, warnings: [] };
  },
  isEmpty: (out) => out.length === 0,
};

/* ============================ Nhân vật: giọng + bộ đồ ============================ */

function nhanVatCanLam(i: BibleInput): BibleNhanVat[] {
  return i.bible.nhanVat.filter((n) => !n.khongDung);
}

export const bibleNhanVat: TaskDef<BibleInput, BibleNhanVat[]> = {
  id: 'bible-nhan-vat',
  promptFile: '06b-bible-nhan-vat.md',
  temperature: 0.7,
  schema: {
    type: 'OBJECT',
    properties: {
      nhanVat: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            tag: { type: 'STRING' },
            giong: { type: 'STRING' },
            bo: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: { ten: { type: 'STRING' }, canh: { type: 'ARRAY', items: { type: 'INTEGER' } }, ...DONG_ANH },
                required: ['ten', 'canh', 'moTa', 'note', 'khungAnh', 'vaiTro'],
              },
            },
          },
          required: ['tag', 'giong', 'bo'],
        },
      },
    },
    required: ['nhanVat'],
  },
  parseInput: (body) => parseBibleInput(body, true),
  genreId: (i) => i.brief.theLoai,
  vars: (i, ctx) => {
    const list = nhanVatCanLam(i);
    const tags = new Set(list.map((n) => n.tag));
    return {
      ...commonVars(i, ctx),
      nhan_vat: i.nhanVat
        .filter((c) => tags.has(c.tag))
        .map((c) => `${characterText(c)}${c.ghiChuThietKe ? `\n  Ghi chú cho khâu thiết kế: ${c.ghiChuThietKe}` : ''}`)
        .join('\n'),
      can_lam: list
        .map((n) => `- @${n.tag} — ${n.ten}: ${n.canh.length ? `có mặt ở ${dsCanh(i, n.canh)}` : 'KHÔNG xuất hiện trên hình (chỉ có giọng)'}${n.coThoai ? '; có thoại' : '; không có thoại'}`)
        .join('\n'),
      ngon_ngu: i.brief.thoai.mucDo === 'khong' ? '' : i.brief.thoai.ngonNgu || 'tiếng Việt',
      canh: canhText(i, (id) => list.some((n) => n.canh.includes(id)), (coMat) => coMat.some((t) => tags.has(t))),
      ban_truoc: i.yeuCau
        ? list
            .map((n) => [`@${n.tag} — giọng: ${n.giong}`, ...n.bo.map((b) => `  · Bộ "${b.ten}" (@${b.tag}, ${dsCanh(i, b.canh)}): ${b.moTa} | Note: ${b.note} | Khung ảnh: ${b.khungAnh} | Vai trò: ${b.vaiTro}`)].join('\n'))
            .join('\n')
        : '',
    };
  },
  normalize: (raw, i) => {
    const rows = arr(obj(raw).nhanVat).map(obj);
    const taken = tagNgoaiNhanVat(i);
    nhanVatCanLam(i).forEach((n) => taken.add(n.tag));
    return nhanVatCanLam(i).map((n) => {
      const r = rows.find((x) => toTag(str(x.tag, 40)) === n.tag) || {};
      const giong = str(r.giong, 600);
      if (!n.canh.length) return { ...n, giong, bo: [] };
      const used = new Set<string>();
      const bo: BoDo[] = arr(r.bo).map((y, k) => {
        const b = obj(y);
        const ten = str(b.ten, 80) || (k === 0 ? 'mặc định' : `bộ ${k + 1}`);
        // Bộ đầu mang tag nhân vật; bộ thêm giữ tag cũ nếu cùng tên, không thì code đặt tag mới
        const old = n.bo.find((x, j) => j > 0 && normName(x.ten) === normName(ten) && !used.has(x.tag));
        const tag = k === 0 ? n.tag : old ? old.tag : uniqueTag(`${n.tag}${toTag(ten)}`, new Set([...taken, ...used]));
        used.add(tag);
        taken.add(tag);
        const canh = Array.from(new Set(arr(b.canh).map((x) => canhIds(i)[int(x) - 1]).filter((id): id is string => !!id && n.canh.includes(id))));
        return { tag, ten, canh, moTa: str(b.moTa, 1500), note: str(b.note, 600), khungAnh: str(b.khungAnh, 800), vaiTro: str(b.vaiTro, 200) };
      });
      return { ...n, giong, bo: bo.length ? bo : [{ tag: n.tag, ten: 'mặc định', canh: n.canh, moTa: '', note: '', khungAnh: '', vaiTro: '' }] };
    });
  },
  check: (out, i) => checkBibleNhanVat(out, ctxBible(i), tagNgoaiNhanVat(i)),
  isEmpty: (out) => out.every((n) => !n.giong && n.bo.every((b) => !b.moTa)),
};

/* ============================ Đạo cụ ============================ */

export const bibleDaoCu: TaskDef<BibleInput, BibleDaoCu[]> = {
  id: 'bible-dao-cu',
  promptFile: '06c-bible-dao-cu.md',
  temperature: 0.6,
  schema: {
    type: 'OBJECT',
    properties: {
      daoCu: { type: 'ARRAY', items: { type: 'OBJECT', properties: { tag: { type: 'STRING' }, ...DONG_ANH }, required: ['tag', 'moTa', 'note', 'khungAnh', 'vaiTro'] } },
    },
    required: ['daoCu'],
  },
  parseInput: (body) => {
    const i = parseBibleInput(body, true);
    if (!i.bible.daoCu.some((d) => !d.khongDung)) throw new Error('Kịch bản không có đạo cụ nào cần thiết kế.');
    return i;
  },
  genreId: (i) => i.brief.theLoai,
  vars: (i, ctx) => {
    const list = i.bible.daoCu.filter((d) => !d.khongDung);
    const tags = new Set(list.map((d) => d.tag));
    return {
      ...commonVars(i, ctx),
      nhan_vat: i.nhanVat.map((c) => `- ${c.ten}${c.tuoi ? `, ${c.tuoi} tuổi` : ''}${c.ghiChuThietKe ? `: ${c.ghiChuThietKe}` : ''}`).join('\n'),
      can_lam: list.map((d) => `- @${d.tag}: ${d.moTaKichBan}${d.trangThai.length ? ` · trạng thái trong phim: ${d.trangThai.join(' → ')}` : ''} · ${dsCanh(i, d.canh)}`).join('\n'),
      canh: canhText(i, (id) => list.some((d) => d.canh.includes(id)), (coMat) => coMat.some((t) => tags.has(t))),
      ban_truoc: i.yeuCau ? list.map((d) => `@${d.tag}: ${d.moTa} | Note: ${d.note} | Khung ảnh: ${d.khungAnh} | Vai trò: ${d.vaiTro}`).join('\n') : '',
    };
  },
  normalize: (raw, i) => {
    const rows = arr(obj(raw).daoCu).map(obj);
    return i.bible.daoCu
      .filter((d) => !d.khongDung)
      .map((d) => {
        const r = rows.find((x) => toTag(str(x.tag, 40)) === d.tag) || {};
        return { ...d, moTa: str(r.moTa, 1200), note: str(r.note, 600), khungAnh: str(r.khungAnh, 800), vaiTro: str(r.vaiTro, 200) };
      });
  },
  check: (out, i) => checkBibleDaoCu(out, ctxBible(i)),
  isEmpty: (out) => out.every((d) => !d.moTa),
};

/* ============================ Bối cảnh + ánh sáng từng cảnh ============================ */

export const bibleBoiCanh: TaskDef<BibleInput, { boiCanh: BibleBoiCanh[]; anhSang: AnhSangCanh[] }> = {
  id: 'bible-boi-canh',
  promptFile: '06d-bible-boi-canh.md',
  temperature: 0.6,
  schema: {
    type: 'OBJECT',
    properties: {
      boiCanh: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            tag: { type: 'STRING' },
            moTa: { type: 'STRING' },
            bienThe: {
              type: 'ARRAY',
              items: { type: 'OBJECT', properties: { tag: { type: 'STRING' }, note: { type: 'STRING' }, khungAnh: { type: 'STRING' }, vaiTro: { type: 'STRING' } }, required: ['tag', 'note', 'khungAnh', 'vaiTro'] },
            },
          },
          required: ['tag', 'moTa', 'bienThe'],
        },
      },
      anhSang: { type: 'ARRAY', items: { type: 'OBJECT', properties: { canh: { type: 'STRING' }, moTa: { type: 'STRING' } }, required: ['canh', 'moTa'] } },
    },
    required: ['boiCanh', 'anhSang'],
  },
  parseInput: (body) => parseBibleInput(body, true),
  genreId: (i) => i.brief.theLoai,
  vars: (i, ctx) => {
    const list = i.bible.boiCanh.filter((c) => !c.khongDung);
    return {
      ...commonVars(i, ctx),
      ti_le: i.brief.tiLe,
      can_lam: list
        .map((c) => [`- @${c.tag} — ${c.ten} (${dsCanh(i, c.canh)})`, ...c.bienThe.map((v) => `    · biến thể @${v.tag}: ${v.thoiDiem || '(không rõ thời điểm)'} — ${dsCanh(i, v.canh)}`)].join('\n'))
        .join('\n'),
      canh: canhText(i),
      ban_truoc: i.yeuCau
        ? [
            ...list.map((c) => [`@${c.tag}: ${c.moTa}`, ...c.bienThe.map((v) => `  · @${v.tag}: Note: ${v.note} | Khung ảnh: ${v.khungAnh} | Vai trò: ${v.vaiTro}`)].join('\n')),
            'Ánh sáng:',
            ...i.bible.anhSang.map((a) => `  ${a.canh}: ${a.moTa}`),
          ].join('\n')
        : '',
    };
  },
  normalize: (raw, i) => {
    const o = obj(raw);
    const rows = arr(o.boiCanh).map(obj);
    const boiCanh = i.bible.boiCanh
      .filter((c) => !c.khongDung)
      .map((c) => {
        const r = rows.find((x) => toTag(str(x.tag, 40)) === c.tag) || {};
        const vs = arr(r.bienThe).map(obj);
        return {
          ...c,
          moTa: str(r.moTa, 1500),
          bienThe: c.bienThe.map((v) => {
            const x = vs.find((y) => toTag(str(y.tag, 40)) === v.tag) || {};
            return { ...v, note: str(x.note, 600), khungAnh: str(x.khungAnh, 800), vaiTro: str(x.vaiTro, 200) };
          }),
        };
      });
    const light = arr(o.anhSang).map(obj);
    const anhSang = dongBoAnhSang(
      i.bible.anhSang.map((a) => {
        const r = light.find((x) => normCanhId(str(x.canh, 20)) === a.canh);
        return { ...a, moTa: r ? str(r.moTa, 600) : '' };
      })
    );
    return { boiCanh, anhSang };
  },
  check: (out, i) => checkBibleBoiCanh(out.boiCanh, out.anhSang, ctxBible(i)),
  isEmpty: (out) => out.boiCanh.every((c) => !c.moTa) && out.anhSang.every((a) => !a.moTa),
};
