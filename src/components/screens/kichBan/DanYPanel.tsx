// Bước A của màn ④: dàn ý cảnh — mỗi cảnh một thẻ, sửa tay, thêm / xoá / đổi chỗ; bảng Cài – Dùng theo cảnh.
import React from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { CanhDanY, CaiDungCanh, Character, DanY, TreatmentData } from '../../../types';
import { fmtGiay, toTag } from '../../../../shared/project';
import { parseTags, parseTrangThai, trangThaiText } from '../../../../shared/kichBan';
import { Field, NumberField, fieldCls } from '../common';
import { LinesField, TagsField } from './fields';

const COLORS = ['bg-primary-400', 'bg-black', 'bg-primary-600', 'bg-gray-500', 'bg-primary-300', 'bg-gray-800'];

/** Thanh thời lượng: mỗi cảnh một khúc, tô màu theo phần của treatment. */
export function SceneTimeline({ d, t, total }: { d: DanY; t: TreatmentData; total: number }) {
  const partIdx = new Map(t.phan.map((p, i) => [p.id, i]));
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 gap-px" aria-hidden="true">
        {d.canh.map((c, i) => {
          const w = Number.isFinite(c.ketThuc - c.batDau) && total > 0 ? Math.max(0, ((c.ketThuc - c.batDau) / total) * 100) : 0;
          return <div key={c.id} className={COLORS[(partIdx.get(c.phan) ?? 3) % COLORS.length]} style={{ width: `${w}%` }} title={`Cảnh ${i + 1}: ${c.diaDiem}`} />;
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>0s</span>
        <span>
          {d.canh.length} cảnh · tổng {fmtGiay(d.canh.length ? d.canh[d.canh.length - 1].ketThuc || 0 : 0)} / {fmtGiay(total)}
        </span>
      </div>
    </div>
  );
}

interface CardProps {
  no: number;
  c: CanhDanY;
  t: TreatmentData;
  written: boolean;
  first: boolean;
  last: boolean;
  onChange: (patch: Partial<CanhDanY>) => void;
  onMove: (dir: -1 | 1) => void;
  onInsert: () => void;
  onRemove: () => void;
}

function SceneCard({ no, c, t, written, first, last, onChange, onMove, onInsert, onRemove }: CardProps) {
  const btn = 'p-2 rounded-xl text-gray-500 hover:text-black hover:bg-gray-100 disabled:opacity-30';
  return (
    <article className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3" aria-label={`Cảnh ${no}`}>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <p className="font-bold text-black">Cảnh {no}</p>
          <p className="text-xs text-gray-500">
            {c.id}
            {written ? ' · đã viết beat' : ''}
          </p>
        </div>
        <div className="w-48">
          <label htmlFor={`${c.id}-phan`} className="block text-xs font-bold text-gray-600 mb-1">Thuộc phần</label>
          <select id={`${c.id}-phan`} value={c.phan} onChange={(e) => onChange({ phan: e.target.value })} className={fieldCls}>
            <option value="">— chọn phần —</option>
            {t.phan.map((p, i) => (
              <option key={p.id} value={p.id}>
                {i + 1}. {p.ten}
              </option>
            ))}
          </select>
        </div>
        <NumberField label="Từ giây" value={c.batDau} onChange={(v) => onChange({ batDau: v })} />
        <NumberField label="Đến giây" value={c.ketThuc} onChange={(v) => onChange({ ketThuc: v })} />
        <span className="text-sm text-gray-500 pb-2.5">{fmtGiay(c.ketThuc - c.batDau)}</span>
        <div className="flex gap-1 ml-auto">
          <button onClick={() => onMove(-1)} disabled={first} className={btn} aria-label={`Đưa cảnh ${no} lên`} title="Đưa lên">
            <ArrowUp className="w-4 h-4" />
          </button>
          <button onClick={() => onMove(1)} disabled={last} className={btn} aria-label={`Đưa cảnh ${no} xuống`} title="Đưa xuống">
            <ArrowDown className="w-4 h-4" />
          </button>
          <button onClick={onInsert} className={btn} aria-label={`Chèn cảnh sau cảnh ${no}`} title="Chèn cảnh sau (chia đôi cảnh này)">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={onRemove} className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50" aria-label={`Xoá cảnh ${no}`} title="Xoá cảnh">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Địa điểm" value={c.diaDiem} onChange={(v) => onChange({ diaDiem: v })} placeholder="Phòng trọ của Lan" />
        <div>
          <label className="block text-sm font-bold text-black mb-1" htmlFor={`${c.id}-tag`}>Tag địa điểm</label>
          <div className="flex items-center">
            <span className="text-gray-500 mr-1">@</span>
            <input id={`${c.id}-tag`} value={c.tagDiaDiem} onChange={(e) => onChange({ tagDiaDiem: toTag(e.target.value) })} className={fieldCls} />
          </div>
        </div>
        <Field label="Thời điểm" value={c.thoiDiem} onChange={(v) => onChange({ thoiDiem: v })} placeholder="khuya" />
        <Field label="Ánh sáng" value={c.anhSang} onChange={(v) => onChange({ anhSang: v })} placeholder="đèn tuýp trắng, đèn bàn vàng" />
      </div>
      <Field label="Chuyển biến (đầu cảnh → cuối cảnh)" value={c.chuyenBien} onChange={(v) => onChange({ chuyenBien: v })} />
      <TagsField label="Nhân vật có mặt" value={c.coMat} parse={parseTags} onChange={(v) => onChange({ coMat: v })} hint="Tag nhân vật ở màn 2, cách nhau bằng dấu cách" />
      <div className="grid sm:grid-cols-2 gap-3">
        <LinesField label="Trạng thái đầu cảnh (mỗi dòng @tag: ở đâu, thế nào)" rows={3} value={c.dauCanh} toText={(v) => trangThaiText(v)} parse={parseTrangThai} onChange={(v) => onChange({ dauCanh: v })} />
        <LinesField label="Trạng thái cuối cảnh" rows={3} value={c.cuoiCanh} toText={(v) => trangThaiText(v)} parse={parseTrangThai} onChange={(v) => onChange({ cuoiCanh: v })} />
      </div>
    </article>
  );
}

interface Props {
  d: DanY;
  t: TreatmentData;
  total: number;
  chars: Character[];
  written: (id: string) => boolean;
  onScene: (id: string, patch: Partial<CanhDanY>) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onInsert: (id: string | null) => void;
  onRemove: (c: CanhDanY, no: number) => void;
  onCaiDung: (id: string, patch: Partial<CaiDungCanh>) => void;
}

export default function DanYPanel({ d, t, total, written, onScene, onMove, onInsert, onRemove, onCaiDung }: Props) {
  return (
    <div className="space-y-4">
      <SceneTimeline d={d} t={t} total={total} />
      {d.canh.map((c, i) => (
        <SceneCard
          key={c.id}
          no={i + 1}
          c={c}
          t={t}
          written={written(c.id)}
          first={i === 0}
          last={i === d.canh.length - 1}
          onChange={(patch) => onScene(c.id, patch)}
          onMove={(dir) => onMove(c.id, dir)}
          onInsert={() => onInsert(c.id)}
          onRemove={() => onRemove(c, i + 1)}
        />
      ))}
      <button onClick={() => onInsert(null)} className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-primary-100 text-sm font-bold flex items-center gap-1.5">
        <Plus className="w-4 h-4" /> Thêm cảnh cuối
      </button>

      {t.caiDung.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <h3 className="font-bold text-black">Cài – Dùng theo cảnh</h3>
          <p className="text-sm text-gray-600 -mt-2">Mỗi chi tiết của treatment được cài ở cảnh nào, dùng lại ở cảnh nào.</p>
          {t.caiDung.map((row) => {
            const r = d.caiDung.find((x) => x.id === row.id) || { id: row.id, cai: '', dung: '' };
            return (
              <div key={row.id} className="flex flex-wrap items-end gap-2">
                <p className="flex-1 min-w-[12rem] text-sm pb-2.5">
                  <b>{row.id}</b> {row.chiTiet}
                </p>
                {(['cai', 'dung'] as const).map((k) => (
                  <div key={k}>
                    <label htmlFor={`${row.id}-${k}`} className="block text-xs font-bold text-gray-600 mb-1">{k === 'cai' ? 'Cài ở' : 'Dùng ở'}</label>
                    <select id={`${row.id}-${k}`} value={r[k]} onChange={(e) => onCaiDung(row.id, { [k]: e.target.value } as Partial<CaiDungCanh>)} className={`${fieldCls} w-48`}>
                      <option value="">— chọn cảnh —</option>
                      {d.canh.map((c, i) => (
                        <option key={c.id} value={c.id}>
                          Cảnh {i + 1}: {c.diaDiem || c.id}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
