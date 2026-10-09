// Đọc file thể loại trong knowledge/the-loai/*.md.
// Mỗi file: "# Tên", đoạn mô tả, các dòng "- **Khoá:** giá trị", rồi các mục "## Tên mục".
// Mỗi mục được gửi cho đúng màn dùng nó (bảng SECTION_OF_SCREEN).
import { normName } from '../../shared/checks';

export { normName };

export interface Genre {
  id: string;
  ten: string;
  moTa: string;
  /** Các dòng "- **Khoá:** giá trị" ở đầu file (giữ nguyên tên khoá) */
  thongTin: Record<string, string>;
  /** Tên các phần bắt buộc của cấu trúc truyện (dòng "Các phần") */
  cacPhan: string[];
  /** Nội dung từng mục, theo tên mục đã chuẩn hoá */
  muc: Record<string, string>;
}

/** Tên mục trong file thể loại → màn dùng nó. */
export const SECTION_OF_SCREEN: Record<string, string> = {
  brief: 'Định hướng',
  nhanVat: 'Nhân vật',
  treatment: 'Cấu trúc truyện',
  kichBan: 'Viết kịch bản',
  raSoat: 'Rà soát',
  bible: 'Hình ảnh',
  phanCanh: 'Cách quay',
};

/** Lấy một dòng thông tin theo tên khoá (không phân biệt dấu, hoa thường). */
export function infoOf(thongTin: Record<string, string>, key: string): string {
  const k = Object.keys(thongTin).find((x) => normName(x) === normName(key));
  return k ? thongTin[k] : '';
}

export function parseGenre(id: string, text: string): Genre {
  const lines = text.replace(/\r/g, '').split('\n');
  let ten = id;
  const moTa: string[] = [];
  const thongTin: Record<string, string> = {};
  const muc: Record<string, string> = {};
  let current = '';
  let body: string[] = [];
  const flush = () => {
    if (current) {
      muc[normName(current)] = body
        .join('\n')
        .replace(/^\s*\*Dùng ở[^\n]*\*\s*$/m, '')
        .replace(/(\n\s*-{3,}\s*)+$/, '')
        .trim();
    }
  };

  for (const line of lines) {
    const h1 = /^#\s+(.+)$/.exec(line);
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h1 && !current) {
      ten = h1[1].trim();
      continue;
    }
    if (h2) {
      flush();
      current = h2[1].trim();
      body = [];
      continue;
    }
    if (current) {
      body.push(line);
      continue;
    }
    const info = /^-\s+\*\*(.+?):\*\*\s*(.+)$/.exec(line.trim());
    if (info) thongTin[info[1].trim()] = info[2].trim();
    else if (line.trim() && line.trim() !== '---') moTa.push(line.trim());
  }
  flush();

  const cacPhanRaw = infoOf(thongTin, 'Các phần');
  const cacPhan = cacPhanRaw
    .split(/[·→,;]/)
    .map((x) => x.trim())
    .filter(Boolean);

  return { id, ten, moTa: moTa.join(' '), thongTin, cacPhan, muc };
}

/** Nội dung mục của thể loại cho một màn (rỗng nếu file không có mục đó). */
export function sectionFor(g: Genre | null, screen: keyof typeof SECTION_OF_SCREEN): string {
  if (!g) return '';
  return g.muc[normName(SECTION_OF_SCREEN[screen])] || '';
}

/** Khối "THỂ LOẠI" ngắn đặt đầu mọi prompt: tên, mô tả, thông tin chung. */
export function genreHeader(g: Genre | null): string {
  if (!g) return '';
  const info = Object.entries(g.thongTin)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  return `${g.ten}\n${g.moTa}${info ? `\n${info}` : ''}`;
}
