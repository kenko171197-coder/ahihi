// Dán ảnh từ bộ nhớ tạm (clipboard) — máy tính (Ctrl/Cmd+V) và điện thoại (nút "Dán ảnh").
// Ảnh dán ra một File bình thường, đi tiếp đúng đường xử lý của ảnh tải lên.

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

function toFile(blob: Blob, i: number): File {
  const type = blob.type || 'image/png';
  return new File([blob], `anh-dan-${Date.now()}-${i + 1}.${EXT[type] || 'png'}`, { type });
}

/** Ảnh trong một sự kiện paste (Ctrl/Cmd+V). */
export function imagesFromClipboardData(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files: File[] = [];
  Array.from(data.items || []).forEach((item, i) => {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) files.push(f.name && f.name !== 'image.png' ? f : toFile(f, i));
    }
  });
  if (!files.length) Array.from(data.files || []).forEach((f) => f.type.startsWith('image/') && files.push(f));
  return files;
}

/** Trình duyệt có hỗ trợ nút "Dán ảnh" (đọc bộ nhớ tạm theo yêu cầu) không. */
export const canReadClipboard = () => typeof navigator !== 'undefined' && !!navigator.clipboard && typeof navigator.clipboard.read === 'function';

/**
 * Nút "Dán ảnh": đọc ảnh trong bộ nhớ tạm. Phải gọi ngay trong lúc người dùng bấm.
 * iPhone hiện bong bóng "Dán" để xác nhận; Android hỏi quyền lần đầu.
 */
export async function readClipboardImages(): Promise<File[]> {
  if (!canReadClipboard()) {
    throw new Error('Trình duyệt này chưa hỗ trợ nút Dán ảnh. Trên máy tính, bấm vào vùng ảnh rồi nhấn Ctrl+V (Mac: ⌘V); hoặc dùng nút gửi ảnh.');
  }
  let items: ClipboardItems;
  try {
    items = await navigator.clipboard.read();
  } catch (e: any) {
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
      throw new Error('Trình duyệt chưa cho đọc bộ nhớ tạm. Cho phép quyền "Bộ nhớ tạm" cho trang này, hoặc mở app ở tab riêng (khung xem trước có thể chặn quyền).');
    }
    if (e?.name === 'DataError' || e?.name === 'NotFoundError') throw new Error('Bộ nhớ tạm chưa có ảnh. Hãy sao chép một ảnh trước.');
    throw new Error('Không đọc được bộ nhớ tạm. Thử lại, hoặc dùng nút gửi ảnh.');
  }
  const files: File[] = [];
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'));
    if (type) files.push(toFile(await item.getType(type), files.length));
  }
  if (!files.length) throw new Error('Bộ nhớ tạm chưa có ảnh (chỉ có chữ hoặc trống). Hãy sao chép một ảnh trước.');
  return files;
}

/** Đang gõ chữ trong ô nhập → để trình duyệt dán chữ như thường, không bắt ảnh. */
export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'TEXTAREA' || (tag === 'INPUT' && (el as HTMLInputElement).type !== 'file') || (el as HTMLElement).isContentEditable;
}
