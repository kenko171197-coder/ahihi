// Nhật ký lời gọi AI: xem prompt đã gửi, kết quả nhận về, lỗi và số lần gửi lại. Dùng để tìm lỗi và chỉnh file prompt.
import React, { useEffect, useState } from 'react';
import { ScrollText, RefreshCw, ChevronDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getLogs, getLog, LogSummary, LogDetail } from '../services/api';
import { CopyButton } from './ui';

const time = (t: number) => new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' });

function Detail({ id }: { id: string }) {
  const [log, setLog] = useState<LogDetail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    getLog(id).then(setLog).catch((e) => setError(e.message));
  }, [id]);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!log) return <p className="text-sm text-gray-500">Đang tải…</p>;
  return (
    <div className="space-y-3">
      {log.attempts.map((a, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2">
          <p className="text-sm font-bold">
            Lần {i + 1} · {(a.ms / 1000).toFixed(1)} giây {a.errors.length ? `· ${a.errors.length} lỗi` : '· đạt'}
          </p>
          {a.errors.length > 0 && (
            <ul className="text-xs text-red-700 list-disc pl-5">
              {a.errors.map((e, j) => (
                <li key={j}>{e}</li>
              ))}
            </ul>
          )}
          <details>
            <summary className="text-sm cursor-pointer">Prompt đã gửi</summary>
            <div className="mt-2 flex justify-end">
              <CopyButton text={a.prompt} />
            </div>
            <pre className="mt-2 text-xs whitespace-pre-wrap bg-gray-50 rounded-lg p-2 max-h-96 overflow-auto">{a.prompt}</pre>
          </details>
          <details>
            <summary className="text-sm cursor-pointer">Kết quả nhận về</summary>
            <pre className="mt-2 text-xs whitespace-pre-wrap bg-gray-50 rounded-lg p-2 max-h-96 overflow-auto">{a.raw || '(trống)'}</pre>
          </details>
        </div>
      ))}
    </div>
  );
}

export default function LogsPanel() {
  const [logs, setLogs] = useState<LogSummary[]>([]);
  const [open, setOpen] = useState('');
  const [error, setError] = useState('');
  const refresh = () => {
    setError('');
    getLogs().then(setLogs).catch((e) => setError(e.message));
  };
  useEffect(refresh, []);

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-6 lg:col-span-2">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary-400 text-black p-2.5 rounded-xl">
            <ScrollText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-black">Nhật ký AI</h2>
            <p className="text-sm text-gray-500">100 lần gọi gần nhất từ khi app khởi động. Bản đầy đủ lưu ở logs/ai-calls.jsonl.</p>
          </div>
        </div>
        <button onClick={refresh} title="Tải lại" className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-black">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!logs.length && !error && <p className="text-sm text-gray-500">Chưa có lần gọi nào.</p>}
      <ul className="space-y-2">
        {logs.map((l) => (
          <li key={l.id} className="border border-gray-200 rounded-xl">
            <button onClick={() => setOpen(open === l.id ? '' : l.id)} className="w-full flex items-center gap-2 p-3 text-left text-sm">
              {l.ok ? <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
              <span className="font-bold">{l.task}</span>
              <span className="text-gray-500">· {time(l.at)} · {l.attempts} lần gọi</span>
              {!l.ok && l.errors[0] && <span className="text-red-700 truncate">· {l.errors[0]}</span>}
              <ChevronDown className={`w-4 h-4 ml-auto shrink-0 transition-transform ${open === l.id ? 'rotate-180' : ''}`} />
            </button>
            {open === l.id && (
              <div className="px-3 pb-3">
                <Detail id={l.id} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
