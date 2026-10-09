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

/* ---------------- Kết quả ---------------- */

console.log(`\n${passed} test đạt, ${failures.length} test lỗi.`);
if (failures.length) {
  console.log(failures.join('\n'));
  process.exit(1);
}
