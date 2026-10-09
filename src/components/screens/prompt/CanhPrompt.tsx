// Màn ⑧ — một cảnh: mỗi beat một thẻ gồm ảnh cần nạp, prompt (nút Chép), lỗi / cảnh báo, sửa phần dịch, frame cuối, ô "đã tạo video".
import React, { useRef, useState } from 'react';
import { RefreshCw, Languages, Check, PenLine, ImagePlus, Trash2, Film, Link2 } from 'lucide-react';
import type { CanhDanY, Character, PromptBeat } from '../../../types';
import { fmtGiay } from '../../../../shared/project';
import { mocGiay } from '../../../../shared/phanCanh';
import { khopDich, NguonBeat, PromptKetQua, TinhTrangPrompt, AnhNap, FRAME_TAG } from '../../../../shared/prompt';
import { useImage } from '../../../lib/useImage';
import { CopyButton, RunButton } from '../../ui';
import { Issues, ReviseBox, Field } from '../common';
import { PasteZone, PasteButton } from '../../PasteZone';
import { tieuDeCanh } from '../kichBan/CanhBlock';

const TINH_TRANG: Record<TinhTrangPrompt, { label: string; cls: string }> = {
  'chua-dich': { label: 'Chưa dịch', cls: 'bg-gray-100 text-gray-600' },
  'da-dich': { label: 'Đã dịch', cls: 'bg-primary-100 text-primary-800' },
  'can-dich-lai': { label: 'Cần dịch lại', cls: 'bg-amber-100 text-amber-900' },
};

const LOAI_ANH: Record<AnhNap['loai'], string> = { character: 'nhân vật', prop: 'đồ vật', location: 'bối cảnh', frame: 'frame nối' };

/** Một ảnh cần nạp: ảnh nhỏ + @tag + vai trò. */
function AnhChip({ a }: { a: AnhNap }) {
  const url = useImage(a.imageId);
  const thieu = !a.imageId;
  return (
    <li className={`flex items-center gap-2 rounded-xl border p-1.5 pr-3 text-xs ${thieu ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <span className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
        {url ? <img src={url} alt={`Ảnh @${a.tag}`} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <span className="text-[10px] text-red-700 text-center leading-tight">chưa có ảnh</span>}
      </span>
      <span className="min-w-0">
        <b className="text-black">@{a.tag}</b> <span className="text-gray-500">· {LOAI_ANH[a.loai]}</span>
        <span className="block text-gray-600 truncate max-w-[14rem]">{a.vaiTro || (a.khongBible ? 'chưa có trong bible' : '—')}</span>
      </span>
    </li>
  );
}

/** Frame cuối của video beat này (bạn chụp ở Flow) — beat sau cùng cảnh dùng làm frame nối. */
function FrameCuoi({ beatId, imageId, onFile, onRemove, onError, disabled }: { beatId: string; imageId?: string; onFile: (f: File) => void; onRemove: () => void; onError: (m: string) => void; disabled: boolean }) {
  const url = useImage(imageId);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <PasteZone label={`frame cuối của ${beatId}`} onFiles={(f) => onFile(f[0])} onError={onError} disabled={disabled} className="rounded-xl border border-dashed border-gray-300 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-24 h-16 rounded-lg bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
          {url ? <img src={url} alt={`Frame cuối ${beatId}`} className="w-full h-full object-cover" /> : <Film className="w-5 h-5 text-gray-400" />}
        </span>
        <div className="flex-1 min-w-[12rem] text-sm">
          <p className="font-bold text-black flex items-center gap-1.5">
            <Link2 className="w-4 h-4" /> Frame cuối của video {beatId}
          </p>
          <p className="text-xs text-gray-600">Tạo xong video beat này ở Flow, chụp frame cuối rồi dán / kéo vào đây. Beat sau cùng cảnh sẽ tự nạp ảnh @{FRAME_TAG}.</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
        <div className="flex gap-1.5">
          <button onClick={() => fileRef.current?.click()} disabled={disabled} title="Chọn ảnh frame" aria-label={`Chọn frame cuối cho ${beatId}`} className="p-2 rounded-lg bg-gray-100 hover:bg-primary-100 disabled:opacity-50">
            <ImagePlus className="w-4 h-4" />
          </button>
          <PasteButton iconOnly label={`Dán frame cuối cho ${beatId}`} onFiles={(f) => onFile(f[0])} onError={onError} disabled={disabled} className="p-2 rounded-lg bg-gray-100 hover:bg-primary-100 disabled:opacity-50" />
          {imageId && (
            <button onClick={onRemove} disabled={disabled} title="Gỡ frame" aria-label={`Gỡ frame cuối của ${beatId}`} className="p-2 rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </PasteZone>
  );
}

/** Sửa tay phần AI dịch của một beat. Phần cố định sửa ở màn gốc (⑥ ⑦). */
function DichEditor({ n, d, chars, coNhac, onChange }: { n: NguonBeat; d: PromptBeat; chars: Character[]; coNhac: boolean; onChange: (d: PromptBeat) => void }) {
  const ten = (t: string) => chars.find((c) => c.tag === t)?.ten || t;
  const moc = mocGiay(n.shots);
  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs text-gray-600">Viết tiếng Anh, gọi người / vật bằng @tag. Bối cảnh, ánh sáng, ngoại hình, máy quay và câu thoại do app tự ghép — không cần viết.</p>
      {n.dau.map((l) => (
        <Field
          key={l.tag}
          label={`Lúc bắt đầu — @${l.tag}`}
          hint={`Tiếng Việt: ${l.moTa}`}
          value={d.lucBatDau.find((x) => x.tag === l.tag)?.cau || ''}
          onChange={(v) => onChange({ ...d, lucBatDau: n.dau.map((x) => ({ tag: x.tag, cau: x.tag === l.tag ? v : d.lucBatDau.find((y) => y.tag === x.tag)?.cau || '' })) })}
        />
      ))}
      {n.shots.map((s, k) => (
        <Field key={s.id} label={`Shot ${k + 1} ${moc[k]} — hành động`} hint={`Mô tả ở màn 7: ${s.moTa}`} rows={2} value={d.shots[s.id] || ''} onChange={(v) => onChange({ ...d, shots: { ...d.shots, [s.id]: v } })} />
      ))}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Âm thanh môi trường (Ambient)" hint={n.beat.amThanh ? `Tiếng Việt: ${n.beat.amThanh}` : undefined} value={d.ambient} onChange={(v) => onChange({ ...d, ambient: v })} />
        {coNhac && <Field label="Nhạc (Music) — để trống nếu không có" value={d.music} onChange={(v) => onChange({ ...d, music: v })} />}
      </div>
      {n.beat.thoai.map((t, k) => {
        const x = d.thoai[k] || { cachNoi: '', nguoiNoi: '' };
        const set = (patch: Partial<typeof x>) => onChange({ ...d, thoai: n.beat.thoai.map((_, j) => (j === k ? { ...x, ...patch } : d.thoai[j] || { cachNoi: '', nguoiNoi: '' })) });
        return (
          <div key={k} className="grid sm:grid-cols-2 gap-3 border-l-2 border-gray-200 pl-3">
            <p className="sm:col-span-2 text-sm text-gray-700">
              Thoại {k + 1}: <b>{ten(t.ai)}</b>
              {t.cachNoi ? ` (${t.cachNoi})` : ''}: “{t.cau}”
            </p>
            <Field label="Người nói (tiếng Anh)" hint={n.khung.includes(t.ai) ? `Có ảnh trong beat — app tự ghi @${t.ai}` : 'Không có ảnh trong beat — ví dụ: Lan\'s mother over the phone'} value={x.nguoiNoi} onChange={(v) => set({ nguoiNoi: v })} />
            <Field label="Cách nói (tiếng Anh)" value={x.cachNoi} onChange={(v) => set({ cachNoi: v })} placeholder="softly" />
          </div>
        );
      })}
      <Field
        label="Giữ đúng — 2–3 điều riêng của beat, mỗi dòng một điều"
        rows={3}
        value={d.giuDung.join('\n')}
        onChange={(v) => onChange({ ...d, giuDung: v.split('\n').slice(0, 3) })}
      />
    </div>
  );
}

function BeatPrompt({ r, n, d, chars, coNhac, laBeatCuoi, frameId, daTao, busy, onDich, onFrame, onDaTao, onError }: {
  r: PromptKetQua; n: NguonBeat; d?: PromptBeat; chars: Character[]; coNhac: boolean; laBeatCuoi: boolean; frameId?: string; daTao: boolean; busy: boolean;
  onDich: (d: PromptBeat) => void; onFrame: (f: File | null) => void; onDaTao: (v: boolean) => void; onError: (m: string) => void;
}) {
  const base = d || khopDich([n])[n.beat.id];
  return (
    <section className={`rounded-2xl border p-4 space-y-3 ${daTao ? 'border-green-200 bg-green-50/40' : 'border-gray-200 bg-white'}`} aria-label={`Beat ${r.beatId}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-black">
            {r.beatId} · {r.giay}s · {r.soShot} shot {r.text ? <span className="text-xs font-normal text-gray-500">· {r.soTu} từ</span> : null}
          </p>
          <p className="text-sm text-gray-600">{n.beat.hanhDong}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold text-black cursor-pointer shrink-0">
          <input type="checkbox" checked={daTao} onChange={(e) => onDaTao(e.target.checked)} className="w-4 h-4 accent-black" />
          Đã tạo video
        </label>
      </div>

      <div>
        <p className="text-xs font-bold text-gray-600 mb-1.5">Ảnh cần nạp ({r.anh.length})</p>
        <ul className="flex flex-wrap gap-2">
          {r.anh.map((a) => (
            <AnhChip key={a.tag} a={a} />
          ))}
        </ul>
      </div>

      {r.chuaCoFrame && (
        <p className="text-sm rounded-xl bg-amber-50 border border-amber-200 text-amber-900 p-2.5">
          Chưa có frame nối từ {r.beatTruoc} — prompt vẫn dùng được nhưng độ khớp với beat trước thấp hơn. Dán frame cuối ở thẻ {r.beatTruoc}.
        </p>
      )}

      {r.text ? (
        <div className="space-y-2">
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900">{r.text}</pre>
          <CopyButton text={r.text} label="Chép prompt" />
        </div>
      ) : (
        <p className="text-sm text-gray-500">Beat chưa dịch — bấm "Dịch cảnh này", hoặc "Tự viết" rồi điền phần dịch.</p>
      )}

      <Issues errors={r.chuaDich ? r.errors.filter((e) => e !== 'Beat chưa dịch.') : r.errors} warnings={r.warnings} />

      {d && (
        <details className="rounded-xl border border-gray-200 p-3">
          <summary className="cursor-pointer text-sm font-bold text-black flex items-center gap-1.5">
            <PenLine className="w-4 h-4" /> Sửa phần dịch
          </summary>
          <DichEditor n={n} d={base} chars={chars} coNhac={coNhac} onChange={onDich} />
        </details>
      )}

      {!laBeatCuoi && <FrameCuoi beatId={r.beatId} imageId={frameId} onFile={(f) => onFrame(f)} onRemove={() => onFrame(null)} onError={onError} disabled={busy} />}
    </section>
  );
}

interface Props {
  no: number;
  canh: CanhDanY;
  nguon: NguonBeat[];
  ketQua: PromptKetQua[];
  dich?: Record<string, PromptBeat>;
  tinhTrang: TinhTrangPrompt;
  frames: Record<string, string>;
  daTao: Record<string, boolean>;
  chars: Character[];
  coNhac: boolean;
  running: '' | 'lam' | 'sua';
  /** Đang gọi AI ở bất kỳ đâu trên màn */
  disabled: boolean;
  /** Màn trên chưa chốt */
  locked: boolean;
  onRun: () => void;
  onRevise: (text: string) => void;
  onKeep: () => void;
  onManual: () => void;
  onDich: (beatId: string, d: PromptBeat) => void;
  onFrame: (beatId: string, f: File | null) => void;
  onDaTao: (beatId: string, v: boolean) => void;
  onError: (m: string) => void;
}

export default function CanhPrompt({ no, canh, nguon, ketQua, dich, tinhTrang, frames, daTao, chars, coNhac, running, disabled, locked, onRun, onRevise, onKeep, onManual, onDich, onFrame, onDaTao, onError }: Props) {
  const conLoi = ketQua.some((r) => r.errors.length > 0);
  const tt = tinhTrang === 'da-dich' && conLoi ? { label: 'Còn lỗi', cls: 'bg-red-100 text-red-800' } : TINH_TRANG[tinhTrang];
  const daDich = tinhTrang !== 'chua-dich';
  const thieuShot = nguon.some((n) => !n.shots.length);
  const xong = ketQua.filter((r) => daTao[r.beatId]).length;
  // Mở sẵn cảnh còn việc lúc vào màn; sau đó bạn tự mở / đóng (không tự đóng lại khi vừa dịch xong)
  const [moSan] = useState(() => tinhTrang !== 'da-dich' || conLoi);
  return (
    <details open={moSan} className="bg-white border border-gray-200 rounded-2xl p-4 group">
      <summary className="cursor-pointer list-none flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-black tracking-wide">{tieuDeCanh(no, canh)}</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {canh.id} · {fmtGiay(canh.batDau)}–{fmtGiay(canh.ketThuc)} · {nguon.length} beat · đã tạo {xong}/{nguon.length}
          </p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tt.cls}`}>{tt.label}</span>
      </summary>

      <div className="space-y-4 mt-4">
        {thieuShot && <p className="text-sm text-red-700">Có beat chưa có shot ở màn 7 — phân cảnh xong mới dịch được.</p>}

        {tinhTrang === 'can-dich-lai' && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex flex-wrap items-center gap-2">
            <span className="flex-1 min-w-[12rem]">Chữ tiếng Việt của cảnh (mô tả shot, trạng thái, âm thanh hoặc thoại) đã đổi sau khi dịch. Dịch lại, hoặc sửa tay phần dịch rồi xác nhận vẫn đúng.</span>
            <button onClick={onKeep} disabled={!!running || locked} className="px-3 py-1.5 rounded-full bg-white border border-amber-300 font-bold flex items-center gap-1.5 disabled:opacity-50">
              <Check className="w-4 h-4" /> Vẫn đúng
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <RunButton onClick={onRun} busy={running === 'lam'} busyLabel="AI đang dịch cảnh…" icon={daDich ? RefreshCw : Languages} variant={daDich ? 'ghost' : 'dark'} disabled={disabled || locked || thieuShot}>
            {daDich ? 'Dịch lại cảnh này' : 'Dịch cảnh này'}
          </RunButton>
          {!daDich && (
            <button onClick={onManual} disabled={!!running || thieuShot} className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-primary-100 font-bold flex items-center gap-2 disabled:opacity-50">
              <PenLine className="w-4 h-4" /> Tự viết
            </button>
          )}
        </div>
        {daDich && <ReviseBox onSubmit={onRevise} busy={running === 'sua'} disabled={disabled || locked || thieuShot} placeholder="VD: beat B007 cho Lan cầm mẩu giấy bằng tay trái, bớt tiếng quạt…" />}

        {nguon.map((n, i) => {
          const r = ketQua.find((x) => x.beatId === n.beat.id);
          if (!r) return null;
          return (
            <BeatPrompt
              key={n.beat.id}
              r={r}
              n={n}
              d={dich?.[n.beat.id]}
              chars={chars}
              coNhac={coNhac}
              laBeatCuoi={i === nguon.length - 1}
              frameId={frames[n.beat.id]}
              daTao={!!daTao[n.beat.id]}
              busy={!!running}
              onDich={(d) => onDich(n.beat.id, d)}
              onFrame={(f) => onFrame(n.beat.id, f)}
              onDaTao={(v) => onDaTao(n.beat.id, v)}
              onError={onError}
            />
          );
        })}
      </div>
    </details>
  );
}
