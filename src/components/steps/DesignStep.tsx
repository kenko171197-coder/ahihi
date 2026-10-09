import React, { useRef, useState } from 'react';
import { askConfirm } from '../../lib/dialog';
import { PasteZone, PasteButton, PASTE_KEYS } from '../PasteZone';
import { Palette, Upload, ImagePlus, Download, Trash2, ScanSearch, CheckCircle2, AlertTriangle, RefreshCw, X, ArrowRight, Plus } from 'lucide-react';
import type { Asset, LegacyProject as Project, LegacyPatch as ProjectPatch, Seed } from '../../types';
import { makeDesign, matchImages, ImageMatch } from '../../services/api';
import { useImage } from '../../lib/useImage';
import { putImage, deleteImage, readAndResize, shrinkDataUrl, splitDataUrl, downloadDataUrl } from '../../lib/images';
import { CopyButton, ErrorBox, RunButton } from '../ui';

interface Props {
  project: Project;
  onUpdate: (patch: ProjectPatch) => void;
  onNext: () => void;
}

interface TagInfo {
  tag: string;
  kind: 'character' | 'prop';
  note: string;
  description: string;
  prompts: { label: string; text: string }[];
}

interface Pending {
  full: string;
  preview: string;
  match: ImageMatch | null;
  tag: string;
}

function TagCard({
  info,
  asset,
  onNote,
  onReplace,
  onRemove,
  onError,
}: {
  info: TagInfo;
  asset?: Asset;
  onNote: (note: string) => void;
  onReplace: (file: File) => void;
  onRemove: () => void;
  onError?: (message: string) => void;
}) {
  const url = useImage(asset?.imageId);
  const fileRef = useRef<HTMLInputElement>(null);
  const note = asset?.note ?? info.note;

  return (
    <article className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-4">
      <div className="sm:w-44 shrink-0">
        <PasteZone label={`ảnh @${info.tag}`} onFiles={(files) => onReplace(files[0])} onError={onError} className="rounded-xl">
          <div className="aspect-square rounded-xl bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center">
            {url ? (
              <img src={url} alt={`Ảnh tham chiếu @${info.tag}`} loading="lazy" decoding="async" className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs text-gray-400 text-center px-3">Chưa có ảnh</span>
            )}
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
          <button onClick={() => fileRef.current?.click()} title="Gắn ảnh cho tag này" className="flex-1 p-2 rounded-lg bg-gray-100 hover:bg-primary-100 flex justify-center">
            <ImagePlus className="w-4 h-4" />
          </button>
          <PasteButton
            iconOnly
            label={`Dán ảnh cho @${info.tag}`}
            onFiles={(files) => onReplace(files[0])}
            onError={onError}
            className="flex-1 p-2 rounded-lg bg-gray-100 hover:bg-primary-100 flex justify-center disabled:opacity-50"
          />
          {url && (
            <>
              <button onClick={() => downloadDataUrl(url, `${info.tag}.jpg`)} title={`Tải ảnh về với tên ${info.tag}.jpg`} className="flex-1 p-2 rounded-lg bg-gray-100 hover:bg-primary-100 flex justify-center">
                <Download className="w-4 h-4" />
              </button>
              <button onClick={onRemove} title="Gỡ ảnh" className="flex-1 p-2 rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-600 flex justify-center">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold text-black">@{info.tag}</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${info.kind === 'character' ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-700'}`}>
            {info.kind === 'character' ? 'Nhân vật' : '★ Đạo cụ'}
          </span>
          {url && <CheckCircle2 className="w-4 h-4 text-green-700" aria-label="Đã có ảnh" />}
        </div>

        {info.description && <p className="text-sm text-gray-600">{info.description}</p>}

        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label htmlFor={`note-${info.tag}`} className="text-sm font-bold text-black">Ô Note</label>
            <CopyButton text={note} />
          </div>
          <textarea
            id={`note-${info.tag}`}
            rows={2}
            value={note}
            onChange={(e) => onNote(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>

        {asset?.seen && (
          <p className="text-sm text-gray-600">
            <span className="font-bold text-gray-800">AI thấy trong ảnh: </span>
            {asset.seen}
          </p>
        )}
        {asset?.warning && (
          <p className="text-sm text-red-700 flex gap-1.5">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {asset.warning}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {info.prompts.map((p) => (
            <CopyButton key={p.label} text={p.text} label={`Chép ${p.label}`} />
          ))}
        </div>
      </div>
    </article>
  );
}

/* ---------- Đầu vào: tóm tắt, style, danh sách nhân vật & đạo cụ ---------- */

const field = 'w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400';

function SeedList({ title, hint, items, onChange }: { title: string; hint: string; items: Seed[]; onChange: (v: Seed[]) => void }) {
  const set = (i: number, patch: Partial<Seed>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-bold text-black">{title}</h4>
        <button onClick={() => onChange([...items, { name: '', brief: '' }])} className="flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-full bg-gray-100 hover:bg-primary-100">
          <Plus className="w-4 h-4" /> Thêm
        </button>
      </div>
      {items.length === 0 && <p className="text-sm text-gray-500">{hint}</p>}
      {items.map((it, i) => (
        <div key={i} className="flex flex-col sm:flex-row gap-2">
          <input value={it.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Tên (VD Ông Tư)" aria-label={`Tên ${title.toLowerCase()} số ${i + 1}`} className={`${field} sm:w-48`} />
          <input value={it.brief} onChange={(e) => set(i, { brief: e.target.value })} placeholder="Mô tả ngắn: tuổi, vai trò, đặc điểm nhìn thấy được…" aria-label={`Mô tả ${title.toLowerCase()} số ${i + 1}`} className={`${field} flex-1`} />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} title="Xoá dòng" className="p-2.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 self-start">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function InputForm({ project, onUpdate }: { project: Project; onUpdate: (patch: ProjectPatch) => void }) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-5">
      <div>
        <label htmlFor="synopsis" className="block font-bold text-black mb-1">Tóm tắt câu chuyện</label>
        <textarea id="synopsis" rows={3} value={project.synopsis} onChange={(e) => onUpdate({ synopsis: e.target.value })} placeholder="Vài câu: chuyện gì xảy ra, ở đâu, không khí thế nào. Các bước trước sẽ tự điền chỗ này khi được làm lại." className={field} />
      </div>
      <div className="grid sm:grid-cols-[1fr_auto] gap-4">
        <div>
          <label htmlFor="style" className="block font-bold text-black mb-1">Style chung (tiếng Anh, tuỳ chọn)</label>
          <input id="style" value={project.style} onChange={(e) => onUpdate({ style: e.target.value })} placeholder="VD: warm 2D hand-drawn animation, soft watercolor textures — để trống thì AI tự chọn" className={field} />
        </div>
        <div>
          <label htmlFor="aspect" className="block font-bold text-black mb-1">Tỉ lệ khung</label>
          <select id="aspect" value={project.aspect} onChange={(e) => onUpdate({ aspect: e.target.value as '16:9' | '9:16' })} className={field}>
            <option value="16:9">16:9 ngang</option>
            <option value="9:16">9:16 dọc</option>
          </select>
        </div>
      </div>
      <SeedList title="Nhân vật" hint="Chưa có nhân vật. Bấm Thêm để nhập tên và mô tả ngắn." items={project.characterSeeds} onChange={(characterSeeds) => onUpdate({ characterSeeds })} />
      <SeedList title="Đạo cụ" hint="Chưa có đạo cụ. Chỉ thêm những vật xuất hiện nhiều hoặc đổi hình dáng." items={project.propSeeds} onChange={(propSeeds) => onUpdate({ propSeeds })} />
    </section>
  );
}

export default function DesignStep({ project, onUpdate, onNext }: Props) {
  const [busy, setBusy] = useState<'' | 'design' | 'scan' | 'save'>('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const design = project.design;
  const hasSeeds = project.characterSeeds.some((x) => x.name.trim()) || project.propSeeds.some((x) => x.name.trim());
  const assets = project.assets || [];

  const tags: TagInfo[] = design
    ? [
        ...design.characters.map((c) => ({
          tag: c.tag,
          kind: 'character' as const,
          note: c.note,
          description: [c.age, c.appearance, c.outfit].filter(Boolean).join(' · '),
          prompts: [
            { label: 'prompt ảnh chính', text: c.standardPrompt },
            { label: 'reference sheet', text: c.sheetPrompt },
          ],
        })),
        ...design.props.map((p) => ({
          tag: p.tag,
          kind: 'prop' as const,
          note: p.note,
          description: p.description,
          prompts: [{ label: 'prompt ảnh', text: p.imagePrompt }],
        })),
      ]
    : [];
  const assetOf = (tag: string) => assets.find((a) => a.tag === tag);
  const missing = tags.filter((t) => !assetOf(t.tag)?.imageId);

  const setAsset = (tag: string, patch: Partial<Asset>, list = assets) => {
    const info = tags.find((t) => t.tag === tag);
    const exists = list.some((a) => a.tag === tag);
    return exists
      ? list.map((a) => (a.tag === tag ? { ...a, ...patch } : a))
      : [...list, { tag, kind: info?.kind || 'character', note: info?.note || '', ...patch }];
  };

  const generate = async () => {
    if (design && !(await askConfirm('Tạo lại thiết kế? Ảnh đã gắn vẫn giữ theo @tag, nhưng prompt và Note sẽ được viết lại.', { okLabel: 'Tạo lại' }))) return;
    setBusy('design');
    setError('');
    try {
      const next = await makeDesign(project);
      // Note mới từ thiết kế ghi đè Note cũ của tag đó; ảnh giữ nguyên
      const kept = assets.filter((a) => [...next.characters, ...next.props].some((x) => x.tag === a.tag));
      const merged = kept.map((a) => {
        const src = [...next.characters, ...next.props].find((x) => x.tag === a.tag);
        return src ? { ...a, note: src.note } : a;
      });
      onUpdate({ design: next, assets: merged });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const scanFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) {
      setError('Không có file ảnh nào trong số file vừa chọn (cần PNG, JPG hoặc WEBP).');
      return;
    }
    if (!tags.length) {
      setError('Tạo thiết kế trước để có danh sách @tag.');
      return;
    }
    setBusy('scan');
    setError('');
    try {
      const loaded: Pending[] = [];
      for (const f of images) {
        const full = await readAndResize(f, 1536);
        loaded.push({ full, preview: await shrinkDataUrl(full, 768), match: null, tag: '' });
      }
      setPending(loaded);

      const tagList = tags.map((t) => ({ tag: t.tag, kind: t.kind, note: assetOf(t.tag)?.note ?? t.note, description: t.description }));
      const results: ImageMatch[] = [];
      for (let i = 0; i < loaded.length; i += 8) {
        const chunk = loaded.slice(i, i + 8);
        const res = await matchImages(chunk.map((p) => splitDataUrl(p.preview)), tagList, project.id);
        res.forEach((m) => results.push({ ...m, index: m.index + i }));
      }
      setPending(loaded.map((p, i) => {
        const m = results.find((r) => r.index === i) || null;
        return { ...p, match: m, tag: m?.tag || '' };
      }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const savePending = async () => {
    setBusy('save');
    try {
      let list = assets;
      for (const p of pending) {
        if (!p.tag) continue;
        const old = list.find((a) => a.tag === p.tag)?.imageId;
        const id = await putImage(p.full);
        if (old) await deleteImage(old).catch(() => undefined);
        list = setAsset(p.tag, { imageId: id, seen: p.match?.seen || '', warning: p.match?.warning || '' }, list);
      }
      const saved = list.filter((a) => pending.some((p) => p.tag === a.tag));
      onUpdate((latest) => {
        const others = (latest.assets || []).filter((a) => !saved.some((x) => x.tag === a.tag));
        return { assets: [...others, ...saved] };
      });
      setPending([]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const replaceOne = async (tag: string, file: File) => {
    try {
      const full = await readAndResize(file, 1536);
      const old = assetOf(tag)?.imageId;
      const id = await putImage(full);
      if (old) await deleteImage(old).catch(() => undefined);
      onUpdate((latest) => ({ assets: setAsset(tag, { imageId: id, seen: '', warning: '' }, latest.assets || []) }));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const removeOne = async (tag: string) => {
    const old = assetOf(tag)?.imageId;
    if (old) await deleteImage(old).catch(() => undefined);
    onUpdate((latest) => ({ assets: setAsset(tag, { imageId: undefined, seen: '', warning: '' }, latest.assets || []) }));
  };

  const duplicateTags = pending
    .map((p) => p.tag)
    .filter((t, i, arr) => t && arr.indexOf(t) !== i);

  return (
    <div className="space-y-6">
      <InputForm project={project} onUpdate={onUpdate} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-gray-600 max-w-2xl">
          Chép prompt sang công cụ tạo ảnh bạn dùng, tạo xong gửi hết ảnh về một lượt. AI quét từng ảnh, đoán @tag, bạn duyệt rồi lưu.
        </p>
        <RunButton onClick={generate} busy={busy === 'design'} busyLabel="Đang thiết kế…" icon={design ? RefreshCw : Palette} variant={design ? 'ghost' : 'dark'} disabled={!!busy || !hasSeeds}>
          {design ? 'Tạo lại thiết kế' : 'Tạo thiết kế nhân vật & đạo cụ'}
        </RunButton>
      </div>

      <ErrorBox message={error} />

      {design && (
        <>
          {/* ---------- Gửi ảnh theo lô ---------- */}
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
            <p className="font-bold text-black">
              {missing.length ? `Còn ${missing.length}/${tags.length} tag chưa có ảnh` : `Đủ ảnh cho cả ${tags.length} tag`}
            </p>
            <p className="text-sm text-gray-500 mb-4">Kéo thả nhiều ảnh vào đây, bấm vào vùng này rồi nhấn {PASTE_KEYS} để dán, hoặc bấm nút bên dưới.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <RunButton onClick={() => fileRef.current?.click()} busy={busy === 'scan'} busyLabel="AI đang quét ảnh…" icon={Upload} variant="yellow" disabled={!!busy}>
                Gửi ảnh về
              </RunButton>
              <PasteButton multiple onFiles={scanFiles} onError={setError} disabled={!!busy} />
            </div>
          </section>
          </PasteZone>

          {/* ---------- Duyệt kết quả quét ---------- */}
          {pending.length > 0 && (
            <section className="bg-black text-white rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-primary-400 text-lg">Duyệt ảnh trước khi lưu</h3>
                <button onClick={() => setPending([])} className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10" title="Huỷ">
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
                          {tags.map((t) => (
                            <option key={t.tag} value={t.tag}>
                              @{t.tag}
                              {assetOf(t.tag)?.imageId ? ' (thay ảnh cũ)' : ''}
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
                      </>
                    ) : (
                      <p className="text-xs text-gray-400">Đang quét…</p>
                    )}
                  </li>
                ))}
              </ul>
              {duplicateTags.length > 0 && (
                <p className="text-sm text-red-300">Nhiều ảnh cùng gán vào @{Array.from(new Set(duplicateTags)).join(', @')} — ảnh sau sẽ đè ảnh trước.</p>
              )}
              <RunButton
                onClick={savePending}
                busy={busy === 'save'}
                busyLabel="Đang lưu…"
                icon={CheckCircle2}
                variant="yellow"
                disabled={!!busy || pending.every((p) => !p.tag)}
                className="w-full"
              >
                Lưu {pending.filter((p) => p.tag).length} ảnh vào dự án
              </RunButton>
            </section>
          )}

          {/* ---------- Danh sách tag ---------- */}
          <section className="space-y-3">
            {tags.map((t) => (
              <TagCard
                key={t.tag}
                info={t}
                asset={assetOf(t.tag)}
                onNote={(note) => onUpdate((latest) => ({ assets: setAsset(t.tag, { note }, latest.assets || []) }))}
                onReplace={(f) => replaceOne(t.tag, f)}
                onError={setError}
                onRemove={() => removeOne(t.tag)}
              />
            ))}
          </section>

          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3">
            {missing.length > 0 && <p className="text-sm text-gray-500">Còn {missing.length} tag chưa có ảnh. Vẫn sang bước sau được.</p>}
            <button onClick={onNext} className="py-3 px-6 rounded-xl bg-black hover:bg-gray-800 text-primary-400 font-bold flex items-center justify-center gap-2">
              Sang màn tiếp theo
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
