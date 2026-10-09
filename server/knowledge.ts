// Kho kiến thức: đọc nguyên văn các file .md trong knowledge/<thư mục>/ để gửi kèm prompt.
// Sửa file .md thì app tự đọc lại sau tối đa 30 giây, không cần khởi động lại.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'knowledge');
const TTL_MS = 30_000;
const cache = new Map<string, { at: number; text: string }>();

/** Ghép mọi file .md trong một thư mục con của knowledge/ (theo thứ tự tên file). */
export function knowledgeDir(dir: string): string {
  const hit = cache.get(dir);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.text;
  let text = '';
  try {
    const folder = path.join(ROOT, dir);
    text = fs
      .readdirSync(folder)
      .filter((f) => f.toLowerCase().endsWith('.md'))
      .sort()
      .map((f) => fs.readFileSync(path.join(folder, f), 'utf8').trim())
      .join('\n\n');
  } catch {
    text = '';
  }
  cache.set(dir, { at: Date.now(), text });
  return text;
}

/** Cho tab Cài đặt biết thư mục kiến thức nào có file. */
export function knowledgeStatus() {
  const folders: { dir: string; files: string[] }[] = [];
  try {
    for (const d of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const files = fs.readdirSync(path.join(ROOT, d.name)).filter((f) => f.toLowerCase().endsWith('.md')).sort();
      folders.push({ dir: d.name, files });
    }
  } catch {
    /* chưa có thư mục knowledge */
  }
  return { folders };
}
