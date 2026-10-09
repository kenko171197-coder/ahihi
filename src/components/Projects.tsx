import React from 'react';
import { askConfirm } from '../lib/dialog';
import { ArrowLeft, FolderOpen, Trash2, Plus, Check, Lock, AlertTriangle, Pencil } from 'lucide-react';
import type { Project, ProjectPatch, SectionKey } from '../types';
import { SCREENS, getSection, missingDeps, blockedDeps, isStale } from '../../shared/project';
import { ProjectUsageBadge } from './UsagePanel';
import BriefScreen from './screens/BriefScreen';
import NhanVatScreen from './screens/NhanVatScreen';
import TreatmentScreen from './screens/TreatmentScreen';
import LegacyDesignScreen from './screens/LegacyDesignScreen';
import PlaceholderStep from './steps/PlaceholderStep';

interface Props {
  projects: Project[];
  openId: string | null;
  onOpen: (id: string | null) => void;
  onCreate: () => void;
  onUpdate: (id: string, patch: ProjectPatch) => void;
  onDelete: (id: string) => void;
}

const STAGE_NAMES: Record<number, string> = { 1: 'Phát triển', 2: 'Tiền kỳ', 3: 'Sản xuất' };

/** Màn đã làm ở lượt nào (màn chưa làm hiện trang giữ chỗ). */
const PLANNED: Partial<Record<SectionKey, { title: string; items: string[] }>> = {
  kichBan: { title: 'Kịch bản', items: ['Dàn ý cảnh (cảnh = các beat cùng bối cảnh) — bạn duyệt trước', 'Viết beat cho từng cảnh: hành động, thoại, âm thanh, số giây (3–10 giây mỗi beat)', 'Ai và vật gì có mặt, trạng thái đầu – cuối beat, thay đổi trạng thái'] },
  raSoat: { title: 'Rà soát', items: ['AI chấm kịch bản theo file thể loại', 'Danh sách vấn đề và đề xuất sửa, bạn nhận hoặc bỏ từng mục', 'Đề xuất được áp thẳng vào kịch bản'] },
  phanCanh: { title: 'Phân cảnh', items: ['Mỗi beat chia thành shot: cỡ cảnh, góc máy, chuyển động, số giây', 'Ô Mô tả tiếng Việt cho từng shot', 'Khung bàn giao để chụp frame nối'] },
  prompt: { title: 'Prompt', items: ['Prompt video cho từng beat theo khung 6 phần', 'Code chép phần cố định từ bible, AI chỉ dịch hành động', 'Frame nối và code tự kiểm trước khi xuất'] },
};

type ScreenState = 'duyet' | 'nhap' | 'cu' | 'khoa' | 'trong';

function screenState(p: Project, key: SectionKey): ScreenState {
  // Màn ⑥ đang dùng bước thiết kế cũ (tạm), mở được ngay
  if (key === 'bible') return 'trong';
  if (missingDeps(p, key).length) return 'khoa';
  const s = getSection(p, key);
  if (!s) return 'trong';
  if (isStale(p, key) || blockedDeps(p, key).length) return 'cu';
  return s.meta.status === 'duyet' ? 'duyet' : 'nhap';
}

const STATE_ICON: Record<ScreenState, React.ReactNode> = {
  duyet: <Check className="w-4 h-4" aria-label="Đã duyệt" />,
  nhap: <Pencil className="w-3.5 h-3.5" aria-label="Nháp" />,
  cu: <AlertTriangle className="w-4 h-4" aria-label="Đã cũ" />,
  khoa: <Lock className="w-3.5 h-3.5" aria-label="Chưa mở" />,
  trong: null,
};

const formatDate = (t: number) => new Date(t).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

function Workspace({ project, onUpdate, onDelete, onBack }: { project: Project; onUpdate: (patch: ProjectPatch) => void; onDelete: () => void; onBack: () => void }) {
  const current = SCREENS.find((s) => s.key === project.manHinh) || SCREENS[0];
  const goTo = (key: SectionKey) => {
    onUpdate({ manHinh: key });
    window.scrollTo({ top: 0 });
  };
  const next = () => {
    const i = SCREENS.findIndex((s) => s.key === current.key);
    if (i < SCREENS.length - 1) goTo(SCREENS[i + 1].key);
  };

  return (
    <div className="space-y-6">
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black mb-3">
          <ArrowLeft className="w-4 h-4" /> Tất cả dự án
        </button>
        <label htmlFor="ptitle" className="sr-only">Tên dự án</label>
        <input
          id="ptitle"
          value={project.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full text-2xl sm:text-3xl font-bold text-black bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-primary-400 focus:outline-none py-1"
        />
        <p className="text-sm text-gray-500 mt-1">Tạo ngày {formatDate(project.createdAt)}</p>
        <div className="mt-1">
          <ProjectUsageBadge projectId={project.id} />
        </div>
      </div>

      <nav aria-label="Các màn của dự án" className="space-y-2">
        {[1, 2, 3].map((stage) => (
          <div key={stage} className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500 sm:w-24 shrink-0">{STAGE_NAMES[stage]}</span>
            <ol className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 snap-x">
              {SCREENS.filter((s) => s.stage === stage).map((s) => {
                const st = screenState(project, s.key);
                const active = s.key === current.key;
                return (
                  <li key={s.key} className="shrink-0 snap-start">
                    <button
                      onClick={() => goTo(s.key)}
                      aria-current={active ? 'step' : undefined}
                      className={`rounded-xl px-3 py-2 text-sm whitespace-nowrap border font-bold flex items-center gap-1.5 transition-colors ${
                        active
                          ? 'bg-black border-black text-primary-400'
                          : st === 'duyet'
                          ? 'bg-primary-400 border-primary-400 text-black hover:bg-primary-300'
                          : st === 'cu'
                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                          : st === 'khoa'
                          ? 'bg-gray-50 border-gray-200 text-gray-400'
                          : 'bg-white border-gray-200 text-black hover:border-primary-400'
                      }`}
                    >
                      {STATE_ICON[st]}
                      {s.no}. {s.label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </nav>

      {current.key === 'brief' && <BriefScreen project={project} onUpdate={onUpdate} onGo={goTo} />}
      {current.key === 'nhanVat' && <NhanVatScreen project={project} onUpdate={onUpdate} onGo={goTo} />}
      {current.key === 'treatment' && <TreatmentScreen project={project} onUpdate={onUpdate} onGo={goTo} />}
      {current.key === 'bible' && <LegacyDesignScreen project={project} onUpdate={onUpdate} onNext={next} />}
      {PLANNED[current.key] && <PlaceholderStep title={`${current.no}. ${PLANNED[current.key]!.title}`} items={PLANNED[current.key]!.items} />}

      <div className="pt-6 border-t border-gray-100">
        <button
          onClick={async () => {
            if (await askConfirm(`Xoá dự án "${project.title}"? Không khôi phục được.`, { okLabel: 'Xoá dự án', danger: true })) onDelete();
          }}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Xoá dự án
        </button>
      </div>
    </div>
  );
}

export default function Projects({ projects, openId, onOpen: setOpenId, onCreate, onUpdate, onDelete }: Props) {
  const open = projects.find((p) => p.id === openId) || null;

  if (open) {
    return (
      <Workspace
        key={open.id}
        project={open}
        onUpdate={(patch) => onUpdate(open.id, patch)}
        onDelete={() => {
          onDelete(open.id);
          setOpenId(null);
        }}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-black">Dự án</h1>
        <button onClick={onCreate} className="flex items-center gap-2 py-2.5 px-5 rounded-xl bg-black hover:bg-gray-800 text-primary-400 font-bold">
          <Plus className="w-5 h-5" /> Dự án mới
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center text-gray-500">
          <FolderOpen className="w-8 h-8 mx-auto mb-3 text-primary-600" />
          Chưa có dự án nào. Bấm "Dự án mới" để bắt đầu.
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...projects]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((p) => {
              const done = SCREENS.filter((s) => screenState(p, s.key) === 'duyet').length;
              const cur = SCREENS.find((s) => s.key === p.manHinh) || SCREENS[0];
              return (
                <li key={p.id}>
                  <button onClick={() => setOpenId(p.id)} className="w-full text-left bg-white border border-gray-200 hover:border-primary-400 rounded-2xl p-4 transition-colors">
                    <p className="font-bold text-black truncate">{p.title}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Đang ở màn {cur.no}: {cur.label} · đã duyệt {done}/8 · {formatDate(p.updatedAt)}
                    </p>
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
