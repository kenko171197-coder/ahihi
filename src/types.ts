// Kiểu dữ liệu của giao diện. Mô hình dự án nằm ở shared/project.ts (dùng chung với server).
export * from '../shared/project';

/** Một thể loại trong knowledge/the-loai/. */
export interface GenreInfo {
  id: string;
  ten: string;
  moTa: string;
  thoiLuong: string;
  tiLe: string;
  cacPhan: string[];
  /** Khoảng giây thể loại khuyên cho mỗi beat */
  beatGiay?: [number, number] | null;
}
