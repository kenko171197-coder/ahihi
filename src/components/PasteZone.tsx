// Vùng nhận ảnh dán: bấm vào vùng (sáng viền) rồi nhấn Ctrl/Cmd+V → ảnh vào ĐÚNG vùng đó.
// Nút "Dán ảnh" dùng cho điện thoại (và cho ai không quen phím tắt).
import React, { useEffect, useRef, useState } from 'react';
import { ClipboardPaste, Loader2 } from 'lucide-react';
import { imagesFromClipboardData, isTypingTarget, readClipboardImages } from '../lib/clipboardImage';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const PASTE_KEYS = isMac ? '⌘V' : 'Ctrl+V';

interface ZoneProps {
  onFiles: (files: File[]) => void;
  onError?: (message: string) => void;
  /** Nhận nhiều ảnh một lần (mặc định chỉ lấy ảnh đầu) */
  multiple?: boolean;
  disabled?: boolean;
  /** Kéo thả ảnh vào vùng (tắt nếu vùng đã có kéo thả riêng) */
  drop?: boolean;
  /** Tên vùng cho trình đọc màn hình, VD "ảnh @bap" */
  label: string;
  as?: 'div' | 'li' | 'section';
  className?: string;
  children: React.ReactNode;
}

export function PasteZone({ onFiles, onError, multiple, disabled, drop = true, label, as = 'div', className = '', children }: ZoneProps) {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  const [dragging, setDragging] = useState(false);
  const latest = useRef({ onFiles, onError, multiple, disabled });
  latest.current = { onFiles, onError, multiple, disabled };

  // Bắt Ctrl/Cmd+V ở cả trang, nhưng chỉ nhận khi vùng TRONG CÙNG đang được chọn chính là vùng này
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = document.activeElement;
      if (!ref.current || el?.closest('[data-paste-zone]') !== ref.current) return;
      if (isTypingTarget(el)) return;
      const { onFiles: give, onError: fail, multiple: many, disabled: off } = latest.current;
      if (off) return;
      const files = imagesFromClipboardData(e.clipboardData);
      e.preventDefault();
      if (!files.length) {
        fail?.('Bộ nhớ tạm chưa có ảnh. Hãy sao chép một ảnh rồi dán lại.');
        return;
      }
      give(many ? files : [files[0]]);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  const Tag = as as any;
  return (
    <Tag
      ref={ref}
      data-paste-zone=""
      tabIndex={disabled ? -1 : 0}
      role={as === 'li' ? undefined : 'group'}
      aria-label={`Vùng ${label} — bấm chọn rồi nhấn ${PASTE_KEYS} để dán ảnh`}
      onPointerDown={(e: React.PointerEvent) => {
        // Bấm bất kỳ đâu trong vùng (trừ ô gõ chữ) → chọn vùng này để Ctrl/Cmd+V dán vào đây
        if (!disabled && !isTypingTarget(e.target as Element)) ref.current?.focus({ preventScroll: true });
      }}
      onFocus={() => setActive(true)}
      onBlur={(e: React.FocusEvent) => {
        if (!ref.current?.contains(e.relatedTarget as Node)) setActive(false);
      }}
      onDragOver={
        drop
          ? (e: React.DragEvent) => {
              if (disabled) return;
              e.preventDefault();
              e.stopPropagation(); // vùng trong cùng nhận, vùng bọc ngoài không nhận trùng
              setDragging(true);
            }
          : undefined
      }
      onDragLeave={drop ? () => setDragging(false) : undefined}
      onDrop={
        drop
          ? (e: React.DragEvent) => {
              if (disabled) return;
              e.preventDefault();
              e.stopPropagation();
              setDragging(false);
              const files = (Array.from(e.dataTransfer.files || []) as File[]).filter((f) => f.type.startsWith('image/'));
              if (files.length) onFiles(multiple ? files : [files[0]]);
            }
          : undefined
      }
      className={`${className} outline-none transition-shadow ${active && !disabled ? 'ring-2 ring-primary-400 ring-offset-2' : ''} ${dragging ? 'ring-2 ring-primary-400 bg-primary-50' : ''}`}
    >
      {children}
      {active && !disabled && (
        <p className="text-xs text-primary-800 mt-1.5" aria-hidden="true">
          Nhấn {PASTE_KEYS} để dán ảnh vào đây
        </p>
      )}
    </Tag>
  );
}

interface ButtonProps {
  onFiles: (files: File[]) => void;
  onError?: (message: string) => void;
  multiple?: boolean;
  disabled?: boolean;
  /** Chỉ hiện biểu tượng */
  iconOnly?: boolean;
  label?: string;
  className?: string;
}

/** Nút "Dán ảnh": đọc ảnh trong bộ nhớ tạm (iPhone hiện bong bóng "Dán" để xác nhận). */
export function PasteButton({ onFiles, onError, multiple, disabled, iconOnly, label = 'Dán ảnh', className }: ButtonProps) {
  const [reading, setReading] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        setReading(true);
        try {
          const files = await readClipboardImages();
          onFiles(multiple ? files : [files[0]]);
        } catch (e: any) {
          onError?.(e.message);
        } finally {
          setReading(false);
        }
      }}
      disabled={disabled || reading}
      title={`${label} từ bộ nhớ tạm (máy tính: bấm vào vùng ảnh rồi nhấn ${PASTE_KEYS})`}
      aria-label={iconOnly ? label : undefined}
      className={
        className ||
        'px-3 py-2 rounded-full text-sm font-medium bg-gray-100 hover:bg-primary-100 flex items-center justify-center gap-1.5 disabled:opacity-50'
      }
    >
      {reading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardPaste className="w-4 h-4" />}
      {!iconOnly && label}
    </button>
  );
}
