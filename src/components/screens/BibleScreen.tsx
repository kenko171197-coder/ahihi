// Màn ⑥ — Bible & tham chiếu: bóc tách từ kịch bản chốt (code), style cố định, phần cố định của nhân vật / đạo cụ /
// bối cảnh / ánh sáng (AI viết, code ghép prompt), ảnh tham chiếu.
import React, { useRef, useState } from 'react';
import { ScanLine, Palette, Users, Package, MapPin, Image as ImageIcon, Sparkles, ArrowRight, Wand2 } from 'lucide-react';
import type { Project, ProjectPatch, SectionKey, Section, BibleData, BibleNhanVat, BibleDaoCu, BibleBoiCanh, AnhSangCanh } from '../../types';
import { freshSection, editSection, approveSection, keepSection, missingDeps, blockedDeps, depRevs, isStale } from '../../../shared/project';
import { bocTach, emptyBible, mucAnh, khoaAnhSang } from '../../../shared/bible';
import { checkBible, checkBibleNhanVat, checkBibleDaoCu, checkBibleBoiCanh, checkStyle, tagNgoaiBoDo } from '../../../shared/checks';
import { runTask } from '../../services/api';
import { askConfirm, notify } from '../../lib/dialog';
import { deleteImage } from '../../lib/images';
import { ErrorBox, RunButton } from '../ui';
import { ScreenIntro, StatusBar, Issues, ReviseBox, useRunner, LockedScreen, UpstreamBanner } from './common';
import { StylePanel, NhanVatPanel, DaoCuPanel, BoiCanhPanel } from './bible/MucPanels';
import AnhPanel from './bible/AnhPanel';

interface Props {
  project: Project;
  onUpdate: (patch: ProjectPatch) => void;
  onGo: (k: SectionKey) => void;
}

type Tab = 'style' | 'nhanVat' | 'daoCu' | 'boiCanh' | 'anh';
type Nhom = 'nhan-vat' | 'dao-cu' | 'boi-canh';
const TEN_NHOM: Record<Nhom, string> = { 'nhan-vat': 'nhân vật', 'dao-cu': 'đạo cụ', 'boi-canh': 'bối cảnh và ánh sáng' };
const VI_DU_SUA: Record<Nhom, string> = {
  'nhan-vat': 'VD: Lan mặc áo khoác jeans thay vì áo len, giọng trầm hơn…',
  'dao-cu': 'VD: thùng xốp nhỏ hơn, có dây nilon buộc quanh…',
  'boi-canh': 'VD: phòng trọ chật hơn, có cửa sổ nhìn ra ngõ; ánh sáng khuya tối hơn…',
};

export default function BibleScreen({ project, onUpdate, onGo }: Props) {
  const { busy, error, notes, setNotes, run } = useRunner();
  const latestRef = useRef(project);
  latestRef.current = project;
  const [tab, setTab] = useState<Tab>('style');
  const [tienDo, setTienDo] = useState('');

  if (missingDeps(project, 'bible').length) return <LockedScreen project={project} sectionKey="bible" onGo={onGo} />;
  const blocked = blockedDeps(project, 'bible').length > 0;

  const brief = project.sections.brief!.data;
  const nhanVat = project.sections.nhanVat!.data.list;
  const kb = project.sections.kichBan!.data;
  const order = kb.danY.canh.map((c) => c.id);
  const section = project.sections.bible;
  const b = section?.data;
  const stale = isStale(project, 'bible');
  const ctx = { nhanVat, canhIds: order, kichBan: kb };
  const full = b ? checkBible(b, ctx) : { errors: [], warnings: [] };

  /* ---------- Ghi dữ liệu ---------- */

  const setSection = (fn: (latest: Project) => Section<BibleData> | undefined) => onUpdate((latest) => ({ sections: { ...latest.sections, bible: fn(latest) } }));
  /** Sửa bible → về nháp. `now` để biết đúng lần ghi (dùng khi chạy nhiều nhóm liền nhau). */
  const edit = (fn: (x: BibleData) => BibleData, now = Date.now()) =>
    setSection((latest) => {
      const s = latest.sections.bible;
      return s ? editSection(s, fn(s.data), now) : s;
    });
  /** Ảnh tham chiếu nằm ngoài việc duyệt: thêm / thay ảnh không làm màn 6 về nháp (docs/LUOT-3.md). */
  const setAnh = (patch: BibleData['anh']) =>
    setSection((latest) => {
      const s = latest.sections.bible;
      return s ? { ...s, data: { ...s.data, anh: { ...s.data.anh, ...patch } } } : s;
    });
  /** Đổi tag một bộ đồ: kiểm hợp lệ, không trùng, chuyển ảnh sang tag mới. */
  const doiTag = (oldTag: string, newTag: string): boolean => {
    const x = latestRef.current.sections.bible?.data;
    if (!x) return false;
    const owner = x.nhanVat.find((n) => n.bo.some((bo) => bo.tag === oldTag));
    // Trả lại tag chính của nhân vật cho một bộ đồ khi chưa bộ nào của nhân vật đó mang nó
    const veTagChinh = !!owner && newTag === owner.tag && !owner.bo.some((bo) => bo.tag === owner.tag);
    const taken = new Set([...tagNgoaiBoDo(x, nhanVat), ...x.nhanVat.flatMap((n) => n.bo.map((y) => y.tag)), ...Object.keys(x.anh).filter((k) => x.anh[k]?.imageId)]);
    taken.delete(oldTag);
    if (!/^[a-z0-9]{1,15}$/.test(newTag) || (taken.has(newTag) && !veTagChinh)) {
      notify(`Không đổi được sang @${newTag || '(trống)'}: tag phải viết liền, không dấu, tối đa 15 ký tự và không trùng tag khác (kể cả tag đã có ảnh).`, 'Tag không hợp lệ');
      return false;
    }
    const anhCu = x.anh[newTag]?.imageId;
    if (veTagChinh && anhCu && !x.anh[oldTag]?.imageId) notify(`@${newTag} đang có ảnh cũ — ảnh đó sẽ gắn vào bộ này. Kiểm tra lại ở tab Ảnh tham chiếu, thay nếu không đúng.`, 'Kiểm tra ảnh');
    edit((y) => {
      const anh = { ...y.anh };
      if (anh[oldTag]?.imageId) {
        // Ảnh của bộ này đi theo bộ; ảnh cũ đang nằm ở tag mới (nếu có) không còn ai dùng → xoá
        if (anh[newTag]?.imageId && anh[newTag].imageId !== anh[oldTag].imageId) deleteImage(anh[newTag].imageId!).catch(() => undefined);
        anh[newTag] = anh[oldTag];
        delete anh[oldTag];
      }
      return { ...y, anh, nhanVat: y.nhanVat.map((n) => ({ ...n, bo: n.bo.map((bo) => (bo.tag === oldTag ? { ...bo, tag: newTag } : bo)) })) };
    });
    return true;
  };

  /** Bóc tách (lại) từ kịch bản chốt: giữ phần đã làm của mục còn dùng. Không gọi AI. */
  const bocTachLai = () => {
    const readRevs = depRevs(project, 'bible');
    setSection((latest) => {
      const k = latest.sections.kichBan!.data;
      const chars = latest.sections.nhanVat!.data.list;
      return freshSection(latest, 'bible', bocTach(k, chars, latest.sections.bible?.data || emptyBible()), Date.now(), readRevs);
    });
  };

  /* ---------- AI ---------- */

  const input = (p: Project, yeuCau = '') => ({
    brief: p.sections.brief!.data,
    nhanVat: p.sections.nhanVat!.data.list,
    kichBan: { danY: p.sections.kichBan!.data.danY, canh: p.sections.kichBan!.data.canh },
    bible: p.sections.bible!.data,
    sua: yeuCau ? { yeuCau } : undefined,
  });

  /** Hỏi trước khi ghi đè nếu bạn đã sửa trong lúc AI chạy. */
  const changedSince = async (startedAt: number | undefined, what: string) =>
    latestRef.current.sections.bible?.meta.updatedAt !== startedAt &&
    !(await askConfirm(`Bạn đã sửa màn 6 trong lúc AI đang viết ${what}. Thay phần ${what} bằng kết quả mới của AI?`, { okLabel: 'Thay bằng kết quả mới', cancelLabel: 'Giữ bản đang sửa' }));

  const goiStyle = (yeuCau = '') =>
    run('style', async () => {
      const startedAt = latestRef.current.sections.bible?.meta.updatedAt;
      const r = await runTask<{ style: string; giaiThich: string }[]>('bible-style', input(latestRef.current, yeuCau), project.id);
      if (await changedSince(startedAt, 'style')) return;
      edit((x) => ({ ...x, phuongAnStyle: r.output }));
      return r;
    });

  /** Gọi AI cho một nhóm và ghi kết quả (giữ các mục "không còn dùng"). Trả lỗi còn lại và thời điểm ghi.
   *  startedAt: lần ghi trước của chính "viết tất cả" (không đọc lại từ giao diện, tránh hỏi nhầm). */
  const goiNhom = async (nhom: Nhom, yeuCau = '', startedAt = latestRef.current.sections.bible?.meta.updatedAt): Promise<{ errors: string[]; at: number } | null> => {
    const r = await runTask<any>(`bible-${nhom}`, input(latestRef.current, yeuCau), project.id);
    if (await changedSince(startedAt, TEN_NHOM[nhom])) return null;
    const at = Math.max(Date.now(), (startedAt || 0) + 1);
    edit((x) => {
      if (nhom === 'nhan-vat') return { ...x, nhanVat: [...(r.output as BibleNhanVat[]), ...x.nhanVat.filter((n) => n.khongDung)] };
      if (nhom === 'dao-cu') return { ...x, daoCu: [...(r.output as BibleDaoCu[]), ...x.daoCu.filter((d) => d.khongDung)] };
      const o = r.output as { boiCanh: BibleBoiCanh[]; anhSang: AnhSangCanh[] };
      return { ...x, boiCanh: [...o.boiCanh, ...x.boiCanh.filter((c) => c.khongDung)], anhSang: o.anhSang };
    }, at);
    return { errors: r.errors.map((e) => `${TEN_NHOM[nhom][0].toUpperCase()}${TEN_NHOM[nhom].slice(1)}: ${e}`), at };
  };

  const viet = (nhom: Nhom, yeuCau = '') =>
    run(nhom, async () => {
      const r = await goiNhom(nhom, yeuCau);
      return r ? { errors: r.errors } : undefined;
    });

  /** Viết lần lượt nhân vật → đạo cụ → bối cảnh. */
  const vietTatCa = () =>
    run('tat-ca', async () => {
      const errors: string[] = [];
      try {
        const nhoms: Nhom[] = ['nhan-vat', ...(latestRef.current.sections.bible!.data.daoCu.some((d) => !d.khongDung) ? (['dao-cu'] as Nhom[]) : []), 'boi-canh'];
        let at = latestRef.current.sections.bible?.meta.updatedAt;
        for (let k = 0; k < nhoms.length; k++) {
          setTienDo(`AI đang viết ${TEN_NHOM[nhoms[k]]} (${k + 1}/${nhoms.length})…`);
          const r = await goiNhom(nhoms[k], '', at);
          if (r === null) break;
          errors.push(...r.errors);
          at = r.at;
          await new Promise((res) => setTimeout(res, 30)); // chờ giao diện nhận bản mới trước khi gửi nhóm sau
        }
      } finally {
        setTienDo('');
      }
      return { errors };
    });

  const approve = () => setSection((latest) => (latest.sections.bible ? approveSection(latest, 'bible', latest.sections.bible, Date.now()) : undefined));
  const keep = () => setSection((latest) => (latest.sections.bible ? keepSection(latest, 'bible', latest.sections.bible, Date.now()) : undefined));

  /* ---------- Hiển thị ---------- */

  const noStyle = !b?.style.trim();
  // Đã cũ (kịch bản đổi): bóc tách lại trước khi để AI viết, kẻo AI viết theo danh sách cũ
  const aiOff = !!busy || blocked || stale;
  const per = b
    ? {
        style: { errors: b.style ? checkStyle(b.style, nhanVat) : ['Chưa chọn style.'], warnings: [] as string[] },
        nhanVat: checkBibleNhanVat(b.nhanVat, ctx, tagNgoaiBoDo(b, nhanVat)),
        daoCu: checkBibleDaoCu(b.daoCu, ctx),
        boiCanh: checkBibleBoiCanh(b.boiCanh, b.anhSang, ctx),
      }
    : null;
  const muc = b ? mucAnh(b, brief.tiLe) : [];
  const thieuAnh = muc.filter((m) => !m.khongDung && !b?.anh[m.tag]?.imageId).length;
  const tabs: { k: Tab; label: string; icon: React.ElementType; sub: string; loi: number }[] = b
    ? [
        { k: 'style', label: 'Style', icon: Palette, sub: b.style ? 'đã chọn' : 'chưa chọn', loi: per!.style.errors.length },
        { k: 'nhanVat', label: 'Nhân vật', icon: Users, sub: `${b.nhanVat.length} người`, loi: per!.nhanVat.errors.length },
        { k: 'daoCu', label: 'Đạo cụ', icon: Package, sub: `${b.daoCu.length} món`, loi: per!.daoCu.errors.length },
        { k: 'boiCanh', label: 'Bối cảnh & ánh sáng', icon: MapPin, sub: `${b.boiCanh.length} nơi, ${b.anhSang.length} cảnh`, loi: per!.boiCanh.errors.length },
        { k: 'anh', label: 'Ảnh tham chiếu', icon: ImageIcon, sub: thieuAnh ? `thiếu ${thieuAnh} ảnh` : 'đủ ảnh', loi: 0 },
      ]
    : [];
  const issuesOf = (k: Tab) => (per && k !== 'anh' ? per[k] : null);
  const nhomOf: Partial<Record<Tab, Nhom>> = { nhanVat: 'nhan-vat', daoCu: 'dao-cu', boiCanh: 'boi-canh' };

  return (
    <div className="space-y-6">
      <ScreenIntro no={6} title="Bible & tham chiếu">
        Mọi thứ cố định của phim: style, nhân vật (bộ đồ, giọng), đạo cụ, bối cảnh, ánh sáng từng cảnh và ảnh tham chiếu. Màn 8 chép nguyên văn phần này vào prompt video, nên nhân vật, đồ vật và căn phòng giữ giống nhau ở mọi beat.
      </ScreenIntro>

      <UpstreamBanner project={project} sectionKey="bible" onGo={onGo} />

      {!b && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <p className="text-sm text-gray-700">
            Bước đầu: app đọc kịch bản đã chốt và lập danh sách nhân vật, đạo cụ, bối cảnh, ánh sáng từng cảnh. Không gọi AI, không tốn tiền.
          </p>
          <RunButton onClick={bocTachLai} busy={false} busyLabel="" icon={ScanLine} disabled={blocked}>
            Bóc tách từ kịch bản
          </RunButton>
        </div>
      )}

      <ErrorBox message={error} />
      <Issues errors={notes.errors} warnings={[]} title={notes.errors.length ? 'AI đã được gửi lại 2 lần nhưng kết quả vẫn còn lỗi — bạn sửa tay hoặc viết lại:' : undefined} />

      {b && (
        <>
          <div className="flex flex-wrap gap-2">
            <RunButton onClick={vietTatCa} busy={busy === 'tat-ca'} busyLabel={tienDo || 'AI đang viết…'} icon={Sparkles} disabled={aiOff || noStyle}>
              AI viết tất cả (nhân vật → đạo cụ → bối cảnh)
            </RunButton>
            <button onClick={bocTachLai} disabled={!!busy || blocked} className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-primary-100 font-bold flex items-center gap-2 disabled:opacity-50">
              <ScanLine className="w-4 h-4" /> Bóc tách lại từ kịch bản
            </button>
          </div>
          {noStyle && <p className="text-sm text-amber-900">Chọn style trước (tab Style) — mọi phần cố định đều viết theo style này.</p>}
          {stale && <p className="text-sm text-amber-900">Kịch bản đã đổi sau lần bóc tách trước. Bấm "Bóc tách lại từ kịch bản" (phần đã làm được giữ) rồi mới để AI viết tiếp.</p>}

          <nav aria-label="Các phần của bible" className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {tabs.map((t) => (
              <button
                key={t.k}
                onClick={() => {
                  setTab(t.k);
                  setNotes({ errors: [], warnings: [] });
                }}
                aria-current={tab === t.k ? 'page' : undefined}
                className={`text-left rounded-xl px-3 py-2.5 border font-bold ${tab === t.k ? 'bg-black border-black text-primary-400' : 'bg-white border-gray-200 text-black hover:border-primary-400'}`}
              >
                <span className="flex items-center gap-1.5 text-sm">
                  <t.icon className="w-4 h-4" /> {t.label}
                </span>
                <span className={`block text-xs font-normal ${tab === t.k ? 'text-primary-200' : 'text-gray-500'}`}>
                  {t.sub}
                  {t.loi > 0 && <span className={tab === t.k ? '' : 'text-red-700'}> · {t.loi} lỗi</span>}
                </span>
              </button>
            ))}
          </nav>

          {tab === 'style' && (
            <div className="space-y-4">
              <RunButton onClick={() => goiStyle()} busy={busy === 'style'} busyLabel="AI đang nghĩ style…" icon={Palette} variant={b.phuongAnStyle.length ? 'ghost' : 'dark'} disabled={aiOff}>
                {b.phuongAnStyle.length ? 'Đề xuất lại 3 phương án' : 'AI đề xuất 3 phương án style'}
              </RunButton>
              <StylePanel b={b} onStyle={(style) => edit((x) => ({ ...x, style }))} />
              {b.phuongAnStyle.length > 0 && <ReviseBox onSubmit={(t) => goiStyle(t)} busy={busy === 'style'} disabled={aiOff} placeholder="VD: ấm hơn, giống phim Hàn những năm 2000…" />}
            </div>
          )}

          {nhomOf[tab] && (
            <div className="flex flex-wrap gap-2">
              <RunButton onClick={() => viet(nhomOf[tab]!)} busy={busy === nhomOf[tab]} busyLabel={`AI đang viết ${TEN_NHOM[nhomOf[tab]!]}…`} icon={Wand2} disabled={aiOff || noStyle || (tab === 'daoCu' && !b.daoCu.some((d) => !d.khongDung))}>
                AI viết {TEN_NHOM[nhomOf[tab]!]}
              </RunButton>
            </div>
          )}

          {tab === 'nhanVat' && (
            <NhanVatPanel
              b={b}
              order={order}
              onChange={(tag, fn) => edit((x) => ({ ...x, nhanVat: x.nhanVat.map((n) => (n.tag === tag ? fn(n) : n)) }))}
              onRemove={(tag) => edit((x) => ({ ...x, nhanVat: x.nhanVat.filter((n) => n.tag !== tag) }))}
              onDoiTag={doiTag}
            />
          )}
          {tab === 'daoCu' && (
            <DaoCuPanel
              b={b}
              order={order}
              onChange={(tag, patch) => edit((x) => ({ ...x, daoCu: x.daoCu.map((d) => (d.tag === tag ? { ...d, ...patch } : d)) }))}
              onRemove={(tag) => edit((x) => ({ ...x, daoCu: x.daoCu.filter((d) => d.tag !== tag) }))}
            />
          )}
          {tab === 'boiCanh' && (
            <BoiCanhPanel
              b={b}
              order={order}
              tiLe={brief.tiLe}
              onChange={(tag, patch) => edit((x) => ({ ...x, boiCanh: x.boiCanh.map((c) => (c.tag === tag ? { ...c, ...patch } : c)) }))}
              onBienThe={(tag, vtag, patch) => edit((x) => ({ ...x, boiCanh: x.boiCanh.map((c) => (c.tag === tag ? { ...c, bienThe: c.bienThe.map((v) => (v.tag === vtag ? { ...v, ...patch } : v)) } : c)) }))}
              onAnhSang={(a, moTa) => edit((x) => ({ ...x, anhSang: x.anhSang.map((y) => (khoaAnhSang(y) === khoaAnhSang(a) ? { ...y, moTa } : y)) }))}
              onRemove={(tag) => edit((x) => ({ ...x, boiCanh: x.boiCanh.filter((c) => c.tag !== tag) }))}
              onXoaBienThe={(tag, vtag) => edit((x) => ({ ...x, boiCanh: x.boiCanh.map((c) => (c.tag === tag ? { ...c, bienThe: c.bienThe.filter((v) => v.tag !== vtag) } : c)) }))}
            />
          )}
          {tab === 'anh' && <AnhPanel projectId={project.id} muc={muc} anh={b.anh} onSet={setAnh} />}

          {nhomOf[tab] && <ReviseBox onSubmit={(t) => viet(nhomOf[tab]!, t)} busy={busy === nhomOf[tab]} disabled={aiOff || noStyle} placeholder={VI_DU_SUA[nhomOf[tab]!]} />}
          {issuesOf(tab) && <Issues errors={issuesOf(tab)!.errors} warnings={issuesOf(tab)!.warnings} />}

          {full.warnings.some((w) => w.includes('chưa có ảnh')) && tab !== 'anh' && (
            <p className="text-sm text-gray-600">
              {full.warnings.find((w) => w.includes('chưa có ảnh'))}{' '}
              <button onClick={() => setTab('anh')} className="underline font-bold text-black">
                Sang tab Ảnh tham chiếu
              </button>
            </p>
          )}

          <StatusBar project={project} sectionKey="bible" blocking={full.errors} onApprove={approve} onKeep={keep} onRegenerate={bocTachLai} busy={!!busy} />
          {section?.meta.status !== 'duyet' && full.errors.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-bold text-black">Điều kiện duyệt màn 6: còn {full.errors.length} việc</summary>
              <ul className="mt-2 list-disc pl-5 text-red-800 space-y-0.5">
                {full.errors.slice(0, 40).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {full.errors.length > 40 && <li>… và {full.errors.length - 40} việc khác.</li>}
              </ul>
            </details>
          )}

          {section?.meta.status === 'duyet' && !blocked && (
            <div className="flex justify-end">
              <button onClick={() => onGo('phanCanh')} className="py-3 px-6 rounded-xl bg-black hover:bg-gray-800 text-primary-400 font-bold flex items-center gap-2">
                Sang màn 7: Phân cảnh <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
