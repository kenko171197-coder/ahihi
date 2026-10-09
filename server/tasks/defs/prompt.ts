// Màn ⑧ — Dịch phần tiếng Việt của một cảnh sang tiếng Anh cho prompt video (một lần mỗi cảnh).
// AI chỉ dịch: lúc bắt đầu, câu hành động từng shot, âm thanh, cách nói, người nói, 2–3 điều giữ đúng.
// Phần cố định (ảnh, style, bối cảnh, ánh sáng, máy, giọng, câu thoại) do code ghép — xem shared/prompt.ts.
import type { TaskDef } from '../framework';
import { genreHeader } from '../genre';
import { arr, obj, str } from '../util';
import { briefText } from '../format';
import type { Brief, Character, KichBanData, PhanCanhCanh, PromptBeat } from '../../../shared/project';
import { toTag } from '../../../shared/project';
import { normBeatId, tatCaDaoCu } from '../../../shared/kichBan';
import { mocGiay } from '../../../shared/phanCanh';
import { checkPromptDich, khopDich, nguonCanh, NguonBeat, GIU_DUNG_MAX } from '../../../shared/prompt';
import { parseBrief, parseCharacters } from './nhanVat';
import { parseKichBan } from './raSoat';
import { parseShots } from './phanCanh';

interface PromptCanhInput {
  brief: Brief;
  nhanVat: Character[];
  kichBan: Pick<KichBanData, 'danY' | 'canh'>;
  /** Shot của cảnh (màn ⑦) */
  phanCanh: PhanCanhCanh;
  canhId: string;
  sua?: { truoc: Record<string, PromptBeat>; yeuCau: string };
}

const nguonOf = (i: PromptCanhInput): NguonBeat[] => nguonCanh(i.kichBan as KichBanData, i.phanCanh, i.canhId);

/** Bản dịch hiện có (từ giao diện, chế độ sửa). */
export function parsePromptBeat(v: unknown): PromptBeat {
  const o = obj(v);
  const shots: Record<string, string> = {};
  Object.entries(obj(o.shots)).forEach(([k, x]) => (shots[str(k, 30)] = str(x, 1500)));
  return {
    lucBatDau: arr(o.lucBatDau).map((x) => ({ tag: toTag(str(obj(x).tag, 40)), cau: str(obj(x).cau, 800) })),
    shots,
    ambient: str(o.ambient, 600),
    music: str(o.music, 600),
    thoai: arr(o.thoai).map((x) => ({ cachNoi: str(obj(x).cachNoi, 200), nguoiNoi: str(obj(x).nguoiNoi, 200) })),
    giuDung: arr(o.giuDung).map((x) => str(x, 400)).filter(Boolean).slice(0, GIU_DUNG_MAX),
  };
}

function beatsText(i: PromptCanhInput, nguon: NguonBeat[], ten: (t: string) => string): string {
  return nguon
    .map((n) => {
      const b = n.beat;
      const moc = mocGiay(n.shots);
      const shotCua = (k: number) => n.shots.findIndex((s) => s.thoai.includes(k));
      return [
        `[${b.id}] ${b.giay} giây${b.camXuc ? ` · Cảm xúc / nhịp: ${b.camXuc}` : ''}`,
        `  Hành động (để hiểu ngữ cảnh, không dịch): ${b.hanhDong}`,
        `  Trong khung: ${n.khung.map((t) => `@${t}`).join(', ') || '(không ai)'}`,
        n.dau.length ? `  Lúc bắt đầu:\n${n.dau.map((l) => `    @${l.tag}: ${l.moTa}`).join('\n')}` : '  Lúc bắt đầu: (không có dòng nào cần dịch)',
        ...n.shots.map((s, k) => `  Shot [${s.id}] ${moc[k]}: ${s.moTa} (trong khung: ${s.trongKhung.map((t) => `@${t}`).join(', ') || 'không ai'})`),
        `  Âm thanh: ${b.amThanh || '(không ghi)'}`,
        ...b.thoai.map((t, k) => {
          const si = shotCua(k);
          const co = n.khung.includes(t.ai);
          return `  Thoại ${k + 1}) ${ten(t.ai).toUpperCase()}${co ? ` (@${t.ai}, có trong khung)` : ' (không có ảnh trong beat)'}${t.cachNoi ? ` (${t.cachNoi})` : ''}${si >= 0 ? ` — nói trong shot ${si + 1}` : ''}: "${t.cau}"`;
        }),
      ].join('\n');
    })
    .join('\n\n');
}

export const promptCanh: TaskDef<PromptCanhInput, Record<string, PromptBeat>> = {
  id: 'prompt-canh',
  promptFile: '08-prompt.md',
  temperature: 0.4,
  schema: {
    type: 'OBJECT',
    properties: {
      beats: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            ma: { type: 'STRING', description: 'Mã beat (B001…)' },
            lucBatDau: {
              type: 'ARRAY',
              items: { type: 'OBJECT', properties: { tag: { type: 'STRING' }, cau: { type: 'STRING' } }, required: ['tag', 'cau'] },
            },
            shots: {
              type: 'ARRAY',
              items: { type: 'OBJECT', properties: { ma: { type: 'STRING', description: 'Mã shot (B007.1…)' }, hanhDong: { type: 'STRING' } }, required: ['ma', 'hanhDong'] },
            },
            ambient: { type: 'STRING' },
            music: { type: 'STRING' },
            thoai: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: { so: { type: 'INTEGER', description: 'Số thứ tự câu thoại (1, 2, …)' }, cachNoi: { type: 'STRING' }, nguoiNoi: { type: 'STRING' } },
                required: ['so', 'cachNoi', 'nguoiNoi'],
              },
            },
            giuDung: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['ma', 'lucBatDau', 'shots', 'ambient', 'music', 'thoai', 'giuDung'],
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
    const beats: PhanCanhCanh['beats'] = {};
    Object.entries(obj(obj(o.phanCanh).beats)).forEach(([k, v]) => (beats[k] = { shots: parseShots(obj(v).shots), soShot: Math.max(1, Math.round(Number(obj(v).soShot)) || 1) }));
    const input: PromptCanhInput = { brief: parseBrief(o.brief), nhanVat, kichBan, phanCanh: { beats, dauVao: '', updatedAt: 0 }, canhId };
    const nguon = nguonOf(input);
    if (!nguon.length) throw new Error('Cảnh này chưa có beat nào.');
    const thieu = nguon.filter((n) => !n.shots.length).map((n) => n.beat.id);
    if (thieu.length) throw new Error(`Beat ${thieu.join(', ')} chưa có shot. Phân cảnh ở màn 7 trước.`);
    const s = obj(o.sua);
    const yeuCau = str(s.yeuCau, 2000);
    if (yeuCau) {
      const truoc: Record<string, PromptBeat> = {};
      Object.entries(obj(s.truoc)).forEach(([k, v]) => (truoc[k] = parsePromptBeat(v)));
      input.sua = { truoc, yeuCau };
    }
    return input;
  },
  genreId: (i) => i.brief.theLoai,
  vars: (i, ctx) => {
    const nguon = nguonOf(i);
    const k = i.kichBan.danY.canh.findIndex((c) => c.id === i.canhId);
    const c = i.kichBan.danY.canh[k];
    const ten = (t: string) => i.nhanVat.find((x) => x.tag === t)?.ten || t;
    const daoCu = tatCaDaoCu(i.kichBan as KichBanData);
    const tags = Array.from(new Set(nguon.flatMap((n) => n.khung)));
    return {
      the_loai: genreHeader(ctx.genre),
      brief: briefText(i.brief),
      ngon_ngu: i.brief.thoai.ngonNgu || 'tiếng Việt',
      khong_nhac: i.brief.nhacNen === 'khong' ? 'có' : '',
      so_canh: k + 1,
      canh: `Cảnh ${k + 1} [${c.id}] · ${c.diaDiem} · ${c.thoiDiem} · Chuyển biến: ${c.chuyenBien}`,
      tag_list: tags
        .map((t) => {
          const nv = i.nhanVat.find((x) => x.tag === t);
          if (nv) return `- @${t}: ${nv.ten} (nhân vật)`;
          const d = daoCu.find((x) => x.tag === t);
          return `- @${t}: ${d ? d.moTa : t} (đồ vật)`;
        })
        .join('\n') || '(không có)',
      beats: beatsText(i, nguon, ten),
      ban_truoc: i.sua
        ? nguon
            .map((n) => {
              const d = i.sua!.truoc[n.beat.id];
              if (!d) return `[${n.beat.id}] (chưa dịch)`;
              return [
                `[${n.beat.id}]`,
                ...d.lucBatDau.map((x) => `  Lúc bắt đầu @${x.tag}: ${x.cau}`),
                ...Object.entries(d.shots).map(([id, x]) => `  Shot [${id}]: ${x}`),
                `  Ambient: ${d.ambient} · Music: ${d.music || '—'}`,
                ...d.thoai.map((x, k) => `  Thoại ${k + 1}: ${x.nguoiNoi} · ${x.cachNoi}`),
                `  Giữ đúng: ${d.giuDung.join(' | ')}`,
              ].join('\n');
            })
            .join('\n')
        : '',
      yeu_cau_sua: i.sua?.yeuCau || '',
    };
  },
  normalize: (raw, i) => {
    const nguon = nguonOf(i);
    const rows = arr(obj(raw).beats).map(obj);
    const out: Record<string, PromptBeat> = {};
    nguon.forEach((n, bi) => {
      const r = rows.find((x) => normBeatId(str(x.ma, 20)) === n.beat.id) || (rows.length === nguon.length ? rows[bi] : undefined);
      if (!r) return;
      const shotRows = arr(r.shots).map(obj);
      const shots: Record<string, string> = {};
      n.shots.forEach((s, k) => {
        const m = shotRows.find((x) => str(x.ma, 30).toUpperCase().replace(/[^A-Z0-9.]/g, '') === s.id) || (shotRows.length === n.shots.length ? shotRows[k] : undefined);
        shots[s.id] = m ? str(m.hanhDong, 1500) : '';
      });
      const thoaiRows = arr(r.thoai).map(obj);
      out[n.beat.id] = {
        lucBatDau: arr(r.lucBatDau).map((x) => ({ tag: toTag(str(obj(x).tag, 40)), cau: str(obj(x).cau, 800) })),
        shots,
        ambient: str(r.ambient, 600),
        music: i.brief.nhacNen === 'khong' ? '' : str(r.music, 600),
        thoai: n.beat.thoai.map((_, k) => {
          const m = thoaiRows.find((x) => Math.round(Number(x.so)) === k + 1) || (thoaiRows.length === n.beat.thoai.length ? thoaiRows[k] : undefined);
          return { cachNoi: m ? str(m.cachNoi, 200) : '', nguoiNoi: m ? str(m.nguoiNoi, 200) : '' };
        }),
        giuDung: arr(r.giuDung).map((x) => str(x, 400)).filter(Boolean).slice(0, GIU_DUNG_MAX),
      };
    });
    return khopDich(nguon, out);
  },
  check: (out, i) => {
    const r = checkPromptDich(nguonOf(i), out);
    return { errors: r.errors, warnings: r.warnings };
  },
  isEmpty: (out) => Object.values(out).every((b) => !Object.values(b.shots).some((x) => x.trim()) && !b.lucBatDau.some((x) => x.cau.trim())),
};
