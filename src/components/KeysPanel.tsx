import React, { useEffect, useRef, useState } from 'react';
import { askConfirm } from '../lib/dialog';
import { KeyRound, Plus, Trash2, CheckCircle2, XCircle, Loader2, ExternalLink, ArrowRightLeft, Eye, EyeOff, Download, Upload } from 'lucide-react';
import { loadKeys, saveKeys, addKey, onKeysChange, mask, exportKeys, importKeys, KeyBook, Tier, ApiKeyItem } from '../lib/apiKeys';
import { testApiKey } from '../services/api';

interface Props {
  onKeyChange: () => void;
}

const TIER_INFO: Record<Tier, { title: string; hint: string }> = {
  free: {
    title: 'API miễn phí',
    hint: 'Luôn được dùng trước, xoay tua giữa các key. Bậc miễn phí có giới hạn lượt/phút và lượt/ngày, và không có model Pro.',
  },
  paid: {
    title: 'API trả phí',
    hint: 'Chỉ dùng khi mọi key miễn phí đều hết lượt, bị giới hạn hoặc không có model cần dùng. Cũng xoay tua.',
  },
};

function KeyRow({
  item, tier, onToggle, onRemove, onMove, onTest, testing,
}: {
  item: ApiKeyItem;
  tier: Tier;
  onToggle: () => void;
  onRemove: () => void;
  onMove: () => void;
  onTest: () => void;
  testing: boolean;
}) {
  return (
    <li className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 ${item.enabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
      <label className="flex items-center gap-2 flex-1 min-w-[12rem]">
        <input type="checkbox" checked={item.enabled} onChange={onToggle} className="accent-black" aria-label="Bật / tắt key" />
        <span className="min-w-0">
          <span className="block text-sm font-bold text-black truncate">{item.label || 'Không tên'}</span>
          <span className="block text-xs font-mono text-gray-500">{mask(item.key)}</span>
        </span>
      </label>
      {item.status && (
        <span className={`text-xs font-bold flex items-center gap-1 ${item.status === 'ok' ? 'text-green-700' : 'text-red-700'}`} title={item.message}>
          {item.status === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          {item.status === 'ok' ? `Dùng được${item.pro && item.pro !== 'ok' ? ' · không có Pro' : item.pro === 'ok' ? ' · có Pro' : ''}` : item.message}
        </span>
      )}
      <div className="flex gap-1">
        <button onClick={onTest} disabled={testing} className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 hover:bg-primary-100 disabled:opacity-50 flex items-center gap-1">
          {testing && <Loader2 className="w-3 h-3 animate-spin" />}
          Kiểm tra
        </button>
        <button onClick={onMove} title={tier === 'free' ? 'Chuyển sang nhóm trả phí' : 'Chuyển sang nhóm miễn phí'} className="p-1.5 rounded-full bg-gray-100 hover:bg-primary-100">
          <ArrowRightLeft className="w-3.5 h-3.5" />
        </button>
        <button onClick={onRemove} title="Xoá key" className="p-1.5 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-700">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
}

function AddForm({ tier, onAdd }: { tier: Tier; onAdd: (key: string, label: string) => string | null }) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <label className="sr-only" htmlFor={`label-${tier}`}>Tên gợi nhớ</label>
        <input
          id={`label-${tier}`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Tên gợi nhớ (VD: Gmail 2)"
          className="sm:w-44 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <div className="relative flex-1">
          <label className="sr-only" htmlFor={`key-${tier}`}>API key</label>
          <input
            id={`key-${tier}`}
            type={show ? 'text' : 'password'}
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setError('');
            }}
            placeholder="AIza..."
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-3 pr-10 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ẩn key' : 'Hiện key'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={() => {
            const err = onAdd(key, label);
            if (err) setError(err);
            else {
              setKey('');
              setLabel('');
            }
          }}
          disabled={!key.trim()}
          className="px-4 py-2 rounded-xl bg-black text-primary-400 text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <Plus className="w-4 h-4" /> Thêm
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

export default function KeysPanel({ onKeyChange }: Props) {
  const [book, setBook] = useState<KeyBook>(loadKeys);
  const [testing, setTesting] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const added = importKeys(String(reader.result));
        setBook(loadKeys());
        setNotice({
          ok: true,
          text: added.free + added.paid ? `Đã thêm ${added.free} key miễn phí, ${added.paid} key trả phí.` : 'Mọi key trong file đã có sẵn, không thêm gì.',
        });
      } catch (err: any) {
        setNotice({ ok: false, text: err?.message || 'File không hợp lệ.' });
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const off = onKeysChange(() => {
      setBook(loadKeys());
      onKeyChange();
    });
    return () => {
      off();
    };
  }, [onKeyChange]);

  const update = (next: KeyBook) => {
    saveKeys(next);
    setBook(next);
  };

  const patchItem = (tier: Tier, id: string, patch: Partial<ApiKeyItem>) =>
    update({ ...book, [tier]: book[tier].map((k) => (k.id === id ? { ...k, ...patch } : k)) });

  const test = async (tier: Tier, item: ApiKeyItem) => {
    setTesting(item.id);
    // Lỗi mạng bất ngờ → vẫn ghi kết quả "lỗi" và tắt vòng quay (trước đây nút quay mãi, không báo gì)
    const r = await testApiKey(item.key).catch((e: any) => ({ ok: false, message: e?.message || 'Không kiểm tra được key.', pro: undefined as string | undefined }));
    const latest = loadKeys();
    const next = {
      ...latest,
      [tier]: latest[tier].map((k) =>
        k.id === item.id ? { ...k, status: r.ok ? ('ok' as const) : ('error' as const), message: r.message, pro: r.pro, checkedAt: Date.now() } : k
      ),
    };
    update(next);
    setTesting('');
  };

  const testAll = async () => {
    for (const tier of ['free', 'paid'] as Tier[]) for (const k of loadKeys()[tier]) if (k.enabled) await test(tier, k);
  };

  const total = book.free.filter((k) => k.enabled).length + book.paid.filter((k) => k.enabled).length;

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-6 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-primary-400 text-black p-2.5 rounded-xl">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-black">Gemini API key</h2>
            <p className="text-sm text-gray-500">
              {total} key đang bật · ưu tiên miễn phí, hết cách mới dùng trả phí · key chỉ lưu trong trình duyệt này
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImport} />
          <button onClick={() => fileRef.current?.click()} className="px-3 py-2 rounded-full text-sm font-bold bg-gray-100 hover:bg-primary-100 flex items-center gap-1.5">
            <Upload className="w-4 h-4" /> Nhập key từ file
          </button>
          {book.free.length + book.paid.length > 0 && (
            <button onClick={exportKeys} className="px-3 py-2 rounded-full text-sm font-bold bg-gray-100 hover:bg-primary-100 flex items-center gap-1.5">
              <Download className="w-4 h-4" /> Xuất key ra file
            </button>
          )}
          {total > 0 && (
            <button onClick={testAll} disabled={!!testing} className="px-3 py-2 rounded-full text-sm font-bold bg-gray-100 hover:bg-primary-100 disabled:opacity-50">
              Kiểm tra tất cả
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p role="status" className={`mb-4 text-sm rounded-xl px-4 py-2.5 ${notice.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          {notice.text}
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {(['free', 'paid'] as Tier[]).map((tier) => (
          <div key={tier} className="space-y-3">
            <div>
              <h3 className="font-bold text-black flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${tier === 'free' ? 'bg-green-500' : 'bg-primary-500'}`} aria-hidden="true" />
                {TIER_INFO[tier].title} ({book[tier].length})
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">{TIER_INFO[tier].hint}</p>
            </div>
            {book[tier].length > 0 && (
              <ul className="space-y-2">
                {book[tier].map((k) => (
                  <KeyRow
                    key={k.id}
                    item={k}
                    tier={tier}
                    testing={testing === k.id}
                    onToggle={() => patchItem(tier, k.id, { enabled: !k.enabled })}
                    onRemove={async () => {
                      if (!(await askConfirm(`Xoá key "${k.label || mask(k.key)}"?`, { okLabel: 'Xoá', danger: true }))) return;
                      // Đọc lại sổ key mới nhất (sổ có thể đổi trong lúc hộp thoại đang mở)
                      const latest = loadKeys();
                      update({ ...latest, [tier]: latest[tier].filter((x) => x.id !== k.id) });
                    }}
                    onMove={() => {
                      const other: Tier = tier === 'free' ? 'paid' : 'free';
                      update({ ...book, [tier]: book[tier].filter((x) => x.id !== k.id), [other]: [...book[other], k] });
                    }}
                    onTest={() => test(tier, k)}
                  />
                ))}
              </ul>
            )}
            <AddForm
              tier={tier}
              onAdd={(key, label) => {
                try {
                  const next = addKey(book, tier, key, label);
                  setBook(next);
                  const added = next[tier][next[tier].length - 1];
                  test(tier, added);
                  return null;
                } catch (e: any) {
                  return e.message;
                }
              }}
            />
          </div>
        ))}
      </div>

      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary-700 hover:text-black mt-4">
        Lấy API key tại Google AI Studio <ExternalLink className="w-3 h-3" />
      </a>
      <p className="text-xs text-gray-500 mt-2">
        File xuất ra chứa key ở dạng chữ thường: cất kỹ như mật khẩu, đừng gửi cho người khác. Nhập file thì key đã có được bỏ qua, key mới được thêm đúng nhóm.
        <br />
        Thứ tự mỗi lần gọi: model của tác vụ → các key miễn phí (xoay tua) → các key trả phí (xoay tua) → model dự phòng. Key chạm giới hạn được nghỉ tự động: 1 phút (giới hạn theo phút), 1 giờ (hết lượt trong ngày), 6 giờ (không có model đó). "Kiểm tra" tốn 2 lượt gọi rất nhỏ.
      </p>
    </section>
  );
}
