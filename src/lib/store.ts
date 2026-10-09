import type { Project } from '../types';
import { newProjectData } from '../../shared/project';
import { getImage, putImage } from './images';

const KEY = 'xuong_v3_projects';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('Không lưu được', key, e);
    return false;
  }
}

export const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const newProject = (): Project => newProjectData(uid('proj'), Date.now());

/** Ghép dự án đã lưu với khuôn mặc định, để dự án lưu từ bản trước vẫn mở được khi có thêm trường mới. */
function upgrade(p: any): Project | null {
  if (!p || typeof p !== 'object' || p.version !== 3 || !p.id) return null;
  const base = newProjectData(p.id, p.createdAt || Date.now(), p.title || 'Dự án mới');
  return {
    ...base,
    ...p,
    briefWork: { ...base.briefWork, ...(p.briefWork || {}), input: { ...base.briefWork.input, ...(p.briefWork?.input || {}) } },
    sections: { ...(p.sections || {}) },
  };
}

export const loadProjects = (): Project[] => read<any[]>(KEY, []).map(upgrade).filter((p): p is Project => !!p);
export const saveProjects = (v: Project[]) => write(KEY, v);

/** Mọi ảnh của dự án (ảnh tham chiếu ở màn ⑥; ảnh của màn ⑥ tạm cũ nếu còn). */
export const imageIdsOf = (p: Project) =>
  [...Object.values(p.sections.bible?.data.anh || {}).map((a) => a.imageId), ...((p as any).thietKeTam?.assets || []).map((a: any) => a?.imageId)].filter(
    (x): x is string => typeof x === 'string' && !!x
  );

/* ---------- Xuất / nhập toàn bộ dữ liệu ra file ---------- */

export async function exportAll() {
  const images: Record<string, string> = {};
  const projects = loadProjects();
  for (const p of projects) {
    for (const id of imageIdsOf(p)) {
      if (!images[id]) {
        const url = await getImage(id).catch(() => undefined);
        if (url) images[id] = url;
      }
    }
  }
  const data = { app: 'xuong-phim-ai', version: 4, exportedAt: new Date().toISOString(), projects, images };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `xuong-phim-ai_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Gộp dữ liệu từ file vào dữ liệu hiện có (không xoá gì). */
export async function importAll(json: string): Promise<{ projects: number }> {
  const data = JSON.parse(json);
  if (data?.app !== 'xuong-phim-ai' || data?.version !== 4) {
    throw new Error('File này không phải dữ liệu của bản Xưởng phim AI hiện tại (file của bản cũ không mở được).');
  }
  if (data.images && typeof data.images === 'object') {
    for (const [id, url] of Object.entries(data.images)) {
      if (typeof url === 'string') await putImage(url, id);
    }
  }
  const current = loadProjects();
  const ids = new Set(current.map((x) => x.id));
  const added = (Array.isArray(data.projects) ? data.projects : []).map(upgrade).filter((p: Project | null): p is Project => !!p && !ids.has(p.id));
  saveProjects([...current, ...added]);
  return { projects: added.length };
}
