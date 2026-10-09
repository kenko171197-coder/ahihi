// Test phần logic (không cần cài thư viện, không gọi AI thật). Chạy: npx tsx tests/run.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { render, varsIn } from '../server/tasks/template';
import { parseGenre, sectionFor, SECTION_OF_SCREEN } from '../server/tasks/genre';
import { runTask, TaskDeps, TaskLog, MAX_RETRIES } from '../server/tasks/framework';
import { TASK_DEFS } from '../server/tasks/registry';
import { hoiLai, logline } from '../server/tasks/defs/brief';
import { nhanVat } from '../server/tasks/defs/nhanVat';
import { treatment } from '../server/tasks/defs/treatment';
import { danYCanh, vietCanh } from '../server/tasks/defs/kichBan';
import { raSoat, normLoai, normMuc } from '../server/tasks/defs/raSoat';
import { beatGiayOf, thangChamOf } from '../server/tasks/genre';
import { checkDanY, checkCanh, canhCtx, checkKichBan, checkRaSoat, raSoatBlocking, tongDiem } from '../shared/checks';
import {
  emptyKichBan, ghiCanh, suaCanh, tinhTrangCanh, dauVaoCanh, dauBeat, daoCuTruoc, ganMaBeat, parseTrangThai, trangThaiText, beatId, normCanhId, normBeatId,
} from '../shared/kichBan';
import type { DanY, Beat, KichBanData, RaSoatData, BibleData } from '../shared/project';
import { bocTach, emptyBible, mucAnh, promptDaoCu, promptBoiCanh, promptSheet, PROP_SUFFIX, dongBoAnhSang } from '../shared/bible';
import { checkBible, coTiengViet } from '../shared/checks';
import { bibleStyle, bibleNhanVat, bibleDaoCu, bibleBoiCanh } from '../server/tasks/defs/bible';
import { checkTreatment, checkCharacters, normName, sentenceCount as sc2 } from '../shared/checks';
import { normVai } from '../server/tasks/defs/nhanVat';
import {
  newProjectData, freshSection, approveSection, editSection, keepSection, isStale, staleDeps, missingDeps, blockedDeps,
  toTag, uniqueTag, fmtGiay, Project, TreatmentData, Character,
} from '../shared/project';
import { sentenceCount } from '../server/tasks/util';

let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
  } catch (e: any) {
    failures.push(`✗ ${name}\n   ${e?.message || e}`);
  }
}

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const genreText = fs.readFileSync(path.join(ROOT, 'knowledge/the-loai/doi-thuong.md'), 'utf8');
const genre = parseGenre('doi-thuong', genreText);

const briefInput = {
  yTuong: 'Con gái đi làm xa nhận đồ ăn mẹ gửi',
  theLoai: 'doi-thuong',
  nenTang: 'doc',
  thoiLuongGiay: 60,
  hinhThuc: 'nguoi-that',
  thoai: { mucDo: 'it', ngonNgu: 'tiếng Việt' },
  nhacNen: 'ai-de-xuat',
  ghiChu: '',
};
const brief = { ...briefInput, tiLe: '9:16', logline: 'Lan về khuya định bỏ bữa, cho tới khi mở thùng đồ mẹ gửi.', thongDiep: 'Được quan tâm', camXuc: 'ấm áp', khanGia: 'người trẻ đi làm xa' };
const chars: Character[] = [
  { id: 'nv1', ten: 'Lan', tag: 'lan', vai: 'chinh', tuoi: '24', muon: 'ngủ ngay', can: '', tinhCach: 'mệt, tự lập', chiTiet: 'quăng túi lên ghế', quanHe: 'con gái', ghiChuThietKe: '' },
  { id: 'nv2', ten: 'Mẹ', tag: 'me', vai: 'gian-tiep', tuoi: '55', muon: '', can: '', tinhCach: '', chiTiet: '', quanHe: 'mẹ của Lan', ghiChuThietKe: '' },
];

function goodTreatment(total: number, seq = false): TreatmentData {
  const names = ['Nếp thường ngày', 'Gợn sóng', 'Khoảnh khắc chạm', 'Dư âm'];
  const cuts = [0, Math.round(total * 0.2), Math.round(total * 0.5), Math.round(total * 0.85), total];
  return {
    phan: names.map((ten, i) => ({
      id: `P${i + 1}`, ten, vaiTro: 'x', batDau: cuts[i], ketThuc: cuts[i + 1], tomTat: 'Tóm tắt.', mocTruyen: [],
      phanDoan: seq
        ? [
            { id: `P${i + 1}.1`, ten: 'a', mucTieu: 'm', batDau: cuts[i], ketThuc: Math.round((cuts[i] + cuts[i + 1]) / 2), tomTat: 't' },
            { id: `P${i + 1}.2`, ten: 'b', mucTieu: 'm', batDau: Math.round((cuts[i] + cuts[i + 1]) / 2), ketThuc: cuts[i + 1], tomTat: 't' },
          ]
        : [],
    })),
    caiDung: [{ id: 'C1', chiTiet: 'nét chữ của mẹ', cai: 'P1', dung: 'P3' }],
  };
}

/** Dàn ý hợp lệ cho phim 60s, khớp goodTreatment(60): P1 0–12, P2 12–30, P3 30–51, P4 51–60. */
function goodDanY(): DanY {
  const st = (moTa: string) => [{ tag: 'lan', moTa }];
  const mk = (id: string, phan: string, batDau: number, ketThuc: number, dau: string, cuoi: string) => ({
    id, phan, diaDiem: 'Phòng trọ của Lan', tagDiaDiem: 'phongtro', thoiDiem: 'khuya', anhSang: 'đèn tuýp trắng', chuyenBien: 'a → b', coMat: ['lan'], batDau, ketThuc, dauCanh: st(dau), cuoiCanh: st(cuoi),
  });
  return {
    canh: [mk('S1', 'P1', 0, 12, 'đứng ở cửa', 'nằm trên giường'), mk('S2', 'P2', 12, 30, 'nằm trên giường', 'ngồi cạnh thùng'), mk('S3', 'P3', 30, 51, 'ngồi cạnh thùng', 'ngồi ăn'), mk('S4', 'P4', 51, 60, 'ngồi ăn', 'ngồi ăn')],
    caiDung: [{ id: 'C1', cai: 'S1', dung: 'S3' }],
  };
}

let beatSeq = 0;
/** Các beat hợp lệ cho một cảnh: chia đều giây (mỗi beat 3–10s), beat cuối chép trạng thái cuối cảnh. */
function beatsFor(c: DanY['canh'][number], start = 1, caiDung: string[] = []): Beat[] {
  const len = c.ketThuc - c.batDau;
  const n = Math.max(1, Math.ceil(len / 8));
  const base = Math.floor(len / n);
  return Array.from({ length: n }, (_, i) => ({
    id: beatId(start + i),
    giay: i === n - 1 ? len - base * (n - 1) : base,
    hanhDong: `Lan làm việc ${++beatSeq}.`,
    thoai: [],
    amThanh: 'quạt trần',
    camXuc: 'chậm',
    coMat: ['lan'],
    daoCuMoi: [],
    thayDoi: [],
    caiDung: i === 0 ? caiDung : [],
    cuoiBeat: i === n - 1 ? c.cuoiCanh : [{ tag: 'lan', moTa: `bước ${i}` }],
  }));
}

/** Kịch bản viết đủ mọi cảnh, đã duyệt dàn ý. */
function goodKichBan(): KichBanData {
  let kb: KichBanData = { ...emptyKichBan(), danY: goodDanY(), danYDuyet: true, soCanh: 5 };
  kb.danY.canh.forEach((c) => {
    const cd = kb.danY.caiDung.filter((x) => x.cai === c.id || x.dung === c.id).map((x) => x.id);
    kb = ghiCanh(kb, c.id, beatsFor(c, kb.soBeat, cd), 1);
  });
  return kb;
}

const kbCtx = { total: 60, treatment: goodTreatment(60), nhanVat: chars, mucThoai: 'it' as const, nhacNen: 'ai-de-xuat' as const, beatGiay: [4, 8] as [number, number] };
const ctxOf = (kb: KichBanData, id: string) => canhCtx(kb.danY, id, { ...kbCtx, daoCuTruoc: daoCuTruoc(kb, id) })!;

/** Kịch bản mẫu có đạo cụ, đổi trạng thái, mẹ nói qua điện thoại, cảnh 4 sang buổi sáng. */
function kbBible(): KichBanData {
  let kb = goodKichBan();
  kb = { ...kb, danY: { ...kb.danY, canh: kb.danY.canh.map((c) => (c.id === 'S4' ? { ...c, thoiDiem: 'sáng sớm', anhSang: 'nắng sớm qua cửa sổ' } : c)) } };
  const s2 = kb.canh.S2.beats;
  kb = suaCanh(kb, 'S2', s2.map((b, i) => (i === 0 ? { ...b, daoCuMoi: [{ tag: 'thungxop', moTa: 'thùng xốp trắng mẹ gửi' }], coMat: ['lan', 'thungxop'], thayDoi: [{ tag: 'thungxop', truoc: 'đóng kín', sau: 'mở nắp' }], thoai: [{ ai: 'me', cachNoi: 'qua điện thoại', cau: 'Nhận được chưa con?' }] } : b)), 2);
  return kb;
}

const EN = {
  moTa: 'A slim young woman in her mid twenties with shoulder length black hair, wearing a beige knit cardigan over a white blouse and dark trousers.',
  khung: 'Full body front view, standing straight, neutral expression, plain light grey background, soft studio lighting.',
};

/** Bible đã viết đủ cho kbBible(). */
function goodBible(): BibleData {
  const b = bocTach(kbBible(), chars);
  return {
    ...b,
    style: 'Cinematic photorealistic live-action, soft natural light, warm muted colors, subtle film grain.',
    nhanVat: b.nhanVat.map((n) => ({ ...n, giong: n.coThoai ? 'middle aged woman, warm gentle voice, Northern Vietnamese accent' : '', bo: n.bo.map((x) => ({ ...x, moTa: EN.moTa, note: 'Cô gái gầy, tóc ngang vai, áo len be.', khungAnh: EN.khung, vaiTro: 'Lan in her cardigan' })) })),
    daoCu: b.daoCu.map((d) => ({ ...d, moTa: 'A white styrofoam box with a lid, about the size of a small suitcase, reaching an adult knee.', note: 'Thùng xốp trắng cỡ va li nhỏ.', khungAnh: 'Centered on a white background, lid closed, studio lighting, sharp focus.', vaiTro: 'the white foam box' })),
    boiCanh: b.boiCanh.map((c) => ({ ...c, moTa: 'A small rented room with a single bed, a low wooden desk, a plastic wardrobe and clothes hanging on a chair.', bienThe: c.bienThe.map((v) => ({ ...v, note: 'Phòng trọ.', khungAnh: 'Late night, wide shot from the doorway.', vaiTro: 'the rented room' })) })),
    anhSang: dongBoAnhSang(b.anhSang.map((a) => ({ ...a, moTa: a.thoiDiem === 'khuya' ? 'Cold white ceiling tube light mixed with a warm desk lamp.' : 'Soft early morning sunlight through the window.' }))),
  };
}

function bibleInput(bible: BibleData = goodBible()) {
  const kb = kbBible();
  return { brief, nhanVat: chars, kichBan: { danY: kb.danY, canh: kb.canh }, bible };
}

/* ---------------- Khuôn prompt ---------------- */

await test('render: biến, khối #, khối ^, bỏ ghi chú', () => {
  const t = '<!-- ghi chú -->\nA {{x}}\n{{#y}}có Y: {{y}}{{/y}}\n{{^y}}không Y{{/y}}\n{{#z}}Z{{/z}}{{^z}}không Z{{/z}}';
  assert.equal(render(t, { x: 1, y: '', z: 'ok' }), 'A 1\n\nkhông Y\nZ');
  assert.equal(render(t, { x: 'a', y: 'b' }), 'A a\ncó Y: b\n\nkhông Z');
});

await test('mọi file prompt chỉ dùng biến mà tác vụ cung cấp', () => {
  const samples: Record<string, unknown> = {
    'hoi-lai': { brief: briefInput },
    logline: { brief: briefInput, cauHoi: [] },
    'nhan-vat': { brief },
    treatment: { brief, nhanVat: chars },
    'dan-y-canh': { brief, nhanVat: chars, treatment: goodTreatment(60), soCanh: 1 },
    'viet-canh': { brief, nhanVat: chars, treatment: goodTreatment(60), danY: goodDanY(), canhId: 'S2', canhTruoc: { cuoi: goodDanY().canh[0].cuoiCanh, beats: beatsFor(goodDanY().canh[0], 1) }, daoCuTruoc: [], soBeat: 3 },
    'ra-soat': { brief, nhanVat: chars, treatment: goodTreatment(60), kichBan: goodKichBan(), daBoQua: ['Cảnh 1 hơi dài'] },
    'bible-style': bibleInput(),
    'bible-nhan-vat': bibleInput(),
    'bible-dao-cu': bibleInput(),
    'bible-boi-canh': bibleInput(),
  };
  for (const [id, def] of Object.entries(TASK_DEFS)) {
    const input = def.parseInput(samples[id]);
    const provided = new Set(Object.keys(def.vars(input, { genre })));
    const tpl = fs.readFileSync(path.join(ROOT, 'prompts', def.promptFile), 'utf8');
    const unknown = varsIn(tpl).filter((v) => !provided.has(v));
    assert.deepEqual(unknown, [], `${def.promptFile} dùng biến không có: ${unknown.join(', ')}`);
    const out = render(tpl, def.vars(input, { genre }));
    assert.ok(!/\{\{|\}\}/.test(out), `${def.promptFile} còn sót cú pháp khuôn`);
    assert.ok(out.length > 300, `${def.promptFile} quá ngắn sau khi ghép`);
  }
});

await test('prompt treatment phim 60s không yêu cầu phân đoạn, phim 5 phút thì có', () => {
  const tpl = fs.readFileSync(path.join(ROOT, 'prompts/03-treatment.md'), 'utf8');
  const short = render(tpl, treatment.vars(treatment.parseInput({ brief, nhanVat: chars }), { genre }));
  assert.ok(short.includes('"phanDoan" để danh sách rỗng'));
  assert.ok(!short.includes('MỖI phần chia thành 2–5'));
  const long = render(tpl, treatment.vars(treatment.parseInput({ brief: { ...brief, thoiLuongGiay: 300 }, nhanVat: chars }), { genre }));
  assert.ok(long.includes('MỖI phần chia thành 2–5'));
  assert.ok(long.includes('Nếp thường ngày → Gợn sóng → Khoảnh khắc chạm → Dư âm'));
});

/* ---------------- File thể loại ---------------- */

await test('đọc file thể loại đời thường', () => {
  assert.equal(genre.ten, 'Phim đời thường');
  assert.deepEqual(genre.cacPhan, ['Nếp thường ngày', 'Gợn sóng', 'Khoảnh khắc chạm', 'Dư âm']);
  for (const screen of Object.keys(SECTION_OF_SCREEN)) {
    assert.ok(sectionFor(genre, screen as keyof typeof SECTION_OF_SCREEN).length > 50, `thiếu mục cho màn ${screen}`);
  }
  assert.ok(!sectionFor(genre, 'brief').includes('Dùng ở màn'), 'dòng "Dùng ở màn" phải bị bỏ');
  assert.ok(sectionFor(genre, 'brief').includes('Câu hỏi nên hỏi lại'));
  assert.ok(!/---\s*$/.test(sectionFor(genre, 'treatment')), 'dòng kẻ --- cuối mục phải bị bỏ');
});

/* ---------------- Code kiểm ---------------- */

await test('treatment hợp lệ thì không lỗi', () => {
  const r = checkTreatment(goodTreatment(60), 60, genre.cacPhan);
  assert.deepEqual(r.errors, []);
});

await test('treatment: hở giây, sai tổng, sai tên phần, cài sau dùng', () => {
  const t = goodTreatment(60);
  t.phan[1].batDau += 2;
  t.phan[3].ketThuc = 58;
  t.phan[2].ten = 'Cao trào';
  t.caiDung[0] = { id: 'C1', chiTiet: 'x', cai: 'P4', dung: 'P2' };
  const r = checkTreatment(t, 60, genre.cacPhan);
  assert.ok(r.errors.some((e) => e.includes('Phần 2 phải bắt đầu đúng lúc')), 'thiếu lỗi hở giây');
  assert.ok(r.errors.some((e) => e.includes('phải kết thúc ở 1:00')), 'thiếu lỗi tổng giây');
  assert.ok(r.errors.some((e) => e.includes('Khoảnh khắc chạm')), 'thiếu lỗi tên phần');
  assert.ok(r.errors.some((e) => e.includes('phần cài (4)')), 'thiếu lỗi cài sau dùng');
});

await test('treatment phim ≥ 3 phút phải có phân đoạn nối liền', () => {
  assert.ok(checkTreatment(goodTreatment(300), 300, genre.cacPhan).errors.some((e) => e.includes('cần ít nhất 2 phân đoạn')));
  assert.deepEqual(checkTreatment(goodTreatment(300, true), 300, genre.cacPhan).errors, []);
  const t = goodTreatment(300, true);
  t.phan[0].phanDoan[1].ketThuc -= 5;
  assert.ok(checkTreatment(t, 300, genre.cacPhan).errors.some((e) => e.includes('Phân đoạn 1.2')));
});

await test('nhân vật: thiếu vai chính, tag trùng, thiếu ô', () => {
  assert.deepEqual(checkCharacters(chars, 60).errors, []);
  const bad = [{ ...chars[0], vai: 'phu' as const, tinhCach: '' }, { ...chars[1], tag: 'lan' }];
  const e = checkCharacters(bad, 60).errors;
  assert.ok(e.some((x) => x.includes('nhân vật chính')));
  assert.ok(e.some((x) => x.includes('bị trùng')));
  assert.ok(e.some((x) => x.includes('tính cách')));
  const many = Array.from({ length: 5 }, (_, i) => ({ ...chars[0], id: `n${i}`, tag: `lan${i}` }));
  assert.ok(checkCharacters(many, 60).warnings.length === 1);
});

await test('tag, giây, đếm câu', () => {
  assert.equal(toTag('Chó Cái Đen'), 'chocaiden');
  assert.equal(uniqueTag('Lan', new Set(['lan'])), 'lan2');
  assert.equal(fmtGiay(75), '1:15');
  assert.equal(fmtGiay(42), '42s');
  assert.equal(sentenceCount('Một câu.'), 1);
  assert.equal(sentenceCount('Câu một. Câu hai! Câu ba'), 3);
  assert.equal(normName('Khoảnh Khắc Chạm'), 'khoanh khac cham');
});

/* ---------------- Cờ "đã cũ" ---------------- */

await test('sửa phần trên thì phần dưới đã cũ; giữ nguyên thì hết cũ', () => {
  let p: Project = newProjectData('p1', 1);
  assert.deepEqual(missingDeps(p, 'nhanVat'), ['brief']);
  const b0 = { data: brief as any, meta: { rev: 0, status: 'nhap' as const, basedOn: {}, updatedAt: 1 } };
  p = { ...p, sections: { brief: approveSection(p, 'brief', b0, 2) } };
  assert.equal(p.sections.brief!.meta.rev, 1);
  assert.deepEqual(missingDeps(p, 'nhanVat'), []);
  const nv = freshSection(p, 'nhanVat', { list: chars }, 3);
  p = { ...p, sections: { ...p.sections, nhanVat: approveSection(p, 'nhanVat', nv, 4) } };
  assert.equal(isStale(p, 'nhanVat'), false);
  // Sửa brief → nháp → nhân vật đã cũ
  p = { ...p, sections: { ...p.sections, brief: editSection(p.sections.brief!, { ...brief, logline: 'khác' } as any, 5) } };
  assert.deepEqual(staleDeps(p, 'nhanVat'), ['brief']);
  // Duyệt lại brief (rev 2) → vẫn cũ cho tới khi nhân vật được giữ nguyên hoặc tạo lại
  p = { ...p, sections: { ...p.sections, brief: approveSection(p, 'brief', p.sections.brief!, 6) } };
  assert.equal(isStale(p, 'nhanVat'), true);
  p = { ...p, sections: { ...p.sections, nhanVat: keepSection(p, 'nhanVat', p.sections.nhanVat!, 7) } };
  assert.equal(isStale(p, 'nhanVat'), false);
  assert.equal(p.sections.nhanVat!.meta.basedOn.brief, 2);
});

/* ---------------- Khung tác vụ với AI giả ---------------- */

function fakeDeps(replies: (unknown | Error)[]): TaskDeps & { logs: TaskLog[]; prompts: string[] } {
  const logs: TaskLog[] = [];
  const prompts: string[] = [];
  let i = 0;
  let t = 0;
  return {
    logs,
    prompts,
    loadPrompt: (f) => fs.readFileSync(path.join(ROOT, 'prompts', f), 'utf8'),
    loadGenre: (id) => (id === 'doi-thuong' ? genre : null),
    generate: async (prompt) => {
      prompts.push(prompt);
      const r = replies[Math.min(i++, replies.length - 1)];
      if (r instanceof Error) throw r;
      if (r === 'CUT') return { json: null, text: '{"phan": [{"ten": "Nếp th', invalid: true };
      return { json: r, text: JSON.stringify(r) };
    },
    log: (e) => logs.push(e),
    now: () => (t += 10),
    newId: () => `log${logs.length + 1}`,
  };
}

const opt = { logline: 'Lan về khuya.', thongDiep: 'a', camXuc: 'b', khanGia: 'c', viSaoHop: 'd' };

await test('khung tác vụ: lỗi lần đầu → gửi lại kèm lỗi → lần hai đạt', async () => {
  const deps = fakeDeps([{ nhanXet: 'ok', phuongAn: [opt, opt] }, { nhanXet: 'ok', phuongAn: [opt, opt, opt] }]);
  const r = await runTask(logline, { brief: briefInput, cauHoi: [] }, 'p1', deps);
  assert.equal(r.output.phuongAn.length, 3);
  assert.deepEqual(r.errors, []);
  assert.equal(deps.prompts.length, 2);
  assert.ok(deps.prompts[1].includes('KẾT QUẢ LẦN TRƯỚC CÓ LỖI'));
  assert.ok(deps.prompts[1].includes('Cần đúng 3 phương án'));
  assert.equal(deps.logs[0].attempts.length, 2);
  assert.equal(deps.logs[0].ok, true);
});

await test('khung tác vụ: sai mãi thì dừng sau 2 lần gửi lại, trả bản ít lỗi nhất kèm lỗi', async () => {
  const deps = fakeDeps([{ nhanXet: '', phuongAn: [opt] }, { nhanXet: 'ok', phuongAn: [opt, opt] }, { nhanXet: '', phuongAn: [] }]);
  const r = await runTask(logline, { brief: briefInput, cauHoi: [] }, 'p1', deps);
  assert.equal(deps.prompts.length, MAX_RETRIES + 1);
  assert.equal(r.output.phuongAn.length, 2, 'phải giữ bản ít lỗi nhất');
  assert.ok(r.errors.length > 0);
  assert.equal(deps.logs[0].ok, false);
});

await test('khung tác vụ: JSON hỏng thì gửi lại', async () => {
  const deps = fakeDeps([null, { nhanXet: 'ok', phuongAn: [opt, opt, opt] }]);
  const r = await runTask(logline, { brief: briefInput, cauHoi: [] }, 'p1', deps);
  assert.deepEqual(r.errors, []);
  assert.equal(deps.prompts.length, 2);
});

await test('khung tác vụ: lỗi gọi AI (mạng, key) thì báo ngay, không gửi lại', async () => {
  const deps = fakeDeps([new Error('Key không hợp lệ')]);
  await assert.rejects(runTask(logline, { brief: briefInput, cauHoi: [] }, 'p1', deps), /Key không hợp lệ/);
  assert.equal(deps.prompts.length, 1);
  assert.equal(deps.logs.length, 1);
});

await test('khung tác vụ: đầu vào sai thì báo lỗi rõ', async () => {
  await assert.rejects(runTask(hoiLai, { brief: { ...briefInput, yTuong: '' } }, 'p1', fakeDeps([])), /Chưa nhập ý tưởng/);
  await assert.rejects(runTask(hoiLai, { brief: { ...briefInput, thoiLuongGiay: 900 } }, 'p1', fakeDeps([])), /Thời lượng/);
  await assert.rejects(runTask(hoiLai, { brief: { ...briefInput, theLoai: 'khong-co' } }, 'p1', fakeDeps([])), /Không tìm thấy file thể loại/);
});

await test('hỏi lại: chuẩn hoá câu hỏi, bỏ lựa chọn trùng', async () => {
  const q = { cauHoi: 'Ai?', luaChon: ['A', 'A', 'B', 'C', 'D', 'E'] };
  const deps = fakeDeps([{ cauHoi: [q, q, q] }]);
  const r = await runTask(hoiLai, { brief: briefInput }, 'p1', deps);
  assert.equal(r.output.length, 3);
  assert.deepEqual(r.output[0].luaChon, ['A', 'B', 'C', 'D']);
  assert.equal(r.output[2].id, 'q3');
});

await test('nhân vật: code đặt tag; sửa theo yêu cầu giữ id và tag cũ', async () => {
  const raw = { nhanVat: [{ ten: 'Lan', vai: 'chính', tuoi: '24', muon: 'ngủ', can: '', tinhCach: 'mệt', chiTiet: 'quăng túi', quanHe: '', ghiChuThietKe: '' }, { ten: 'Bạn Lan', vai: 'phụ', tuoi: '25', muon: 'x', can: '', tinhCach: 'vui', chiTiet: 'y', quanHe: '', ghiChuThietKe: '' }] };
  const prev = [{ ...chars[0], id: 'nv7', tag: 'lanx' }];
  const r = await runTask(nhanVat, { brief, sua: { truoc: { list: prev }, yeuCau: 'thêm bạn' } }, 'p1', fakeDeps([raw]));
  assert.equal(r.output[0].id, 'nv7');
  assert.equal(r.output[0].tag, 'lanx');
  assert.equal(r.output[0].vai, 'chinh');
  assert.equal(r.output[1].id, 'nv8');
  assert.equal(r.output[1].tag, 'banlan');
  assert.deepEqual(r.errors, []);
});

await test('treatment: phần cài/dùng đổi từ số thứ tự sang id; phim ngắn bỏ phân đoạn', async () => {
  const t = goodTreatment(60, true);
  const raw = {
    phan: t.phan.map((p) => ({ ...p, phanDoan: p.phanDoan })),
    caiDung: [{ chiTiet: 'nét chữ', phanCai: 1, phanDung: 3 }, { chiTiet: 'sai', phanCai: 9, phanDung: 1 }],
  };
  const r = await runTask(treatment, { brief, nhanVat: chars }, 'p1', fakeDeps([raw, raw, raw]));
  assert.equal(r.output.caiDung[0].cai, 'P1');
  assert.equal(r.output.caiDung[0].dung, 'P3');
  assert.equal(r.output.caiDung[1].cai, '');
  assert.ok(r.errors.some((e) => e.includes('phải chỉ rõ phần cài')));
  assert.ok(r.output.phan.every((p) => p.phanDoan.length === 0));
});

/* ---------------- Các lỗi đã sửa sau lượt soát ---------------- */

await test('JSON bị cắt không thắng bản gần đúng; gửi lại đúng lời nhắc JSON hỏng', async () => {
  const t = goodTreatment(60);
  t.phan[2].ten = 'Sai tên';
  const deps = fakeDeps([{ phan: t.phan, caiDung: [{ chiTiet: 'x', phanCai: 1, phanDung: 3 }] }, 'CUT', 'CUT']);
  const r = await runTask(treatment, { brief, nhanVat: chars }, 'p1', deps);
  assert.equal(r.output.phan.length, 4, 'phải giữ bản 4 phần, không phải bản rỗng');
  assert.ok(deps.prompts[2].includes('không phải JSON hợp lệ'));
});

await test('kết quả rỗng không được chọn khi có bản có nội dung; toàn rỗng thì báo lỗi', async () => {
  const r = await runTask(logline, { brief: briefInput, cauHoi: [] }, 'p1', fakeDeps([{ nhanXet: 'ok', phuongAn: [{ ...opt, logline: 'Một. Hai. Ba.' }, opt, opt] }, { nhanXet: '', phuongAn: [] }, { nhanXet: '', phuongAn: [] }]));
  assert.equal(r.output.phuongAn.length, 3);
  await assert.rejects(runTask(logline, { brief: briefInput, cauHoi: [] }, 'p1', fakeDeps(['CUT', 'CUT', 'CUT'])), /không trả về kết quả dùng được/);
});

await test('nhân vật: AI trả hai người cùng tên thì id không trùng; tên rỗng không ăn id cũ', async () => {
  const one = { ten: 'Lan', vai: 'chinh', tuoi: '', muon: 'a', can: '', tinhCach: 'b', chiTiet: 'c', quanHe: '', ghiChuThietKe: '' };
  const prev = [{ ...chars[0], id: 'nv1' }, { ...chars[0], id: 'nv2', ten: '', tag: 'nhanvat' }];
  const r = await runTask(nhanVat, { brief, sua: { truoc: { list: prev }, yeuCau: 'x' } }, 'p1', fakeDeps([{ nhanVat: [one, one, { ...one, ten: '' }] }]));
  const ids = r.output.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, `id trùng: ${ids.join(',')}`);
  assert.equal(ids[0], 'nv1');
  assert.notEqual(ids[2], 'nv2');
});

await test('vai nhân vật đọc được nhiều cách viết', () => {
  assert.equal(normVai('nhân vật chính'), 'chinh');
  assert.equal(normVai('main'), 'chinh');
  assert.equal(normVai('Gián tiếp'), 'gian-tiep');
  assert.equal(normVai('phụ'), 'phu');
});

await test('đã cũ lan theo chuỗi: ② đã cũ thì ③ bị chặn', () => {
  let p: Project = newProjectData('p1', 1);
  const b0 = { data: brief as any, meta: { rev: 0, status: 'nhap' as const, basedOn: {}, updatedAt: 1 } };
  p = { ...p, sections: { brief: approveSection(p, 'brief', b0, 2) } };
  p = { ...p, sections: { ...p.sections, nhanVat: approveSection(p, 'nhanVat', freshSection(p, 'nhanVat', { list: chars }, 3), 4) } };
  p = { ...p, sections: { ...p.sections, treatment: approveSection(p, 'treatment', freshSection(p, 'treatment', goodTreatment(60), 5), 6) } };
  assert.deepEqual(blockedDeps(p, 'treatment'), []);
  // Duyệt lại brief với nội dung mới → ② và ③ đã cũ; ③ bị chặn vì ② đã cũ
  p = { ...p, sections: { ...p.sections, brief: approveSection(p, 'brief', editSection(p.sections.brief!, { ...brief, logline: 'mới' } as any, 7), 8) } };
  assert.ok(isStale(p, 'nhanVat'));
  assert.deepEqual(blockedDeps(p, 'treatment'), ['nhanVat']);
  assert.deepEqual(missingDeps(p, 'treatment'), [], 'màn ③ vẫn xem được, chỉ bị chặn thao tác');
  // Giữ nguyên ② → ③ hết bị chặn (vẫn đã cũ với brief cho tới khi giữ nguyên ③)
  p = { ...p, sections: { ...p.sections, nhanVat: keepSection(p, 'nhanVat', p.sections.nhanVat!, 9) } };
  assert.deepEqual(blockedDeps(p, 'treatment'), []);
  assert.ok(isStale(p, 'treatment'));
});

await test('đếm câu không coi "..." giữa câu là hết câu; giây NaN hiện gạch ngang', () => {
  assert.equal(sc2('Anh ấy đi... rồi về. Hết.'), 2);
  assert.equal(sc2('lan đi. mẹ gọi. bố về.'), 3);
  assert.equal(sc2('Chờ… rồi thôi'), 1);
  assert.equal(fmtGiay(NaN), '—');
});

await test('kết quả AI ghi phiên bản phần trên lúc BẤM NÚT; phần trên đổi trong lúc chạy thì kết quả đã cũ', () => {
  let p: Project = newProjectData('p1', 1);
  const b0 = { data: brief as any, meta: { rev: 0, status: 'nhap' as const, basedOn: {}, updatedAt: 1 } };
  p = { ...p, sections: { brief: approveSection(p, 'brief', b0, 2) } };
  const readRevs = { brief: p.sections.brief!.meta.rev }; // lúc bấm "Đề xuất nhân vật"
  // Trong lúc AI chạy: brief được sửa và duyệt lại (bản 2)
  p = { ...p, sections: { ...p.sections, brief: approveSection(p, 'brief', editSection(p.sections.brief!, { ...brief, logline: 'mới' } as any, 3), 4) } };
  p = { ...p, sections: { ...p.sections, nhanVat: freshSection(p, 'nhanVat', { list: chars }, 5, readRevs) } };
  assert.ok(isStale(p, 'nhanVat'), 'phải là đã cũ vì AI đọc brief bản 1');
});

/* ---------------- Màn ④ — Kịch bản ---------------- */

await test('dàn ý hợp lệ thì không lỗi', () => {
  const r = checkDanY(goodDanY(), kbCtx);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

await test('dàn ý: hở giây, cảnh < 3s, tag địa điểm lệch, nhân vật lạ, cài sau dùng, thiếu Cài – Dùng', () => {
  const d = goodDanY();
  d.canh[1].batDau = 13;
  d.canh[3].batDau = 51;
  d.canh[2].tagDiaDiem = 'phong2'; // cùng tên, khác tag
  d.canh[0].coMat = ['lan', 'shipper'];
  d.canh[0].tagDiaDiem = 'lan'; // trùng tag nhân vật
  d.caiDung = [{ id: 'C1', cai: 'S3', dung: 'S1' }];
  const e = checkDanY(d, kbCtx).errors;
  assert.ok(e.some((x) => x.includes('Cảnh 2 phải bắt đầu đúng lúc')), 'thiếu lỗi hở giây');
  assert.ok(e.some((x) => x.includes('cùng địa điểm phải cùng tag')), 'thiếu lỗi tag địa điểm');
  assert.ok(e.some((x) => x.includes('@shipper không có ở màn 2')), 'thiếu lỗi nhân vật lạ');
  assert.ok(e.some((x) => x.includes('trùng tag nhân vật')), 'thiếu lỗi trùng tag');
  assert.ok(e.some((x) => x.includes('cảnh cài (3)')), 'thiếu lỗi cài sau dùng');
  const short = goodDanY();
  short.canh[3] = { ...short.canh[3], batDau: 51, ketThuc: 60 };
  short.canh[2] = { ...short.canh[2], ketThuc: 58 };
  short.canh[3].batDau = 58;
  assert.ok(checkDanY(short, kbCtx).errors.some((x) => x.includes('ít nhất 3 giây')));
  const noCd = { ...goodDanY(), caiDung: [] };
  assert.ok(checkDanY(noCd, kbCtx).errors.some((x) => x.includes('chưa chọn đủ cảnh cài')));
});

await test('dàn ý: cùng địa điểm liên tiếp mà trạng thái không nối → cảnh báo; nhân vật gián tiếp có mặt → cảnh báo', () => {
  const d = goodDanY();
  d.canh[1].dauCanh = [{ tag: 'lan', moTa: 'đứng ở bếp' }];
  d.canh[2].coMat = ['lan', 'me'];
  const w = checkDanY(d, kbCtx).warnings;
  assert.ok(w.some((x) => x.includes('Cảnh 2 cùng địa điểm') && x.includes('@lan')));
  assert.ok(w.some((x) => x.includes('gián tiếp')));
});

await test('beat hợp lệ thì không lỗi; trạng thái đầu beat lấy từ cuối beat trước', () => {
  const kb = goodKichBan();
  for (const c of kb.danY.canh) {
    const r = checkCanh(kb.canh[c.id].beats, ctxOf(kb, c.id));
    assert.deepEqual(r.errors, [], `${c.id}: ${r.errors.join(' | ')}`);
  }
  const c = kb.danY.canh[1];
  const beats = kb.canh[c.id].beats;
  assert.deepEqual(dauBeat(c, beats, 0), c.dauCanh);
  assert.deepEqual(dauBeat(c, beats, 1), beats[0].cuoiBeat);
  assert.deepEqual(checkKichBan(kb, kbCtx).errors, []);
});

await test('beat: sai tổng giây, beat ngoài 3–10s, tag lạ, đạo cụ trùng, thoại khi brief không thoại, thiếu Cài – Dùng', () => {
  const kb = goodKichBan();
  const c = kb.danY.canh[0];
  const beats: Beat[] = kb.canh[c.id].beats.map((b) => ({ ...b, caiDung: [] }));
  beats[0] = { ...beats[0], giay: 2, coMat: ['lan', 'conmeo'], daoCuMoi: [{ tag: 'lan', moTa: 'x' }], thoai: [{ ai: 'lan', cachNoi: '', cau: 'Mệt quá.' }] };
  const r = checkCanh(beats, { ...ctxOf(kb, c.id), mucThoai: 'khong' });
  assert.ok(r.errors.some((x) => x.includes('Tổng giây các beat')), 'thiếu lỗi tổng giây');
  assert.ok(r.errors.some((x) => x.includes('mỗi beat 3–10 giây')), 'thiếu lỗi beat ngắn');
  assert.ok(r.errors.some((x) => x.includes('@conmeo')), 'thiếu lỗi tag lạ');
  assert.ok(r.errors.some((x) => x.includes('trùng tag nhân vật')), 'thiếu lỗi đạo cụ trùng nhân vật');
  assert.ok(r.errors.some((x) => x.includes('không thoại')), 'thiếu lỗi thoại');
  assert.ok(r.errors.some((x) => x.includes('nét chữ của mẹ')), 'thiếu lỗi Cài – Dùng');
});

await test('beat: cảnh báo thoại dài, ngoài khoảng thể loại, người lạ nói, beat cuối lệch dàn ý', () => {
  const kb = goodKichBan();
  const c = kb.danY.canh[1];
  const beats = kb.canh[c.id].beats.map((b) => ({ ...b }));
  beats[0] = { ...beats[0], giay: 9, thoai: [{ ai: 'người giao hàng', cachNoi: '', cau: 'Chị ơi có hàng nè chị ơi ra nhận giúp em với nha chị ơi em đứng chờ dưới cổng nãy giờ rồi đó chị xuống lẹ giùm em nha em còn đi giao mấy đơn nữa' }] };
  beats[1] = { ...beats[1], giay: beats[1].giay - (9 - kb.canh[c.id].beats[0].giay) };
  beats[beats.length - 1] = { ...beats[beats.length - 1], cuoiBeat: [{ tag: 'lan', moTa: 'đứng ở cửa' }] };
  const w = checkCanh(beats, ctxOf(kb, c.id)).warnings;
  assert.ok(w.some((x) => x.includes('nói không kịp')), 'thiếu cảnh báo thoại dài');
  assert.ok(w.some((x) => x.includes('thể loại khuyên 4–8')), 'thiếu cảnh báo khoảng thể loại');
  assert.ok(w.some((x) => x.includes('người giao hàng') && x.includes('không có ở màn 2')), 'thiếu cảnh báo người lạ nói');
  assert.ok(w.some((x) => x.includes('khác trạng thái cuối cảnh')), 'thiếu cảnh báo beat cuối');
});

await test('đạo cụ: khai ở cảnh trước thì cảnh sau dùng được; khai lại thì lỗi', () => {
  let kb = goodKichBan();
  const [c1, c2] = kb.danY.canh;
  const b1 = kb.canh[c1.id].beats.map((b, i) => (i === 0 ? { ...b, daoCuMoi: [{ tag: 'thungxop', moTa: 'thùng xốp trắng' }], coMat: ['lan', 'thungxop'], cuoiBeat: [...b.cuoiBeat, { tag: 'thungxop', moTa: 'đóng' }] } : b));
  kb = suaCanh(kb, c1.id, b1, 2);
  assert.deepEqual(daoCuTruoc(kb, c2.id).map((d) => d.tag), ['thungxop']);
  const b2 = kb.canh[c2.id].beats.map((b, i) => (i === 0 ? { ...b, coMat: ['lan', 'thungxop'], thayDoi: [{ tag: 'thungxop', truoc: 'đóng', sau: 'mở' }], cuoiBeat: [...b.cuoiBeat, { tag: 'thungxop', moTa: 'mở' }] } : b));
  assert.deepEqual(checkCanh(b2, ctxOf(kb, c2.id)).errors, []);
  const again = b2.map((b, i) => (i === 0 ? { ...b, daoCuMoi: [{ tag: 'thungxop', moTa: 'lại' }] } : b));
  assert.ok(checkCanh(again, ctxOf(kb, c2.id)).errors.some((x) => x.includes('@thungxop đã có')));
});

await test('cần xem lại: sửa dàn ý một cảnh chỉ cờ cảnh đó; đổi cuối cảnh trước thì cờ cảnh sau; "vẫn đúng" xoá cờ', () => {
  let kb = goodKichBan();
  assert.ok(kb.danY.canh.every((c) => tinhTrangCanh(kb, c.id) === 'da-viet'));
  // Sửa chuyển biến của cảnh 2 (không đổi trạng thái cuối)
  kb = { ...kb, danY: { ...kb.danY, canh: kb.danY.canh.map((c) => (c.id === 'S2' ? { ...c, chuyenBien: 'khác' } : c)) } };
  assert.deepEqual(kb.danY.canh.map((c) => tinhTrangCanh(kb, c.id)), ['da-viet', 'can-xem-lai', 'da-viet', 'da-viet']);
  // "Vẫn đúng": ghi lại dấu đầu vào
  kb = ghiCanh(kb, 'S2', kb.canh.S2.beats, 3);
  assert.equal(tinhTrangCanh(kb, 'S2'), 'da-viet');
  // Sửa tay beat cuối cảnh 2 (đổi trạng thái cuối thật) → cảnh 3 cần xem lại, cảnh 2 thì không
  const b = kb.canh.S2.beats;
  kb = suaCanh(kb, 'S2', b.map((x, i) => (i === b.length - 1 ? { ...x, cuoiBeat: [{ tag: 'lan', moTa: 'đứng dậy' }] } : x)), 4);
  assert.equal(tinhTrangCanh(kb, 'S2'), 'da-viet');
  assert.equal(tinhTrangCanh(kb, 'S3'), 'can-xem-lai');
  assert.ok(checkKichBan(kb, kbCtx).errors.some((x) => x.includes('Cảnh 3 cần xem lại')));
  // Cảnh chưa viết
  const kb2 = { ...kb, canh: { ...kb.canh } };
  delete kb2.canh.S4;
  assert.equal(tinhTrangCanh(kb2, 'S4'), 'chua-viet');
  assert.ok(checkKichBan(kb2, kbCtx).errors.some((x) => x.includes('Cảnh 4 chưa viết')));
});

await test('mã beat cố định: không trùng cảnh khác, không dùng lại số đã xoá', () => {
  let kb = goodKichBan();
  const all = Object.values(kb.canh).flatMap((v) => v.beats.map((b) => b.id));
  assert.equal(new Set(all).size, all.length);
  const before = kb.soBeat;
  // Xoá beat cuối cảnh 4 rồi thêm beat mới: số mới lớn hơn mọi số cũ
  const s4 = kb.canh.S4.beats;
  kb = suaCanh(kb, 'S4', s4.slice(0, -1), 5);
  const g = ganMaBeat(kb, 'S4', [...kb.canh.S4.beats, { ...s4[0], id: '' }]);
  assert.equal(g.beats[g.beats.length - 1].id, beatId(before));
  // Beat AI trả về trùng mã cảnh khác → nhận số mới
  const clash = ganMaBeat(kb, 'S4', [{ ...s4[0], id: kb.canh.S1.beats[0].id }]);
  assert.notEqual(clash.beats[0].id, kb.canh.S1.beats[0].id);
});

await test('trạng thái: đọc / ghi ô chữ, đọc mã cảnh / beat', () => {
  const lines = parseTrangThai('@lan: ngồi bệt, giữa phòng\nthungxop — mở nắp\nkhông có tag');
  assert.deepEqual(lines, [{ tag: 'lan', moTa: 'ngồi bệt, giữa phòng' }, { tag: 'thungxop', moTa: 'mở nắp' }]);
  assert.equal(trangThaiText(lines), '@lan: ngồi bệt, giữa phòng\n@thungxop: mở nắp');
  assert.equal(normCanhId('Cảnh S 3'), 'S3');
  assert.equal(normBeatId('b7'), 'B007');
});

await test('thể loại: đọc độ dài beat và thang chấm', () => {
  assert.deepEqual(beatGiayOf(genre), [4, 8]);
  const t = thangChamOf(genre)!;
  assert.equal(t.tieuChi.length, 5);
  assert.equal(t.nguong, 7);
  assert.equal(t.tieuChi[0].toiDa, 2);
});

await test('tác vụ dàn ý: AI giả → mã cảnh, phần, Cài – Dùng theo số thứ tự; sửa theo yêu cầu giữ mã cũ', async () => {
  const d = goodDanY();
  const raw = {
    canh: d.canh.map((c, i) => ({ ...c, id: undefined, ma: '', phan: i + 1, tagDiaDiem: '@PhongTro', coMat: ['@lan'] })),
    caiDung: [{ ma: 'c1', canhCai: 1, canhDung: 3 }],
  };
  const r = await runTask(danYCanh, { brief, nhanVat: chars, treatment: goodTreatment(60), soCanh: 1 }, 'p1', fakeDeps([raw]));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.output.canh.map((c) => c.id), ['S1', 'S2', 'S3', 'S4']);
  assert.equal(r.output.canh[2].phan, 'P3');
  assert.equal(r.output.canh[0].tagDiaDiem, 'phongtro');
  assert.deepEqual(r.output.caiDung, [{ id: 'C1', cai: 'S1', dung: 'S3' }]);
  // Sửa: AI chèn một cảnh mới giữa S1 và S2, giữ mã cũ cho các cảnh khác
  const raw2 = { canh: [{ ...raw.canh[0], ma: 'S1' }, { ...raw.canh[1], ma: '', ketThuc: 20 }, { ...raw.canh[1], ma: 'S2', batDau: 20 }, { ...raw.canh[2], ma: 'S3' }, { ...raw.canh[3], ma: 'S4' }], caiDung: raw.caiDung };
  const r2 = await runTask(danYCanh, { brief, nhanVat: chars, treatment: goodTreatment(60), soCanh: 5, sua: { truoc: r.output, yeuCau: 'thêm cảnh' } }, 'p1', fakeDeps([raw2]));
  assert.deepEqual(r2.output.canh.map((c) => c.id), ['S1', 'S5', 'S2', 'S3', 'S4']);
});

await test('tác vụ viết cảnh: AI giả → mã beat từ số tiếp theo; sai tổng giây thì gửi lại kèm lỗi', async () => {
  const d = goodDanY();
  const c = d.canh[1];
  const good = beatsFor(c, 1).map((b) => ({ ...b, ma: '', coMat: ['@Lan'] }));
  const bad = good.map((b, i) => (i === 0 ? { ...b, giay: b.giay + 1 } : b));
  const input = { brief, nhanVat: chars, treatment: goodTreatment(60), danY: d, canhId: 'S2', canhTruoc: null, daoCuTruoc: [], soBeat: 7 };
  const deps = fakeDeps([{ beats: bad }, { beats: good }]);
  const r = await runTask(vietCanh, input, 'p1', deps);
  assert.deepEqual(r.errors, []);
  assert.equal(r.output[0].id, 'B007');
  assert.deepEqual(r.output[0].coMat, ['lan']);
  assert.ok(deps.prompts[1].includes('Tổng giây các beat'));
  assert.ok(deps.prompts[0].includes('Tổng giây các beat PHẢI bằng đúng 18 giây'));
});

await test('prompt viết cảnh: brief không thoại / không nhạc thì dặn rõ; có Cài – Dùng thì liệt kê', () => {
  const tpl = fs.readFileSync(path.join(ROOT, 'prompts/04b-viet-canh.md'), 'utf8');
  const b2 = { ...brief, thoai: { mucDo: 'khong', ngonNgu: '' }, nhacNen: 'khong' };
  const input = vietCanh.parseInput({ brief: b2, nhanVat: chars, treatment: goodTreatment(60), danY: goodDanY(), canhId: 'S1', canhTruoc: null, daoCuTruoc: [], soBeat: 1 });
  const out = render(tpl, vietCanh.vars(input, { genre }));
  assert.ok(out.includes('KHÔNG THOẠI'));
  assert.ok(out.includes('KHÔNG NHẠC NỀN'));
  assert.ok(out.includes('C1 "nét chữ của mẹ": cài ở cảnh này'));
  assert.ok(out.includes('Đây là cảnh mở đầu phim'));
});

/* ---------------- Màn ⑤ — Rà soát ---------------- */

const diemRaw = [1, 2, 3, 4, 5].map((k) => ({ tieuChi: k, diem: 1.6, nhanXet: 'ổn' }));

await test('tác vụ rà soát: code tự cộng điểm theo thang thể loại; beat kéo theo cảnh; mã lạ thì lỗi', async () => {
  const kb = goodKichBan();
  const b = kb.canh.S3.beats[0].id;
  const raw = {
    diem: diemRaw,
    nhanXet: 'Ổn.',
    vanDe: [
      { loai: 'Cài-dùng', muc: 'Cao', canh: [], beat: [b.toLowerCase()], moTa: 'Mẩu giấy xuất hiện mà không nhìn rõ.', deXuat: 'Cho Lan cầm mẩu giấy lên.', canSuaDanY: false },
      { loai: 'nhịp', muc: 'thấp', canh: ['S9'], beat: [], moTa: 'x', deXuat: 'y', canSuaDanY: false },
    ],
  };
  const r = await runTask(raSoat, { brief, nhanVat: chars, treatment: goodTreatment(60), kichBan: kb, daBoQua: [] }, 'p1', fakeDeps([raw, raw, raw]));
  assert.equal(r.output.diem.length, 5);
  assert.equal(r.output.diem[0].diem, 1.5, 'điểm làm tròn 0,5');
  assert.equal(tongDiem(r.output), 7.5);
  assert.equal(r.output.nguong, 7);
  assert.deepEqual(r.output.vanDe[0].canh, ['S3']);
  assert.equal(r.output.vanDe[0].loai, 'cài – dùng');
  assert.equal(r.output.vanDe[0].muc, 'cao');
  assert.ok(r.errors.some((e) => e.includes('không có cảnh S9')));
});

await test('rà soát: kiểm điểm ngoài thang, thiếu đề xuất; dưới ngưỡng chỉ cảnh báo; cổng duyệt chặn vấn đề cao', () => {
  const base: RaSoatData = {
    diem: [{ ten: 'a', toiDa: 2, diem: 3, nhanXet: 'x' }, { ten: 'b', toiDa: 8, diem: 2, nhanXet: 'x' }],
    nguong: 7, nhanXet: '', banSua: [], daBoQua: [],
    vanDe: [{ id: 'V1', loai: 'nhịp', muc: 'cao', canh: ['S1'], beat: [], moTa: 'm', deXuat: '', canSuaDanY: false, daSuaCanh: [], xuLy: 'chua', lyDo: '' }],
  };
  const r = checkRaSoat(base, { canhIds: ['S1'], beatIds: [], soTieuChi: 2 });
  assert.ok(r.errors.some((e) => e.includes('ngoài thang')));
  assert.ok(r.errors.some((e) => e.includes('chưa có đề xuất')));
  assert.ok(r.warnings.some((e) => e.includes('dưới mức đạt')));
  assert.equal(raSoatBlocking(base).length, 1);
  assert.equal(raSoatBlocking({ ...base, vanDe: [{ ...base.vanDe[0], xuLy: 'bo' }] }).length, 0);
  assert.equal(raSoatBlocking({ ...base, vanDe: [{ ...base.vanDe[0], xuLy: 'nhan' }] }).length, 1, 'đã nhận nhưng chưa sửa vẫn chặn');
  assert.equal(raSoatBlocking({ ...base, vanDe: [{ ...base.vanDe[0], muc: 'vua' }] }).length, 0);
});

await test('rà soát: đọc loại / mức nhiều cách viết', () => {
  assert.equal(normLoai('Khó cho AI'), 'khó với AI video');
  assert.equal(normLoai('Nhân quả'), 'nhân quả');
  assert.equal(normLoai('lạ'), 'khác');
  assert.equal(normMuc('HIGH'), 'cao');
  assert.equal(normMuc('Thấp'), 'thap');
  assert.equal(normMuc(''), 'vua');
});

await test('màn ⑥ ⑦ dựa trên ⑤: ⑤ chưa duyệt thì ⑥ bị khoá', () => {
  const p: Project = newProjectData('p1', 1);
  assert.ok(missingDeps(p, 'bible').includes('raSoat'));
  assert.ok(missingDeps(p, 'phanCanh').includes('raSoat'));
});

/* ---------------- Các lỗi đã sửa sau lượt soát lượt 2 ---------------- */

await test('mã beat: số đã cấp rồi xoá không được dùng lại, kể cả khi AI trả về số đó', () => {
  let kb = goodKichBan();
  // Bạn thêm một beat ở cảnh 1 (nhận số mới), rồi xoá nó
  kb = suaCanh(kb, 'S1', [...kb.canh.S1.beats, { ...kb.canh.S1.beats[0], id: '' }], 2);
  const added = kb.canh.S1.beats[kb.canh.S1.beats.length - 1].id;
  kb = suaCanh(kb, 'S1', kb.canh.S1.beats.filter((b) => b.id !== added), 3);
  // Kết quả AI (cấp số lúc bấm nút) mang đúng số vừa xoá → phải nhận số mới
  const g = ganMaBeat(kb, 'S4', [{ ...kb.canh.S4.beats[0], id: added }]);
  assert.notEqual(g.beats[0].id, added);
  // Beat vốn của cảnh thì giữ mã
  assert.equal(ganMaBeat(kb, 'S4', kb.canh.S4.beats).beats[0].id, kb.canh.S4.beats[0].id);
});

await test('bản sửa ghi kèm đầu vào lúc gửi AI: cảnh trước đổi sau đó thì vẫn "cần xem lại"', () => {
  let kb = goodKichBan();
  const dv = dauVaoCanh(kb, 'S3'); // lúc gửi AI viết lại cảnh 3
  // Nhận bản sửa cảnh 2 trước, cuối cảnh 2 đổi
  const b2 = kb.canh.S2.beats;
  kb = ghiCanh(kb, 'S2', b2.map((x, i) => (i === b2.length - 1 ? { ...x, cuoiBeat: [{ tag: 'lan', moTa: 'đứng dậy' }] } : x)), 2);
  // Nhận bản sửa cảnh 3 với đầu vào cũ → vẫn cần xem lại
  kb = ghiCanh(kb, 'S3', kb.canh.S3.beats, 3, dv);
  assert.equal(tinhTrangCanh(kb, 'S3'), 'can-xem-lai');
});

await test('rà soát: mức "nghiêm trọng" là cao; "sai logic" không bị coi là khó với AI video', () => {
  assert.equal(normMuc('Nghiêm trọng'), 'cao');
  assert.equal(normLoai('sai logic'), 'khác');
  assert.equal(normLoai('khó làm video'), 'khó với AI video');
});

/* ---------------- Màn ⑥ — Bible ---------------- */

await test('bóc tách: nhân vật có mặt / chỉ có giọng, đạo cụ và trạng thái, bối cảnh theo thời điểm, ánh sáng từng cảnh', () => {
  const b = bocTach(kbBible(), chars);
  const lan = b.nhanVat.find((n) => n.tag === 'lan')!;
  assert.deepEqual(lan.canh, ['S1', 'S2', 'S3', 'S4']);
  assert.equal(lan.bo.length, 1);
  assert.equal(lan.bo[0].tag, 'lan');
  assert.deepEqual(lan.bo[0].canh, ['S1', 'S2', 'S3', 'S4']);
  const me = b.nhanVat.find((n) => n.tag === 'me')!;
  assert.deepEqual(me.canh, [], 'mẹ chỉ nói qua điện thoại');
  assert.equal(me.coThoai, true);
  assert.deepEqual(me.bo, []);
  assert.deepEqual(b.daoCu.map((d) => [d.tag, d.trangThai.join(' → ')]), [['thungxop', 'đóng kín → mở nắp']]);
  assert.equal(b.boiCanh.length, 1);
  assert.deepEqual(b.boiCanh[0].bienThe.map((v) => [v.tag, v.thoiDiem, v.canh.length]), [['phongtro', 'khuya', 3], ['phongtrosangsom', 'sáng sớm', 1]]);
  assert.equal(b.anhSang.length, 4);
});

await test('bóc tách lại: giữ phần đã làm, mục mới thêm vào, mục không còn dùng được đánh dấu', () => {
  const old = goodBible();
  old.anh.thungxop = { imageId: 'img1' };
  let kb = kbBible();
  // Bỏ đạo cụ khỏi kịch bản, thêm cảnh buổi chiều
  kb = suaCanh(kb, 'S2', kb.canh.S2.beats.map((b) => ({ ...b, daoCuMoi: [], thayDoi: [], coMat: ['lan'] })), 3);
  kb = { ...kb, danY: { ...kb.danY, canh: kb.danY.canh.map((c) => (c.id === 'S3' ? { ...c, thoiDiem: 'chiều', anhSang: 'nắng chiều' } : c)) } };
  const b = bocTach(kb, chars, old);
  assert.equal(b.style, old.style);
  assert.equal(b.nhanVat.find((n) => n.tag === 'lan')!.bo[0].moTa, EN.moTa, 'giữ mô tả đã làm');
  assert.equal(b.daoCu.find((d) => d.tag === 'thungxop')!.khongDung, true);
  assert.equal(b.anh.thungxop.imageId, 'img1', 'giữ ảnh');
  const v = b.boiCanh[0].bienThe;
  assert.equal(v.find((x) => x.thoiDiem === 'khuya')!.tag, 'phongtro');
  assert.equal(v.find((x) => x.thoiDiem === 'sáng sớm')!.tag, 'phongtrosangsom', 'giữ tag biến thể cũ');
  assert.equal(v.find((x) => x.thoiDiem === 'chiều')!.khungAnh, '', 'biến thể mới chờ AI viết');
  assert.equal(b.anhSang.find((a) => a.canh === 'S3')!.moTa, '', 'ánh sáng đổi thì viết lại');
  assert.equal(b.anhSang.find((a) => a.canh === 'S1')!.moTa, old.anhSang[0].moTa);
});

await test('bóc tách: biến thể mới không chiếm tag địa điểm của biến thể cũ', () => {
  const old = goodBible();
  let kb = kbBible();
  // Cảnh 1 đổi sang buổi chiều (thời điểm mới đứng đầu), khuya vẫn còn ở cảnh 2–3
  kb = { ...kb, danY: { ...kb.danY, canh: kb.danY.canh.map((c) => (c.id === 'S1' ? { ...c, thoiDiem: 'chiều' } : c)) } };
  const tags = bocTach(kb, chars, old).boiCanh[0].bienThe.map((v) => v.tag);
  assert.equal(new Set(tags).size, tags.length, `tag trùng: ${tags.join(', ')}`);
  assert.ok(tags.includes('phongtro'));
});

await test('bible hợp lệ thì không lỗi; thiếu ảnh chỉ cảnh báo', () => {
  const r = checkBible(goodBible(), { nhanVat: chars, canhIds: ['S1', 'S2', 'S3', 'S4'] });
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => w.includes('chưa có ảnh')));
});

await test('bible: tiếng Việt trong ô tiếng Anh, quá dài, thiếu giọng, cảnh chưa có bộ đồ, tên nhân vật trong mô tả, thiếu style', () => {
  const b = goodBible();
  b.style = '';
  b.nhanVat = b.nhanVat.map((n) => (n.tag === 'me' ? { ...n, giong: '' } : { ...n, bo: n.bo.map((x) => ({ ...x, moTa: 'Cô gái gầy tóc ngắn', canh: x.canh.filter((c) => c !== 'S2') })) }));
  b.daoCu = b.daoCu.map((d) => ({ ...d, moTa: `${'word '.repeat(45)}` }));
  b.boiCanh = b.boiCanh.map((c) => ({ ...c, moTa: 'The rented room where Lan lives, with a bed.' }));
  b.anhSang = b.anhSang.map((a, i) => (i === 0 ? { ...a, moTa: '' } : a));
  const e = checkBible(b, { nhanVat: chars, canhIds: ['S1', 'S2', 'S3', 'S4'] }).errors;
  for (const want of ['Chưa chọn style', 'phải viết tiếng Anh', 'tối đa 40 từ', 'Giọng của Mẹ', 'cảnh 2 chưa chọn bộ đồ', 'không được nhắc tên nhân vật (Lan)', 'Ánh sáng cảnh 1 còn trống']) {
    assert.ok(e.some((x) => x.includes(want)), `thiếu lỗi: ${want}\n${e.join('\n')}`);
  }
  assert.equal(coTiengViet('A girl'), false);
});

await test('prompt ảnh do code ghép: mô tả + khung + style; đạo cụ kết bằng câu không chữ; bối cảnh không người, đúng tỉ lệ', () => {
  const b = goodBible();
  const d = promptDaoCu(b.daoCu[0], b.style);
  assert.ok(d.startsWith(b.daoCu[0].moTa.replace(/\.$/, '')));
  assert.ok(d.includes(b.style.replace(/\.$/, '')));
  assert.ok(d.endsWith(`${PROP_SUFFIX}.`));
  const c = promptBoiCanh(b.boiCanh[0], b.boiCanh[0].bienThe[0], b.style, '9:16');
  assert.ok(c.includes('aspect ratio 9:16') && c.includes('no people'));
  assert.ok(promptSheet(b.nhanVat[0].bo[0], b.style).includes(EN.moTa.replace(/\.$/, '')));
  const tags = mucAnh(b, '9:16').map((m) => m.tag);
  assert.deepEqual(tags, ['lan', 'thungxop', 'phongtro', 'phongtrosangsom'], 'mẹ không có ảnh (chỉ có giọng)');
});

await test('tác vụ style: đúng 3 phương án tiếng Anh, không tên nhân vật', async () => {
  const p = (style: string) => ({ style, giaiThich: 'Hợp phim.' });
  const ok = { phuongAn: [p('Warm natural photorealistic look.'), p('High contrast cinematic look.'), p('Faded vintage film look.')] };
  const bad = { phuongAn: [p('Ảnh ấm áp'), p('Lan in warm light.')] };
  const deps = fakeDeps([bad, ok]);
  const r = await runTask(bibleStyle, bibleInput({ ...goodBible(), style: '' }), 'p1', deps);
  assert.deepEqual(r.errors, []);
  assert.equal(r.output.length, 3);
  assert.ok(deps.prompts[1].includes('Cần đúng 3 phương án'));
  assert.ok(deps.prompts[1].includes('nhắc tên nhân vật'));
});

await test('tác vụ nhân vật: bộ đầu mang tag nhân vật, bộ thêm code đặt tag, cảnh theo số thứ tự; chưa có style thì báo', async () => {
  const empty = bocTach(kbBible(), chars);
  await assert.rejects(runTask(bibleNhanVat, bibleInput({ ...empty, style: '' }), 'p1', fakeDeps([])), /Chưa chọn style/);
  const bo = (ten: string, canh: number[]) => ({ ten, canh, moTa: EN.moTa, note: 'Ghi chú.', khungAnh: EN.khung, vaiTro: 'Lan in her outfit' });
  const raw = { nhanVat: [{ tag: '@lan', giong: '', bo: [bo('đồ đi làm', [1, 2, 3]), bo('đồ ngủ', [4])] }, { tag: 'me', giong: 'warm middle aged female voice', bo: [] }] };
  const r = await runTask(bibleNhanVat, bibleInput({ ...empty, style: 'Warm natural look.' }), 'p1', fakeDeps([raw]));
  assert.deepEqual(r.errors, []);
  const lan = r.output.find((n) => n.tag === 'lan')!;
  assert.deepEqual(lan.bo.map((x) => [x.tag, x.canh.join(',')]), [['lan', 'S1,S2,S3'], ['landongu', 'S4']]);
  assert.equal(r.output.find((n) => n.tag === 'me')!.giong, 'warm middle aged female voice');
});

await test('tác vụ đạo cụ và bối cảnh: điền đúng tag; ánh sáng cùng khoá được chép cùng một câu', async () => {
  const base = { ...bocTach(kbBible(), chars), style: 'Warm natural look.' };
  const g = goodBible();
  const rd = await runTask(bibleDaoCu, bibleInput(base), 'p1', fakeDeps([{ daoCu: g.daoCu.map((d) => ({ tag: d.tag, moTa: d.moTa, note: d.note, khungAnh: d.khungAnh, vaiTro: d.vaiTro })) }]));
  assert.deepEqual(rd.errors, []);
  assert.equal(rd.output[0].trangThai.join(' → '), 'đóng kín → mở nắp', 'giữ phần bóc tách');
  const raw = {
    boiCanh: g.boiCanh.map((c) => ({ tag: c.tag, moTa: c.moTa, bienThe: c.bienThe.map((v) => ({ tag: v.tag, note: v.note, khungAnh: v.khungAnh, vaiTro: v.vaiTro })) })),
    anhSang: [
      { canh: 'S1', moTa: 'Cold white tube light and a warm desk lamp.' },
      { canh: 'S2', moTa: 'A slightly different sentence.' },
      { canh: 's3', moTa: 'Another one.' },
      { canh: 'S4', moTa: 'Soft early morning sunlight.' },
    ],
  };
  const rb = await runTask(bibleBoiCanh, bibleInput(base), 'p1', fakeDeps([raw]));
  assert.deepEqual(rb.errors, []);
  assert.deepEqual(rb.output.anhSang.map((a) => a.moTa), ['Cold white tube light and a warm desk lamp.', 'Cold white tube light and a warm desk lamp.', 'Cold white tube light and a warm desk lamp.', 'Soft early morning sunlight.']);
});

await test('xoá dự án xoá cả ảnh tham chiếu của màn ⑥', async () => {
  const { imageIdsOf } = await import('../src/lib/store').catch(() => ({ imageIdsOf: null as any }));
  if (!imageIdsOf) return; // store dùng localStorage — bỏ qua khi chạy ngoài trình duyệt
  const p = newProjectData('p1', 1) as any;
  p.sections.bible = { data: { ...emptyBible(), anh: { lan: { imageId: 'a' } } }, meta: { rev: 0, status: 'nhap', basedOn: {}, updatedAt: 1 } };
  assert.deepEqual(imageIdsOf(p), ['a']);
});

/* ---------------- Kết quả ---------------- */

console.log(`\n${passed} test đạt, ${failures.length} test lỗi.`);
if (failures.length) {
  console.log(failures.join('\n'));
  process.exit(1);
}
