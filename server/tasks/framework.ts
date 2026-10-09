// Khung chung cho mọi tác vụ AI:
//   file prompt (prompts/*.md) + biến → gọi AI với khuôn trả về → chuẩn hoá → code kiểm
//   → sai thì gửi lại AI kèm danh sách lỗi (tối đa 2 lần) → ghi nhật ký.
// Không import thư viện ngoài: phần gọi AI, đọc file, ghi nhật ký được truyền vào (để test với AI giả).

import { render, Vars } from './template';
import type { Genre } from './genre';

export interface TaskCtx {
  genre: Genre | null;
}

/** errors: gửi lại AI để sửa · warnings: chỉ báo người dùng */
export type { CheckResult } from '../../shared/checks';
import type { CheckResult } from '../../shared/checks';

export interface TaskDef<I, O> {
  /** Mã tác vụ, cũng là khoá chọn model ở tab Cài đặt */
  id: string;
  /** File khuôn prompt trong prompts/ */
  promptFile: string;
  temperature: number;
  /** Khuôn trả về (định dạng responseSchema của Gemini) */
  schema: unknown;
  /** Đọc và kiểm đầu vào từ body request */
  parseInput(body: unknown): I;
  /** Id thể loại để nạp file thể loại (rỗng nếu tác vụ không cần) */
  genreId(input: I): string;
  /** Biến cho khuôn prompt */
  vars(input: I, ctx: TaskCtx): Vars;
  /** Chuẩn hoá kết quả thô của AI (ném lỗi nếu không dùng được) */
  normalize(raw: unknown, input: I): O;
  /** Code kiểm kết quả đã chuẩn hoá */
  check(out: O, input: I, ctx: TaskCtx): CheckResult;
  /** Kết quả rỗng (không có nội dung chính) — chỉ được chọn khi không còn bản nào khác */
  isEmpty(out: O): boolean;
}

export interface Attempt {
  prompt: string;
  raw: string;
  errors: string[];
  ms: number;
}

export interface TaskLog {
  id: string;
  at: number;
  task: string;
  projectId: string;
  attempts: Attempt[];
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface TaskDeps {
  loadPrompt(file: string): string;
  loadGenre(id: string): Genre | null;
  /** Gọi AI: trả về JSON đã parse và chữ gốc. invalid = có chữ nhưng không phải JSON hợp lệ (thường do bị cắt vì quá dài). */
  generate(prompt: string, schema: unknown, temperature: number, taskId: string): Promise<{ json: unknown; text: string; invalid?: boolean }>;
  log(entry: TaskLog): void;
  now(): number;
  newId(): string;
}

export interface TaskResult<O> {
  output: O;
  errors: string[];
  warnings: string[];
  logId: string;
}

export const MAX_RETRIES = 2;

/** Đoạn thêm vào prompt khi gửi lại AI để sửa lỗi. */
export function retryNote(errors: string[], previous: string): string {
  const prev = previous.length > 20000 ? `${previous.slice(0, 20000)}…` : previous;
  return `\n\n===== KẾT QUẢ LẦN TRƯỚC CÓ LỖI =====\n${errors.map((e) => `- ${e}`).join('\n')}${prev ? `\n\nKết quả lần trước:\n${prev}` : ''}\n\nHãy trả lại TOÀN BỘ kết quả, đã sửa hết các lỗi trên, giữ nguyên những phần không lỗi.`;
}

export const INVALID_JSON_ERROR = 'Kết quả lần trước không phải JSON hợp lệ (có thể bị cắt vì quá dài). Hãy trả lại JSON đầy đủ; viết các ô văn bản ngắn gọn hơn nếu cần.';

/** Bản nào tốt hơn: bản có nội dung thắng bản rỗng; cùng loại thì ít lỗi hơn thắng (bằng nhau giữ bản đến trước). */
function better(a: { errors: number; empty: boolean }, b: { errors: number; empty: boolean } | null): boolean {
  if (!b) return true;
  if (a.empty !== b.empty) return !a.empty;
  return a.errors < b.errors;
}

export async function runTask<I, O>(def: TaskDef<I, O>, body: unknown, projectId: string, deps: TaskDeps): Promise<TaskResult<O>> {
  const input = def.parseInput(body);
  const gid = def.genreId(input);
  const genre = gid ? deps.loadGenre(gid) : null;
  if (gid && !genre) throw new Error(`Không tìm thấy file thể loại "${gid}" trong knowledge/the-loai/.`);
  const ctx: TaskCtx = { genre };
  const base = render(deps.loadPrompt(def.promptFile), def.vars(input, ctx));

  const attempts: Attempt[] = [];
  let prompt = base;
  let best: { out: O; check: CheckResult; empty: boolean } | null = null;
  let fatal = '';

  for (let i = 0; i <= MAX_RETRIES; i++) {
    const t0 = deps.now();
    let text = '';
    let errors: string[] = [];
    let previous = '';
    try {
      const res = await deps.generate(prompt, def.schema, def.temperature, def.id);
      text = res.text;
      if (res.invalid || res.json === null || typeof res.json !== 'object' || Array.isArray(res.json)) {
        errors = [INVALID_JSON_ERROR];
        previous = '';
      } else {
        const out = def.normalize(res.json, input);
        const check = def.check(out, input, ctx);
        const empty = def.isEmpty(out);
        errors = empty && !check.errors.length ? ['Kết quả không có nội dung.'] : check.errors;
        if (better({ errors: check.errors.length, empty }, best && { errors: best.check.errors.length, empty: best.empty })) best = { out, check, empty };
        previous = JSON.stringify(out, null, 2);
      }
    } catch (e: any) {
      // Lỗi gọi AI (mạng, key, hết lượt…) hoặc chuẩn hoá hỏng → báo ngay, không gửi lại
      fatal = String(e?.message || e);
      attempts.push({ prompt, raw: text, errors: [fatal], ms: deps.now() - t0 });
      break;
    }
    attempts.push({ prompt, raw: text, errors, ms: deps.now() - t0 });
    if (!errors.length) break;
    if (i < MAX_RETRIES) prompt = base + retryNote(errors, previous);
  }

  const id = deps.newId();
  const finalErrors = best ? best.check.errors : [fatal || INVALID_JSON_ERROR];
  deps.log({
    id,
    at: deps.now(),
    task: def.id,
    projectId,
    attempts,
    ok: !!best && !best.check.errors.length && !best.empty,
    errors: finalErrors,
    warnings: best?.check.warnings || [],
  });
  if (!best) throw new Error(fatal || 'AI không trả về kết quả dùng được sau 3 lần thử. Thử lại, hoặc rút ngắn yêu cầu.');
  if (best.empty) throw new Error('AI trả về kết quả rỗng sau 3 lần thử. Thử lại sau ít phút.');
  return { output: best.out, errors: best.check.errors, warnings: best.check.warnings, logId: id };
}
