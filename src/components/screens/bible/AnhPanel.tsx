// Màn ⑥ — ảnh tham chiếu: gửi ảnh theo lô → AI quét gán @tag → duyệt rồi lưu; hoặc gắn ảnh riêng cho từng tag.
// Giữ cách làm của bước Nhân vật & đạo cụ cũ, thêm loại bối cảnh và vai trò ảnh cho màn ⑧.
import React, { useRef, useState } from 'react';
import { Upload, ImagePlus, Download, Trash2, ScanSearch, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import type { AnhThamChieu } from '../../../types';
import type { MucAnh, LoaiAnh } from '../../../../shared/bible';
import { matchImages, ImageMatch } from '../../../services/api';
import { useImage } from '../../../lib/useImage';
import { putImage, deleteImage, readAndResize, shrinkDataUrl, splitDataUrl, downloadDataUrl } from '../../../lib/images';
import { PasteZone, PasteButton, PASTE_KEYS } from '../../PasteZone';
import { CopyButton, ErrorBox, RunButton } from '../../ui';

const LOAI: Record<LoaiAnh, { label: string; cls: string }> = {
  character: { label: 'Nhân vật', cls: 'bg-primary-100 text-primary-800' },
  prop: { label: '★ Đạo cụ', cls: 'bg-gray-100 text-gray-700' },
  location: { label: 'Bối cảnh', cls: 'bg-black text-primary-400' },
};

interface Pending {
  full: string;
  preview: string;
  match: ImageMatch | null;
  tag: string;
  /** Quét lỗi: chọn tag bằng tay (không có gì AI thấy để lưu) */
  chuaQuet?: boolean;
}

function TagCard({ m, anh, onReplace, onRemove, onError }: { m: MucAnh; anh?: AnhThamChieu; onReplace: (f: File) => void; onRemove: () => void; onError: (msg: string) => void }) {
  const url = useImage(anh?.imageId);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <article className={`bg-white border rounded-2xl p-4 flex flex-col sm:flex-row gap-4 ${m.khongDung ? 'border-amber-300 opacity-70' : 'border-gray-200'}`} aria-label={`Ảnh @${m.tag}`}>
      <div className="sm:w-44 shrink-0">
        <PasteZone label={`ảnh @${m.tag}`} onFiles={(files) => onReplace(files[0])} onError={onError} className="rounded-xl">
          <div className="aspect-square rounded-xl bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center">
            {url ? <img src={url} alt={`Ảnh tham chiếu @${m.tag}`} loading="lazy" decoding="async" className="w-full h-full object-contain" /> : <span className="text-xs text-gray-400 text-center px-3">Chưa có ảnh</span>}
          </div>
        </PasteZone>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onReplace(f);
            e.target.value = '';
          }}
        />
        <div className="flex gap-1.5 mt-2">
          <button onClick={() => fileRef.current?.click()} title="Gắn ảnh cho tag này" aria-label={`Gắn ảnh cho @${m.tag}`} className="flex-1 p-2 rounded-lg bg-gray-100 hover:bg-primary-100 flex justify-center">
            <ImagePlus className="w-4 h-4" />
          </button>
          <PasteButton iconOnly label={`Dán ảnh cho @${m.tag}`} onFiles={(files) => onReplace(files[0])} onError={onError} className="flex-1 p-2 rounded-lg bg-gray-100 hover:bg-primary-100 flex justify-center disabled:opacity-50" />
          {url && (
            <>
              <button onClick={() => downloadDataUrl(url, `${m.tag}.jpg`)} title={`Tải ảnh về với tên ${m.tag}.jpg`} className="flex-1 p-2 rounded-lg bg-gray-100 hover:bg-primary-100 flex justify-center">
                <Download className="w-4 h-4" />
              </button>
              <button onClick={onRemove} title="Gỡ ảnh" aria-label={`Gỡ ảnh @${m.tag}`} className="flex-1 p-2 rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-600 flex justify-center">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-lg font-bold text-black">@{m.tag}</h4>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LOAI[m.loai].cls}`}>{LOAI[m.loai].label}</span>
          <span className="text-sm text-gray-600">{m.ten}</span>
          {url && <CheckCircle2 className="w-4 h-4 text-green-700" aria-label="Đã có ảnh" />}
          {m.khongDung && <span className="text-xs font-bold text-amber-900">không còn dùng</span>}
        </div>
        <p className="text-sm text-gray-700">
          <b>Vai trò ở màn 8:</b> @{m.tag} as {m.vaiTro || '…'}
        </p>
        <div className="flex items-start gap-2">
          <p className="text-sm text-gray-700 flex-1">
            <b>Ô Note:</b> {m.note || <span className="text-gray-400">(chưa có — viết ở tab của mục này)</span>}
          </p>
          {m.note && <CopyButton text={m.note} />}
        </div>
        {anh?.seen && (
          <p className="text-sm text-gray-600">
            <b className="text-gray-800">AI thấy trong ảnh: </b>
            {anh.seen}
          </p>
        )}
        {anh?.warning && (
          <p className="text-sm text-red-700 flex gap-1.5">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {anh.warning}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {m.prompts.map((p) => (
            <CopyButton key={p.label} text={p.text} label={`Chép ${p.label}`} />
          ))}
        </div>
      </div>
    </article>
  );
}

interface Props {
  projectId: string;
  muc: MucAnh[];
  anh: Record<string, AnhThamChieu>;
  /** Ghi ảnh của nhiều tag một lần (luôn trên bản mới nhất) */
  onSet: (patch: Record<string, AnhThamChieu>) => void;
}

export default function AnhPanel({ projectId, muc, anh, onSet }: Props) {
  const [busy, setBusy] = useState<'' | 'scan' | 'save'>('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dangDung = muc.filter((m) => !m.khongDung);
  const missing = dangDung.filter((m) => !anh[m.tag]?.imageId);

  const scanFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return setError('Không có file ảnh nào trong số file vừa chọn (cần PNG, JPG hoặc WEBP).');
    if (!dangDung.length) return setError('Chưa có @tag nào. Bóc tách kịch bản trước.');
    setBusy('scan');
    setError('');
    try {
      const loaded: Pending[] = [];
      for (const f of images) {
        const full = await readAndResize(f, 1536);
        loaded.push({ full, preview: await shrinkDataUrl(full, 768), match: null, tag: '' });
      }
      setPending(loaded);
      const tagList = dangDung.map((m) => ({ tag: m.tag, kind: m.loai, note: m.note, description: `${m.ten}${m.vaiTro ? ` — ${m.vaiTro}` : ''}` }));
      // Quét từng lô 8 ảnh; lô nào xong hiện kết quả ngay
      for (let i = 0; i < loaded.length; i += 8) {
        const res = await matchImages(loaded.slice(i, i + 8).map((p) => splitDataUrl(p.preview)), tagList, projectId);
        setPending((list) =>
          list.map((p, j) => {
            const m = res.find((r) => r.index + i === j);
            return m ? { ...p, match: { ...m, index: j }, tag: m.tag || '' } : p;
          })
        );
      }
    } catch (e: any) {
      setError(`${e.message} — ảnh chưa quét được thì chọn tag bằng tay.`);
      // Ảnh chưa quét được vẫn chọn tag bằng tay được
      setPending((list) => list.map((p) => (p.match ? p : { ...p, chuaQuet: true, match: { index: -1, tag: '', confidence: 0, seen: '', warning: '' } })));
    } finally {
      setBusy('');
    }
  };

  const savePending = async () => {
    setBusy('save');
    // Ghi các ảnh đã lưu xong vào dự án trước, rồi mới xoá ảnh cũ — lỗi giữa chừng không để tag trỏ vào ảnh đã xoá
    const patch: Record<string, AnhThamChieu> = {};
    const xoa: string[] = [];
    try {
      for (const p of pending) {
        if (!p.tag) continue;
        const id = await putImage(p.full);
        const old = patch[p.tag]?.imageId || anh[p.tag]?.imageId;
        if (old) xoa.push(old);
        patch[p.tag] = { imageId: id, seen: p.match?.seen || '', warning: p.match?.warning || '' };
      }
      setPending([]);
    } catch (e: any) {
      setError(`${e.message} — đã lưu ${Object.keys(patch).length} ảnh trước khi lỗi.`);
      setPending((list) => list.filter((p) => !p.tag || !patch[p.tag]));
    } finally {
      if (Object.keys(patch).length) onSet(patch);
      xoa.forEach((id) => deleteImage(id).catch(() => undefined));
      setBusy('');
    }
  };

  const replaceOne = async (tag: string, file: File) => {
    try {
      const full = await readAndResize(file, 1536);
      const old = anh[tag]?.imageId;
      const id = await putImage(full);
      onSet({ [tag]: { imageId: id, seen: '', warning: '' } });
      if (old) deleteImage(old).catch(() => undefined);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const removeOne = async (tag: string) => {
    const old = anh[tag]?.imageId;
    onSet({ [tag]: {} });
    if (old) deleteImage(old).catch(() => undefined);
  };

  const dup = pending.map((p) => p.tag).filter((t, i, arr) => t && arr.indexOf(t) !== i);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 max-w-3xl">
        Chép prompt ảnh của từng tag sang công cụ tạo ảnh bạn dùng. Tạo xong, gửi hết ảnh về một lượt: AI quét từng ảnh, đoán @tag, bạn duyệt rồi lưu. Thiếu ảnh vẫn duyệt được màn này, nhưng màn 8 sẽ cần đủ ảnh.
      </p>
      <ErrorBox message={error} />

      <PasteZone label="gửi ảnh theo lô" multiple drop={false} disabled={!!busy} onFiles={scanFiles} onError={setError} className="rounded-2xl">
        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            scanFiles(Array.from(e.dataTransfer.files || []));
          }}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${dragging ? 'border-primary-400 bg-primary-50' : 'border-gray-200'}`}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              scanFiles(Array.from(e.target.files || []));
              e.target.value = '';
            }}
          />
          <ScanSearch className="w-8 h-8 text-primary-600 mx-auto mb-2" />
          <p className="font-bold text-black">{missing.length ? `Còn ${missing.length}/${dangDung.length} tag chưa có ảnh` : `Đủ ảnh cho cả ${dangDung.length} tag`}</p>
          <p className="text-sm text-gray-500 mb-4">Kéo thả nhiều ảnh vào đây, bấm vào vùng này rồi nhấn {PASTE_KEYS} để dán, hoặc bấm nút bên dưới.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <RunButton onClick={() => fileRef.current?.click()} busy={busy === 'scan'} busyLabel="AI đang quét ảnh…" icon={Upload} variant="yellow" disabled={!!busy}>
              Gửi ảnh về
            </RunButton>
            <PasteButton multiple onFiles={scanFiles} onError={setError} disabled={!!busy} />
          </div>
        </section>
      </PasteZone>

      {pending.length > 0 && (
        <section className="bg-black text-white rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-primary-400 text-lg">Duyệt ảnh trước khi lưu</h3>
            <button onClick={() => setPending([])} className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10" title="Huỷ" aria-label="Huỷ">
              <X className="w-4 h-4" />
            </button>
          </div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pending.map((p, i) => (
              <li key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                <img src={p.preview} alt={`Ảnh gửi lên số ${i + 1}`} className="w-full aspect-square object-contain rounded-lg bg-white" />
                {p.match ? (
                  <>
                    <select
                      value={p.tag}
                      onChange={(e) => setPending((list) => list.map((x, j) => (j === i ? { ...x, tag: e.target.value } : x)))}
                      aria-label={`Gán tag cho ảnh số ${i + 1}`}
                      className="w-full bg-white text-black rounded-lg p-2 text-sm"
                    >
                      <option value="">Bỏ qua ảnh này</option>
                      {dangDung.map((m) => (
                        <option key={m.tag} value={m.tag}>
                          @{m.tag} — {m.ten}
                          {anh[m.tag]?.imageId ? ' (thay ảnh cũ)' : ''}
                        </option>
                      ))}
                    </select>
                    {p.match.tag && (
                      <p className="text-xs text-gray-400">
                        AI đoán @{p.match.tag} · tự tin {p.match.confidence}%
                      </p>
                    )}
                    {p.match.seen && <p className="text-xs text-gray-300">{p.match.seen}</p>}
                    {p.match.warning && <p className="text-xs text-red-300">⚠ {p.match.warning}</p>}
                    {p.chuaQuet && <p className="text-xs text-gray-400">Chưa quét được — chọn tag bằng tay.</p>}
                  </>
                ) : (
                  <p className="text-xs text-gray-400">Đang quét…</p>
                )}
              </li>
            ))}
          </ul>
          {dup.length > 0 && <p className="text-sm text-red-300">Nhiều ảnh cùng gán vào @{Array.from(new Set(dup)).join(', @')} — ảnh sau sẽ đè ảnh trước.</p>}
          <RunButton onClick={savePending} busy={busy === 'save'} busyLabel="Đang lưu…" icon={CheckCircle2} variant="yellow" disabled={!!busy || pending.every((p) => !p.tag)} className="w-full">
            Lưu {pending.filter((p) => p.tag).length} ảnh vào dự án
          </RunButton>
        </section>
      )}

      <section className="space-y-3">
        {muc.map((m) => (
          <TagCard key={m.tag} m={m} anh={anh[m.tag]} onReplace={(f) => replaceOne(m.tag, f)} onRemove={() => removeOne(m.tag)} onError={setError} />
        ))}
      </section>
    </div>
  );
}
