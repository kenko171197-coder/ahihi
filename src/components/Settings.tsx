import React, { useEffect, useState } from 'react';
import { BookOpen, RefreshCw, CheckCircle2 } from 'lucide-react';
import { getKnowledgeStatus, KnowledgeStatus } from '../services/api';
import KeysPanel from './KeysPanel';
import UsagePanel from './UsagePanel';
import ModelPanel from './ModelPanel';
import LogsPanel from './LogsPanel';

interface Props {
  onKeyChange: () => void;
}

export default function Settings({ onKeyChange }: Props) {
  const [status, setStatus] = useState<KnowledgeStatus | null>(null);
  const [statusError, setStatusError] = useState('');

  const refreshStatus = () => {
    setStatusError('');
    getKnowledgeStatus().then(setStatus).catch((e) => setStatusError(e.message));
  };
  useEffect(refreshStatus, []);

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <KeysPanel onKeyChange={onKeyChange} />

      <section className="bg-white border border-gray-200 rounded-2xl p-6 lg:col-span-2">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary-400 text-black p-2.5 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-black">Kho kiến thức</h2>
              <p className="text-sm text-gray-500">Các file .md trong thư mục knowledge/ được gửi kèm cho AI ở từng bước</p>
            </div>
          </div>
          <button onClick={refreshStatus} title="Kiểm tra lại" className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-black">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {statusError && <p className="text-sm text-red-600">{statusError}</p>}
        {status && (
          <ul className="space-y-2">
            {status.folders.map((f) => (
              <li key={f.dir} className="text-sm rounded-lg px-3 py-2 bg-green-50 text-green-900">
                <span className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {f.dir}
                </span>
                <span className="block text-green-800 mt-0.5">{f.files.join(' · ') || 'Chưa có file'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ModelPanel />
      <UsagePanel />
      <LogsPanel />
    </div>
  );
}
