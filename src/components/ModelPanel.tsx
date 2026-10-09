import React, { useState } from 'react';
import { Cpu, RotateCcw, ChevronDown } from 'lucide-react';
import { MODEL_CATALOG, TASKS, modelInfo, selectableModels } from '../../shared/models';
import { loadModelPrefs, saveModelPrefs, resetModelPrefs } from '../lib/modelPrefs';

const price = (id: string) => {
  const m = modelInfo(id);
  if (!m) return '';
  if (m.input === undefined) return m.priceNote || '';
  return `$${m.input} vào / $${m.output} ra`;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Đang chạy', cls: 'bg-green-100 text-green-800' },
  retiring: { label: 'Sắp ngừng', cls: 'bg-primary-100 text-primary-800' },
  shutdown: { label: 'Đã ngừng', cls: 'bg-red-100 text-red-700' },
};

const GROUP: Record<string, string> = {
  flash: 'Flash & Flash-Lite — tác vụ nhanh, quét ảnh, chi phí thấp',
  pro: 'Pro — suy luận sâu, logic phức tạp, viết dài',
  special: 'Chuyên biệt — ảnh, giọng nói, realtime, video (không dùng cho tác vụ viết chữ của app)',
};

export default function ModelPanel() {
  const [prefs, setPrefs] = useState(loadModelPrefs);
  const [showCatalog, setShowCatalog] = useState(false);
  const options = selectableModels();

  const change = (task: string, model: string) => {
    const next = { ...prefs, [task]: model };
    setPrefs(next);
    saveModelPrefs(next);
  };

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-6 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-primary-400 text-black p-2.5 rounded-xl">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-black">Model cho từng tác vụ</h2>
            <p className="text-sm text-gray-500">Giá USD / 1 triệu token (bậc trả phí). Model chọn lỗi hoặc hết quota → app tự chuyển 3.8 Flash rồi 3.1 Flash-Lite.</p>
          </div>
        </div>
        <button
          onClick={() => {
            resetModelPrefs();
            setPrefs(loadModelPrefs());
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm text-gray-600 bg-gray-100 hover:bg-primary-100"
        >
          <RotateCcw className="w-4 h-4" />
          Về mặc định
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-2 pr-3 font-medium">Tác vụ</th>
              <th className="py-2 pr-3 font-medium">Model</th>
              <th className="py-2 pr-3 font-medium">Giá</th>
              <th className="py-2 font-medium">Vì sao mặc định</th>
            </tr>
          </thead>
          <tbody>
            {TASKS.map((t) => {
              const chosen = prefs[t.key];
              const m = modelInfo(chosen);
              return (
                <tr key={t.key} className="border-t border-gray-100 align-top">
                  <td className="py-2.5 pr-3 font-medium text-black whitespace-nowrap">{t.label}</td>
                  <td className="py-2.5 pr-3">
                    <label className="sr-only" htmlFor={`m-${t.key}`}>Model cho {t.label}</label>
                    <select
                      id={`m-${t.key}`}
                      value={chosen}
                      onChange={(e) => change(t.key, e.target.value)}
                      className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    >
                      {(['pro', 'flash'] as const).map((g) => (
                        <optgroup key={g} label={g === 'pro' ? 'Pro' : 'Flash & Flash-Lite'}>
                          {options
                            .filter((o) => o.group === g)
                            .map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                                {o.status === 'retiring' ? ' (sắp ngừng)' : ''}
                                {o.id === t.model ? ' ★' : ''}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                    {m?.status === 'retiring' && <p className="text-xs text-primary-800 mt-1">{m.note}</p>}
                    {m?.id === 'gemini-3.1-pro-preview' && <p className="text-xs text-gray-500 mt-1">Chỉ bậc trả phí; key miễn phí sẽ tự chuyển sang Flash.</p>}
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-gray-700">{price(chosen)}</td>
                  <td className="py-2.5 text-gray-500">{t.why}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-3">★ = mặc định đề xuất. Giá 3.6 / 3.7 / 3.8 Flash là giá khuyến mãi tới 31/12/2026, từ 1/1/2027 thành $1.50 / $7.50.</p>

      <button onClick={() => setShowCatalog((v) => !v)} aria-expanded={showCatalog} className="mt-5 flex items-center gap-2 font-bold text-black text-sm">
        <ChevronDown className={`w-4 h-4 transition-transform ${showCatalog ? 'rotate-180' : ''}`} />
        Bảng giá mọi model
      </button>
      {showCatalog && (
        <div className="mt-3 space-y-5">
          {(['flash', 'pro', 'special'] as const).map((g) => (
            <div key={g}>
              <p className="text-sm font-bold text-gray-700 mb-2">{GROUP[g]}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-500">
                    <tr>
                      <th className="py-1.5 pr-3 font-medium">Model</th>
                      <th className="py-1.5 pr-3 font-medium text-right">Input</th>
                      <th className="py-1.5 pr-3 font-medium text-right">Cache</th>
                      <th className="py-1.5 pr-3 font-medium text-right">Output</th>
                      <th className="py-1.5 pr-3 font-medium">Trạng thái</th>
                      <th className="py-1.5 font-medium">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODEL_CATALOG.filter((m) => m.group === g).map((m) => (
                      <tr key={m.id} className={`border-t border-gray-100 align-top ${m.status === 'shutdown' ? 'opacity-60' : ''}`}>
                        <td className="py-1.5 pr-3">
                          <span className="font-medium text-black">{m.name}</span>
                          <span className="block text-xs text-gray-400 font-mono">{m.id}</span>
                        </td>
                        {m.input !== undefined ? (
                          <>
                            <td className="py-1.5 pr-3 text-right">${m.input}</td>
                            <td className="py-1.5 pr-3 text-right">{m.cached !== undefined ? `$${m.cached}` : '—'}</td>
                            <td className="py-1.5 pr-3 text-right">${m.output}</td>
                          </>
                        ) : (
                          <td colSpan={3} className="py-1.5 pr-3 text-right text-gray-600">{m.priceNote || '—'}</td>
                        )}
                        <td className="py-1.5 pr-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS[m.status].cls}`}>{STATUS[m.status].label}</span>
                        </td>
                        <td className="py-1.5 text-gray-500">{m.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-500">
            Cache: phần prompt được lưu lại tính ~10% giá input, cộng phí lưu $1 / 1 triệu token / giờ (Flash), $4.50 (Pro). Batch API giảm 50% nhưng trả kết quả chậm, không hợp làm phim tương tác.
          </p>
        </div>
      )}
    </section>
  );
}
