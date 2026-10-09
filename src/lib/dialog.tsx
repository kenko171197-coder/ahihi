// Hộp thoại của app — thay window.confirm / window.alert.
// Lý do: trong khung xem trước của AI Studio (iframe), hộp thoại của trình duyệt có thể bị chặn và
// confirm() tự trả về "Huỷ" mà không hiện gì → các nút cần xác nhận "bấm không chạy".
import React, { useEffect, useState } from 'react';

interface DialogRequest {
  id: number;
  title?: string;
  message: string;
  okLabel: string;
  cancelLabel?: string; // không có → chỉ là thông báo
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

let queue: DialogRequest[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/** Hỏi xác nhận. Trả về true nếu người dùng đồng ý. */
export function askConfirm(
  message: string,
  opts: { title?: string; okLabel?: string; cancelLabel?: string; danger?: boolean } = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    queue = [
      ...queue,
      { id: ++seq, message, title: opts.title, okLabel: opts.okLabel || 'Đồng ý', cancelLabel: opts.cancelLabel || 'Huỷ', danger: opts.danger, resolve },
    ];
    emit();
  });
}

/** Thông báo (chỉ có nút Đóng). */
export function notify(message: string, title?: string): Promise<void> {
  return new Promise((resolve) => {
    queue = [...queue, { id: ++seq, message, title, okLabel: 'Đã hiểu', resolve: () => resolve() }];
    emit();
  });
}

/** Đặt một lần trong App. */
export function DialogHost() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((x) => x + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  const d = queue[0];
  if (!d) return null;
  const close = (ok: boolean) => {
    queue = queue.slice(1);
    emit();
    d.resolve(ok);
  };
  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={`dlg-${d.id}`}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
        {d.title && (
          <h2 id={`dlg-${d.id}`} className="font-bold text-lg text-black">
            {d.title}
          </h2>
        )}
        <p id={d.title ? undefined : `dlg-${d.id}`} className="text-sm text-gray-800 whitespace-pre-wrap">
          {d.message}
        </p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          {d.cancelLabel && (
            <button onClick={() => close(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-700 hover:border-primary-400">
              {d.cancelLabel}
            </button>
          )}
          <button
            autoFocus
            onClick={() => close(true)}
            className={`px-4 py-2.5 rounded-xl font-bold ${d.danger ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-black text-primary-400 hover:bg-gray-800'}`}
          >
            {d.okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
