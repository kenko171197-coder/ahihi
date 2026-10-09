// Màn ⑧ — Prompt: mỗi beat một prompt video (một lần tạo trên Omni Flash). Code ghép phần cố định từ ⑥ ⑦; AI dịch từng cảnh.
// Frame nối: dán frame cuối video của beat → beat sau cùng cảnh tự nạp. Xuất prompt và kịch bản ra .txt.
import React, { useEffect, useRef, useState } from 'react';
import { Languages, Square, FileText, FileDown } from 'lucide-react';
import type { Project, ProjectPatch, SectionKey, Section, PromptData, PromptBeat } from '../../types';
import { freshSection, editSection, missingDeps, blockedDeps, depRevs, isStale, toTag, SCREENS } from '../../../shared/project';
import { emptyPrompt, docPrompt, dauPrompt, nguonCanh, dauVaoPrompt, tinhTrangPrompt, khopDich, ghepCanh, ghepBeat, GhepCtx, PromptKetQua } from '../../../shared/prompt';
import { beatsOf } from '../../../shared/kichBan';
import { xuatPromptTxt, xuatKichBanTxt } from '../../../shared/xuat';
import { runTask, TaskResult } from '../../services/api';
import { askConfirm, notify } from '../../lib/dialog';
import { putImage, deleteImage, readAndResize } from '../../lib/images';
import { ErrorBox, RunButton } from '../ui';
import { ScreenIntro, Issues, useRunner, LockedScreen, UpstreamBanner } from './common';
import CanhPrompt from './prompt/CanhPrompt';

interface Props {
  project: Project;
  onUpdate: (patch: ProjectPatch) => void;
  onGo: (k: SectionKey) => void;
}

const tick = () => new Promise((r) => setTimeout(r, 30));

function taiFile(text: string, name: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function PromptScreen({ project, onUpdate, onGo }: Props) {
  const { busy, error, setError, notes, run } = useRunner();
  const latestRef = useRef(project);
  latestRef.current = project;
  const [dangLam, setDangLam] = useState<{ id: string; kind: 'lam' | 'sua' } | null>(null);
  const [tienDo, setTienDo] = useState('');
  const stopRef = useRef(false);
  useEffect(
    () => () => {
      stopRef.current = true;
    },
    []
  );

  const locked = missingDeps(project, 'prompt').length > 0;
  const blocked = blockedDeps(project, 'prompt').length > 0;
  const stale = !!project.sections.prompt && isStale(project, 'prompt');

  // Màn ⑧ không có nút duyệt: khi ⑥ ⑦ đã chốt lại, ghi nhận phiên bản mới. Thay đổi cần dịch lại đã có cờ theo cảnh;
  // phần cố định (style, ánh sáng, máy, ảnh) tự ghép lại theo bản mới.
  useEffect(() => {
    if (locked || blocked || !stale) return;
    onUpdate((latest) => {
      const s = latest.sections.prompt;
      if (!s || blockedDeps(latest, 'prompt').length) return {};
      return { sections: { ...latest.sections, prompt: { ...s, meta: { ...s.meta, basedOn: depRevs(latest, 'prompt') } } } };
    });
  }, [locked, blocked, stale]);

  if (locked) return <LockedScreen project={project} sectionKey="prompt" onGo={onGo} />;

  const brief = project.sections.brief!.data;
  const nhanVat = project.sections.nhanVat!.data.list;
  const kb = project.sections.kichBan!.data;
  const pc = project.sections.phanCanh!.data;
  const bible = project.sections.bible!.data;
  const section = project.sections.prompt;
  const pd = docPrompt(section?.data);
  const scenes = kb.danY.canh;
  const ctx: GhepCtx = { brief, nhanVat, kb, pc, bible, prompt: pd };
  const ketQua: Record<string, PromptKetQua[]> = {};
  scenes.forEach((c) => (ketQua[c.id] = ghepCanh(ctx, c.id)));
  const tt = (id: string) => tinhTrangPrompt(pd, kb, pc, id, brief.nhacNen);

  /* ---------- Ghi dữ liệu ---------- */

  const setSection = (fn: (latest: Project) => Section<PromptData> | undefined) => onUpdate((latest) => ({ sections: { ...latest.sections, prompt: fn(latest) } }));
  const edit = (fn: (x: PromptData, latest: Project) => PromptData) =>
    setSection((latest) => {
      const s = latest.sections.prompt;
      return s ? editSection(s, fn(docPrompt(s.data), latest), Date.now()) : freshSection(latest, 'prompt', fn(emptyPrompt(), latest), Date.now());
    });
  /** Prompt hiện tại của một beat (theo dữ liệu mới nhất). */
  const textCua = (p: Project, beatId: string) => {
    const k = p.sections.kichBan!.data;
    const c = k.danY.canh.find((x) => beatsOf(k, x.id).some((b) => b.id === beatId));
    if (!c) return '';
    const g: GhepCtx = { brief: p.sections.brief!.data, nhanVat: p.sections.nhanVat!.data.list, kb: k, pc: p.sections.phanCanh!.data, bible: p.sections.bible!.data, prompt: docPrompt(p.sections.prompt?.data) };
    return ghepBeat(g, c.id, beatId).text;
  };
  const nguonOf = (p: Project, id: string) => nguonCanh(p.sections.kichBan!.data, p.sections.phanCanh!.data.canh[id], id);

  /** Ghi phần dịch của một beat (sửa tay) — giữ dấu đầu vào của cảnh. */
  const onDich = (canhId: string, beatId: string, d: PromptBeat) =>
    edit((x, p) => {
      const c = x.canh[canhId] || { beats: khopDich(nguonOf(p, canhId)), dauVao: dauVaoPrompt(nguonOf(p, canhId), p.sections.brief!.data.nhacNen), updatedAt: 0 };
      return { ...x, canh: { ...x.canh, [canhId]: { ...c, beats: { ...c.beats, [beatId]: d }, updatedAt: Date.now() } } };
    });

  /** "Tự viết" / "Vẫn đúng": khớp phần dịch với nguồn hiện tại (giữ câu cũ, thêm ô trống), ghi dấu đầu vào mới. */
  const khop = (canhId: string) =>
    edit((x, p) => {
      const nguon = nguonOf(p, canhId);
      return { ...x, canh: { ...x.canh, [canhId]: { beats: khopDich(nguon, x.canh[canhId]?.beats), dauVao: dauVaoPrompt(nguon, p.sections.brief!.data.nhacNen), updatedAt: Date.now() } } };
    });

  /** Dán / gỡ frame cuối của beat. Ảnh cũ (và frame của beat không còn trong kịch bản) được xoá khỏi kho ảnh. */
  const onFrame = async (beatId: string, f: File | null) => {
    try {
      const id = f ? await putImage(await readAndResize(f, 1536)) : '';
      edit((x, p) => {
        const bo = new Set<string>();
        const con = new Set(p.sections.kichBan!.data.danY.canh.flatMap((c) => beatsOf(p.sections.kichBan!.data, c.id).map((b) => b.id)));
        const frame: Record<string, string> = {};
        const frameTheo: Record<string, string> = {};
        Object.entries(x.frame).forEach(([b, img]) => {
          if (b === beatId || !con.has(b)) bo.add(img);
          else {
            frame[b] = img;
            if (x.frameTheo[b]) frameTheo[b] = x.frameTheo[b];
          }
        });
        if (id) {
          frame[beatId] = id;
          frameTheo[beatId] = dauPrompt(textCua(p, beatId));
        }
        // Ảnh vừa bị bỏ khỏi dự án (frame cũ của beat, frame của beat đã xoá): xoá khỏi kho. Xoá lặp lại cũng không sao.
        bo.forEach((img) => img !== id && queueMicrotask(() => deleteImage(img).catch(() => undefined)));
        return { ...x, frame, frameTheo };
      });
    } catch (e: any) {
      setError(e?.message || 'Không lưu được ảnh.');
    }
  };

  /** Đánh dấu đã tạo video: lưu dấu prompt lúc đó để biết prompt có đổi sau này không. */
  const onDaTao = (beatId: string, v: boolean) =>
    edit((x, p) => {
      const daTao = { ...x.daTao };
      if (v) daTao[beatId] = dauPrompt(textCua(p, beatId));
      else delete daTao[beatId];
      return { ...x, daTao };
    });

  /* ---------- AI ---------- */

  const lamCanh = async (canhId: string, yeuCau?: string): Promise<TaskResult<Record<string, PromptBeat>> | null> => {
    const p = latestRef.current;
    const k = p.sections.kichBan!.data;
    const no = k.danY.canh.findIndex((c) => c.id === canhId) + 1;
    const cur = p.sections.prompt?.data.canh[canhId];
    const startedAt = cur?.updatedAt;
    const nguon = nguonOf(p, canhId);
    const dauVao = dauVaoPrompt(nguon, p.sections.brief!.data.nhacNen); // chữ mà AI đọc — đổi trong lúc chạy thì cảnh hiện "cần dịch lại"
    const readRevs = depRevs(p, 'prompt');
    const r = await runTask<Record<string, PromptBeat>>(
      'prompt-canh',
      {
        brief: p.sections.brief!.data,
        nhanVat: p.sections.nhanVat!.data.list,
        kichBan: { danY: k.danY, canh: k.canh },
        phanCanh: p.sections.phanCanh!.data.canh[canhId],
        canhId,
        sua: yeuCau ? { truoc: cur?.beats || {}, yeuCau } : undefined,
      },
      p.id
    );
    if (latestRef.current.sections.prompt?.data.canh[canhId]?.updatedAt !== startedAt && !(await askConfirm(`Bạn đã sửa phần dịch cảnh ${no} trong lúc AI đang chạy. Thay bằng kết quả mới của AI?`, { okLabel: 'Thay bằng kết quả mới', cancelLabel: 'Giữ bản đang sửa' }))) return null;
    setSection((latest) => {
      const now = Date.now();
      const s = latest.sections.prompt;
      const moi = { beats: r.output, dauVao, updatedAt: now };
      return s ? editSection(s, { ...s.data, canh: { ...s.data.canh, [canhId]: moi } }, now) : freshSection(latest, 'prompt', { ...emptyPrompt(), canh: { [canhId]: moi } }, now, readRevs);
    });
    return r;
  };

  const lamMot = async (canhId: string, yeuCau?: string) => {
    if (!yeuCau && tt(canhId) !== 'chua-dich' && !(await askConfirm('Dịch lại cả cảnh này? Những chỗ bạn đã sửa tay ở phần dịch của cảnh này sẽ mất.', { okLabel: 'Dịch lại' }))) return;
    setDangLam({ id: canhId, kind: yeuCau ? 'sua' : 'lam' });
    await run('canh', async () => {
      try {
        return (await lamCanh(canhId, yeuCau)) || undefined;
      } finally {
        setDangLam(null);
      }
    });
  };

  /** Dịch lần lượt các cảnh ở tình trạng cần làm; dừng khi một cảnh còn lỗi hoặc khi bạn bấm dừng. */
  const lamTatCa = (can: 'chua-dich' | 'can-dich-lai') => {
    stopRef.current = false;
    const tried = new Set<string>();
    run(can === 'chua-dich' ? 'tat-ca' : 'dich-lai', async () => {
      try {
        for (;;) {
          if (stopRef.current) break;
          const p = latestRef.current;
          const k = p.sections.kichBan!.data;
          const cur = p.sections.prompt?.data || emptyPrompt();
          const i = k.danY.canh.findIndex((c) => !tried.has(c.id) && tinhTrangPrompt(cur, k, p.sections.phanCanh!.data, c.id, p.sections.brief!.data.nhacNen) === can && nguonOf(p, c.id).every((n) => n.shots.length));
          if (i < 0) break;
          const c = k.danY.canh[i];
          tried.add(c.id);
          setTienDo(`Đang dịch cảnh ${i + 1}/${k.danY.canh.length}…`);
          setDangLam({ id: c.id, kind: 'lam' });
          const r = await lamCanh(c.id);
          await tick();
          if (!r) break;
          if (r.errors.length) throw new Error(`Cảnh ${i + 1} còn lỗi sau 3 lần thử, nên dừng lại để bạn xem. Sửa tay hoặc dịch lại cảnh đó, rồi bấm chạy tiếp.`);
        }
      } finally {
        setTienDo('');
        setDangLam(null);
      }
    });
  };

  const lamLaiCanDich = async () => {
    const n = scenes.filter((c) => tt(c.id) === 'can-dich-lai').length;
    if (n && (await askConfirm(`Dịch lại ${n} cảnh cần dịch lại? Những chỗ bạn đã sửa tay ở phần dịch của các cảnh đó sẽ mất.`, { okLabel: 'Dịch lại' }))) lamTatCa('can-dich-lai');
  };

  /* ---------- Hiển thị ---------- */

  const all = scenes.flatMap((c) => ketQua[c.id]);
  // Sẵn sàng: đã dịch, không lỗi, và cảnh không cần dịch lại (bản dịch khớp chữ tiếng Việt hiện tại)
  const sanSang = all.filter((r) => r.text && !r.errors.length && tt(r.canhId) === 'da-dich').length;
  const daTao = all.filter((r) => pd.daTao[r.beatId]).length;
  const chuaDich = scenes.filter((c) => tt(c.id) === 'chua-dich').length;
  const canDichLai = scenes.filter((c) => tt(c.id) === 'can-dich-lai').length;
  const thieuAnh = Array.from(new Set(all.flatMap((r) => r.anh.filter((a) => a.loai !== 'frame' && !a.imageId).map((a) => a.tag))));
  const aiOff = !!busy || blocked;

  /* ---------- Xuất file ---------- */

  const tenFile = toTag(project.title) || 'du-an';
  const xuatPrompt = async () => {
    const chua = all.filter((r) => r.errors.length || tt(r.canhId) !== 'da-dich').length;
    const chuaChot = blocked ? `${blockedDeps(project, 'prompt').map((k) => `màn ${SCREENS.find((x) => x.key === k)?.no}`).join(', ')} đang nháp hoặc đã cũ — prompt ghép theo bản đang sửa, chưa chốt.` : '';
    const viec = [chua ? `${chua} beat chưa sẵn sàng (chưa dịch, cần dịch lại hoặc còn lỗi)` : '', chuaChot].filter(Boolean).join('; ');
    if (viec && !(await askConfirm(`${viec}. Vẫn xuất file (những chỗ này được ghi chú trong file)?`, { okLabel: 'Vẫn xuất' }))) return;
    taiFile(xuatPromptTxt({ ...ctx, title: project.title, tiLe: brief.tiLe, chuaChot }), `${tenFile}_prompt.txt`);
  };
  const xuatKichBan = () => taiFile(xuatKichBanTxt({ title: project.title, brief, nhanVat, kb }), `${tenFile}_kich-ban.txt`);


  return (
    <div className="space-y-6">
      <ScreenIntro no={8} title="Prompt">
        Mỗi beat một prompt video: nạp đúng các ảnh trong danh sách ở Flow, chép prompt, tạo một lần. App tự chép style, bối cảnh, ánh sáng, máy quay, giọng và câu thoại; AI chỉ dịch hành động và âm thanh sang tiếng Anh.
      </ScreenIntro>

      <UpstreamBanner project={project} sectionKey="prompt" onGo={onGo} />
      <ErrorBox message={error} />
      <Issues errors={notes.errors} warnings={[]} title={notes.errors.length ? 'AI đã được gửi lại 2 lần nhưng kết quả vẫn còn lỗi — bạn sửa tay hoặc dịch lại:' : undefined} />

      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-black flex items-center gap-2">
              <Languages className="w-4 h-4" /> Sẵn sàng {sanSang}/{all.length} beat · đã tạo video {daTao}/{all.length}
            </p>
            <p className="text-sm text-gray-600">
              {chuaDich ? `${chuaDich} cảnh chưa dịch` : 'Đã dịch mọi cảnh'}
              {canDichLai ? ` · ${canDichLai} cảnh cần dịch lại` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(busy === 'tat-ca' || busy === 'dich-lai') && (
              <button onClick={() => (stopRef.current = true)} className="py-3 px-5 rounded-xl bg-gray-100 hover:bg-red-50 font-bold flex items-center gap-2">
                <Square className="w-4 h-4" /> Dừng sau cảnh này
              </button>
            )}
            {canDichLai > 0 && (
              <RunButton onClick={lamLaiCanDich} busy={busy === 'dich-lai'} busyLabel={tienDo ? `${tienDo} Đừng rời màn này.` : 'AI đang dịch lại…'} icon={Languages} variant="ghost" disabled={aiOff}>
                Dịch lại {canDichLai} cảnh cần dịch lại
              </RunButton>
            )}
            <RunButton onClick={() => lamTatCa('chua-dich')} busy={busy === 'tat-ca'} busyLabel={tienDo ? `${tienDo} Đừng rời màn này.` : 'AI đang dịch…'} icon={Languages} disabled={aiOff || !chuaDich}>
              Dịch tất cả cảnh chưa dịch
            </RunButton>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
          <button onClick={xuatPrompt} className="mt-2 px-4 py-2 rounded-full bg-black text-primary-400 text-sm font-bold flex items-center gap-1.5">
            <FileDown className="w-4 h-4" /> Xuất prompt (.txt)
          </button>
          <button onClick={xuatKichBan} className="mt-2 px-4 py-2 rounded-full bg-gray-100 hover:bg-primary-100 text-sm font-bold flex items-center gap-1.5">
            <FileText className="w-4 h-4" /> Xuất kịch bản (.txt)
          </button>
        </div>
        {thieuAnh.length > 0 && (
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
            Còn {thieuAnh.length} ảnh tham chiếu chưa có ở màn 6: {thieuAnh.map((t) => `@${t}`).join(', ')}.{' '}
            <button onClick={() => onGo('bible')} className="underline font-bold">
              Sang màn 6
            </button>
          </p>
        )}
      </div>

      {scenes.map((c, i) => (
        <CanhPrompt
          key={c.id}
          no={i + 1}
          canh={c}
          nguon={nguonCanh(kb, pc.canh[c.id], c.id)}
          ketQua={ketQua[c.id]}
          dich={pd.canh[c.id]?.beats}
          tinhTrang={tt(c.id)}
          frames={pd.frame}
          frameTheo={pd.frameTheo}
          daTao={pd.daTao}
          chars={nhanVat}
          coNhac={brief.nhacNen !== 'khong'}
          running={dangLam?.id === c.id ? dangLam.kind : ''}
          disabled={aiOff}
          locked={blocked}
          onRun={() => lamMot(c.id)}
          onRevise={(t) => lamMot(c.id, t)}
          onKeep={() => khop(c.id)}
          onManual={() => khop(c.id)}
          onDich={(beatId, d) => onDich(c.id, beatId, d)}
          onFrame={onFrame}
          onDaTao={onDaTao}
          onError={(m) => notify(m)}
        />
      ))}
    </div>
  );
}
