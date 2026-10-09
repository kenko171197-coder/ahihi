// Ô nhập dạng danh sách cho kịch bản: gõ tự do, rời ô mới ghi (để dòng đang gõ dở không bị mất).
import React, { useEffect, useRef, useState } from 'react';
import { fieldCls } from '../common';

/** Ô chữ giữ bản đang gõ; rời ô thì gọi commit. Dữ liệu bên ngoài đổi (khi không gõ) thì cập nhật lại. */
function useCommitText(external: string, commit: (t: string) => void) {
  const [text, setText] = useState(external);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(external);
  }, [external]);
  return {
    value: text,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setText(e.target.value),
    onFocus: () => {
      focused.current = true;
    },
    onBlur: () => {
      focused.current = false;
      if (text !== external) commit(text);
    },
  };
}

interface LinesProps<T> {
  label: string;
  value: T[];
  toText: (v: T[]) => string;
  parse: (text: string) => T[];
  onChange: (v: T[]) => void;
  rows?: number;
  hint?: string;
  placeholder?: string;
}

/** Danh sách nhiều dòng (trạng thái, đạo cụ, thay đổi, thoại…). */
export function LinesField<T>({ label, value, toText, parse, onChange, rows = 2, hint, placeholder }: LinesProps<T>) {
  const id = React.useId();
  const p = useCommitText(toText(value), (t) => onChange(parse(t)));
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-gray-600 mb-1">
        {label}
      </label>
      <textarea id={id} rows={rows} placeholder={placeholder} className={fieldCls} {...p} />
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

/** Danh sách tag trên một dòng: "@lan @thungxop". */
export function TagsField({ label, value, onChange, parse, hint }: { label: string; value: string[]; onChange: (v: string[]) => void; parse: (t: string) => string[]; hint?: string }) {
  const id = React.useId();
  const p = useCommitText(value.map((t) => `@${t}`).join(' '), (t) => onChange(parse(t)));
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-gray-600 mb-1">
        {label}
      </label>
      <input id={id} className={fieldCls} {...p} />
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
