import React, { useEffect, useRef, useState } from 'react';
import { Copy, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

/** Chép chữ vào bộ nhớ tạm. Trả về false nếu trình duyệt chặn cả hai cách. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export function CopyButton({ text, label = 'Sao chép', className = '' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState<'' | 'ok' | 'fail'>('');
  return (
    <button
      type="button"
      onClick={async () => {
        setDone((await copyText(text)) ? 'ok' : 'fail');
        setTimeout(() => setDone(''), 2200);
      }}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gray-100 hover:bg-primary-100 text-gray-700 hover:text-black transition-colors ${className}`}
    >
      {done === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-700" /> : <Copy className="w-3.5 h-3.5" />}
      {done === 'ok' ? 'Đã chép' : done === 'fail' ? 'Trình duyệt chặn — mở app ở tab riêng' : label}
    </button>
  );
}

export function ErrorBox({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [message]);
  if (!message) return null;
  return (
    <div ref={ref} role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm scroll-mt-24">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

interface RunButtonProps {
  onClick: () => void;
  busy: boolean;
  busyLabel: string;
  icon: React.ElementType;
  children: React.ReactNode;
  variant?: 'dark' | 'yellow' | 'ghost';
  disabled?: boolean;
  className?: string;
}

/** Nút gọi AI: tự hiện vòng quay và chữ "đang…" khi chạy. */
export function RunButton({ onClick, busy, busyLabel, icon: Icon, children, variant = 'dark', disabled, className = '' }: RunButtonProps) {
  const styles = {
    dark: 'bg-black hover:bg-gray-800 text-primary-400',
    yellow: 'bg-primary-400 hover:bg-primary-300 text-black',
    ghost: 'border border-primary-400/40 bg-primary-400/10 hover:bg-primary-400/20 text-primary-800',
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`py-3 px-5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${styles} ${className}`}
    >
      {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
      {busy ? busyLabel : children}
    </button>
  );
}
