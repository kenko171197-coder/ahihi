import React, { useEffect, useState } from 'react';
import { askConfirm } from '../lib/dialog';
import { Gauge, RotateCcw } from 'lucide-react';
import { loadUsage, onUsageChange, resetUsage, fmtTokens, fmtUSD, FEATURE_NAMES, UsageBook } from '../lib/usage';

/** Hook: số liệu token luôn cập nhật khi có lần gọi mới. */
export function useUsage(): UsageBook {
  const [book, setBook] = useState(loadUsage);
  useEffect(() => {
    const off = onUsageChange(() => setBook(loadUsage()));
    return () => {
      off();
    };
  }, []);
  return book;
}

/** Huy hiệu nhỏ: tổng token của một dự án. */
export function ProjectUsageBadge({ projectId }: { projectId: string }) {
  const u = useUsage().byProject[projectId];
  if (!u) return null;
  return (
    <span className="text-xs text-gray-500 flex items-center gap-1" title={`${u.calls} lần gọi · vào ${u.input} · ra ${u.output} · cache ${u.cached}`}>
      <Gauge className="w-3.5 h-3.5" />
      {fmtTokens(u.input + u.output)} token · ~{fmtUSD(u.cost)}
    </span>
  );
}

export default function UsagePanel() {
  const book = useUsage();
  const rows = Object.entries(book.byFeature).sort((a, b) => b[1].input + b[1].output - (a[1].input + a[1].output));
  const total = book.total;

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-6 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-primary-400 text-black p-2.5 rounded-xl">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-black">Token đã dùng</h2>
            <p className="text-sm text-gray-500">
              Số thật Gemini báo về, tính từ {new Date(book.since).toLocaleDateString('vi-VN')}
            </p>
          </div>
        </div>
        <button
          onClick={async () => (await askConfirm('Đặt lại bộ đếm token về 0?', { okLabel: 'Đặt lại' })) && resetUsage()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm text-gray-600 bg-gray-100 hover:bg-primary-100"
        >
          <RotateCcw className="w-4 h-4" />
          Đặt lại
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {[
          ['Gửi lên (input)', fmtTokens(total.input)],
          ['Nhận về (output)', fmtTokens(total.output)],
          ['Trong đó được cache', fmtTokens(total.cached)],
          ['Lượt gọi miễn phí / trả phí', `${total.freeCalls || 0} / ${total.paidCalls || 0}`],
          ['Chi phí ước tính', fmtUSD(total.cost)],
        ].map(([label, v]) => (
          <div key={label} className={`rounded-xl p-3 ${label === 'Chi phí ước tính' ? 'bg-primary-100' : 'bg-gray-50'}`}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-bold text-black">{v}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Chưa có lần gọi nào.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Chức năng</th>
                <th className="py-2 pr-3 font-medium text-right">Lần gọi</th>
                <th className="py-2 pr-3 font-medium text-right">Input / lần</th>
                <th className="py-2 pr-3 font-medium text-right">Output / lần</th>
                <th className="py-2 pr-3 font-medium text-right">Tổng</th>
                <th className="py-2 font-medium text-right">Chi phí</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([url, u]) => (
                <tr key={url} className="border-t border-gray-100">
                  <td className="py-2 pr-3">{FEATURE_NAMES[url] || url}</td>
                  <td className="py-2 pr-3 text-right">{u.calls}</td>
                  <td className="py-2 pr-3 text-right">{fmtTokens(Math.round(u.input / Math.max(u.calls, 1)))}</td>
                  <td className="py-2 pr-3 text-right">{fmtTokens(Math.round(u.output / Math.max(u.calls, 1)))}</td>
                  <td className="py-2 pr-3 text-right font-bold">{fmtTokens(u.input + u.output)}</td>
                  <td className="py-2 text-right">{fmtUSD(u.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-4">
        "Lần gọi" là số lần gọi Gemini thật: một nút có thể gọi nhiều lần (VD beat mượn module chạy 2 lần; model hết quota chuyển model khác vẫn chỉ tính lần thành công).
        Output đã gồm cả token "suy nghĩ" của model. Chi phí chỉ tính các lượt chạy bằng key TRẢ PHÍ, theo bảng giá của đúng model đã chạy (phần cache tính giá cache); lượt chạy bằng key miễn phí không mất tiền.
      </p>
    </section>
  );
}
