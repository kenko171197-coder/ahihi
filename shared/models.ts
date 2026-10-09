// Danh mục model + bảng giá (USD / 1 triệu token, bậc trả phí, xử lý thường).
// Nguồn: bảng giá Gemini API cập nhật tháng 9/2026. Giá 3.6/3.7/3.8 Flash là giá khuyến mãi tới 31/12/2026,
// từ 1/1/2027 tăng gấp đôi ($1.50 / $7.50). Google đổi giá thường xuyên — kiểm tra lại trên trang giá chính thức.
// Dùng chung cho server (chọn model) và giao diện (bảng chọn + ước tính chi phí).

export type ModelStatus = 'active' | 'retiring' | 'shutdown';

export interface ModelInfo {
  id: string;
  name: string;
  group: 'flash' | 'pro' | 'special';
  /** Giá theo token (USD / 1M). Không có = tính theo ảnh/giây, xem priceNote */
  input?: number;
  cached?: number;
  output?: number;
  priceNote?: string;
  status: ModelStatus;
  /** Dùng được cho các tác vụ viết chữ / JSON / đọc ảnh của app */
  text: boolean;
  note: string;
}

export const MODEL_CATALOG: ModelInfo[] = [
  // ---------- Flash & Flash-Lite ----------
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', group: 'flash', input: 0.75, cached: 0.075, output: 3.75, status: 'active', text: true, note: 'Flash mới nhất, mạnh ở việc dài nhiều luật. Giá khuyến mãi tới 31/12/2026, sau đó $1.50 / $7.50' },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', group: 'flash', input: 0.75, cached: 0.075, output: 3.75, status: 'active', text: true, note: 'Cùng giá 3.8, thiên về lập trình' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', group: 'flash', input: 0.75, cached: 0.075, output: 3.75, status: 'active', text: true, note: 'Cùng giá 3.8' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', group: 'flash', input: 1.5, cached: 0.15, output: 9, status: 'active', text: true, note: 'Đắt hơn 3.8 mà không mạnh hơn cho việc của app' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', group: 'flash', input: 0.3, cached: 0.03, output: 2.5, status: 'active', text: true, note: 'Flash-Lite mới nhất' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', group: 'flash', input: 0.25, cached: 0.025, output: 1.5, status: 'active', text: true, note: 'Rẻ nhất thế hệ hiện tại — hợp việc đơn giản' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', group: 'flash', input: 0.1, cached: 0.01, output: 0.4, status: 'retiring', text: true, note: 'Rẻ nhất, nhưng dự kiến ngừng 16/10/2026; chỉ mở cho tài khoản đã từng dùng' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', group: 'flash', input: 0.1, output: 0.4, status: 'shutdown', text: true, note: 'Đã ngừng từ 1/6/2026' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', group: 'flash', status: 'shutdown', text: true, note: 'Đã ngừng (báo lỗi 404)' },
  { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B', group: 'flash', status: 'shutdown', text: true, note: 'Đã ngừng (báo lỗi 404)' },
  // ---------- Pro ----------
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', group: 'pro', input: 2, cached: 0.2, output: 12, status: 'active', text: true, note: 'Mạnh nhất. Chỉ bậc trả phí. Prompt trên 200K token: $4 / $18' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', group: 'pro', input: 1.25, cached: 0.125, output: 10, status: 'retiring', text: true, note: 'Dự kiến ngừng 16/10/2026' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', group: 'pro', status: 'shutdown', text: true, note: 'Đã ngừng (báo lỗi 404)' },
  // ---------- Chuyên biệt (không dùng cho tác vụ viết chữ của app) ----------
  { id: 'gemini-3.1-flash-image', name: 'Nano Banana 2 (3.1 Flash Image)', group: 'special', status: 'active', text: false, priceNote: '$0.045–0.151 / ảnh (1K: $0.067)', note: 'Tạo ảnh — dùng tạo ảnh nhân vật, đạo cụ, khung cuối' },
  { id: 'gemini-3-pro-image-preview', name: 'Nano Banana Pro (3 Pro Image)', group: 'special', status: 'active', text: false, priceNote: '$0.134 / ảnh 1K–2K, $0.24 / ảnh 4K', note: 'Ảnh chất lượng cao nhất' },
  { id: 'gemini-3.1-flash-lite-image', name: '3.1 Flash-Lite Image', group: 'special', status: 'active', text: false, priceNote: '$0.0336 / ảnh 1K', note: 'Tạo ảnh rẻ và nhanh' },
  { id: 'gemini-3.1-flash-tts-preview', name: '3.1 Flash TTS', group: 'special', status: 'active', text: false, priceNote: '$1 / 1M token chữ vào, $20 / 1M token âm thanh ra', note: 'Chuyển chữ thành giọng nói' },
  { id: 'gemini-3.1-flash-live-preview', name: '3.1 Flash Live', group: 'special', status: 'active', text: false, priceNote: 'Xem trang giá Live API', note: 'Hội thoại giọng nói thời gian thực' },
  { id: 'gemini-3.8-live', name: '3.8 Live', group: 'special', status: 'active', text: false, priceNote: 'Xem trang giá Live API', note: 'Hội thoại giọng nói thời gian thực' },
  { id: 'veo-3.1-lite-generate-preview', name: 'Veo 3.1 Lite', group: 'special', status: 'active', text: false, priceNote: '~$0.05–0.08 / giây video', note: 'Tạo video qua API (rẻ nhất dòng Veo)' },
];

/** Các tác vụ của app và model mặc định (đánh giá: việc khó giữ 3.8 Flash, việc xương sống dùng Pro, việc đơn giản dùng Flash-Lite). */
export const TASKS: { key: string; label: string; model: string; why: string }[] = [
  { key: 'hoi-lai', label: '① Hỏi lại cho rõ ý tưởng', model: 'gemini-3.8-flash', why: 'Việc nhẹ, cần hiểu ý tưởng' },
  { key: 'logline', label: '① Đề xuất logline', model: 'gemini-3.8-flash', why: 'Cần sáng tạo' },
  { key: 'nhan-vat', label: '② Nhân vật', model: 'gemini-3.8-flash', why: 'Cần sáng tạo, bám brief' },
  { key: 'treatment', label: '③ Treatment', model: 'gemini-3.1-pro-preview', why: 'Xương sống câu chuyện, nhiều ràng buộc về giây; key không có Pro thì tự lùi về Flash' },
  { key: 'dan-y-canh', label: '④ Dàn ý cảnh', model: 'gemini-3.1-pro-preview', why: 'Chia cả phim thành cảnh, nhiều ràng buộc về giây và Cài – Dùng; key không có Pro thì tự lùi về Flash' },
  { key: 'viet-canh', label: '④ Viết beat từng cảnh', model: 'gemini-3.8-flash', why: 'Gọi một lần mỗi cảnh (phim dài 30–40 lần), cần sáng tạo và giữ luật' },
  { key: 'ra-soat', label: '⑤ Rà soát', model: 'gemini-3.1-pro-preview', why: 'Đọc cả kịch bản và chấm, cần phán đoán tốt' },
  { key: 'design', label: '⑥ Thiết kế nhân vật & đạo cụ (bản tạm)', model: 'gemini-3.8-flash', why: 'Prompt ảnh quyết định nhân vật có đồng nhất hay không' },
  { key: 'match', label: '⑥ Quét ảnh gán @tag', model: 'gemini-3.1-flash-lite', why: 'So ảnh với mô tả, bạn duyệt lại' },
  { key: 'testkey', label: 'Kiểm tra key', model: 'gemini-3.1-flash-lite', why: 'Chỉ gọi thử' },
];

export type TaskKey = string;

export const modelInfo = (id: string) => MODEL_CATALOG.find((m) => m.id === id);

export const selectableModels = () => MODEL_CATALOG.filter((m) => m.text && m.status !== 'shutdown');

/** Chuỗi dự phòng khi model chọn hết quota / lỗi: luôn có Flash mạnh rồi Flash-Lite. */
export const FALLBACK_CHAIN = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

/** Chi phí USD cho một lượng token trên một model (phần cached tính giá cached). */
export function costOf(modelId: string, input: number, output: number, cached: number): number {
  const m = modelInfo(modelId);
  if (!m || m.input === undefined || m.output === undefined) return 0;
  const fresh = Math.max(0, input - cached);
  return (fresh * m.input + cached * (m.cached ?? m.input) + output * m.output) / 1_000_000;
}
