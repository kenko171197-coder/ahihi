import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard, FolderOpen, Settings as SettingsIcon, Download, Upload, KeyRound } from 'lucide-react';
import type { Project, ProjectPatch } from './types';
import { loadProjects, saveProjects, newProject, exportAll, importAll, imageIdsOf } from './lib/store';
import { hasApiKey } from './services/api';
import { deleteImage } from './lib/images';
import Projects from './components/Projects';
import Settings from './components/Settings';
import { DialogHost } from './lib/dialog';

type Tab = 'du-an' | 'cai-dat';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'du-an', label: 'Dự án', icon: FolderOpen },
  { key: 'cai-dat', label: 'Cài đặt', icon: SettingsIcon },
];

export default function App() {
  const [tab, setTab] = useState<Tab>(() => (hasApiKey() ? 'du-an' : 'cai-dat'));
  const [projects, setProjects] = useState<Project[]>(loadProjects);
  const [keyReady, setKeyReady] = useState(hasApiKey);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2600);
  };

  /* ---------- Dự án ---------- */

  // Lưu dự án khi có thay đổi — gom lại sau 600ms ngừng gõ. Rời trang / ẩn tab thì ghi ngay.
  const firstRender = useRef(true);
  const pendingSave = useRef<Project[] | null>(null);
  const flushSave = useCallback(() => {
    const v = pendingSave.current;
    if (!v) return;
    pendingSave.current = null;
    if (!saveProjects(v)) notify('Không lưu được: bộ nhớ trình duyệt đã đầy. Hãy lưu dữ liệu ra file.');
  }, []);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    pendingSave.current = projects;
    const t = window.setTimeout(flushSave, 600);
    return () => window.clearTimeout(t);
  }, [projects, flushSave]);
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flushSave();
    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flushSave);
      document.removeEventListener('visibilitychange', onHide);
      flushSave();
    };
  }, [flushSave]);

  const createProject = () => {
    const p = newProject();
    setProjects((prev) => [...prev, p]);
    setOpenProjectId(p.id);
  };

  /** Gộp thay đổi vào dự án mới nhất (tránh ghi đè khi nhiều thao tác chạy cùng lúc). */
  const updateProject = useCallback((id: string, patch: ProjectPatch) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch), updatedAt: Date.now() } : p))
    );
  }, []);

  const deleteProject = (id: string) => {
    const target = projects.find((p) => p.id === id);
    if (target) imageIdsOf(target).forEach((id) => deleteImage(id).catch(() => undefined));
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  /* ---------- Xuất / nhập ---------- */

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        flushSave();
        const added = await importAll(String(reader.result));
        setProjects(loadProjects());
        notify(`Đã thêm ${added.projects} dự án.`);
      } catch (err: any) {
        notify(err?.message || 'File không hợp lệ.');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-primary-400/40">
      <nav className="border-b border-primary-500/20 bg-white md:bg-white/85 md:backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl 2xl:max-w-[100rem] mx-auto px-3 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="bg-primary-400 p-1.5 rounded-lg">
              <Clapperboard className="w-5 h-5 text-black" />
            </span>
            <span className="text-base sm:text-xl font-bold text-black whitespace-nowrap">Xưởng phim AI</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              title="Mở dữ liệu từ file"
              className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-gray-600 hover:bg-primary-400/15 hover:text-black"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden md:inline">Mở</span>
            </button>
            <button
              onClick={() => { flushSave(); exportAll().catch((e) => notify(e?.message || 'Không lưu được file.')); }}
              title="Lưu toàn bộ dữ liệu ra file"
              className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-gray-600 hover:bg-primary-400/15 hover:text-black"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Lưu ra file</span>
            </button>
            <div className="w-px h-6 bg-primary-500/25 mx-1" />
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-current={tab === key ? 'page' : undefined}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  tab === key ? 'bg-black text-primary-400' : 'text-gray-600 hover:bg-primary-400/15 hover:text-black'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {!keyReady && tab !== 'cai-dat' && (
        <div className="bg-primary-400 text-black">
          <div className="max-w-7xl 2xl:max-w-[100rem] mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center gap-3 text-sm">
            <KeyRound className="w-4 h-4" />
            <span className="font-medium">Chưa có Gemini API key nên chưa dùng được AI.</span>
            <button onClick={() => setTab('cai-dat')} className="underline font-bold">
              Nhập key
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl 2xl:max-w-[100rem] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {tab === 'du-an' && (
          <Projects
            projects={projects}
            openId={openProjectId}
            onOpen={setOpenProjectId}
            onCreate={createProject}
            onUpdate={updateProject}
            onDelete={deleteProject}
          />
        )}
        {tab === 'cai-dat' && <Settings onKeyChange={() => setKeyReady(hasApiKey())} />}
      </main>

      <DialogHost />

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-black text-primary-400 px-5 py-3 rounded-full text-sm font-medium shadow-xl max-w-[90vw] text-center">
          {toast}
        </div>
      )}
    </div>
  );
}
