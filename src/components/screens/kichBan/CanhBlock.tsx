// Một cảnh ở bước B: đọc như kịch bản (tiêu đề cảnh, các beat có giây và thoại), sửa tay từng beat.
import React, { useState } from 'react';
import { PenLine, Plus, Trash2, Scissors, RefreshCw, Wand2, Check, Eye } from 'lucide-react';
import type { Beat, CanhDanY, CanhViet, Character } from '../../../types';
import { fmtGiay, BEAT_MIN } from '../../../../shared/project';
import type { CheckResult } from '../../../../shared/checks';
import {
  blankBeat, dauBeat, parseTags, parseThayDoi, parseThoai, parseTrangThai, thayDoiText, thoaiText, tongGiayBeat, trangThaiText, TinhTrangCanh,
} from '../../../../shared/kichBan';
import { RunButton } from '../../ui';
import { Field, Issues, NumberField, ReviseBox } from '../common';
import { LinesField, TagsField } from './fields';

const TINH_TRANG: Record<TinhTrangCanh, { label: string; cls: string }> = {
  'chua-viet': { label: 'Chưa viết', cls: 'bg-gray-100 text-gray-600' },
  'da-viet': { label: 'Đã viết', cls: 'bg-primary-100 text-primary-800' },
  'can-xem-lai': { label: 'Cần xem lại', cls: 'bg-amber-100 text-amber-900' },
};

export function tieuDeCanh(no: number, c: CanhDanY) {
  return `CẢNH ${no} · ${(c.diaDiem || 'chưa có địa điểm').toUpperCase()}${c.thoiDiem ? ` — ${c.thoiDiem.toUpperCase()}` : ''}`;
}

const nameOf = (chars: Character[], ai: string) => chars.find((c) => c.tag === ai)?.ten || ai;

/** Một beat ở dạng đọc. */
export function BeatView({ b, chars, dau }: { b: Beat; chars: Character[]; dau?: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-gray-500">
        {b.id} · {b.giay}s{b.camXuc ? ` · ${b.camXuc}` : ''}
      </p>
      <p className="text-sm text-black leading-relaxed">{b.hanhDong || <span className="text-gray-400">(chưa có hành động)</span>}</p>
      {b.thoai.map((t, i) => (
        <div key={i} className="text-center text-sm px-6">
          <p className="font-bold uppercase tracking-wide">
            {nameOf(chars, t.ai)}
            {t.cachNoi && <span className="font-normal normal-case text-gray-500"> ({t.cachNoi})</span>}
          </p>
          <p className="text-black">{t.cau}</p>
        </div>
      ))}
      {b.amThanh && <p className="text-sm italic text-gray-600">♪ {b.amThanh}</p>}
      <div className="text-xs text-gray-500 space-y-0.5">
        {dau && <p>Đầu beat: {dau}</p>}
        {b.coMat.length > 0 && <p>Có mặt: {b.coMat.map((t) => `@${t}`).join(', ')}</p>}
        {b.daoCuMoi.length > 0 && <p>Đạo cụ mới: {b.daoCuMoi.map((d) => `@${d.tag} — ${d.moTa}`).join('; ')}</p>}
        {b.thayDoi.length > 0 && <p>Thay đổi: {b.thayDoi.map((x) => `@${x.tag}: ${x.truoc} → ${x.sau}`).join('; ')}</p>}
        {b.caiDung.length > 0 && <p>Cài – Dùng: {b.caiDung.join(', ')}</p>}
        <p>Cuối beat: {trangThaiText(b.cuoiBeat, '; ') || '—'}</p>
      </div>
    </div>
  );
}

function BeatEditor({ b, chars, onChange }: { b: Beat; chars: Character[]; onChange: (patch: Partial<Beat>) => void }) {
  const tags = new Set(chars.map((c) => c.tag));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <NumberField label="Số giây" value={b.giay} onChange={(v) => onChange({ giay: v })} min={BEAT_MIN} />
        <div className="flex-1 min-w-[10rem]">
          <Field label="Cảm xúc / nhịp" value={b.camXuc} onChange={(v) => onChange({ camXuc: v })} />
        </div>
      </div>
      <Field label="Hành động" rows={3} value={b.hanhDong} onChange={(v) => onChange({ hanhDong: v })} />
      <LinesField
        label="Thoại (mỗi dòng một câu)"
        value={b.thoai}
        toText={(v) => thoaiText(v, tags)}
        parse={(t) => parseThoai(t, tags)}
        onChange={(v) => onChange({ thoai: v })}
        placeholder="@lan (khẽ): Mẹ gửi gì mà nặng thế không biết."
      />
      <Field label="Âm thanh, nhạc" value={b.amThanh} onChange={(v) => onChange({ amThanh: v })} />
      <div className="grid sm:grid-cols-2 gap-2">
        <TagsField label="Có mặt" value={b.coMat} parse={parseTags} onChange={(v) => onChange({ coMat: v })} hint="Tag nhân vật và đạo cụ, cách nhau bằng dấu cách" />
        <TagsField label="Cài – Dùng thể hiện ở beat này" value={b.caiDung} parse={(t) => Array.from(new Set(t.toUpperCase().split(/[\s,;@]+/).filter((x) => /^C\d+$/.test(x))))} onChange={(v) => onChange({ caiDung: v })} hint="Mã dòng Cài – Dùng: C1 C2" />
      </div>
      <LinesField label="Đạo cụ mới (mỗi dòng @tag: mô tả)" value={b.daoCuMoi} toText={(v) => trangThaiText(v)} parse={parseTrangThai} onChange={(v) => onChange({ daoCuMoi: v })} placeholder="@manhgiay: mẩu giấy viết tay gấp đôi" />
      <LinesField label="Thay đổi trạng thái (mỗi dòng @tag: trước → sau)" value={b.thayDoi} toText={thayDoiText} parse={parseThayDoi} onChange={(v) => onChange({ thayDoi: v })} placeholder="@thungxop: đóng kín → mở nắp" />
      <LinesField label="Trạng thái cuối beat (mỗi dòng @tag: ở đâu, thế nào)" rows={3} value={b.cuoiBeat} toText={(v) => trangThaiText(v)} parse={parseTrangThai} onChange={(v) => onChange({ cuoiBeat: v })} />
    </div>
  );
}

interface Props {
  no: number;
  canh: CanhDanY;
  viet?: CanhViet;
  tinhTrang: TinhTrangCanh;
  phanTen: string;
  chars: Character[];
  caiDung: { id: string; chiTiet: string; vai: string }[];
  check?: CheckResult;
  /** Đang chạy AI cho cảnh này */
  running: '' | 'viet' | 'sua';
  /** Không cho gọi AI (đang bận việc khác, màn trên chưa chốt, dàn ý chưa duyệt) */
  disabled: boolean;
  onWrite: () => void;
  onRevise: (text: string) => void;
  onKeep: () => void;
  onBeats: (fn: (beats: Beat[]) => Beat[]) => void;
}

export default function CanhBlock({ no, canh, viet, tinhTrang, phanTen, chars, caiDung, check, running, disabled, onWrite, onRevise, onKeep, onBeats }: Props) {
  const [editing, setEditing] = useState(false);
  const beats = viet?.beats || [];
  const len = canh.ketThuc - canh.batDau;
  const sum = tongGiayBeat(beats);
  const tt = TINH_TRANG[tinhTrang];
  const setBeat = (id: string, patch: Partial<Beat>) => onBeats((l) => l.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const addAfter = (i: number) => onBeats((l) => [...l.slice(0, i + 1), { ...blankBeat('', 5), coMat: l[i]?.coMat || canh.coMat, cuoiBeat: l[i]?.cuoiBeat || canh.dauCanh }, ...l.slice(i + 1)]);
  const split = (i: number) =>
    onBeats((l) => {
      const b = l[i];
      const a = Math.max(1, Math.floor(b.giay / 2));
      return [...l.slice(0, i), { ...b, giay: a }, { ...blankBeat('', b.giay - a), coMat: b.coMat, cuoiBeat: b.cuoiBeat }, ...l.slice(i + 1)];
    });

  return (
    <article className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3" aria-label={`Cảnh ${no}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-bold text-black tracking-wide">{tieuDeCanh(no, canh)}</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {canh.id} · {phanTen} · {fmtGiay(canh.batDau)}–{fmtGiay(canh.ketThuc)} ({len}s){beats.length > 0 && ` · ${beats.length} beat, tổng ${sum}s`}
          </p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tt.cls}`}>{tt.label}</span>
      </header>
      <div className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 space-y-0.5">
        <p>
          <b>Chuyển biến:</b> {canh.chuyenBien}
        </p>
        <p>
          <b>Đầu cảnh:</b> {trangThaiText(canh.dauCanh, '; ') || '—'}
        </p>
        <p>
          <b>Cuối cảnh:</b> {trangThaiText(canh.cuoiCanh, '; ') || '—'}
        </p>
        {caiDung.length > 0 && (
          <p>
            <b>Cài – Dùng:</b> {caiDung.map((x) => `${x.id} "${x.chiTiet}" (${x.vai})`).join('; ')}
          </p>
        )}
      </div>

      {tinhTrang === 'can-xem-lai' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex flex-wrap items-center gap-2">
          <span className="flex-1 min-w-[12rem]">Dàn ý của cảnh này hoặc cuối cảnh trước đã đổi sau khi cảnh được viết. Viết lại, hoặc xác nhận vẫn đúng.</span>
          <button onClick={onKeep} disabled={!!running} className="px-3 py-1.5 rounded-full bg-white border border-amber-300 font-bold flex items-center gap-1.5 disabled:opacity-50">
            <Check className="w-4 h-4" /> Vẫn đúng
          </button>
        </div>
      )}

      {beats.length > 0 && (
        <ol className="space-y-3">
          {beats.map((b, i) => (
            <li key={b.id || i} className="border-l-2 border-primary-400 pl-3">
              {editing ? (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500">
                    {b.id || 'Beat mới'} · Đầu beat: {trangThaiText(dauBeat(canh, beats, i), '; ') || '—'}
                  </p>
                  <BeatEditor b={b} chars={chars} onChange={(patch) => setBeat(b.id, patch)} />
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => addAfter(i)} className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-primary-100 text-sm font-bold flex items-center gap-1.5">
                      <Plus className="w-4 h-4" /> Thêm beat sau
                    </button>
                    <button onClick={() => split(i)} disabled={b.giay < 2} className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-primary-100 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
                      <Scissors className="w-4 h-4" /> Tách đôi
                    </button>
                    <button onClick={() => onBeats((l) => l.filter((x) => x.id !== b.id))} aria-label={`Xoá beat ${b.id}`} className="px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" /> Xoá beat
                    </button>
                  </div>
                </div>
              ) : (
                <BeatView b={b} chars={chars} />
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap gap-2">
        <RunButton onClick={onWrite} busy={running === 'viet'} busyLabel="AI đang viết cảnh…" icon={beats.length ? RefreshCw : Wand2} variant={beats.length ? 'ghost' : 'dark'} disabled={disabled}>
          {beats.length ? 'Viết lại cảnh' : 'Viết cảnh'}
        </RunButton>
        {beats.length > 0 ? (
          <button onClick={() => setEditing((x) => !x)} className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-primary-100 font-bold flex items-center gap-2">
            {editing ? <Eye className="w-4 h-4" /> : <PenLine className="w-4 h-4" />} {editing ? 'Xem như kịch bản' : 'Sửa tay'}
          </button>
        ) : (
          <button
            onClick={() => {
              onBeats(() => [{ ...blankBeat('', Math.max(BEAT_MIN, Math.min(len, 10))), coMat: canh.coMat, cuoiBeat: canh.cuoiCanh }]);
              setEditing(true);
            }}
            disabled={!!running}
            className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-primary-100 font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <PenLine className="w-4 h-4" /> Tự viết
          </button>
        )}
      </div>
      {beats.length > 0 && <ReviseBox onSubmit={onRevise} busy={running === 'sua'} disabled={disabled} placeholder="VD: thêm một khoảng lặng sau khi Lan đọc mẩu giấy…" />}

      {check && <Issues errors={check.errors} warnings={check.warnings} />}
    </article>
  );
}
