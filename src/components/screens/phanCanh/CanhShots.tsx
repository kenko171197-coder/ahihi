// Màn ⑦ — một cảnh: mỗi beat một bảng shot (mốc giây, cỡ, góc, máy, mô tả, trong khung, thoại), sửa tay tại chỗ.
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Scissors, RefreshCw, Clapperboard, Check, PenLine } from 'lucide-react';
import type { Beat, CanhDanY, Character, PhanCanhCanh, Shot } from '../../../types';
import { fmtGiay } from '../../../../shared/project';
import { CO_CANH, GOC_MAY, CHUYEN_DONG, mocGiay, cauMay, tronNuaGiay, blankShot, TinhTrangPhanCanh } from '../../../../shared/phanCanh';
import type { CheckResult } from '../../../../shared/checks';
import { RunButton } from '../../ui';
import { Issues, ReviseBox, fieldCls } from '../common';
import { tieuDeCanh } from '../kichBan/CanhBlock';

const TINH_TRANG: Record<TinhTrangPhanCanh, { label: string; cls: string }> = {
  'chua-lam': { label: 'Chưa phân cảnh', cls: 'bg-gray-100 text-gray-600' },
  'da-lam': { label: 'Đã phân cảnh', cls: 'bg-primary-100 text-primary-800' },
  'can-xem-lai': { label: 'Cần xem lại', cls: 'bg-amber-100 text-amber-900' },
};

/** Ô số giây bước 0,5 (gõ "1,5" hay "1.5" đều được); rời ô mới ghi. */
function GiayField({ id, value, onChange }: { id: string; value: number; onChange: (v: number) => void }) {
  const show = (n: number) => (Number.isFinite(n) ? String(n).replace('.', ',') : '');
  const [text, setText] = useState(show(value));
  useEffect(() => setText(show(value)), [value]);
  return (
    <input
      id={id}
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const n = tronNuaGiay(Number(text.replace(',', '.')));
        if (n !== value) onChange(n);
        else setText(show(value));
      }}
      className={`${fieldCls} w-20`}
    />
  );
}

function Chon<T extends string>({ id, label, value, list, onChange }: { id: string; label: string; value: T; list: { id: T; vi: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-gray-600 mb-1">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={`${fieldCls} w-40`}>
        {!list.some((x) => x.id === value) && <option value={value}>— chọn —</option>}
        {list.map((x) => (
          <option key={x.id} value={x.id}>{x.vi}</option>
        ))}
      </select>
    </div>
  );
}

const chip = (on: boolean) => `px-2.5 py-1 rounded-full text-xs font-bold border ${on ? 'bg-black text-primary-400 border-black' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-400'}`;

function ShotRow({ b, s, moc, k, chars, onChange, onSplit, onAdd, onRemove }: {
  b: Beat; s: Shot; moc: string; k: number; chars: Character[];
  onChange: (patch: Partial<Shot>) => void; onSplit: () => void; onAdd: () => void; onRemove: () => void;
}) {
  const ten = (t: string) => chars.find((c) => c.tag === t)?.ten || t;
  const base = `${b.id}-${k}`;
  return (
    <li className="border-l-2 border-primary-400 pl-3 space-y-2" aria-label={`Shot ${s.id}`}>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <p className="text-xs font-bold text-gray-600 mb-1">Shot {k + 1}</p>
          <p className="text-sm font-mono text-black py-2">{moc}</p>
        </div>
        <div>
          <label htmlFor={`${base}-giay`} className="block text-xs font-bold text-gray-600 mb-1">Số giây</label>
          <GiayField id={`${base}-giay`} value={s.giay} onChange={(giay) => onChange({ giay })} />
        </div>
        <Chon id={`${base}-co`} label="Cỡ cảnh" value={s.coCanh} list={CO_CANH} onChange={(coCanh) => onChange({ coCanh })} />
        <Chon id={`${base}-goc`} label="Góc máy" value={s.gocMay} list={GOC_MAY} onChange={(gocMay) => onChange({ gocMay })} />
        <Chon id={`${base}-may`} label="Chuyển động" value={s.chuyenDong} list={CHUYEN_DONG} onChange={(chuyenDong) => onChange({ chuyenDong })} />
      </div>
      <div>
        <label htmlFor={`${base}-mota`} className="block text-xs font-bold text-gray-600 mb-1">Mô tả (tiếng Việt — nguồn câu hành động ở màn 8)</label>
        <textarea id={`${base}-mota`} rows={2} value={s.moTa} onChange={(e) => onChange({ moTa: e.target.value })} className={fieldCls} />
        <p className="text-xs text-gray-400 mt-1">Câu máy ở màn 8: {cauMay(s)}</p>
      </div>
      {b.coMat.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-gray-600 mr-1">Trong khung:</span>
          {b.coMat.map((t) => {
            const on = s.trongKhung.includes(t);
            return (
              <button key={t} aria-pressed={on} onClick={() => onChange({ trongKhung: on ? s.trongKhung.filter((x) => x !== t) : b.coMat.filter((x) => x === t || s.trongKhung.includes(x)) })} className={chip(on)}>
                @{t}
              </button>
            );
          })}
        </div>
      )}
      {b.thoai.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-gray-600 mr-1">Thoại:</span>
          {b.thoai.map((t, n) => {
            const on = s.thoai.includes(n);
            return (
              <button key={n} aria-pressed={on} title={t.cau} onClick={() => onChange({ thoai: on ? s.thoai.filter((x) => x !== n) : [...s.thoai, n].sort((x, y) => x - y) })} className={chip(on)}>
                {n + 1}. {ten(t.ai)}: “{t.cau.length > 24 ? `${t.cau.slice(0, 24)}…` : t.cau}”
              </button>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={onAdd} className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-primary-100 text-xs font-bold flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Thêm shot sau
        </button>
        <button onClick={onSplit} disabled={!(s.giay >= 2)} className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-primary-100 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
          <Scissors className="w-3.5 h-3.5" /> Tách đôi
        </button>
        <button onClick={onRemove} aria-label={`Xoá shot ${s.id}`} className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50">
          <Trash2 className="w-3.5 h-3.5" /> Xoá shot
        </button>
      </div>
    </li>
  );
}

interface Props {
  no: number;
  canh: CanhDanY;
  beats: Beat[];
  pc?: PhanCanhCanh;
  tinhTrang: TinhTrangPhanCanh;
  chars: Character[];
  check?: CheckResult & { theoBeat: Record<string, CheckResult> };
  running: '' | 'lam' | 'sua';
  disabled: boolean;
  onRun: () => void;
  onRevise: (text: string) => void;
  onKeep: () => void;
  onManual: () => void;
  onShots: (beatId: string, fn: (shots: Shot[]) => Shot[]) => void;
}

export default function CanhShots({ no, canh, beats, pc, tinhTrang, chars, check, running, disabled, onRun, onRevise, onKeep, onManual, onShots }: Props) {
  const tt = TINH_TRANG[tinhTrang];
  const daLam = tinhTrang !== 'chua-lam';
  const ten = (t: string) => chars.find((c) => c.tag === t)?.ten || t;
  return (
    <article className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4" aria-label={`Cảnh ${no}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-black tracking-wide">{tieuDeCanh(no, canh)}</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {canh.id} · {fmtGiay(canh.batDau)}–{fmtGiay(canh.ketThuc)} · {beats.length} beat
          </p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tt.cls}`}>{tt.label}</span>
      </header>

      {tinhTrang === 'can-xem-lai' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex flex-wrap items-center gap-2">
          <span className="flex-1 min-w-[12rem]">Beat của cảnh này đã đổi ở màn 4 / 5 sau khi phân cảnh. Làm lại, hoặc xác nhận vẫn đúng.</span>
          <button onClick={onKeep} disabled={!!running} className="px-3 py-1.5 rounded-full bg-white border border-amber-300 font-bold flex items-center gap-1.5 disabled:opacity-50">
            <Check className="w-4 h-4" /> Vẫn đúng
          </button>
        </div>
      )}

      {daLam && (
        <div className="space-y-5">
          {beats.map((b) => {
            const shots = pc?.beats[b.id]?.shots || [];
            const moc = mocGiay(shots);
            const ck = check?.theoBeat[b.id];
            return (
              <section key={b.id} className="space-y-3" aria-label={`Beat ${b.id}`}>
                <div className="bg-gray-50 rounded-xl p-3 text-sm">
                  <p className="text-xs font-bold text-gray-500">
                    {b.id} · {b.giay}s{b.camXuc ? ` · ${b.camXuc}` : ''}
                  </p>
                  <p className="text-black">{b.hanhDong}</p>
                  {b.thoai.map((t, n) => (
                    <p key={n} className="text-gray-700">
                      {n + 1}. <b>{ten(t.ai)}</b>
                      {t.cachNoi ? ` (${t.cachNoi})` : ''}: “{t.cau}”
                    </p>
                  ))}
                </div>
                <ol className="space-y-4">
                  {shots.map((s, k) => (
                    <ShotRow
                      key={s.id || k}
                      b={b}
                      s={s}
                      k={k}
                      moc={moc[k]}
                      chars={chars}
                      onChange={(patch) => onShots(b.id, (l) => l.map((x, j) => (j === k ? { ...x, ...patch } : x)))}
                      onAdd={() => onShots(b.id, (l) => [...l.slice(0, k + 1), blankShot(1, l[k].trongKhung), ...l.slice(k + 1)])}
                      onSplit={() =>
                        onShots(b.id, (l) => {
                          const a = tronNuaGiay(l[k].giay / 2);
                          return [...l.slice(0, k), { ...l[k], giay: a }, { ...blankShot(l[k].giay - a, l[k].trongKhung), coCanh: l[k].coCanh, gocMay: l[k].gocMay, chuyenDong: l[k].chuyenDong }, ...l.slice(k + 1)];
                        })
                      }
                      onRemove={() => onShots(b.id, (l) => l.filter((_, j) => j !== k))}
                    />
                  ))}
                </ol>
                {!shots.length && (
                  <button onClick={() => onShots(b.id, () => [{ ...blankShot(b.giay, b.coMat), thoai: b.thoai.map((_, n) => n) }])} className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-primary-100 text-xs font-bold flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Thêm shot
                  </button>
                )}
                {ck && <Issues errors={ck.errors} warnings={ck.warnings} />}
              </section>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <RunButton onClick={onRun} busy={running === 'lam'} busyLabel="AI đang phân cảnh…" icon={daLam ? RefreshCw : Clapperboard} variant={daLam ? 'ghost' : 'dark'} disabled={disabled}>
          {daLam ? 'Phân cảnh lại' : 'Phân cảnh'}
        </RunButton>
        {!daLam && (
          <button onClick={onManual} disabled={!!running} className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-primary-100 font-bold flex items-center gap-2 disabled:opacity-50">
            <PenLine className="w-4 h-4" /> Tự làm
          </button>
        )}
      </div>
      {daLam && <ReviseBox onSubmit={onRevise} busy={running === 'sua'} disabled={disabled} placeholder="VD: beat B007 cận vào tay Lan rồi mới lên mặt, bỏ shot từ trên xuống…" />}
    </article>
  );
}
