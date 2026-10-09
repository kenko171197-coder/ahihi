// Thiết kế nhân vật & đạo cụ, và quét ảnh người dùng gửi về để gán @tag.
// Không còn phụ thuộc đề cương / kịch bản cũ: đầu vào là phần tóm tắt + danh sách nhân vật, đạo cụ do người dùng nhập.
import { Type } from '@google/genai';
import { knowledgeDir } from './knowledge';
import { toTag } from './util';

// Mẫu Character Reference Sheet. App tự ghép, không để AI chép lại.
export const SHEET_TEMPLATE = `A professional character reference sheet, 4x2 grid layout, pure white background, high resolution. The subject is a single consistent character in all panels. Studio lighting, sharp focus, no text.
Top Row: 1. Front view of the head. 2. Side profile of the head. 3. Back view of the head. 4. Top-down view of the head.
Bottom Row: 1. Full-body front view. 2. Full-body side view. 3. Full-body back view. 4. Close-up of both hands and forearms.
Character details: `;

// Câu kết bắt buộc của prompt đạo cụ.
export const PROP_SUFFIX = 'no text, no letters, no logos, no engraving or writing on the surface';

export interface Seed {
  tag: string;
  name: string;
  brief: string;
}

export interface DesignRequest {
  synopsis: string;
  style: string;
  aspect: string;
  characters: Seed[];
  props: Seed[];
}

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

export function validateDesign(body: any): DesignRequest {
  const seeds = (list: unknown, max: number): Seed[] => {
    const seen = new Set<string>();
    return (Array.isArray(list) ? list : [])
      .map((x: any) => ({ name: clean(x?.name, 60), brief: clean(x?.brief, 800), tag: toTag(x?.name) }))
      .filter((s) => s.tag && !seen.has(s.tag) && (seen.add(s.tag), true))
      .slice(0, max);
  };
  const characters = seeds(body?.characters, 12);
  const props = seeds(body?.props, 20);
  if (!characters.length && !props.length) throw new Error('Chưa có nhân vật hay đạo cụ nào để thiết kế. Thêm ít nhất một dòng.');
  return {
    synopsis: clean(body?.synopsis, 8000),
    style: clean(body?.style, 600),
    aspect: body?.aspect === '9:16' ? '9:16' : '16:9',
    characters,
    props,
  };
}

const seedLines = (list: Seed[]) => list.map((s) => `- tag "${s.tag}" — ${s.name}${s.brief ? `: ${s.brief}` : ''}`).join('\n') || '(không có)';

export function buildDesignPrompt(r: DesignRequest): string {
  return `VAI TRÒ
Bạn là Thiết kế nhân vật, chạy bên trong một app có nút bấm: không hỏi lại, không chào hỏi, không kết bằng câu hỏi. Viết tiếng Việt; prompt ảnh viết tiếng Anh.

===== QUY TẮC THIẾT KẾ (NGUYÊN VĂN) =====
${knowledgeDir('buoc-4-nhan-vat')}

===== PHẦN TÓM TẮT CÂU CHUYỆN =====
${r.synopsis || '(người dùng chưa nhập — dựa vào mô tả từng nhân vật, đạo cụ)'}

Style chung: ${r.style || '(chưa chốt — chọn một style hợp với câu chuyện và dùng NGUYÊN VĂN cho mọi prompt ảnh)'}
Tỉ lệ khung của phim: ${r.aspect}

===== NHÂN VẬT CẦN THIẾT KẾ =====
${seedLines(r.characters)}

===== ĐẠO CỤ CẦN THIẾT KẾ (trạng thái gốc) =====
${seedLines(r.props)}

===== NHIỆM VỤ =====
Thiết kế MỌI nhân vật và MỌI đạo cụ ở trên, đúng tag đã cho (giữ nguyên từng ký tự).
- "note" = "Mô tả ngắn cho ô Note": 1–2 câu tiếng Việt, chỉ đặc điểm nhìn thấy được. Bắt buộc.
- Nhân vật: "standardPrompt" là Standard Image Prompt một góc chính, tiếng Anh, có style. "details" là toàn bộ mô tả nhân vật bằng tiếng Anh để app ghép vào cuối mẫu Character Reference Sheet (KHÔNG chép lại mẫu).
- Đạo cụ: kích thước NEO VÀO CƠ THỂ nhân vật; "imagePrompt" tiếng Anh, nền trắng, ánh sáng studio, sắc nét, và kết bằng đúng cụm: ${PROP_SUFFIX}
- Nhân vật có tỉ lệ kích thước với nhau thì ghi rõ trong mô tả.
- Tả điều MUỐN THẤY bằng câu khẳng định.`;
}

export const DESIGN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tag: { type: Type.STRING },
          age: { type: Type.STRING },
          personality: { type: Type.STRING, description: 'Chép từ 1.3' },
          appearance: { type: Type.STRING },
          outfit: { type: Type.STRING },
          expression: { type: Type.STRING, description: 'Biểu cảm mặc định' },
          note: { type: Type.STRING, description: 'Mô tả ngắn cho ô Note' },
          standardPrompt: { type: Type.STRING },
          details: { type: Type.STRING },
        },
        required: ['tag', 'age', 'personality', 'appearance', 'outfit', 'expression', 'note', 'standardPrompt', 'details'],
      },
    },
    props: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tag: { type: Type.STRING },
          description: { type: Type.STRING, description: 'Hình dáng, chất liệu, màu, kích thước neo vào cơ thể nhân vật' },
          note: { type: Type.STRING, description: 'Mô tả ngắn cho ô Note' },
          imagePrompt: { type: Type.STRING },
        },
        required: ['tag', 'description', 'note', 'imagePrompt'],
      },
    },
  },
  required: ['characters', 'props'],
};

const str = (v: unknown) => String(v ?? '').trim();

export function normalizeDesign(raw: any, allowed?: Set<string>) {
  if (!raw) throw new Error('Gemini không trả về thiết kế.');
  const characters = (Array.isArray(raw.characters) ? raw.characters : [])
    .map((c: any) => {
      const details = str(c.details);
      return {
        tag: toTag(c.tag),
        age: str(c.age),
        personality: str(c.personality),
        appearance: str(c.appearance),
        outfit: str(c.outfit),
        expression: str(c.expression),
        note: str(c.note),
        standardPrompt: str(c.standardPrompt),
        sheetPrompt: SHEET_TEMPLATE + details,
      };
    })
    .filter((c: any) => c.tag && (!allowed || allowed.has(c.tag)));

  const props = (Array.isArray(raw.props) ? raw.props : [])
    .map((p: any) => {
      let prompt = str(p.imagePrompt).replace(/[.\s]+$/, '');
      if (!prompt.toLowerCase().includes('no engraving or writing on the surface')) {
        prompt = `${prompt}, ${PROP_SUFFIX}`;
      }
      return { tag: toTag(p.tag), description: str(p.description), note: str(p.note), imagePrompt: prompt };
    })
    .filter((p: any) => p.tag && (!allowed || allowed.has(p.tag)));

  if (!characters.length && !props.length) throw new Error('Gemini không trả về nhân vật hay đạo cụ nào.');
  return { characters, props };
}

/* ============ Quét ảnh, gán @tag ============ */

export interface MatchImage {
  mime: string;
  data: string; // base64, không kèm tiền tố data:
}

export interface MatchTag {
  tag: string;
  kind: 'character' | 'prop';
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
      kind: t.kind === 'prop' ? 'prop' : 'character',
      note: str(t.note),
      description: str(t.description),
    }))
    .filter((t: MatchTag) => t.tag);
  if (!tags.length) throw new Error('Dự án chưa có @tag nào để gán ảnh.');
  return { images, tags };
}

export function buildMatchParts(images: MatchImage[], tags: MatchTag[]) {
  const list = tags
    .map((t) => `- @${t.tag} (${t.kind === 'prop' ? 'đạo cụ' : 'nhân vật'}): ${t.note}${t.description ? ` | ${t.description}` : ''}`)
    .join('\n');

  const parts: any[] = [
    {
      text: `Bạn là Trợ lý đạo diễn. Người dùng gửi ${images.length} ảnh tham chiếu vừa tạo. Với MỖI ảnh:
1. Xác nhận ngắn những gì thấy được: giống loài/người, tỉ lệ, màu, trang phục, kích thước tương đối, có chữ trên thân vật không (chữ là lỗi với ảnh đạo cụ).
2. Gán ảnh cho @tag khớp nhất trong danh sách dưới đây và cho điểm tự tin 0–100. Không khớp tag nào thì để tag rỗng và điểm 0.
Ảnh có thể là ảnh một góc hoặc bảng reference sheet nhiều ô — cả hai đều hợp lệ.

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
