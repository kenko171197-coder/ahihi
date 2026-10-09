// Màn ④ — Kịch bản. Bước A: dàn ý cảnh (duyệt riêng). Bước B: viết beat từng cảnh (một lần gọi AI mỗi cảnh).
import React, { useEffect, useRef, useState } from 'react';
import { ListTree, PenLine, RefreshCw, ArrowRight, ShieldCheck, CheckCircle2, Clapperboard, Square } from 'lucide-react';
import type { Project, ProjectPatch, SectionKey, Section, GenreInfo, KichBanData, DanY, Beat, CanhDanY } from '../../types';
import { freshSection, editSection, approveSection, keepSection, missingDeps, blockedDeps, depRevs, isStale, fmtGiay, BEAT_MIN, BEAT_MAX } from '../../../shared/project';
import { checkDanY, checkKichBan, canhCtx } from '../../../shared/checks';
import { emptyKichBan, ghiCanh, suaCanh, beatsOf, tinhTrangCanh, dauVaoCanh, idNum, canhId, blankCanh, tongGiayBeat, daoCuTruoc } from '../../../shared/kichBan';
import { runTask, getGenres, TaskResult } from '../../services/api';
import { kichBanCtx, vietCanhInput } from '../../lib/kichBanInput';
import { askConfirm } from '../../lib/dialog';
import { ErrorBox, RunButton } from '../ui';
import { ScreenIntro, StatusBar, Issues, ReviseBox, useRunner, LockedScreen, UpstreamBanner } from './common';
import DanYPanel from './kichBan/DanYPanel';
import CanhBlock from './kichBan/CanhBlock';

interface Props {
  project: Project;
  onUpdate: (patch: ProjectPatch) => void;
  onGo: (k: SectionKey) => void;
}

const tick = () => new Promise((r) => setTimeout(r, 30));

/** Đặt lại giây các cảnh liền nhau từ 0, giữ độ dài từng cảnh (sau khi đổi chỗ). */
function relayout(canh: CanhDanY[]): CanhDanY[] {
  let t = 0;
  return canh.map((c) => {
    const len = Number.isFinite(c.ketThuc - c.batDau) ? Math.max(0, c.ketThuc - c.batDau) : 0;
    const out = { ...c, batDau: t, ketThuc: t + len };
    t += len;
    return out;
  });
}

export default function KichBanScreen({ project, onUpdate, onGo }: Props) {
  const { busy, error, notes, run } = useRunner();
  const [genres, setGenres] = useState<GenreInfo[] | null>(null);
  const [genreError, setGenreError] = useState('');
  const loadGenres = () => {
    setGenreError('');
    getGenres(true)
      .then(setGenres)
      .catch((e) => setGenreError(e?.message || 'Không đọc được danh sách thể loại.'));
  };
  useEffect(loadGenres, []);
  const latestRef = useRef(project);
  latestRef.current = project;
  const [buoc, setBuoc] = useState<'A' | 'B'>(() => (project.sections.kichBan?.data.danYDuyet ? 'B' : 'A'));
  const [dangViet, setDangViet] = useState<{ id: string; kind: 'viet' | 'sua' } | null>(null);
  const [tienDo, setTienDo] = useState('');
  const stopRef = useRef(false);
  // Rời màn khi "Viết tất cả" đang chạy → dừng sau cảnh đang viết (không chạy ngầm)
  useEffect(() => () => {
    stopRef.current = true;
  }, []);

  if (missingDeps(project, 'kichBan').length) return <LockedScreen project={project} sectionKey="kichBan" onGo={onGo} />;
  const blocked = blockedDeps(project, 'kichBan').length > 0;
  const stale = isStale(project, 'kichBan');

  const brief = project.sections.brief!.data;
  const nhanVat = project.sections.nhanVat!.data.list;
  const treatment = project.sections.treatment!.data;
  const total = brief.thoiLuongGiay;
  const genreInfo = genres?.find((g) => g.id === brief.theLoai);
  const beatGiay = genreInfo?.beatGiay ?? null;
  const section = project.sections.kichBan;
  const kb = section?.data;
  const ctx = kichBanCtx(project, beatGiay);
  const danYCheck = kb ? checkDanY(kb.danY, ctx) : { errors: [], warnings: [] };
  const full = kb ? checkKichBan(kb, ctx) : null;
  const genreBlocking =
    genres === null
      ? [genreError ? 'Không đọc được thông tin thể loại — bấm "Đọc lại thể loại".' : 'Đang đọc thông tin thể loại…']
      : !genreInfo
      ? [`Không tìm thấy file thể loại "${brief.theLoai}" trong knowledge/the-loai/. Chọn lại thể loại ở màn 1.`]
      : [];
  const blocking = [...genreBlocking, ...(full?.errors || [])];

  /* ---------- Ghi dữ liệu ---------- */

  const setSection = (fn: (latest: Project) => Section<KichBanData> | undefined) => onUpdate((latest) => ({ sections: { ...latest.sections, kichBan: fn(latest) } }));
  const edit = (fn: (k: KichBanData) => KichBanData) =>
    setSection((latest) => {
      const s = latest.sections.kichBan;
      return s ? editSection(s, fn(s.data), Date.now()) : freshSection(latest, 'kichBan', fn(emptyKichBan()), Date.now());
    });
  /** Sửa dàn ý → dàn ý về nháp (phải duyệt lại). */
  const editDanY = (fn: (d: DanY, k: KichBanData) => Partial<KichBanData> & { danY: DanY }) => edit((k) => ({ ...k, ...fn(k.danY, k), danYDuyet: false }));

  const onScene = (id: string, patch: Partial<CanhDanY>) => editDanY((d) => ({ danY: { ...d, canh: d.canh.map((c) => (c.id === id ? { ...c, ...patch } : c)) } }));
  const onMove = (id: string, dir: -1 | 1) =>
    editDanY((d) => {
      const i = d.canh.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.canh.length) return { danY: d };
      const canh = [...d.canh];
      [canh[i], canh[j]] = [canh[j], canh[i]];
      return { danY: { ...d, canh: relayout(canh) } };
    });
  /** Chèn cảnh: sau một cảnh (chia đôi cảnh đó), hoặc ở cuối (lấp khoảng trống, hết chỗ thì chia đôi cảnh cuối). */
  const onInsert = (afterId: string | null) =>
    editDanY((d, k) => {
      const id = canhId(k.soCanh);
      const i = afterId ? d.canh.findIndex((c) => c.id === afterId) : d.canh.length - 1;
      const c = d.canh[i];
      if (!c) return { danY: { ...d, canh: [blankCanh(id, 0, total, treatment.phan[0]?.id)] }, soCanh: k.soCanh + 1 };
      if (!afterId && Number.isFinite(c.ketThuc) && c.ketThuc < total) return { danY: { ...d, canh: [...d.canh, blankCanh(id, c.ketThuc, total, c.phan)] }, soCanh: k.soCanh + 1 };
      const mid = Math.round((c.batDau + c.ketThuc) / 2);
      const moi: CanhDanY = { ...blankCanh(id, mid, c.ketThuc, c.phan), diaDiem: c.diaDiem, tagDiaDiem: c.tagDiaDiem, thoiDiem: c.thoiDiem, anhSang: c.anhSang, coMat: c.coMat, cuoiCanh: c.cuoiCanh };
      return { danY: { ...d, canh: [...d.canh.slice(0, i), { ...c, ketThuc: mid }, moi, ...d.canh.slice(i + 1)] }, soCanh: k.soCanh + 1 };
    });
  const onRemove = async (c: CanhDanY, no: number) => {
    const written = beatsOf(kb!, c.id).length > 0;
    if (!(await askConfirm(`Xoá cảnh ${no}${c.diaDiem ? ` (${c.diaDiem})` : ''}?${written ? ' Các beat đã viết của cảnh này cũng bị xoá.' : ''} Số giây của cảnh được gộp vào cảnh liền kề.`, { okLabel: 'Xoá', danger: true }))) return;
    editDanY((d, k) => {
      const i = d.canh.findIndex((x) => x.id === c.id);
      if (i < 0) return { danY: d };
      const canh = d.canh.filter((x) => x.id !== c.id);
      if (i > 0) canh[i - 1] = { ...canh[i - 1], ketThuc: c.ketThuc };
      else if (canh[0]) canh[0] = { ...canh[0], batDau: c.batDau };
      const rest = { ...k.canh };
      delete rest[c.id];
      return {
        danY: { canh, caiDung: d.caiDung.map((x) => ({ ...x, cai: x.cai === c.id ? '' : x.cai, dung: x.dung === c.id ? '' : x.dung })) },
        canh: rest,
      };
    });
  };
  const onCaiDung = (id: string, patch: { cai?: string; dung?: string }) =>
    editDanY((d) => ({
      danY: { ...d, caiDung: d.caiDung.some((x) => x.id === id) ? d.caiDung.map((x) => (x.id === id ? { ...x, ...patch } : x)) : [...d.caiDung, { id, cai: '', dung: '', ...patch }] },
    }));

  /** Tự viết dàn ý: mỗi phần của treatment một cảnh trống. */
  const startManual = () =>
    edit((k) => ({
      ...k,
      danY: { canh: treatment.phan.map((p, i) => blankCanh(canhId(k.soCanh + i), p.batDau, p.ketThuc, p.id)), caiDung: treatment.caiDung.map((c) => ({ id: c.id, cai: '', dung: '' })) },
      soCanh: k.soCanh + treatment.phan.length,
    }));

  /* ---------- AI: dàn ý ---------- */

  const genDanY = async (sua?: string) => {
    if (!sua && kb?.danY.canh.length) {
      const msg = Object.keys(kb.canh).length ? 'Viết lại toàn bộ dàn ý? Các beat đã viết sẽ bị xoá.' : 'Viết lại toàn bộ dàn ý? Những chỗ bạn đã sửa sẽ mất.';
      if (!(await askConfirm(msg, { okLabel: 'Viết lại' }))) return;
    }
    const startedAt = section?.meta.updatedAt;
    const readRevs = depRevs(project, 'kichBan');
    const soCanh = kb?.soCanh || 1;
    run(sua ? 'sua-dan-y' : 'dan-y', async () => {
      const r = await runTask<DanY>('dan-y-canh', { brief, nhanVat, treatment, soCanh, sua: sua && kb ? { truoc: kb.danY, yeuCau: sua } : undefined }, project.id);
      if (latestRef.current.sections.kichBan?.meta.updatedAt !== startedAt && !(await askConfirm('Bạn đã sửa kịch bản trong lúc AI đang chạy. Thay dàn ý bằng kết quả mới của AI?', { okLabel: 'Thay bằng kết quả mới', cancelLabel: 'Giữ bản đang sửa' }))) return;
      setSection((latest) => {
        const old = latest.sections.kichBan?.data || emptyKichBan();
        const keep = new Set(r.output.canh.map((c) => c.id));
        // Sửa theo yêu cầu: cảnh giữ mã cũ thì giữ beat (sẽ hiện "cần xem lại" nếu dòng dàn ý đổi)
        const canh = sua ? Object.fromEntries(Object.entries(old.canh).filter(([id]) => keep.has(id))) : {};
        const next = Math.max(old.soCanh, ...r.output.canh.map((c) => idNum(c.id) + 1));
        return freshSection(latest, 'kichBan', { ...old, danY: r.output, danYDuyet: false, canh, soCanh: next }, Date.now(), readRevs);
      });
      setBuoc('A');
      return r;
    });
  };

  const approveDanY = () => {
    edit((k) => ({ ...k, danYDuyet: true }));
    setBuoc('B');
    window.scrollTo({ top: 0 });
  };

  /* ---------- AI: viết cảnh ---------- */

  /** Viết (hoặc sửa theo yêu cầu) một cảnh. Trả null nếu bạn chọn giữ bản đang sửa. */
  const writeScene = async (id: string, sua?: string): Promise<TaskResult<Beat[]> | null> => {
    const p = latestRef.current;
    const k = p.sections.kichBan!.data;
    const no = k.danY.canh.findIndex((c) => c.id === id) + 1;
    const startedAt = k.canh[id]?.updatedAt;
    const dauVao = dauVaoCanh(k, id); // đầu vào mà AI đọc — đổi trong lúc chạy thì cảnh hiện "cần xem lại"
    const r = await runTask<Beat[]>('viet-canh', vietCanhInput(p, k, id, sua ? { truoc: beatsOf(k, id), yeuCau: sua } : undefined), p.id);
    if (latestRef.current.sections.kichBan?.data.canh[id]?.updatedAt !== startedAt && !(await askConfirm(`Bạn đã sửa cảnh ${no} trong lúc AI đang chạy. Thay bằng kết quả mới của AI?`, { okLabel: 'Thay bằng kết quả mới', cancelLabel: 'Giữ bản đang sửa' }))) return null;
    setSection((latest) => {
      const s = latest.sections.kichBan;
      return s ? editSection(s, ghiCanh(s.data, id, r.output, Date.now(), dauVao), Date.now()) : s;
    });
    return r;
  };

  const writeOne = async (id: string, sua?: string) => {
    if (!sua && kb && beatsOf(kb, id).length && !(await askConfirm('Viết lại cả cảnh này? Những chỗ bạn đã sửa ở cảnh này sẽ mất.', { okLabel: 'Viết lại' }))) return;
    setDangViet({ id, kind: sua ? 'sua' : 'viet' });
    await run('canh', async () => {
      try {
        await writeScene(id, sua);
      } finally {
        setDangViet(null);
      }
    });
  };

  /** Viết lần lượt mọi cảnh chưa viết. Dừng khi một cảnh còn lỗi sau 3 lần thử, hoặc khi bạn bấm dừng. */
  const writeAll = () => {
    stopRef.current = false;
    const tried = new Set<string>();
    run('tat-ca', async () => {
      try {
        for (;;) {
          if (stopRef.current) break;
          const k = latestRef.current.sections.kichBan?.data;
          if (!k) break;
          const i = k.danY.canh.findIndex((c) => tinhTrangCanh(k, c.id) === 'chua-viet');
          if (i < 0) break;
          const c = k.danY.canh[i];
          if (tried.has(c.id)) break;
          tried.add(c.id);
          setTienDo(`Đang viết cảnh ${i + 1}/${k.danY.canh.length}…`);
          setDangViet({ id: c.id, kind: 'viet' });
          const r = await writeScene(c.id);
          await tick(); // chờ giao diện nhận bản mới trước khi viết cảnh sau
          if (!r) break;
          if (r.errors.length) throw new Error(`Cảnh ${i + 1} còn lỗi sau 3 lần thử, nên dừng lại để bạn xem. Sửa tay hoặc viết lại cảnh đó, rồi bấm "Viết tất cả" để chạy tiếp.`);
        }
      } finally {
        setTienDo('');
        setDangViet(null);
      }
    });
  };

  const keepScene = (id: string) => edit((k) => ghiCanh(k, id, beatsOf(k, id), Date.now()));
  const onBeats = (id: string, fn: (b: Beat[]) => Beat[]) => edit((k) => suaCanh(k, id, fn(beatsOf(k, id)), Date.now()));

  const approve = () => setSection((latest) => (latest.sections.kichBan ? approveSection(latest, 'kichBan', latest.sections.kichBan, Date.now()) : undefined));
  const keep = () => setSection((latest) => (latest.sections.kichBan ? keepSection(latest, 'kichBan', latest.sections.kichBan, Date.now()) : undefined));

  /* ---------- Hiển thị ---------- */

  const scenes = kb?.danY.canh || [];
  const daViet = scenes.filter((c) => tinhTrangCanh(kb!, c.id) !== 'chua-viet').length;
  const giayDaViet = scenes.reduce((s, c) => s + tongGiayBeat(beatsOf(kb!, c.id)), 0);
  // Màn trên đã đổi (đã cũ) chỉ là cảnh báo: vẫn viết tiếp được, để không phải tạo lại cả dàn ý
  const aiOff = !!busy || blocked || genres === null;
  const phanTen = (id: string) => {
    const i = treatment.phan.findIndex((p) => p.id === id);
    return i >= 0 ? `Phần ${i + 1}. ${treatment.phan[i].ten}` : 'chưa chọn phần';
  };
  const tab = (k: 'A' | 'B', label: string, sub: string, disabled = false) => (
    <button
      onClick={() => setBuoc(k)}
      disabled={disabled}
      aria-current={buoc === k ? 'step' : undefined}
      className={`flex-1 text-left rounded-xl px-4 py-3 border font-bold disabled:opacity-50 ${buoc === k ? 'bg-black border-black text-primary-400' : 'bg-white border-gray-200 text-black hover:border-primary-400'}`}
    >
      {label}
      <span className={`block text-xs font-normal ${buoc === k ? 'text-primary-200' : 'text-gray-500'}`}>{sub}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <ScreenIntro no={4} title="Kịch bản">
        Bước A: chia phim thành các cảnh (cùng bối cảnh, cùng mạch thời gian) — bạn duyệt dàn ý trước. Bước B: viết từng cảnh thành các beat {BEAT_MIN}–{BEAT_MAX} giây, mỗi beat là một lần tạo video.
      </ScreenIntro>

      <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-3">
        <b>Logline:</b> {brief.logline} · <b>Thời lượng:</b> {fmtGiay(total)}
        {beatGiay && (
          <>
            {' '}
            · <b>Thể loại khuyên mỗi beat:</b> {beatGiay[0]}–{beatGiay[1]} giây
          </>
        )}
      </p>

      <UpstreamBanner project={project} sectionKey="kichBan" onGo={onGo} />

      {genreError && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-red-700">
          {genreError}
          <button onClick={loadGenres} className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-primary-100 font-bold text-black">Đọc lại thể loại</button>
        </div>
      )}

      {!kb?.danY.canh.length && (
        <div className="flex flex-wrap gap-2">
          <RunButton onClick={() => genDanY()} busy={busy === 'dan-y'} busyLabel="AI đang chia cảnh…" icon={ListTree} disabled={!!busy || blocked}>
            Tạo dàn ý cảnh
          </RunButton>
          <button onClick={startManual} disabled={!!busy} className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-primary-100 font-bold flex items-center gap-2 disabled:opacity-50">
            <PenLine className="w-4 h-4" /> Tự viết
          </button>
        </div>
      )}

      <ErrorBox message={error} />
      <Issues errors={notes.errors} warnings={[]} title={notes.errors.length ? 'AI đã được gửi lại 2 lần nhưng kết quả vẫn còn lỗi — bạn sửa tay hoặc tạo lại:' : undefined} />

      {kb && kb.danY.canh.length > 0 && (
        <>
          <div className="flex gap-2">
            {tab('A', 'A. Dàn ý cảnh', `${scenes.length} cảnh · ${kb.danYDuyet ? 'đã duyệt' : 'nháp'}`)}
            {tab('B', 'B. Viết beat từng cảnh', `đã viết ${daViet}/${scenes.length} cảnh`)}
          </div>

          {buoc === 'A' && (
            <div className="space-y-4">
              <DanYPanel d={kb.danY} t={treatment} total={total} chars={nhanVat} written={(id) => beatsOf(kb, id).length > 0} onScene={onScene} onMove={onMove} onInsert={onInsert} onRemove={onRemove} onCaiDung={onCaiDung} />
              <div className="flex flex-wrap gap-2">
                <RunButton onClick={() => genDanY()} busy={busy === 'dan-y'} busyLabel="AI đang viết lại…" icon={RefreshCw} variant="ghost" disabled={!!busy || blocked}>
                  Viết lại toàn bộ dàn ý
                </RunButton>
              </div>
              <ReviseBox onSubmit={(t) => genDanY(t)} busy={busy === 'sua-dan-y'} disabled={!!busy || blocked} placeholder="VD: gộp cảnh 2 và 3, thêm một cảnh Lan đứng ở ban công…" />
              <Issues errors={danYCheck.errors} warnings={danYCheck.warnings} />
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl p-4 ${kb.danYDuyet ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                <p className={`text-sm font-bold flex items-center gap-2 ${kb.danYDuyet ? 'text-green-800' : 'text-gray-700'}`}>
                  {kb.danYDuyet ? <CheckCircle2 className="w-4 h-4" /> : null}
                  {kb.danYDuyet ? 'Dàn ý đã duyệt. Sửa bất kỳ ô nào sẽ chuyển dàn ý về nháp.' : blocked ? 'Dàn ý nháp — chờ màn phía trên chốt.' : 'Dàn ý nháp — kiểm tra, sửa nếu cần, rồi duyệt để viết beat.'}
                </p>
                {kb.danYDuyet ? (
                  <button onClick={() => setBuoc('B')} className="py-3 px-5 rounded-xl bg-black hover:bg-gray-800 text-primary-400 font-bold flex items-center gap-2">
                    Sang bước B <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <RunButton onClick={approveDanY} busy={false} busyLabel="" icon={ShieldCheck} disabled={!!busy || blocked || danYCheck.errors.length > 0}>
                    Duyệt dàn ý
                  </RunButton>
                )}
              </div>
              {!kb.danYDuyet && danYCheck.errors.length > 0 && <p className="text-sm text-red-700">Còn {danYCheck.errors.length} lỗi cần sửa trước khi duyệt dàn ý.</p>}
            </div>
          )}

          {buoc === 'B' && (
            <div className="space-y-4">
              {!kb.danYDuyet && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex flex-wrap items-center gap-3">
                  <span className="flex-1">Dàn ý chưa duyệt. Duyệt dàn ý ở bước A rồi mới viết beat được.</span>
                  <button onClick={() => setBuoc('A')} className="px-4 py-2 rounded-full bg-black text-primary-400 font-bold">Sang bước A</button>
                </div>
              )}
              {stale && <p className="text-sm text-amber-900">Màn phía trên đã đổi sau khi tạo dàn ý. Bạn vẫn viết tiếp được; kiểm tra dàn ý còn đúng không, viết xong thì bấm "Giữ nguyên và duyệt lại" (hoặc tạo lại dàn ý) ở cuối màn.</p>}

              <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-black flex items-center gap-2">
                      <Clapperboard className="w-4 h-4" /> Đã viết {daViet}/{scenes.length} cảnh
                    </p>
                    <p className="text-sm text-gray-600">
                      Tổng giây các beat: {fmtGiay(giayDaViet)} / {fmtGiay(total)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {busy === 'tat-ca' ? (
                      <button onClick={() => (stopRef.current = true)} className="py-3 px-5 rounded-xl bg-gray-100 hover:bg-red-50 font-bold flex items-center gap-2">
                        <Square className="w-4 h-4" /> Dừng sau cảnh này
                      </button>
                    ) : null}
                    <RunButton onClick={writeAll} busy={busy === 'tat-ca'} busyLabel={tienDo ? `${tienDo} Đừng rời màn này.` : 'AI đang viết…'} icon={Clapperboard} disabled={aiOff || !kb.danYDuyet || daViet === scenes.length}>
                      Viết tất cả cảnh chưa viết
                    </RunButton>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
                  <div className="h-full bg-primary-400" style={{ width: `${total > 0 ? Math.min(100, (giayDaViet / total) * 100) : 0}%` }} />
                </div>
              </div>

              {scenes.map((c, i) => {
                const cc = canhCtx(kb.danY, c.id, { ...ctx, daoCuTruoc: daoCuTruoc(kb, c.id) });
                return (
                  <CanhBlock
                    key={c.id}
                    no={i + 1}
                    canh={c}
                    viet={kb.canh[c.id]}
                    tinhTrang={tinhTrangCanh(kb, c.id)}
                    phanTen={phanTen(c.phan)}
                    chars={nhanVat}
                    caiDung={cc?.caiDung || []}
                    check={full?.theoCanh[c.id]}
                    running={dangViet?.id === c.id ? dangViet.kind : ''}
                    disabled={aiOff || !kb.danYDuyet}
                    onWrite={() => writeOne(c.id)}
                    onRevise={(t) => writeOne(c.id, t)}
                    onKeep={() => keepScene(c.id)}
                    onBeats={(fn) => onBeats(c.id, fn)}
                  />
                );
              })}
            </div>
          )}

          {section && (
            <>
              {blocking.length > 0 && section.meta.status !== 'duyet' && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-bold text-black">Điều kiện duyệt màn 4: còn {blocking.length} việc</summary>
                  <ul className="mt-2 list-disc pl-5 text-red-800 space-y-0.5">
                    {blocking.slice(0, 30).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                    {blocking.length > 30 && <li>… và {blocking.length - 30} việc khác.</li>}
                  </ul>
                </details>
              )}
              <StatusBar project={project} sectionKey="kichBan" blocking={blocking} onApprove={approve} onKeep={keep} onRegenerate={() => genDanY()} busy={!!busy} />
              {section.meta.status === 'duyet' && !blocked && !stale && (
                <div className="flex justify-end">
                  <button onClick={() => onGo('raSoat')} className="py-3 px-6 rounded-xl bg-black hover:bg-gray-800 text-primary-400 font-bold flex items-center gap-2">
                    Sang màn 5: Rà soát <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
