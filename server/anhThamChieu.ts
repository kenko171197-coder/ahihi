// Màn ⑥ — quét ảnh tham chiếu người dùng gửi về, gán @tag (nhân vật / bộ đồ, đạo cụ, bối cảnh).
// Gọi AI kèm ảnh nên không đi qua khung tác vụ chữ (server/tasks/framework.ts).
import { Type } from '@google/genai';
import { toTag } from './util';

const str = (v: unknown) => String(v ?? '').trim();

/* ============ Quét ảnh, gán @tag ============ */

export interface MatchImage {
  mime: string;
  data: string; // base64, không kèm tiền tố data:
}

export type MatchKind = 'character' | 'prop' | 'location';
const KIND_LABEL: Record<MatchKind, string> = { character: 'nhân vật', prop: 'đạo cụ', location: 'bối cảnh' };

export interface MatchTag {
  tag: string;
  kind: MatchKind;
  note: string;
  description: string;
}

export function validateMatch(body: any): { images: MatchImage[]; tags: MatchTag[] } {
  const images = (Array.isArray(body?.images) ? body.images : [])
    .filter((i: any) => i && typeof i.data === 'string' && i.data.length > 100)
    .slice(0, 10)
    .map((i: any) => ({ mime: /^image\/(png|jpeg|webp)$/.test(i.mime) ? i.mime : 'image/jpeg', data: i.data }));
  if (!images.length) throw new Error('Chưa có ảnh nào để quét.');
  const tags = (Array.isArray(body?.tags) ? body.tags : [])
    .map((t: any) => ({
      tag: toTag(t.tag),
      kind: (t.kind === 'prop' || t.kind === 'location' ? t.kind : 'character') as MatchKind,
      note: str(t.note),
      description: str(t.description),
    }))
    .filter((t: MatchTag) => t.tag);
  if (!tags.length) throw new Error('Dự án chưa có @tag nào để gán ảnh.');
  return { images, tags };
}

export function buildMatchParts(images: MatchImage[], tags: MatchTag[]) {
  const list = tags
    .map((t) => `- @${t.tag} (${KIND_LABEL[t.kind]}): ${t.note}${t.description ? ` | ${t.description}` : ''}`)
    .join('\n');

  const parts: any[] = [
    {
      text: `Bạn là Trợ lý đạo diễn. Người dùng gửi ${images.length} ảnh tham chiếu vừa tạo. Với MỖI ảnh:
1. Xác nhận ngắn những gì thấy được: người hay vật hay không gian, tỉ lệ, màu, trang phục, kích thước tương đối, thời điểm và ánh sáng (với bối cảnh), có chữ đọc được không.
2. Gán ảnh cho @tag khớp nhất trong danh sách dưới đây và cho điểm tự tin 0–100. Không khớp tag nào thì để tag rỗng và điểm 0. Cùng một nhân vật có thể có nhiều bộ đồ (nhiều tag): chọn tag theo TRANG PHỤC. Cùng một địa điểm có thể có nhiều tag theo thời điểm: chọn theo ÁNH SÁNG / GIỜ trong ảnh.
3. Báo vấn đề trong "warning": chữ, logo trên đồ vật hoặc trong bối cảnh; có người trong ảnh bối cảnh; lệch mô tả.
Ảnh nhân vật có thể là ảnh một góc hoặc bảng reference sheet nhiều ô — cả hai đều hợp lệ.

DANH SÁCH @TAG ĐANG CHỜ ẢNH:
${list}

Ảnh được đánh số theo thứ tự gửi, bắt đầu từ 0.`,
    },
  ];
  images.forEach((img, i) => {
    parts.push({ text: `Ảnh số ${i}:` });
    parts.push({ inlineData: { mimeType: img.mime, data: img.data } });
  });
  return parts;
}

export const MATCH_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      index: { type: Type.INTEGER },
      tag: { type: Type.STRING, description: 'Tag khớp nhất, không kèm @; rỗng nếu không khớp' },
      confidence: { type: Type.INTEGER },
      seen: { type: Type.STRING, description: 'Những gì thấy được trong ảnh, 1–2 câu tiếng Việt' },
      warning: { type: Type.STRING, description: 'Vấn đề cần báo (chữ trên vật, lệch mô tả…), rỗng nếu không có' },
    },
    required: ['index', 'tag', 'confidence', 'seen', 'warning'],
  },
};

export function normalizeMatches(raw: any, imageCount: number, tags: MatchTag[]) {
  const valid = new Set(tags.map((t) => t.tag));
  const out = Array.from({ length: imageCount }, (_, i) => ({ index: i, tag: '', confidence: 0, seen: '', warning: '' }));
  (Array.isArray(raw) ? raw : []).forEach((m: any) => {
    const i = Number(m?.index);
    if (!Number.isInteger(i) || i < 0 || i >= imageCount) return;
    const tag = toTag(m.tag);
    out[i] = {
      index: i,
      tag: valid.has(tag) ? tag : '',
      confidence: valid.has(tag) ? Math.min(Math.max(Math.round(Number(m.confidence) || 0), 0), 100) : 0,
      seen: str(m.seen),
      warning: str(m.warning),
    };
  });
  return out;
}
