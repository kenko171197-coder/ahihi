// Màn ⑥ — các tab Style, Nhân vật, Đạo cụ, Bối cảnh & ánh sáng: sửa tay từng ô, xem prompt ảnh đã ghép.
import React from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import type { AnhSangCanh, BibleBoiCanh, BibleData, BibleDaoCu, BibleNhanVat, BienTheBoiCanh, BoDo } from '../../../types';
import { toTag, uniqueTag } from '../../../../shared/project';
import { promptNhanVat, promptSheet, promptDaoCu, promptBoiCanh, khoaAnhSang, tagsDaDung } from '../../../../shared/bible';
import { GIOI_HAN_TU, soTu } from '../../../../shared/checks';
import { CopyButton } from '../../ui';
import { Field, fieldCls } from '../common';

/** Ô tiếng Anh có đếm từ. */
function EnField({ label, value, onChange, max, rows = 2, placeholder }: { label: string; value: string; onChange: (v: string) => void; max: number; rows?: number; placeholder?: string }) {
  const n = soTu(value);
  return <Field label={label} rows={rows} value={value} onChange={onChange} placeholder={placeholder} hint={`Tiếng Anh · ${n}/${max} từ${n > max ? ' — quá dài' : ''}`} />;
}

function PromptBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-xs font-bold text-gray-600">{label} (app ghép, chép sang công cụ tạo ảnh)</p>
        <CopyButton text={text} />
      </div>
      <p className="text-xs text-gray-700 break-words">{text}</p>
    </div>
  );
}

function KhongDung({ ten, onRemove }: { ten: string; onRemove: () => void }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex flex-wrap items-center gap-2">
      <span className="flex-1">{ten} không còn trong kịch bản.</span>
      <button onClick={onRemove} className="px-3 py-1.5 rounded-full bg-white border border-amber-300 font-bold flex items-center gap-1.5">
        <Trash2 className="w-4 h-4" /> Xoá mục này
      </button>
    </div>
  );
}

const canhLabel = (ids: string[], order: string[]) => (ids.length ? ids.map((id) => `cảnh ${order.indexOf(id) + 1}`).join(', ') : 'không có cảnh nào');

/* ============================ Style ============================ */

export function StylePanel({ b, onStyle }: { b: BibleData; onStyle: (s: string) => void }) {
  return (
    <div className="space-y-4">
      <EnField label="Style của phim — một câu cố định, chép nguyên văn vào mọi prompt ảnh và video" rows={3} value={b.style} onChange={onStyle} max={GIOI_HAN_TU.style} placeholder="Cinematic photorealistic live-action, soft natural light, warm muted colors, subtle film grain." />
      <p className="text-xs text-gray-500">Đổi style thì mọi prompt ảnh tự ghép lại theo style mới. Ảnh đã tạo theo style cũ nên tạo lại.</p>
      {b.phuongAnStyle.length > 0 && (
        <div className="grid md:grid-cols-3 gap-3">
          {b.phuongAnStyle.map((p, i) => {
            const chosen = p.style === b.style;
            return (
              <article key={i} className={`rounded-2xl p-4 border space-y-2 ${chosen ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-white'}`} aria-label={`Phương án style ${i + 1}`}>
                <p className="text-xs font-bold text-gray-500">Phương án {i + 1}</p>
                <p className="text-sm text-black">{p.style}</p>
                <p className="text-sm text-gray-600">{p.giaiThich}</p>
                <button onClick={() => onStyle(p.style)} disabled={chosen} className="px-3 py-1.5 rounded-full bg-black text-primary-400 text-sm font-bold flex items-center gap-1.5 disabled:opacity-60">
                  <Check className="w-4 h-4" /> {chosen ? 'Đang dùng' : 'Dùng phương án này'}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================ Nhân vật ============================ */

/** Ô tag: gõ tự do, rời ô mới đổi (để tag không trùng tạm thời với tag khác trong lúc gõ). */
function TagInput({ id, value, disabled, onCommit }: { id: string; value: string; disabled?: boolean; onCommit: (tag: string) => boolean }) {
  const [text, setText] = React.useState(value);
  React.useEffect(() => setText(value), [value]);
  return (
    <input
      id={id}
      value={text}
      disabled={disabled}
      onChange={(e) => setText(toTag(e.target.value))}
      onBlur={() => {
        if (text !== value && !onCommit(text)) setText(value);
      }}
      className={`${fieldCls} disabled:opacity-60`}
    />
  );
}

export function NhanVatPanel({
  b, order, onChange, onRemove, onDoiTag,
}: {
  b: BibleData;
  order: string[];
  onChange: (tag: string, fn: (n: BibleNhanVat) => BibleNhanVat) => void;
  onRemove: (tag: string) => void;
  /** Đổi tag một bộ đồ (kèm chuyển ảnh). Trả false nếu tag không hợp lệ / trùng. */
  onDoiTag: (oldTag: string, newTag: string) => boolean;
}) {
  return (
    <div className="space-y-4">
      {b.nhanVat.length === 0 && <p className="text-sm text-gray-600">Kịch bản không có nhân vật nào.</p>}
      {b.nhanVat.map((n) => {
        // Bộ đồ được chỉ theo vị trí (không theo tag) để sửa một bộ không bao giờ đụng bộ khác
        const setBo = (k: number, patch: Partial<BoDo>) => onChange(n.tag, (x) => ({ ...x, bo: x.bo.map((y, j) => (j === k ? { ...y, ...patch } : y)) }));
        /** Chọn bộ đồ cho một cảnh: cảnh đó rời các bộ khác (mỗi cảnh đúng một bộ). */
        const ganCanh = (k: number, id: string) => onChange(n.tag, (x) => ({ ...x, bo: x.bo.map((y, j) => ({ ...y, canh: j === k ? order.filter((c) => c === id || y.canh.includes(c)) : y.canh.filter((c) => c !== id) })) }));
        const themBo = () =>
          onChange(n.tag, (x) => {
            const tag = uniqueTag(`${x.tag}bo`, new Set([...tagsDaDung(b), ...Object.keys(b.anh)]));
            return { ...x, bo: [...x.bo, { tag, ten: `bộ ${x.bo.length + 1}`, canh: [], moTa: x.bo[0]?.moTa || '', note: '', khungAnh: x.bo[0]?.khungAnh || '', vaiTro: '' }] };
          });
        /** Xoá một bộ: cảnh của nó về bộ mang tag nhân vật (hoặc bộ đầu). */
        const xoaBo = (k: number) =>
          onChange(n.tag, (x) => {
            const gone = x.bo[k];
            const rest = x.bo.filter((_, j) => j !== k);
            const dich = Math.max(0, rest.findIndex((y) => y.tag === x.tag));
            return { ...x, bo: rest.map((y, j) => (j === dich ? { ...y, canh: order.filter((c) => y.canh.includes(c) || gone?.canh.includes(c)) } : y)) };
          });
        return (
          <article key={n.tag} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3" aria-label={`Nhân vật ${n.ten}`}>
            <div>
              <h4 className="font-bold text-black text-lg">
                {n.ten} <span className="text-gray-500 font-normal">@{n.tag}</span>
              </h4>
              <p className="text-xs text-gray-500">
                {n.canh.length ? `Có mặt ở ${canhLabel(n.canh, order)}` : 'Không xuất hiện trên hình — chỉ có giọng'} · {n.coThoai ? 'có thoại' : 'không có thoại'}
              </p>
            </div>
            {n.khongDung && <KhongDung ten={n.ten} onRemove={() => onRemove(n.tag)} />}
            {n.coThoai && <EnField label="Giọng (chỉ dùng ở màn 8, phần thoại của prompt video)" value={n.giong} onChange={(v) => onChange(n.tag, (x) => ({ ...x, giong: v }))} max={GIOI_HAN_TU.giong} placeholder="young woman in her twenties, soft slightly husky voice, speaks slowly, Northern Vietnamese accent" />}
            {n.bo.map((bo, i) => (
              <section key={i} className="border-l-2 border-primary-400 pl-3 space-y-2" aria-label={`Bộ đồ ${bo.ten}`}>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[10rem]">
                    <Field label={`Bộ đồ ${i + 1}`} value={bo.ten} onChange={(v) => setBo(i, { ten: v })} />
                  </div>
                  <div className="w-40">
                    <label htmlFor={`bo-${n.tag}-${i}`} className="block text-sm font-bold text-black mb-1">Tag ảnh</label>
                    <div className="flex items-center">
                      <span className="text-gray-500 mr-1">@</span>
                      <TagInput id={`bo-${n.tag}-${i}`} value={bo.tag} disabled={bo.tag === n.tag} onCommit={(t) => onDoiTag(bo.tag, t)} />
                    </div>
                  </div>
                  {n.bo.length > 1 && bo.tag !== n.tag && (
                    <button onClick={() => xoaBo(i)} aria-label={`Xoá bộ đồ ${bo.ten}`} title="Xoá bộ đồ (cảnh của bộ này về bộ đầu)" className="p-2.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {n.bo.length > 1 && (
                  <div>
                    <p className="text-xs font-bold text-gray-600 mb-1">Cảnh mặc bộ này</p>
                    <div className="flex flex-wrap gap-1.5">
                      {n.canh.map((id) => {
                        const on = bo.canh.includes(id);
                        return (
                          <button key={id} onClick={() => ganCanh(i, id)} aria-pressed={on} className={`px-2.5 py-1 rounded-full text-xs font-bold border ${on ? 'bg-black text-primary-400 border-black' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-400'}`}>
                            Cảnh {order.indexOf(id) + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <EnField label="Mô tả cố định (ngoại hình + trang phục)" rows={3} value={bo.moTa} onChange={(v) => setBo(i, { moTa: v })} max={GIOI_HAN_TU.moTaNhanVat} />
                <div className="grid sm:grid-cols-2 gap-2">
                  <Field label="Ô Note (tiếng Việt)" rows={2} value={bo.note} onChange={(v) => setBo(i, { note: v })} />
                  <EnField label="Khung ảnh (góc, tư thế, nền)" value={bo.khungAnh} onChange={(v) => setBo(i, { khungAnh: v })} max={GIOI_HAN_TU.khungAnh} />
                </div>
                <EnField label="Vai trò ảnh ở màn 8" rows={1} value={bo.vaiTro} onChange={(v) => setBo(i, { vaiTro: v })} max={GIOI_HAN_TU.vaiTro} placeholder="Lan in her office clothes" />
                <PromptBox label="Prompt ảnh chính" text={promptNhanVat(bo, b.style)} />
                <PromptBox label="Prompt reference sheet" text={promptSheet(bo, b.style)} />
              </section>
            ))}
            {n.canh.length > 0 && !n.khongDung && (
              <button onClick={themBo} className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-primary-100 text-sm font-bold flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Thêm bộ đồ
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}

/* ============================ Đạo cụ ============================ */

export function DaoCuPanel({ b, order, onChange, onRemove }: { b: BibleData; order: string[]; onChange: (tag: string, patch: Partial<BibleDaoCu>) => void; onRemove: (tag: string) => void }) {
  return (
    <div className="space-y-4">
      {b.daoCu.length === 0 && <p className="text-sm text-gray-600">Kịch bản không khai đạo cụ nào.</p>}
      {b.daoCu.map((d) => (
        <article key={d.tag} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3" aria-label={`Đạo cụ @${d.tag}`}>
          <div>
            <h4 className="font-bold text-black text-lg">@{d.tag}</h4>
            <p className="text-sm text-gray-700">Trong kịch bản: {d.moTaKichBan}</p>
            <p className="text-xs text-gray-500">
              {d.trangThai.length ? `Trạng thái: ${d.trangThai.join(' → ')} · ` : ''}
              {canhLabel(d.canh, order)}
            </p>
          </div>
          {d.khongDung && <KhongDung ten={`Đạo cụ @${d.tag}`} onRemove={() => onRemove(d.tag)} />}
          <EnField label="Mô tả cố định (hình dáng, chất liệu, màu, kích thước so với người)" rows={2} value={d.moTa} onChange={(v) => onChange(d.tag, { moTa: v })} max={GIOI_HAN_TU.moTaDaoCu} />
          <div className="grid sm:grid-cols-2 gap-2">
            <Field label="Ô Note (tiếng Việt)" rows={2} value={d.note} onChange={(v) => onChange(d.tag, { note: v })} />
            <EnField label="Khung ảnh (trạng thái đầu, nền trắng)" value={d.khungAnh} onChange={(v) => onChange(d.tag, { khungAnh: v })} max={GIOI_HAN_TU.khungAnh} />
          </div>
          <EnField label="Vai trò ảnh ở màn 8" rows={1} value={d.vaiTro} onChange={(v) => onChange(d.tag, { vaiTro: v })} max={GIOI_HAN_TU.vaiTro} />
          <PromptBox label="Prompt ảnh" text={promptDaoCu(d, b.style)} />
        </article>
      ))}
    </div>
  );
}

/* ============================ Bối cảnh & ánh sáng ============================ */

export function BoiCanhPanel({
  b, order, tiLe, onChange, onBienThe, onAnhSang, onRemove, onXoaBienThe,
}: {
  b: BibleData;
  order: string[];
  tiLe: string;
  onChange: (tag: string, patch: Partial<BibleBoiCanh>) => void;
  onBienThe: (tag: string, vtag: string, patch: Partial<BienTheBoiCanh>) => void;
  /** Sửa câu ánh sáng của một cảnh — app chép sang mọi cảnh cùng địa điểm, thời điểm, ánh sáng */
  onAnhSang: (a: AnhSangCanh, moTa: string) => void;
  onRemove: (tag: string) => void;
  /** Xoá một ảnh bối cảnh không còn dùng */
  onXoaBienThe: (tag: string, vtag: string) => void;
}) {
  const nhom = new Map<string, number>();
  b.anhSang.forEach((a) => nhom.set(khoaAnhSang(a), (nhom.get(khoaAnhSang(a)) || 0) + 1));
  return (
    <div className="space-y-4">
      {b.boiCanh.map((c) => (
        <article key={c.tag} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3" aria-label={`Bối cảnh ${c.ten}`}>
          <div>
            <h4 className="font-bold text-black text-lg">
              {c.ten} <span className="text-gray-500 font-normal">@{c.tag}</span>
            </h4>
            <p className="text-xs text-gray-500">{canhLabel(c.canh, order)}</p>
          </div>
          {c.khongDung && <KhongDung ten={c.ten} onRemove={() => onRemove(c.tag)} />}
          <EnField label="Mô tả cố định của không gian (không người, không ánh sáng)" rows={3} value={c.moTa} onChange={(v) => onChange(c.tag, { moTa: v })} max={GIOI_HAN_TU.moTaBoiCanh} />
          {c.bienThe.map((v) => (
            <section key={v.tag} className="border-l-2 border-primary-400 pl-3 space-y-2" aria-label={`Ảnh bối cảnh @${v.tag}`}>
              <p className="text-sm font-bold text-black">
                Ảnh @{v.tag} · {v.thoiDiem || 'không rõ thời điểm'} <span className="font-normal text-gray-500">· {canhLabel(v.canh, order)}</span>
              </p>
              {v.khongDung && <KhongDung ten={`Ảnh @${v.tag} (${v.thoiDiem})`} onRemove={() => onXoaBienThe(c.tag, v.tag)} />}
              <div className="grid sm:grid-cols-2 gap-2">
                <EnField label="Khung ảnh (thời điểm, ánh sáng, góc rộng)" value={v.khungAnh} onChange={(x) => onBienThe(c.tag, v.tag, { khungAnh: x })} max={GIOI_HAN_TU.khungAnh} />
                <Field label="Ô Note (tiếng Việt)" rows={2} value={v.note} onChange={(x) => onBienThe(c.tag, v.tag, { note: x })} />
              </div>
              <EnField label="Vai trò ảnh ở màn 8" rows={1} value={v.vaiTro} onChange={(x) => onBienThe(c.tag, v.tag, { vaiTro: x })} max={GIOI_HAN_TU.vaiTro} />
              <PromptBox label="Prompt ảnh" text={promptBoiCanh(c, v, b.style, tiLe)} />
            </section>
          ))}
        </article>
      ))}

      <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <h3 className="font-bold text-black">Ánh sáng từng cảnh</h3>
        <p className="text-sm text-gray-600 -mt-2">Câu tiếng Anh được chép nguyên văn vào mọi beat của cảnh. Sửa một cảnh thì các cảnh cùng địa điểm, cùng thời điểm, cùng ánh sáng đổi theo.</p>
        {b.anhSang.map((a) => (
          <div key={a.canh} className="grid sm:grid-cols-[14rem_1fr] gap-2 items-start">
            <p className="text-sm text-gray-700 pt-1">
              <b>Cảnh {order.indexOf(a.canh) + 1}</b> · @{a.diaDiem} · {a.thoiDiem}
              <br />
              <span className="text-gray-500">{a.goc}</span>
              {(nhom.get(khoaAnhSang(a)) || 0) > 1 && <span className="block text-xs text-gray-400">dùng chung với {(nhom.get(khoaAnhSang(a)) || 1) - 1} cảnh khác</span>}
            </p>
            <EnField label={`Ánh sáng cảnh ${order.indexOf(a.canh) + 1}`} rows={2} value={a.moTa} onChange={(v) => onAnhSang(a, v)} max={GIOI_HAN_TU.anhSang} />
          </div>
        ))}
      </section>
    </div>
  );
}
