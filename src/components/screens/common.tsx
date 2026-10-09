// Thành phần dùng chung cho các màn: thanh trạng thái (duyệt / đã cũ), danh sách lỗi, ô sửa theo yêu cầu, ô nhập.
import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock, RefreshCw, ShieldCheck, Wand2, ArrowRight, Info } from 'lucide-react';
import type { Project, SectionKey, Section } from '../../types';
import { SCREENS, getSection, staleDeps, missingDeps, blockedDeps } from '../../../shared/project';
import { RunButton } from '../ui';

export const screenLabel = (k: SectionKey) => {
  const s = SCREENS.find((x) => x.key === k);
  return s ? `màn ${s.no} (${s.label})` : k;
};

/* ---------- Gọi AI có trạng thái bận / lỗi / cảnh báo ---------- */

export function useRunner() {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<{ errors: string[]; warnings: string[] }>({ errors: [], warnings: [] });
  const run = async (label: string, fn: () => Promise<{ errors?: string[]; warnings?: string[] } | void>) => {
    setBusy(label);
    setError('');
    try {
      const r = await fn();
      setNotes({ errors: (r && r.errors) || [], warnings: (r && r.warnings) || [] });
    } catch (e: any) {
      setError(e?.message || 'Có lỗi.');
    } finally {
      setBusy('');
    }
  };
  return { busy, error, setError, notes, setNotes, run };
}

/* ---------- Tiêu đề màn ---------- */

export function ScreenIntro({ no, title, children }: { no: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-bold text-black">
        {no}. {title}
      </h2>
      {children && <p className="text-sm text-gray-600 mt-1 max-w-3xl">{children}</p>}
    </div>
  );
}

/* ---------- Màn bị khoá vì phần phía trên chưa duyệt ---------- */

export function LockedScreen({ project, sectionKey, onGo }: { project: Project; sectionKey: SectionKey; onGo: (k: SectionKey) => void }) {
  const missing = missingDeps(project, sectionKey);
  return (
    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
      <Lock className="w-8 h-8 text-gray-400 mx-auto mb-3" />
      <p className="font-bold text-black">Màn này cần các phần phía trên được duyệt trước.</p>
      <div className="flex flex-wrap justify-center gap-2 mt-4">
        {missing.map((k) => (
          <button key={k} onClick={() => onGo(k)} className="px-4 py-2 rounded-full bg-black text-primary-400 text-sm font-bold flex items-center gap-1.5">
            Sang {screenLabel(k)} <ArrowRight className="w-4 h-4" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Màn phía trên đang nháp / đã cũ ---------- */

export function UpstreamBanner({ project, sectionKey, onGo }: { project: Project; sectionKey: SectionKey; onGo: (k: SectionKey) => void }) {
  const blocked = blockedDeps(project, sectionKey);
  if (!blocked.length) return null;
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-bold flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> Màn phía trên chưa chốt
      </p>
      <p className="mt-1">
        {blocked.map(screenLabel).join(', ')} đang ở dạng nháp hoặc đã cũ. Duyệt (hoặc giữ nguyên) màn đó trước, rồi mới tạo, duyệt hay giữ nguyên ở màn này. Bạn vẫn xem và sửa tay được.
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        {blocked.map((k) => (
          <button key={k} onClick={() => onGo(k)} className="px-4 py-2 rounded-full bg-black text-primary-400 font-bold flex items-center gap-1.5">
            Sang {screenLabel(k)} <ArrowRight className="w-4 h-4" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Thanh trạng thái của một phần ---------- */

interface StatusBarProps {
  project: Project;
  sectionKey: SectionKey;
  /** Lỗi chặn duyệt (code kiểm) */
  blocking: string[];
  onApprove: () => void;
  onKeep: () => void;
  onRegenerate: () => void;
  busy: boolean;
}

export function StatusBar({ project, sectionKey, blocking, onApprove, onKeep, onRegenerate, busy }: StatusBarProps) {
  const s = getSection(project, sectionKey) as Section<unknown> | undefined;
  if (!s) return null;
  const stale = staleDeps(project, sectionKey);
  const upstreamBlocked = blockedDeps(project, sectionKey).length > 0;
  const approved = s.meta.status === 'duyet';
  return (
    <div className="space-y-3">
      {stale.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-bold text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Đã cũ
          </p>
          <p className="text-amber-900 mt-1">
            {stale.map(screenLabel).join(', ')} đã thay đổi sau khi phần này được tạo. Kiểm tra lại: tạo lại theo nội dung mới, hoặc giữ nguyên nếu vẫn đúng.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={onRegenerate} disabled={busy || upstreamBlocked} className="px-4 py-2 rounded-full bg-black text-primary-400 font-bold flex items-center gap-1.5 disabled:opacity-50">
              <RefreshCw className="w-4 h-4" /> Tạo lại
            </button>
            <button onClick={onKeep} disabled={busy || upstreamBlocked || blocking.length > 0} className="px-4 py-2 rounded-full bg-white border border-amber-300 font-bold disabled:opacity-50">
              Giữ nguyên và duyệt lại
            </button>
          </div>
          {upstreamBlocked && <p className="text-amber-900 mt-2">Màn phía trên chưa chốt — xem thông báo ở đầu màn.</p>}
        </div>
      )}

      {stale.length === 0 && (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl p-4 ${approved ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
          <p className={`text-sm font-bold flex items-center gap-2 ${approved ? 'text-green-800' : 'text-gray-700'}`}>
            {approved ? <CheckCircle2 className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            {approved ? `Đã duyệt (bản ${s.meta.rev}). Sửa bất kỳ ô nào sẽ chuyển về nháp.` : upstreamBlocked ? 'Nháp — chờ màn phía trên chốt rồi mới duyệt được.' : 'Nháp — kiểm tra, sửa nếu cần, rồi duyệt để mở màn sau.'}
          </p>
          {!approved && (
            <RunButton onClick={onApprove} busy={false} busyLabel="" icon={ShieldCheck} disabled={busy || upstreamBlocked || blocking.length > 0}>
              Duyệt
            </RunButton>
          )}
        </div>
      )}
      {!approved && blocking.length > 0 && <p className="text-sm text-red-700">Còn {blocking.length} lỗi cần sửa trước khi duyệt (xem danh sách bên dưới).</p>}
    </div>
  );
}

/* ---------- Danh sách lỗi / cảnh báo ---------- */

export function Issues({ errors, warnings, title }: { errors: string[]; warnings: string[]; title?: string }) {
  if (!errors.length && !warnings.length) return null;
  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-bold text-black">{title}</p>}
      {errors.length > 0 && (
        <ul className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 space-y-1">
          {errors.map((e, i) => (
            <li key={i} className="flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {e}
            </li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-1">
          {warnings.map((e, i) => (
            <li key={i} className="flex gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" /> {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Sửa theo yêu cầu ---------- */

export function ReviseBox({ onSubmit, busy, disabled, placeholder }: { onSubmit: (text: string) => void; busy: boolean; disabled?: boolean; placeholder: string }) {
  const [text, setText] = useState('');
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && text.trim() && !busy && !disabled) onSubmit(text.trim());
        }}
        placeholder={placeholder}
        aria-label="Yêu cầu sửa"
        className={`${fieldCls} flex-1`}
      />
      <RunButton onClick={() => onSubmit(text.trim())} busy={busy} busyLabel="AI đang sửa…" icon={Wand2} variant="ghost" disabled={disabled || !text.trim()}>
        Sửa theo yêu cầu
      </RunButton>
    </div>
  );
}

/* ---------- Ô nhập ---------- */

export const fieldCls = 'w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400';

export function Field({ label, value, onChange, placeholder, rows, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; hint?: string }) {
  const id = React.useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-black mb-1">
        {label}
      </label>
      {rows ? (
        <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={fieldCls} />
      ) : (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={fieldCls} />
      )}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

export function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const id = React.useId();
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-gray-600 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Math.round(Number(e.target.value)))}
        className={`${fieldCls} w-24`}
      />
    </div>
  );
}
