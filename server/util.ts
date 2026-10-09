// Tiện ích dùng chung cho các bước.

/** "Chó Cái" → "chocai": viết liền, không dấu, chữ thường, tối đa 15 ký tự (khớp app Đạo diễn). */
export function toTag(input: string): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 15);
}

export const str = (v: unknown, max = 60000) => String(v ?? '').trim().slice(0, max);
