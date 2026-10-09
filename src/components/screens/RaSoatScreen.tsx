// Màn ⑤ — Rà soát: AI chấm theo thang thể loại và nêu vấn đề; bạn nhận / bỏ từng đề xuất;
// đề xuất được nhận → AI viết lại đúng cảnh đó → bạn nhận bản sửa → ghi thẳng vào màn ④ (tự duyệt lại nếu đủ điều kiện).
import React, { useEffect, useRef, useState } from 'react';
import { SearchCheck, RefreshCw, ArrowRight, Check, X, Undo2, Wand2 } from 'lucide-react';
import type { Project, ProjectPatch, SectionKey, Section, GenreInfo, RaSoatData, VanDe, BanSua, Beat, KichBanData } from '../../types';
import { freshSection, editSection, approveSection, keepSection, missingDeps, blockedDeps, depRevs, isStale } from '../../../shared/project';
import { checkKichBan, checkCanh, canhCtx, checkRaSoat, raSoatBlocking, tongDiem, diemToiDa } from '../../../shared/checks';
import { beatsOf, ghiCanh, hash, daoCuTruoc, viTriCanh, dauVaoCanh } from '../../../shared/kichBan';
import { runTask, getGenres } from '../../services/api';
import { kichBanCtx, vietCanhInput } from '../../lib/kichBanInput';
import { askConfirm, notify } from '../../lib/dialog';
import { ErrorBox, RunButton } from '../ui';
import { ScreenIntro, StatusBar, Issues, useRunner, LockedScreen, UpstreamBanner, fieldCls } from './common';
import { BeatView, tieuDeCanh } from './kichBan/CanhBlock';

interface Props {
  project: Project;
  onUpdate: (patch: ProjectPatch) => void;
  onGo: (k: SectionKey) => void;
}

const MUC: Record<string, { label: string; cls: string }> = {
  cao: { label: 'Cao', cls: 'bg-red-100 text-red-800' },
  vua: { label: 'Vừa', cls: 'bg-amber-100 text-amber-900' },
  thap: { label: 'Thấp', cls: 'bg-gray-100 text-gray-700' },
};

const XU_LY: Record<string, string> = { chua: '', nhan: 'Đã nhận — chờ sửa', 'da-sua': 'Đã sửa', bo: 'Đã bỏ qua' };

/** Lời dặn gửi AI khi viết lại một cảnh theo các vấn đề đã nhận. */
function yeuCauSua(list: VanDe[]): string {
  return list.map((v) => `- [${v.loai}, mức ${MUC[v.muc]?.label.toLowerCase() || v.muc}${v.beat.length ? `, beat ${v.beat.join(', ')}` : ''}] ${v.moTa} → Đề xuất: ${v.deXuat}`).join('\n');
}

function IssueCard({
  v, no, sceneLabel, onSet, onGoDanY, disabled,
}: {
  v: VanDe;
  /** AI đang chạy → không đổi quyết định (tránh bị kết quả mới ghi đè) */
  disabled: boolean;
  no: number;
  sceneLabel: (id: string) => string;
  onSet: (patch: Partial<VanDe>) => void;
  onGoDanY: () => void;
}) {
  const [skipping, setSkipping] = useState(false);
  const [lyDo, setLyDo] = useState('');
  const m = MUC[v.muc] || MUC.vua;
  const small = 'px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 disabled:opacity-50';
  return (
    <article className={`bg-white border rounded-2xl p-4 space-y-2 ${v.xuLy === 'bo' || v.xuLy === 'da-sua' ? 'border-gray-100 opacity-70' : 'border-gray-200'}`} aria-label={`Vấn đề ${no}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold text-black text-sm">Vấn đề {no}</span>
        <span className={`font-bold px-2 py-0.5 rounded-full ${m.cls}`}>Mức {m.label.toLowerCase()}</span>
        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{v.loai}</span>
        {v.canh.map((id) => (
          <span key={id} className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-800">{sceneLabel(id)}</span>
        ))}
        {v.beat.length > 0 && <span className="text-gray-500">beat {v.beat.join(', ')}</span>}
        {v.canSuaDanY && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold">Cần sửa ở dàn ý</span>}
      </div>
      <p className="text-sm text-black">{v.moTa}</p>
      <p className="text-sm text-gray-700">
        <b>Đề xuất:</b> {v.deXuat}
      </p>

      {v.xuLy === 'chua' && !skipping && (
        <div className="flex flex-wrap gap-2 pt-1">
          {v.canSuaDanY ? (
            <>
              <button onClick={onGoDanY} className={`${small} bg-black text-primary-400`}>
                Sang màn 4 sửa dàn ý <ArrowRight className="w-4 h-4" />
              </button>
              <button disabled={disabled} onClick={() => onSet({ xuLy: 'da-sua' })} className={`${small} bg-gray-100 hover:bg-primary-100`}>
                <Check className="w-4 h-4" /> Tôi đã sửa
              </button>
            </>
          ) : (
            <button disabled={disabled} onClick={() => onSet({ xuLy: 'nhan' })} className={`${small} bg-black text-primary-400`}>
              <Check className="w-4 h-4" /> Nhận đề xuất
            </button>
          )}
          <button disabled={disabled} onClick={() => setSkipping(true)} className={`${small} bg-gray-100 hover:bg-red-50`}>
            <X className="w-4 h-4" /> Bỏ qua
          </button>
        </div>
      )}
      {v.xuLy === 'chua' && skipping && (
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <input value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="Lý do bỏ qua (tuỳ chọn) — app ghi lại" aria-label="Lý do bỏ qua" className={`${fieldCls} flex-1`} />
          <button disabled={disabled} onClick={() => onSet({ xuLy: 'bo', lyDo: lyDo.trim() })} className={`${small} bg-black text-primary-400 justify-center`}>
            Xác nhận bỏ qua
          </button>
          <button onClick={() => setSkipping(false)} className={`${small} bg-gray-100 justify-center`}>
            Huỷ
          </button>
        </div>
      )}
      {v.xuLy !== 'chua' && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
          <span className="font-bold text-gray-700">
            {XU_LY[v.xuLy]}
            {v.xuLy === 'bo' && v.lyDo ? `: ${v.lyDo}` : ''}
          </span>
          {v.xuLy !== 'da-sua' && (
            <button disabled={disabled} onClick={() => onSet({ xuLy: 'chua', lyDo: '' })} className={`${small} bg-gray-100 hover:bg-primary-100`}>
              <Undo2 className="w-4 h-4" /> {v.xuLy === 'nhan' ? 'Huỷ nhận' : 'Mở lại'}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export default function RaSoatScreen({ project, onUpdate, onGo }: Props) {
  const { busy, error, notes, run } = useRunner();
  const [genres, setGenres] = useState<GenreInfo[] | null>(null);
  useEffect(() => {
    getGenres().then(setGenres).catch(() => setGenres([]));
  }, []);
  const latestRef = useRef(project);
  latestRef.current = project;
  const [tienDo, setTienDo] = useState('');

  if (missingDeps(project, 'raSoat').length) return <LockedScreen project={project} sectionKey="raSoat" onGo={onGo} />;
  const blocked = blockedDeps(project, 'raSoat').length > 0;

  const brief = project.sections.brief!.data;
  const nhanVat = project.sections.nhanVat!.data.list;
  const treatment = project.sections.treatment!.data;
  const kb = project.sections.kichBan!.data;
  const beatGiay = genres?.find((g) => g.id === brief.theLoai)?.beatGiay ?? null;
  const section = project.sections.raSoat;
  const data = section?.data;
  const check = data
    ? checkRaSoat(
        { ...data, vanDe: data.vanDe.filter((v) => v.xuLy !== 'bo' && v.xuLy !== 'da-sua') },
        { canhIds: kb.danY.canh.map((c) => c.id), beatIds: Object.values(kb.canh).flatMap((v) => v.beats.map((b) => b.id)), soTieuChi: data.diem.length }
      )
    : { errors: [], warnings: [] };
  // Cổng duyệt theo thiết kế: chỉ vấn đề mức "cao" chưa xử lý và bản sửa chờ nhận. Lỗi khác của kết quả AI chỉ báo.
  const blocking = data ? raSoatBlocking(data) : [];
  const sceneLabel = (id: string) => {
    const i = viTriCanh(kb.danY, id);
    return i >= 0 ? `Cảnh ${i + 1}` : id;
  };

  const setSection = (fn: (latest: Project) => Section<RaSoatData> | undefined) => onUpdate((latest) => ({ sections: { ...latest.sections, raSoat: fn(latest) } }));
  const edit = (fn: (r: RaSoatData) => RaSoatData) =>
    setSection((latest) => {
      const s = latest.sections.raSoat;
      return s ? editSection(s, fn(s.data), Date.now()) : s;
    });

  const setVanDe = (id: string, patch: Partial<VanDe>) =>
    edit((r) => {
      const v = r.vanDe.find((x) => x.id === id);
      // Bỏ qua → ghi lại (không trùng); mở lại → xoá khỏi danh sách đã bỏ qua
      const rest = v ? r.daBoQua.filter((x) => x.moTa !== v.moTa) : r.daBoQua;
      const daBoQua = !v ? r.daBoQua : patch.xuLy === 'bo' ? [...rest, { moTa: v.moTa, lyDo: patch.lyDo || '', at: Date.now() }] : v.xuLy === 'bo' ? rest : r.daBoQua;
      return { ...r, daBoQua, vanDe: r.vanDe.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
    });

  /* ---------- AI: rà soát ---------- */

  const review = async () => {
    const pending = data?.vanDe.filter((v) => v.xuLy === 'nhan').length || 0;
    if (data && (pending || data.banSua.length) && !(await askConfirm('Rà lại sẽ thay danh sách vấn đề hiện tại. Các đề xuất đã nhận mà chưa sửa và các bản sửa chưa nhận sẽ mất. Tiếp tục?', { okLabel: 'Rà lại' }))) return;
    const readRevs = depRevs(project, 'raSoat');
    const startedAt = section?.meta.updatedAt;
    const daBoQua = data?.daBoQua || [];
    run('ra-soat', async () => {
      const r = await runTask<RaSoatData>(
        'ra-soat',
        { brief, nhanVat, treatment, kichBan: { danY: kb.danY, canh: kb.canh }, daBoQua: daBoQua.map((x) => `${x.moTa}${x.lyDo ? ` (lý do bỏ qua: ${x.lyDo})` : ''}`) },
        project.id
      );
      if (latestRef.current.sections.raSoat?.meta.updatedAt !== startedAt && !(await askConfirm('Bạn đã nhận / bỏ vấn đề trong lúc AI đang rà. Thay bằng kết quả rà mới?', { okLabel: 'Thay bằng kết quả mới', cancelLabel: 'Giữ bản đang có' }))) return;
      setSection((latest) => freshSection(latest, 'raSoat', { ...r.output, daBoQua: latest.sections.raSoat?.data.daBoQua || daBoQua }, Date.now(), readRevs));
      return r;
    });
  };

  /* ---------- AI: sửa các cảnh theo đề xuất đã nhận ---------- */

  /** Vấn đề đã nhận còn cần sửa ở cảnh này (chưa có bản sửa được nhận cho cảnh đó). */
  const canSuaO = (v: VanDe, id: string) => v.xuLy === 'nhan' && !v.canSuaDanY && v.canh.includes(id) && !(v.daSuaCanh || []).includes(id);
  const scenesToFix = kb.danY.canh.map((c) => c.id).filter((id) => (data?.vanDe || []).some((v) => canSuaO(v, id)) && !data?.banSua.some((b) => b.canhId === id));

  const fixAll = () =>
    run('sua', async () => {
      try {
        for (let n = 0; n < scenesToFix.length; n++) {
          const id = scenesToFix[n];
          const p = latestRef.current;
          const k = p.sections.kichBan!.data;
          const list = (p.sections.raSoat?.data.vanDe || []).filter((v) => canSuaO(v, id));
          if (!list.length) continue;
          setTienDo(`Đang viết lại ${sceneLabel(id).toLowerCase()} (${n + 1}/${scenesToFix.length})…`);
          const goc = beatsOf(k, id);
          const dauVao = dauVaoCanh(k, id); // đầu vào AI đọc — cảnh trước đổi sau đó thì cảnh này vẫn hiện "cần xem lại"
          const r = await runTask<Beat[]>('viet-canh', vietCanhInput(p, k, id, { truoc: goc, yeuCau: yeuCauSua(list) }), p.id);
          const ban: BanSua = { canhId: id, vanDe: list.map((v) => v.id), beats: r.output, goc: hash(JSON.stringify(goc)), dauVao, errors: r.errors, warnings: r.warnings };
          edit((x) => ({ ...x, banSua: [...x.banSua.filter((b) => b.canhId !== id), ban] }));
        }
      } finally {
        setTienDo('');
      }
    });

  /** Nhận bản sửa: ghi vào màn ④, tự duyệt lại ④ nếu không còn lỗi; đánh dấu các vấn đề đã sửa. */
  const acceptFix = async (ban: BanSua) => {
    const p = latestRef.current;
    const ks = p.sections.kichBan!;
    if (hash(JSON.stringify(beatsOf(ks.data, ban.canhId))) !== ban.goc && !(await askConfirm(`${sceneLabel(ban.canhId)} đã được sửa ở màn 4 sau khi gửi AI. Vẫn thay bằng bản sửa này?`, { okLabel: 'Thay bằng bản sửa' }))) return;
    const now = Date.now();
    const dv = ban.dauVao || undefined;
    const newKb: KichBanData = ghiCanh(ks.data, ban.canhId, ban.beats, now, dv);
    const ok = checkKichBan(newKb, kichBanCtx(p, beatGiay)).errors.length === 0 && !blockedDeps(p, 'kichBan').length && !isStale(p, 'kichBan');
    onUpdate((latest) => {
      const s = latest.sections.kichBan!;
      const merged = ghiCanh(s.data, ban.canhId, ban.beats, now, dv);
      const edited = editSection(s, merged, now);
      const r = latest.sections.raSoat!;
      return {
        sections: {
          ...latest.sections,
          kichBan: ok ? approveSection(latest, 'kichBan', edited, now) : edited,
          raSoat: editSection(
            r,
            {
              ...r.data,
              banSua: r.data.banSua.filter((b) => b.canhId !== ban.canhId),
              // Vấn đề "đã sửa" khi mọi cảnh của nó đều đã nhận bản sửa
              vanDe: r.data.vanDe.map((v) => {
                if (!ban.vanDe.includes(v.id)) return v;
                const daSuaCanh = Array.from(new Set([...(v.daSuaCanh || []), ban.canhId]));
                return { ...v, daSuaCanh, xuLy: v.canh.every((c) => daSuaCanh.includes(c)) ? 'da-sua' : v.xuLy };
              }),
            },
            now
          ),
        },
      };
    });
    if (!ok) await notify(`Đã ghi bản sửa vào màn 4, nhưng màn 4 chưa tự duyệt lại được: còn lỗi, hoặc có cảnh cần xem lại (cuối ${sceneLabel(ban.canhId).toLowerCase()} đổi thì cảnh sau phải xem lại). Sang màn 4 xử lý rồi duyệt lại.`, 'Cần xem lại màn 4');
  };

  const dropFix = (ban: BanSua) => edit((r) => ({ ...r, banSua: r.banSua.filter((b) => b.canhId !== ban.canhId) }));

  const approve = () => setSection((latest) => (latest.sections.raSoat ? approveSection(latest, 'raSoat', latest.sections.raSoat, Date.now()) : undefined));
  const keep = () => setSection((latest) => (latest.sections.raSoat ? keepSection(latest, 'raSoat', latest.sections.raSoat, Date.now()) : undefined));

  const tong = data ? tongDiem(data) : 0;
  const toiDa = data ? diemToiDa(data) : 0;
  const dat = data ? tong >= data.nguong : false;
  const order = (v: VanDe) => ({ cao: 0, vua: 1, thap: 2 }[v.muc] ?? 1);

  return (
    <div className="space-y-6">
      <ScreenIntro no={5} title="Rà soát">
        AI đọc cả kịch bản, chấm theo thang của thể loại và nêu vấn đề. Bạn nhận hoặc bỏ từng đề xuất; đề xuất được nhận thì AI viết lại đúng cảnh đó, bạn xem rồi nhận bản sửa. Kịch bản sau màn này là bản chốt cho các màn sau.
      </ScreenIntro>

      <UpstreamBanner project={project} sectionKey="raSoat" onGo={onGo} />

      {!data && (
        <RunButton onClick={review} busy={busy === 'ra-soat'} busyLabel="AI đang đọc kịch bản…" icon={SearchCheck} disabled={!!busy || blocked}>
          Rà soát kịch bản
        </RunButton>
      )}

      <ErrorBox message={error} />
      <Issues errors={notes.errors} warnings={[]} title={notes.errors.length ? 'AI đã được gửi lại 2 lần nhưng kết quả vẫn còn lỗi — bạn rà lại, hoặc bỏ qua vấn đề lỗi:' : undefined} />

      {data && (
        <>
          <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-black">Điểm</h3>
              <p className={`text-lg font-bold ${dat ? 'text-green-700' : 'text-amber-800'}`}>
                {tong}/{toiDa} · {dat ? 'Đạt' : `Chưa đạt (cần ${data.nguong})`}
              </p>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {data.diem.map((d, i) => (
                  <tr key={i} className="border-t border-gray-100 align-top">
                    <td className="py-2 pr-3 font-bold text-black">{d.ten}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {Number.isFinite(d.diem) ? d.diem : '—'}/{d.toiDa}
                    </td>
                    <td className="py-2 text-gray-700">{d.nhanXet}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.nhanXet && <p className="text-sm text-gray-700">{data.nhanXet}</p>}
            {!dat && <p className="text-xs text-gray-500">Điểm dưới mức đạt chỉ để bạn cân nhắc, không chặn duyệt.</p>}
          </section>

          <section className="space-y-3">
            <h3 className="font-bold text-black">Vấn đề ({data.vanDe.length})</h3>
            {data.vanDe.length === 0 && <p className="text-sm text-gray-600">AI không thấy vấn đề nào cần sửa.</p>}
            {[...data.vanDe]
              .sort((a, b) => order(a) - order(b))
              .map((v) => (
                <IssueCard key={v.id} v={v} no={data.vanDe.indexOf(v) + 1} sceneLabel={sceneLabel} onSet={(patch) => setVanDe(v.id, patch)} onGoDanY={() => onGo('kichBan')} disabled={!!busy} />
              ))}
          </section>

          {scenesToFix.length > 0 && (
            <RunButton onClick={fixAll} busy={busy === 'sua'} busyLabel={tienDo || 'AI đang viết lại…'} icon={Wand2} disabled={!!busy || blocked}>
              Sửa các đề xuất đã nhận ({scenesToFix.length} cảnh)
            </RunButton>
          )}

          {data.banSua.map((ban) => {
            const i = viTriCanh(kb.danY, ban.canhId);
            const c = kb.danY.canh[i];
            if (!c) return null;
            const cc = canhCtx(kb.danY, c.id, { ...kichBanCtx(project, beatGiay), daoCuTruoc: daoCuTruoc(kb, c.id) });
            const ck = cc ? checkCanh(ban.beats, cc) : { errors: ban.errors, warnings: ban.warnings };
            return (
              <section key={ban.canhId} className="bg-white border-2 border-primary-400 rounded-2xl p-4 space-y-3" aria-label={`Bản sửa ${sceneLabel(ban.canhId)}`}>
                <h3 className="font-bold text-black">Bản sửa — {tieuDeCanh(i + 1, c)}</h3>
                <p className="text-sm text-gray-600">Theo vấn đề {ban.vanDe.map((id) => data.vanDe.findIndex((v) => v.id === id) + 1).join(', ')}.</p>
                <div className="grid lg:grid-cols-2 gap-4">
                  {[
                    { title: 'Bản hiện tại', beats: beatsOf(kb, ban.canhId) },
                    { title: 'Bản sửa', beats: ban.beats },
                  ].map((col) => (
                    <div key={col.title} className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{col.title}</p>
                      {col.beats.map((b) => (
                        <div key={b.id} className="border-l-2 border-primary-400 pl-3">
                          <BeatView b={b} chars={nhanVat} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <Issues errors={ck.errors} warnings={ck.warnings} />
                <div className="flex flex-wrap gap-2">
                  <RunButton onClick={() => acceptFix(ban)} busy={false} busyLabel="" icon={Check} disabled={!!busy}>
                    Nhận bản sửa
                  </RunButton>
                  <button onClick={() => dropFix(ban)} disabled={!!busy} className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-red-50 font-bold flex items-center gap-2 disabled:opacity-50">
                    <X className="w-4 h-4" /> Bỏ bản sửa
                  </button>
                </div>
              </section>
            );
          })}

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={review} busy={busy === 'ra-soat'} busyLabel="AI đang rà lại…" icon={RefreshCw} variant="ghost" disabled={!!busy || blocked}>
              Rà lại
            </RunButton>
          </div>

          {data.daBoQua.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-bold text-black">Đã bỏ qua ({data.daBoQua.length}) — AI sẽ không nêu lại</summary>
              <ul className="mt-2 list-disc pl-5 text-gray-700 space-y-0.5">
                {data.daBoQua.map((x, i) => (
                  <li key={i}>
                    {x.moTa}
                    {x.lyDo && <span className="text-gray-500"> — lý do: {x.lyDo}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <Issues errors={blocking} warnings={[...check.errors, ...check.warnings]} />
          <StatusBar project={project} sectionKey="raSoat" blocking={blocking} onApprove={approve} onKeep={keep} onRegenerate={review} busy={!!busy} />

          {section?.meta.status === 'duyet' && !blocked && (
            <div className="flex justify-end">
              <button onClick={() => onGo('bible')} className="py-3 px-6 rounded-xl bg-black hover:bg-gray-800 text-primary-400 font-bold flex items-center gap-2">
                Sang màn 6: Bible & tham chiếu <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
