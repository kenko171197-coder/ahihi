// Màn ⑥ (tạm): dùng lại bước Nhân vật & đạo cụ cũ cho tới khi làm lại ở lượt 3.
// Ghép dữ liệu dự án mới sang dạng bước cũ đang đọc (LegacyProject), và ghi ngược lại vào project.thietKeTam.
import React from 'react';
import { Info, Download } from 'lucide-react';
import type { Project, ProjectPatch, LegacyProject, LegacyPatch } from '../../types';
import { tiLeCua, isStale } from '../../../shared/project';
import DesignStep from '../steps/DesignStep';
import { ScreenIntro } from './common';

interface Props {
  project: Project;
  onUpdate: (patch: ProjectPatch) => void;
  onNext: () => void;
}

const toLegacy = (p: Project): LegacyProject => ({
  id: p.id,
  synopsis: p.thietKeTam.synopsis,
  style: p.thietKeTam.style,
  aspect: p.sections.brief ? p.sections.brief.data.tiLe : tiLeCua(p.briefWork.input.nenTang),
  characterSeeds: p.thietKeTam.characterSeeds,
  propSeeds: p.thietKeTam.propSeeds,
  design: p.thietKeTam.design as LegacyProject['design'],
  assets: p.thietKeTam.assets,
});

export default function LegacyDesignScreen({ project, onUpdate, onNext }: Props) {
  const legacy = toLegacy(project);

  const onLegacyUpdate = (patch: LegacyPatch) =>
    onUpdate((latest) => {
      const cur = toLegacy(latest);
      const change = typeof patch === 'function' ? patch(cur) : patch;
      const { aspect: _aspect, id: _id, ...rest } = change;
      return { thietKeTam: { ...latest.thietKeTam, ...rest } };
    });

  // Chỉ lấy bản ĐÃ DUYỆT và không "đã cũ" (docs/QUYET-DINH.md mục 2)
  const usable = (p: Project, k: 'nhanVat' | 'treatment') => p.sections[k]?.meta.status === 'duyet' && !isStale(p, k);

  // Lấy nhân vật đã duyệt ở màn ② và treatment đã duyệt ở màn ③ làm đầu vào
  const fillFromScript = () =>
    onUpdate((latest) => {
      if (!usable(latest, 'nhanVat')) return {};
      const chars = latest.sections.nhanVat!.data.list;
      const t = usable(latest, 'treatment') ? latest.sections.treatment!.data : undefined;
      const brief = latest.sections.brief?.meta.status === 'duyet' ? latest.sections.brief.data.logline : '';
      const synopsis = t ? t.phan.map((p) => `${p.ten}: ${p.tomTat}`).join('\n') : brief || latest.thietKeTam.synopsis;
      return {
        thietKeTam: {
          ...latest.thietKeTam,
          synopsis,
          characterSeeds: chars
            .filter((c) => c.vai !== 'gian-tiep')
            .map((c) => ({ name: c.ten, brief: [c.tuoi && `${c.tuoi} tuổi`, c.tinhCach, c.chiTiet, c.ghiChuThietKe].filter(Boolean).join('; ') })),
        },
      };
    });

  const hasScript = usable(project, 'nhanVat');

  return (
    <div className="space-y-6">
      <ScreenIntro no={6} title="Bible & tham chiếu (bản tạm)">
        Đây là bước Nhân vật & đạo cụ giữ lại từ app cũ. Ở lượt 3, màn này sẽ được làm lại: bóc tách tự động từ kịch bản, thêm bối cảnh, ánh sáng theo cảnh và giọng nhân vật.
      </ScreenIntro>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm text-gray-700">
        <Info className="w-5 h-5 shrink-0" />
        <p className="flex-1">Bạn có thể lấy nhân vật (màn 2) và tóm tắt câu chuyện (màn 3) làm đầu vào, thay vì nhập tay. Chỉ lấy bản đã duyệt; màn 3 chưa duyệt thì lấy logline. Thao tác này ghi đè ô tóm tắt và danh sách nhân vật bên dưới, giữ nguyên đạo cụ và ảnh đã gắn.</p>
        <button onClick={fillFromScript} disabled={!hasScript} className="px-4 py-2 rounded-full bg-black text-primary-400 font-bold flex items-center gap-1.5 disabled:opacity-50 shrink-0">
          <Download className="w-4 h-4" /> Lấy từ màn 2 và 3
        </button>
      </div>
      <DesignStep project={legacy} onUpdate={onLegacyUpdate} onNext={onNext} />
    </div>
  );
}
