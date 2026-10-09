import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import 'dotenv/config';
import { requestContext, generateWithFallback, currentUsage, newUsage, testKey, KeyPool } from './server/ai';
import { knowledgeStatus } from './server/knowledge';
import { runTask } from './server/tasks/framework';
import { TASK_DEFS } from './server/tasks/registry';
import { nodeDeps, listGenres, listLogs, getLog } from './server/tasks/node';
import {
  validateDesign, buildDesignPrompt, DESIGN_SCHEMA, normalizeDesign,
  validateMatch, buildMatchParts, MATCH_SCHEMA, normalizeMatches,
} from './server/design';

/** Gọi Gemini với một prompt, ép trả JSON theo khuôn. `task` quyết định model (bảng ở tab Cài đặt). */
async function askJson(prompt: string | any[], schema: any, temperature: number, task: string) {
  const parts = typeof prompt === 'string' ? [{ text: prompt }] : prompt;
  const response = await generateWithFallback(
    {
      contents: [{ role: 'user', parts }],
      config: { temperature, responseMimeType: 'application/json', responseSchema: schema },
    },
    task
  );
  try {
    return JSON.parse(response.text || 'null');
  } catch {
    throw new Error('Gemini trả về dữ liệu hỏng (có thể do quá dài). Thử lại một lần nữa.');
  }
}

/** Bọc route: bắt lỗi, trả thông báo tiếng Việt. */
const route = (label: string, handler: (req: any) => Promise<any>) => async (req: any, res: any) => {
  try {
    const data = await handler(req);
    res.json({ ...data, usage: currentUsage() });
  } catch (error: any) {
    console.error(`${label}:`, error);
    res.status(502).json({ error: `${label}: ${error?.message || 'Gemini lỗi'}` });
  }
};

// Những route không cần API key
// /logs không mở: nhật ký chứa prompt và ý tưởng của bạn, chỉ trả cho trình duyệt đã có key.
const OPEN_ROUTES = new Set(['/health', '/knowledge-status', '/test-key', '/genres']);
const isOpen = (p: string) => OPEN_ROUTES.has(p);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Mọi route AI đều cần key của người dùng (nhập ở tab Cài đặt).
  app.use('/api', (req, res, next) => {
    if (isOpen(req.path)) return next();
    // Nhóm key: { free: [...], paid: [...] } (header x-gemini-keys).
    const keys: KeyPool = { free: [], paid: [] };
    try {
      const raw = req.headers['x-gemini-keys'];
      if (typeof raw === 'string' && raw) {
        const parsed = JSON.parse(decodeURIComponent(raw));
        const clean = (a: any) => (Array.isArray(a) ? a.map((k) => String(k).trim()).filter((k) => k.length > 10) : []);
        keys.free = Array.from(new Set(clean(parsed.free)));
        keys.paid = Array.from(new Set(clean(parsed.paid))).filter((k) => !keys.free.includes(k));
      }
    } catch {
      /* bỏ qua */
    }
    if (!keys.free.length && !keys.paid.length) {
      return res.status(401).json({ error: 'Chưa có API key. Vào tab Cài đặt để thêm key.' });
    }
    // Model người dùng chọn cho từng tác vụ (tab Cài đặt), gửi kèm header
    let models: Record<string, string> = {};
    try {
      const raw = req.headers['x-gemini-models'];
      if (typeof raw === 'string' && raw) models = JSON.parse(decodeURIComponent(raw));
    } catch {
      models = {};
    }
    requestContext.run({ keys, usage: newUsage(), models }, next);
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Cho tab Cài đặt biết thư mục kiến thức nào đã có file
  app.get('/api/knowledge-status', (_req, res) => {
    res.json(knowledgeStatus());
  });

  // Kiểm tra từng key (tab Cài đặt): thử model Flash-Lite, và thử cả model Pro để biết key có dùng được Pro không
  app.post('/api/test-key', async (req, res) => {
    const key = String(req.body?.key || '').trim();
    if (!key) return res.status(400).json({ error: 'Thiếu key.' });
    const friendly = (e: any) => {
      const raw = String(e?.message || '');
      if (/api key not valid|api_key_invalid|unauthenticated/i.test(raw)) return 'Key không hợp lệ.';
      if (/limit: 0/i.test(raw)) return 'Không có ở bậc của key này.';
      if (/quota|resource_exhausted|429/i.test(raw)) return 'Đang hết lượt.';
      return raw.slice(0, 160) || 'Lỗi.';
    };
    try {
      await testKey(key, 'gemini-3.1-flash-lite');
    } catch (e: any) {
      return res.status(400).json({ error: friendly(e) });
    }
    let pro = 'ok';
    try {
      await testKey(key, 'gemini-3.1-pro-preview');
    } catch (e: any) {
      pro = friendly(e);
    }
    res.json({ ok: true, pro });
  });

  // Danh sách thể loại (knowledge/the-loai/*.md)
  app.get('/api/genres', (_req, res) => {
    try {
      res.json({ genres: listGenres() });
    } catch (e: any) {
      res.status(500).json({ error: `Không đọc được thư mục thể loại: ${e?.message || e}` });
    }
  });

  // Nhật ký lời gọi AI (tab Cài đặt)
  app.get('/api/logs', (_req, res) => res.json({ logs: listLogs() }));
  app.get('/api/logs/:id', (req, res) => {
    const log = getLog(req.params.id);
    if (!log) return res.status(404).json({ error: 'Không tìm thấy nhật ký (server đã khởi động lại?).' });
    res.json({ log });
  });

  // Mọi tác vụ AI của 8 màn: /api/task/<mã tác vụ>, body { input, projectId }
  app.post('/api/task/:id', async (req, res) => {
    const id = String(req.params.id || '');
    const def = Object.prototype.hasOwnProperty.call(TASK_DEFS, id) ? TASK_DEFS[id] : undefined;
    if (!def) return res.status(404).json({ error: `Không có tác vụ "${id}".` });
    // Đầu vào sai → 400, báo ngay, không gọi AI
    try {
      const input = def.parseInput(req.body?.input);
      const gid = def.genreId(input);
      if (gid && !nodeDeps.loadGenre(gid)) throw new Error(`Không tìm thấy file thể loại "${gid}" trong knowledge/the-loai/.`);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'Đầu vào không hợp lệ.' });
    }
    const projectId = String(req.body?.projectId || '').slice(0, 80);
    return route('Tác vụ AI lỗi', () => runTask(def, req.body?.input, projectId, nodeDeps))(req, res);
  });

  // Bước Nhân vật & đạo cụ cũ (tạm ở màn ⑥, làm lại ở lượt 3)
  app.post('/api/design', route('Không tạo được thiết kế', async (req) => {
    const r = validateDesign(req.body);
    const raw = await askJson(buildDesignPrompt(r), DESIGN_SCHEMA, 0.7, 'design');
    const allowed = new Set([...r.characters, ...r.props].map((s) => s.tag));
    return { design: normalizeDesign(raw, allowed) };
  }));

  // Bước 4 — quét ảnh người dùng gửi về, gán @tag
  app.post('/api/match-images', route('Không quét được ảnh', async (req) => {
    const { images, tags } = validateMatch(req.body);
    const raw = await askJson(buildMatchParts(images, tags), MATCH_SCHEMA, 0.2, 'match');
    return { matches: normalizeMatches(raw, images.length, tags) };
  }));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Xưởng phim AI chạy tại http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Không khởi động được server:', err);
  process.exit(1);
});
