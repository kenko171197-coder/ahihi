// Màn ② — Nhân vật: AI đề xuất hồ sơ nhân vật (câu chuyện), bạn sửa / thêm / xoá, rồi duyệt.
import React, { useRef } from 'react';
import { Users, Plus, Trash2, RefreshCw, ArrowRight } from 'lucide-react';
import type { Project, ProjectPatch, Character, NhanVatData, SectionKey, Section, VaiNhanVat } from '../../types';
import { freshSection, editSection, approveSection, keepSection, missingDeps, blockedDeps, depRevs, toTag, uniqueTag } from '../../../shared/project';
import { checkCharacters } from '../../../shared/checks';
import { runTask } from '../../services/api';
import { askConfirm } from '../../lib/dialog';
import { ErrorBox, RunButton } from '../ui';
import { ScreenIntro, StatusBar, Issues, ReviseBox, Field, fieldCls, useRunner, LockedScreen, UpstreamBanner } from './common';

interface Props {
  project: Project;
  onUpdate: (patch: ProjectPatch) => void;
  onGo: (k: SectionKey) => void;
}

const VAI_LABEL: Record<VaiNhanVat, string> = { chinh: 'Chính', phu: 'Phụ', 'gian-tiep': 'Gián tiếp' };

function CharacterCard({ c, onChange, onRemove }: { c: Character; onChange: (patch: Partial<Character>) => void; onRemove: () => void }) {
  return (
    <article className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[10rem]">
          <Field label="Tên" value={c.ten} onChange={(v) => onChange({ ten: v })} />
        </div>
        <div className="w-36">
          <label className="block text-sm font-bold text-black mb-1" htmlFor={`tag-${c.id}`}>Tag</label>
          <div className="flex items-center">
            <span className="text-gray-500 mr-1">@</span>
            <input id={`tag-${c.id}`} value={c.tag} onChange={(e) => onChange({ tag: toTag(e.target.value) })} className={fieldCls} />
          </div>
        </div>
        <div className="w-36">
          <label className="block text-sm font-bold text-black mb-1" htmlFor={`vai-${c.id}`}>Vai</label>
          <select id={`vai-${c.id}`} value={c.vai} onChange={(e) => onChange({ vai: e.target.value as VaiNhanVat })} className={fieldCls}>
            {(Object.keys(VAI_LABEL) as VaiNhanVat[]).map((v) => (
              <option key={v} value={v}>{VAI_LABEL[v]}</option>
            ))}
          </select>
        </div>
        <div className="w-24">
          <Field label="Tuổi" value={c.tuoi} onChange={(v) => onChange({ tuoi: v })} />
        </div>
        <button onClick={onRemove} title="Xoá nhân vật" aria-label={`Xoá ${c.ten || 'nhân vật'}`} className="p-2.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Muốn (nhỏ, cụ thể)" value={c.muon} onChange={(v) => onChange({ muon: v })} />
        <Field label="Cần (tuỳ chọn)" value={c.can} onChange={(v) => onChange({ can: v })} />
        <Field label="Tính cách (3–4 từ)" value={c.tinhCach} onChange={(v) => onChange({ tinhCach: v })} />
        <Field label="Chi tiết riêng nhìn thấy được" value={c.chiTiet} onChange={(v) => onChange({ chiTiet: v })} />
        <Field label="Quan hệ" value={c.quanHe} onChange={(v) => onChange({ quanHe: v })} />
        <Field label="Ghi chú cho khâu thiết kế" value={c.ghiChuThietKe} onChange={(v) => onChange({ ghiChuThietKe: v })} />
      </div>
    </article>
  );
}

export default function NhanVatScreen({ project, onUpdate, onGo }: Props) {
  const { busy, error, notes, run } = useRunner();
  // Bản mới nhất của dự án, để biết bạn có sửa gì trong lúc chờ AI không
  const latestRef = useRef(project);
  latestRef.current = project;
  if (missingDeps(project, 'nhanVat').length) return <LockedScreen project={project} sectionKey="nhanVat" onGo={onGo} />;
  const blocked = blockedDeps(project, 'nhanVat').length > 0;

  const brief = project.sections.brief!.data;
  const section = project.sections.nhanVat;
  const list = section?.data.list || [];
  const check = checkCharacters(list, brief.thoiLuongGiay);

  const setSection = (fn: (latest: Project) => Section<NhanVatData> | undefined) =>
    onUpdate((latest) => ({ sections: { ...latest.sections, nhanVat: fn(latest) } }));

  /** Sửa tay. Chưa có phần nào (AI lỗi, hoặc muốn tự nhập) thì tạo phần nháp rỗng. */
  const edit = (fn: (l: Character[]) => Character[]) =>
    setSection((latest) => {
      const s = latest.sections.nhanVat;
      return s ? editSection(s, { list: fn(s.data.list) }, Date.now()) : freshSection(latest, 'nhanVat', { list: fn([]) }, Date.now());
    });

  const generate = async (sua?: string) => {
    if (!sua && section && !(await askConfirm('Tạo lại toàn bộ nhân vật? Những chỗ bạn đã sửa sẽ mất.', { okLabel: 'Tạo lại' }))) return;
    const startedAt = section?.meta.updatedAt;
    const readRevs = depRevs(project, 'nhanVat'); // phiên bản phần trên mà AI sẽ đọc
    run(sua ? 'sua' : 'tao', async () => {
      const r = await runTask<Character[]>('nhan-vat', { brief, sua: sua ? { truoc: { list }, yeuCau: sua } : undefined }, project.id);
      const now = latestRef.current.sections.nhanVat?.meta.updatedAt;
      if (now !== startedAt && !(await askConfirm('Bạn đã sửa danh sách nhân vật trong lúc AI đang chạy. Thay bằng kết quả mới của AI?', { okLabel: 'Thay bằng kết quả mới', cancelLabel: 'Giữ bản đang sửa' }))) return;
      setSection((latest) => freshSection(latest, 'nhanVat', { list: r.output }, Date.now(), readRevs));
      return r;
    });
  };

  const addCharacter = () =>
    edit((l) => {
      const n = l.reduce((m, c) => Math.max(m, Number(/(\d+)$/.exec(c.id)?.[1] || 0)), 0) + 1;
      const tag = uniqueTag('nhanvat', new Set(l.map((c) => c.tag)));
      return [...l, { id: `nv${n}`, ten: '', tag, vai: 'phu', tuoi: '', muon: '', can: '', tinhCach: '', chiTiet: '', quanHe: '', ghiChuThietKe: '' }];
    });

  const approve = () => setSection((latest) => (latest.sections.nhanVat ? approveSection(latest, 'nhanVat', latest.sections.nhanVat, Date.now()) : undefined));
  const keep = () => setSection((latest) => (latest.sections.nhanVat ? keepSection(latest, 'nhanVat', latest.sections.nhanVat, Date.now()) : undefined));

  return (
    <div className="space-y-6">
      <ScreenIntro no={2} title="Nhân vật">
        Hồ sơ nhân vật về mặt câu chuyện: muốn gì, tính cách, chi tiết riêng nhìn thấy được. Ngoại hình chi tiết và giọng nói làm ở màn 6.
      </ScreenIntro>

      <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-3">
        <b>Logline:</b> {brief.logline}
      </p>

      <UpstreamBanner project={project} sectionKey="nhanVat" onGo={onGo} />

      {!section && (
        <div className="flex flex-wrap gap-2">
          <RunButton onClick={() => generate()} busy={busy === 'tao'} busyLabel="AI đang xây dựng nhân vật…" icon={Users} disabled={!!busy || blocked}>
            Đề xuất nhân vật
          </RunButton>
          <button onClick={addCharacter} disabled={!!busy} className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-primary-100 font-bold flex items-center gap-2 disabled:opacity-50">
            <Plus className="w-4 h-4" /> Tự nhập nhân vật
          </button>
        </div>
      )}

      <ErrorBox message={error} />
      <Issues errors={notes.errors} warnings={[]} title={notes.errors.length ? 'AI đã được gửi lại 2 lần nhưng kết quả vẫn còn lỗi — bạn sửa tay hoặc tạo lại:' : undefined} />

      {section && (
        <>
          <div className="space-y-3">
            {list.map((c) => (
              <CharacterCard
                key={c.id}
                c={c}
                onChange={(patch) => edit((l) => l.map((x) => (x.id === c.id ? { ...x, ...patch } : x)))}
                onRemove={async () => {
                  if (await askConfirm(`Xoá nhân vật ${c.ten || '(chưa đặt tên)'}?`, { okLabel: 'Xoá', danger: true })) edit((l) => l.filter((x) => x.id !== c.id));
                }}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={addCharacter} disabled={!!busy} className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-primary-100 font-bold flex items-center gap-2 disabled:opacity-50">
              <Plus className="w-4 h-4" /> Thêm nhân vật
            </button>
            <RunButton onClick={() => generate()} busy={busy === 'tao'} busyLabel="AI đang tạo lại…" icon={RefreshCw} variant="ghost" disabled={!!busy || blocked}>
              Tạo lại toàn bộ
            </RunButton>
          </div>

          <ReviseBox onSubmit={(t) => generate(t)} busy={busy === 'sua'} disabled={!!busy || blocked} placeholder="VD: thêm một người bạn cùng phòng, cho Lan hay càu nhàu hơn…" />

          <Issues errors={check.errors} warnings={check.warnings} />

          <StatusBar project={project} sectionKey="nhanVat" blocking={check.errors} onApprove={approve} onKeep={keep} onRegenerate={() => generate()} busy={!!busy} />

          {section.meta.status === 'duyet' && !blocked && (
            <div className="flex justify-end">
              <button onClick={() => onGo('treatment')} className="py-3 px-6 rounded-xl bg-black hover:bg-gray-800 text-primary-400 font-bold flex items-center gap-2">
                Sang màn 3: Treatment <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
