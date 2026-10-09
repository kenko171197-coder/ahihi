// Kiểu dữ liệu của giao diện. Mô hình dự án nằm ở shared/project.ts (dùng chung với server).
export * from '../shared/project';

/* ---------- Bước Nhân vật & đạo cụ cũ (dùng tạm ở màn ⑥ cho tới lượt 3) ---------- */

export interface Seed {
  name: string;
  brief: string;
}

export interface CharacterDesign {
  tag: string;
  age: string;
  personality: string;
  appearance: string;
  outfit: string;
  expression: string;
  note: string;
  standardPrompt: string;
  sheetPrompt: string;
}

export interface PropDesign {
  tag: string;
  description: string;
  note: string;
  imagePrompt: string;
}

/** Ảnh tham chiếu đã gắn @tag. Ảnh thật nằm trong IndexedDB theo imageId. */
export interface Asset {
  tag: string;
  kind: 'character' | 'prop';
  note: string;
  imageId?: string;
  seen?: string;
  warning?: string;
}

/** Dạng dữ liệu bước thiết kế cũ đang đọc. Màn ⑥ tạm thời ghép từ dự án mới sang dạng này. */
export interface LegacyProject {
  id: string;
  synopsis: string;
  style: string;
  aspect: '9:16' | '16:9';
  characterSeeds: Seed[];
  propSeeds: Seed[];
  design?: { characters: CharacterDesign[]; props: PropDesign[] };
  assets?: Asset[];
}

export type LegacyPatch = Partial<LegacyProject> | ((latest: LegacyProject) => Partial<LegacyProject>);

/** Một thể loại trong knowledge/the-loai/. */
export interface GenreInfo {
  id: string;
  ten: string;
  moTa: string;
  thoiLuong: string;
  tiLe: string;
  cacPhan: string[];
}
