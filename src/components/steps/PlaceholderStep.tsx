import React from 'react';
import { Hammer } from 'lucide-react';

/** Chỗ giữ cho bước sẽ làm lại. Nội dung "sẽ có gì" là dự kiến, chốt khi thiết kế bước. */
export default function PlaceholderStep({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
      <Hammer className="w-8 h-8 text-primary-600 mx-auto mb-3" />
      <h3 className="font-bold text-black text-lg">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">Bước này đang được làm lại từ đầu. Dự kiến sẽ có:</p>
      <ul className="text-sm text-gray-700 mt-3 space-y-1 inline-block text-left list-disc pl-5">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
