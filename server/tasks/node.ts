// Phần chạy thật của khung tác vụ trên Node: đọc file prompt và thể loại, ghi nhật ký, gọi Gemini.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { TaskDeps, TaskLog } from './framework';
import { parseGenre, Genre, infoOf, beatGiayOf } from './genre';
import { generateWithFallback } from '../ai';

const ROOT = process.cwd();
const PROMPT_DIR = path.join(ROOT, 'prompts');
const GENRE_DIR = path.join(ROOT, 'knowledge', 'the-loai');
const LOG_DIR = path.join(ROOT, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'ai-calls.jsonl');
const MAX_LOGS = 100;

/* ---------- File prompt và thể loại (đọc mỗi lần gọi để sửa file là có hiệu lực ngay) ---------- */

export function loadPrompt(file: string): string {
  const p = path.join(PROMPT_DIR, path.basename(file));
  if (!fs.existsSync(p)) throw new Error(`Thiếu file prompt prompts/${file}.`);
  return fs.readFileSync(p, 'utf8');
}

const safeId = (id: string) => /^[a-z0-9-]+$/i.test(id);

export function loadGenre(id: string): Genre | null {
  if (!safeId(id)) return null;
  const p = path.join(GENRE_DIR, `${id}.md`);
  if (!fs.existsSync(p)) return null;
  return parseGenre(id, fs.readFileSync(p, 'utf8'));
}

export interface GenreSummary {
  id: string;
  ten: string;
  moTa: string;
  thoiLuong: string;
  tiLe: string;
  cacPhan: string[];
  /** Khoảng giây thể loại khuyên cho mỗi beat */
  beatGiay: [number, number] | null;
}

export function listGenres(): GenreSummary[] {
  if (!fs.existsSync(GENRE_DIR)) return [];
  return fs
    .readdirSync(GENRE_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort()
    .map((f) => {
      const id = f.replace(/\.md$/, '');
      const g = parseGenre(id, fs.readFileSync(path.join(GENRE_DIR, f), 'utf8'));
      return { id, ten: g.ten, moTa: g.moTa, thoiLuong: infoOf(g.thongTin, 'Thời lượng hợp'), tiLe: infoOf(g.thongTin, 'Tỉ lệ'), cacPhan: g.cacPhan, beatGiay: beatGiayOf(g) };
    });
}

/* ---------- Nhật ký lời gọi AI ---------- */

const memory: TaskLog[] = [];

export function writeLog(entry: TaskLog) {
  memory.unshift(entry);
  memory.length = Math.min(memory.length, MAX_LOGS);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch (e) {
    console.warn('Không ghi được nhật ký AI:', e);
  }
}

export const listLogs = () =>
  memory.map((l) => ({ id: l.id, at: l.at, task: l.task, projectId: l.projectId, ok: l.ok, attempts: l.attempts.length, errors: l.errors, warnings: l.warnings }));

export const getLog = (id: string) => memory.find((l) => l.id === id) || null;

/* ---------- Gọi Gemini ---------- */

async function generate(prompt: string, schema: unknown, temperature: number, taskId: string) {
  const response = await generateWithFallback(
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature, responseMimeType: 'application/json', responseSchema: schema },
    },
    taskId
  );
  const text = response.text || '';
  try {
    return { json: JSON.parse(text), text };
  } catch {
    // Có chữ nhưng không phải JSON (thường do bị cắt vì quá dài) → khung tác vụ gửi lại AI
    return { json: null, text, invalid: true };
  }
}

export const nodeDeps: TaskDeps = {
  loadPrompt,
  loadGenre,
  generate,
  log: writeLog,
  now: () => Date.now(),
  newId: () => crypto.randomUUID(),
};
