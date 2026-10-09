// Màn ⑦ — Phân cảnh: mỗi beat chia thành shot (một beat vẫn là một lần tạo video). AI làm từng cảnh; sửa tay từng shot.
import React, { useEffect, useRef, useState } from 'react';
import { Clapperboard, Square, ArrowRight } from 'lucide-react';
import type { Project, ProjectPatch, SectionKey, Section, PhanCanhData, PhanCanhBeat, Shot } from '../../types';
import { freshSection, editSection, approveSection, keepSection, missingDeps, blockedDeps, depRevs } from '../../../shared/project';
import { beatsOf } from '../../../shared/kichBan';
import { emptyPhanCanh, dauVaoPhanCanh, tinhTrangPhanCanh, ganMaShot, blankShot } from '../../../shared/phanCanh';
import { checkPhanCanh } from '../../../shared/checks';
import { runTask, TaskResult } from '../../services/api';
import { askConfirm } from '../../lib/dialog';
import { ErrorBox, RunButton } from '../ui';
import { ScreenIntro, StatusBar, Issues, useRunner, LockedScreen, UpstreamBanner } from './common';
import CanhShots from './phanCanh/CanhShots';

interface Props {
  project: Project;
  onUpdate: (patch: ProjectPatch) => void;
  onGo: (k: SectionKey) => void;
}

const tick = () => new Promise((r) => setTimeout(r, 30));

export default function PhanCanhScreen({ project, onUpdate, onGo }: Props) {
  const { busy, error, notes, run } = useRunner();
  const latestRef = useRef(project);
  latestRef.current = project;
  const [dangLam, setDangLam] = useState<{ id: string; kind: 'lam' | 'sua' } | null>(null);
  const [tienDo, setTienDo] = useState('');
  const stopRef = useRef(false);
  // Rời màn khi "Phân cảnh tất cả" đang chạy → dừng sau cảnh đang làm
  useEffect(
    () => () => {
      stopRef.current = true;
    },
    []
  );

  if (missingDeps(project, 'phanCanh').length) return <LockedScreen project={project} sectionKey="phanCanh" onGo={onGo} />;
  const blocked = blockedDeps(project, 'phanCanh').length > 0;

  const nhanVat = project.sections.nhanVat!.data.list;
  const kb = project.sections.kichBan!.data;
  const scenes = kb.danY.canh;
  const section = project.sections.phanCanh;
  const pc = section?.data || emptyPhanCanh();
  const full = checkPhanCanh(pc, kb);

  /* ---------- Ghi dữ liệu ---------- */

  const setSection = (fn: (latest: Project) => Section<PhanCanhData> | undefined) => onUpdate((latest) => ({ sections: { ...latest.sections, phanCanh: fn(latest) } }));
  /** Sửa (hoặc tạo lần đầu) phần phân cảnh. */
  const edit = (fn: (x: PhanCanhData) => PhanCanhData) =>
    setSection((latest) => {
      const s = latest.sections.phanCanh;
      return s ? editSection(s, fn(s.data), Date.now()) : freshSection(latest, 'phanCanh', fn(emptyPhanCanh()), Date.now());
    });

  /** Sửa tay shot của một beat: shot mới / tách nhận mã mới, không đánh lại số shot cũ. */
  const onShots = (canhId: string, beatId: string, fn: (s: Shot[]) => Shot[]) =>
    edit((x) => {
      const c = x.canh[canhId] || { beats: {}, dauVao: dauVaoPhanCanh(latestRef.current.sections.kichBan!.data, canhId), updatedAt: 0 };
      const old = c.beats[beatId] || { shots: [], soShot: 1 };
      const g = ganMaShot(beatId, fn(old.shots), old.soShot);
      return { canh: { ...x.canh, [canhId]: { ...c, beats: { ...c.beats, [beatId]: g }, updatedAt: Date.now() } } };
    });

  /** Tự làm: mỗi beat một shot dài cả beat, thoại cả beat. */
  const tuLam = (canhId: string) =>
    edit((x) => {
      const k = latestRef.current.sections.kichBan!.data;
      const beats: Record<string, PhanCanhBeat> = {};
      beatsOf(k, canhId).forEach((b) => (beats[b.id] = ganMaShot(b.id, [{ ...blankShot(b.giay, b.coMat), thoai: b.thoai.map((_, n) => n) }], 1)));
      return { canh: { ...x.canh, [canhId]: { beats, dauVao: dauVaoPhanCanh(k, canhId), updatedAt: Date.now() } } };
    });

  const vanDung = (canhId: string) => edit((x) => (x.canh[canhId] ? { canh: { ...x.canh, [canhId]: { ...x.canh[canhId], dauVao: dauVaoPhanCanh(latestRef.current.sections.kichBan!.data, canhId) } } } : x));

  /* ---------- AI ---------- */

  /** Phân cảnh (hoặc sửa theo yêu cầu) một cảnh. Trả null nếu bạn chọn giữ bản đang sửa. */
  const lamCanh = async (canhId: string, yeuCau?: string): Promise<TaskResult<Record<string, PhanCanhBeat>> | null> => {
    const p = latestRef.current;
    const k = p.sections.kichBan!.data;
    const no = k.danY.canh.findIndex((c) => c.id === canhId) + 1;
    const cur = p.sections.phanCanh?.data.canh[canhId];
    const startedAt = cur?.updatedAt;
    const dauVao = dauVaoPhanCanh(k, canhId); // beat mà AI đọc — đổi trong lúc chạy thì cảnh hiện "cần xem lại"
    const readRevs = depRevs(p, 'phanCanh');
    const r = await runTask<Record<string, PhanCanhBeat>>(
      'phan-canh',
      { brief: p.sections.brief!.data, nhanVat: p.sections.nhanVat!.data.list, kichBan: { danY: k.danY, canh: k.canh }, canhId, sua: yeuCau ? { truoc: cur?.beats || {}, yeuCau } : undefined },
      p.id
    );
    if (latestRef.current.sections.phanCanh?.data.canh[canhId]?.updatedAt !== startedAt && !(await askConfirm(`Bạn đã sửa cảnh ${no} trong lúc AI đang chạy. Thay bằng kết quả mới của AI?`, { okLabel: 'Thay bằng kết quả mới', cancelLabel: 'Giữ bản đang sửa' }))) return null;
    setSection((latest) => {
      const now = Date.now();
      const s = latest.sections.phanCanh;
      const moi = { beats: r.output, dauVao, updatedAt: now };
      // Lần đầu: tạo phần mới với phiên bản màn trên lúc bấm nút; sau đó: ghi một cảnh vào phần đã có
      return s ? editSection(s, { canh: { ...s.data.canh, [canhId]: moi } }, now) : freshSection(latest, 'phanCanh', { canh: { [canhId]: moi } }, now, readRevs);
    });
    return r;
  };

  const lamMot = async (canhId: string, yeuCau?: string) => {
    if (!yeuCau && tinhTrangPhanCanh(pc, kb, canhId) !== 'chua-lam' && !(await askConfirm('Phân cảnh lại cả cảnh này? Những chỗ bạn đã sửa ở cảnh này sẽ mất.', { okLabel: 'Phân cảnh lại' }))) return;
    setDangLam({ id: canhId, kind: yeuCau ? 'sua' : 'lam' });
    await run('canh', async () => {
      try {
        await lamCanh(canhId, yeuCau);
      } finally {
        setDangLam(null);
      }
    });
  };

  /** Phân cảnh lần lượt mọi cảnh chưa làm; dừng khi một cảnh còn lỗi sau 3 lần thử hoặc khi bạn bấm dừng. */
  const lamTatCa = () => {
    stopRef.current = false;
    const tried = new Set<string>();
    run('tat-ca', async () => {
      try {
        for (;;) {
          if (stopRef.current) break;
          const p = latestRef.current;
          const k = p.sections.kichBan!.data;
          const cur = p.sections.phanCanh?.data || emptyPhanCanh();
          const i = k.danY.canh.findIndex((c) => tinhTrangPhanCanh(cur, k, c.id) === 'chua-lam');
          if (i < 0) break;
          const c = k.danY.canh[i];
          if (tried.has(c.id)) break;
          tried.add(c.id);
          setTienDo(`Đang phân cảnh ${i + 1}/${k.danY.canh.length}…`);
          setDangLam({ id: c.id, kind: 'lam' });
          const r = await lamCanh(c.id);
          await tick(); // chờ giao diện nhận bản mới trước khi làm cảnh sau
          if (!r) break;
          if (r.errors.length) throw new Error(`Cảnh ${i + 1} còn lỗi sau 3 lần thử, nên dừng lại để bạn xem. Sửa tay hoặc phân cảnh lại cảnh đó, rồi bấm "Phân cảnh tất cả" để chạy tiếp.`);
        }
      } finally {
        setTienDo('');
        setDangLam(null);
      }
    });
  };

  const approve = () => setSection((latest) => (latest.sections.phanCanh ? approveSection(latest, 'phanCanh', latest.sections.phanCanh, Date.now()) : undefined));
  const keep = () => setSection((latest) => (latest.sections.phanCanh ? keepSection(latest, 'phanCanh', latest.sections.phanCanh, Date.now()) : undefined));

  /* ---------- Hiển thị ---------- */

  const daLam = scenes.filter((c) => tinhTrangPhanCanh(pc, kb, c.id) !== 'chua-lam').length;
  const soShot = Object.values(pc.canh).reduce((n, c) => n + Object.values(c.beats).reduce((m, b) => m + b.shots.length, 0), 0);
  const aiOff = !!busy || blocked;

  return (
    <div className="space-y-6">
      <ScreenIntro no={7} title="Phân cảnh">
        Mỗi beat chia thành các shot: số giây, cỡ cảnh, góc máy, chuyển động và ô Mô tả tiếng Việt (nguồn duy nhất cho câu hành động ở màn 8). Một beat vẫn là một lần tạo video; các shot nối nhau bằng cú cắt.
      </ScreenIntro>

      <UpstreamBanner project={project} sectionKey="phanCanh" onGo={onGo} />
      <ErrorBox message={error} />
      <Issues errors={notes.errors} warnings={[]} title={notes.errors.length ? 'AI đã được gửi lại 2 lần nhưng kết quả vẫn còn lỗi — bạn sửa tay hoặc làm lại:' : undefined} />

      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-black flex items-center gap-2">
            <Clapperboard className="w-4 h-4" /> Đã phân cảnh {daLam}/{scenes.length} cảnh
          </p>
          <p className="text-sm text-gray-600">{soShot} shot</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {busy === 'tat-ca' && (
            <button onClick={() => (stopRef.current = true)} className="py-3 px-5 rounded-xl bg-gray-100 hover:bg-red-50 font-bold flex items-center gap-2">
              <Square className="w-4 h-4" /> Dừng sau cảnh này
            </button>
          )}
          <RunButton onClick={lamTatCa} busy={busy === 'tat-ca'} busyLabel={tienDo ? `${tienDo} Đừng rời màn này.` : 'AI đang phân cảnh…'} icon={Clapperboard} disabled={aiOff || daLam === scenes.length}>
            Phân cảnh tất cả cảnh chưa làm
          </RunButton>
        </div>
      </div>

      {scenes.map((c, i) => (
        <CanhShots
          key={c.id}
          no={i + 1}
          canh={c}
          beats={beatsOf(kb, c.id)}
          pc={pc.canh[c.id]}
          tinhTrang={tinhTrangPhanCanh(pc, kb, c.id)}
          chars={nhanVat}
          check={full.theoCanh[c.id]}
          running={dangLam?.id === c.id ? dangLam.kind : ''}
          disabled={aiOff}
          onRun={() => lamMot(c.id)}
          onRevise={(t) => lamMot(c.id, t)}
          onKeep={() => vanDung(c.id)}
          onManual={() => tuLam(c.id)}
          onShots={(beatId, fn) => onShots(c.id, beatId, fn)}
        />
      ))}

      {section && (
        <>
          {section.meta.status !== 'duyet' && full.errors.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-bold text-black">Điều kiện duyệt màn 7: còn {full.errors.length} việc</summary>
              <ul className="mt-2 list-disc pl-5 text-red-800 space-y-0.5">
                {full.errors.slice(0, 30).map((e, k) => (
                  <li key={k}>{e}</li>
                ))}
                {full.errors.length > 30 && <li>… và {full.errors.length - 30} việc khác.</li>}
              </ul>
            </details>
          )}
          <StatusBar project={project} sectionKey="phanCanh" blocking={full.errors} onApprove={approve} onKeep={keep} onRegenerate={lamTatCa} busy={!!busy} />
          {section.meta.status === 'duyet' && !blocked && (
            <div className="flex justify-end">
              <button onClick={() => onGo('prompt')} className="py-3 px-6 rounded-xl bg-black hover:bg-gray-800 text-primary-400 font-bold flex items-center gap-2">
                Sang màn 8: Prompt <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
