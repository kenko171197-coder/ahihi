// Khuôn prompt rất nhỏ cho các file trong prompts/.
//   {{ten}}                → thay bằng giá trị (rỗng nếu không có)
//   {{#ten}} … {{/ten}}    → chỉ giữ khối khi giá trị không rỗng
//   {{^ten}} … {{/ten}}    → chỉ giữ khối khi giá trị rỗng
// Dòng bắt đầu bằng "<!--" … "-->" là ghi chú cho người sửa file, bị bỏ khi gửi AI.

export type Vars = Record<string, string | number | undefined | null>;

const isEmpty = (v: unknown) => v === undefined || v === null || String(v).trim() === '';

export function render(template: string, vars: Vars): string {
  let out = template.replace(/<!--[\s\S]*?-->\n?/g, '');
  // Khối điều kiện (lồng một tầng là đủ cho các file prompt)
  out = out.replace(/\{\{([#^])([\w.-]+)\}\}([\s\S]*?)\{\{\/\2\}\}/g, (_m, kind: string, name: string, body: string) => {
    const empty = isEmpty(vars[name]);
    return (kind === '#' ? !empty : empty) ? body : '';
  });
  out = out.replace(/\{\{([\w.-]+)\}\}/g, (_m, name: string) => (isEmpty(vars[name]) ? '' : String(vars[name])));
  // Gọn dòng trống thừa do khối bị bỏ
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/** Tên biến dùng trong khuôn (để test: file prompt không gọi biến lạ). */
export function varsIn(template: string): string[] {
  const names = new Set<string>();
  const re = /\{\{[#^/]?([\w.-]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template.replace(/<!--[\s\S]*?-->/g, '')))) names.add(m[1]);
  return Array.from(names);
}
