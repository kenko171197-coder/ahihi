// Màn ③ — Treatment: các phần theo khung thể loại, phân đoạn (phim ≥ 3 phút), bảng Cài – Dùng.
import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Plus, Trash2, RefreshCw, ArrowRight, PenLine } from 'lucide-react';
import type { Project, ProjectPatch, TreatmentData, PhanTruyen, PhanDoan, CaiDung, SectionKey, Section, GenreInfo } from '../../types';
import { freshSection, editSection, approveSection, keepSection, missingDeps, blockedDeps, depRevs, fmtGiay, PHAN_DOAN_TU_GIAY } from '../../../shared/project';
import { checkTreatment } from '../../../shared/checks';
import { runTask, getGenres } from '../../services/api';
import { askConfirm } from '../../lib/dialog';
import { ErrorBox, RunButton } from '../ui';
import { ScreenIntro, StatusBar, Issues, ReviseBox, Field, NumberField, fieldCls, useRunner, LockedScreen, UpstreamBanner } from './common';

interface Props {
  project: Project;
  onUpdate: (patch: ProjectPatch) => void;
  onGo: (k: SectionKey) => void;
}

const COLORS = ['bg-primary-400', 'bg-black', 'bg-primary-600', 'bg-gray-500', 'bg-primary-300', 'bg-gray-800'];

/** Thanh thời lượng: mỗi phần một khúc, độ dài theo số giây. */
function Timeline({ phan, total }: { phan: PhanTruyen[]; total: number }) {
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100" aria-hidden="true">
        {phan.map((p, i) => {
          const w = Number.isFinite(p.ketThuc - p.batDau) && total > 0 ? Math.max(0, ((p.ketThuc - p.batDau) / total) * 100) : 0;
          return <div key={p.id} className={COLORS[i % COLORS.length]} style={{ width: `${w}%` }} title={p.ten} />;
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>0s</span>
        <span>
          Tổng các phần: {fmtGiay(phan.length ? (phan[phan.length - 1].ketThuc || 0) : 0)} / {fmtGiay(total)}
        </span>
      </div>
    </div>
  );
}

function SeqRow({ s, onChange, onRemove }: { s: PhanDoan; onChange: (patch: Partial<PhanDoan>) => void; onRemove: () => void }) {
  return (
    <div className="border-l-2 border-primary-400 pl-3 space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[8rem]">
          <Field label={`Phân đoạn ${s.id.replace(/^P/, '')}`} value={s.ten} onChange={(v) => onChange({ ten: v })} />
        </div>
        <NumberField label="Từ giây" value={s.batDau} onChange={(v) => onChange({ batDau: v })} />
        <NumberField label="Đến giây" value={s.ketThuc} onChange={(v) => onChange({ ketThuc: v })} />
        <button onClick={onRemove} title="Xoá phân đoạn" aria-label="Xoá phân đoạn" className="p-2.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <Field label="Mục tiêu" value={s.mucTieu} onChange={(v) => onChange({ mucTieu: v })} />
      <Field label="Tóm tắt" rows={2} value={s.tomTat} onChange={(v) => onChange({ tomTat: v })} />
    </div>
  );
}

export default function TreatmentScreen({ project, onUpdate, onGo }: Props) {
  const { busy, error, notes, run } = useRunner();
  const [genres, setGenres] = useState<GenreInfo[] | null>(null);
  const [genreError, setGenreError] = useState('');
  const loadGenres = () => {
    setGenreError('');
    getGenres(true)
      .then(setGenres)
      .catch((e) => setGenreError(e?.message || 'Không đọc được danh sách thể loại.'));
  };
  useEffect(loadGenres, []);
  const latestRef = useRef(project);
  latestRef.current = project;

  if (missingDeps(project, 'treatment').length) return <LockedScreen project={project} sectionKey="treatment" onGo={onGo} />;
  const blocked = blockedDeps(project, 'treatment').length > 0;

  const brief = project.sections.brief!.data;
  const nhanVat = project.sections.nhanVat!.data.list;
  const total = brief.thoiLuongGiay;
  const needSeq = total >= PHAN_DOAN_TU_GIAY;
  const genreInfo = genres?.find((g) => g.id === brief.theLoai);
  const requiredParts = genreInfo?.cacPhan || [];
  const section = project.sections.treatment;
  const data = section?.data;
  const check = data ? checkTreatment(data, total, requiredParts) : { errors: [], warnings: [] };
  // Chưa đọc được danh sách thể loại thì chưa biết các phần bắt buộc → chưa cho duyệt
  const blocking =
    genres === null
      ? [genreError ? 'Không đọc được thông tin thể loại — bấm "Đọc lại thể loại".' : 'Đang đọc thông tin thể loại…', ...check.errors]
      : !genreInfo
      ? [`Không tìm thấy file thể loại "${brief.theLoai}" trong knowledge/the-loai/ (đã đổi tên hay xoá?). Chọn lại thể loại ở màn 1.`, ...check.errors]
      : check.errors;

  const setSection = (fn: (latest: Project) => Section<TreatmentData> | undefined) =>
    onUpdate((latest) => ({ sections: { ...latest.sections, treatment: fn(latest) } }));

  const edit = (fn: (t: TreatmentData) => TreatmentData) =>
    setSection((latest) => {
      const s = latest.sections.treatment;
      return s ? editSection(s, fn(s.data), Date.now()) : s;
    });
  const editPart = (id: string, patch: Partial<PhanTruyen>) => edit((t) => ({ ...t, phan: t.phan.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const editSeq = (pid: string, sid: string, patch: Partial<PhanDoan>) =>
    edit((t) => ({ ...t, phan: t.phan.map((p) => (p.id === pid ? { ...p, phanDoan: p.phanDoan.map((s) => (s.id === sid ? { ...s, ...patch } : s)) } : p)) }));
  const editCd = (id: string, patch: Partial<CaiDung>) => edit((t) => ({ ...t, caiDung: t.caiDung.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const nextId = (ids: string[], prefix: string) => `${prefix}${ids.reduce((m, x) => Math.max(m, Number(/(\d+)$/.exec(x)?.[1] || 0)), 0) + 1}`;

  const generate = async (sua?: string) => {
    if (!sua && section && !(await askConfirm('Viết lại toàn bộ treatment? Những chỗ bạn đã sửa sẽ mất.', { okLabel: 'Viết lại' }))) return;
    const startedAt = section?.meta.updatedAt;
    const readRevs = depRevs(project, 'treatment'); // phiên bản phần trên mà AI sẽ đọc
    run(sua ? 'sua' : 'tao', async () => {
      const r = await runTask<TreatmentData>('treatment', { brief, nhanVat, sua: sua ? { truoc: data, yeuCau: sua } : undefined }, project.id);
      const now = latestRef.current.sections.treatment?.meta.updatedAt;
      if (now !== startedAt && !(await askConfirm('Bạn đã sửa treatment trong lúc AI đang chạy. Thay bằng kết quả mới của AI?', { okLabel: 'Thay bằng kết quả mới', cancelLabel: 'Giữ bản đang sửa' }))) return;
      setSection((latest) => freshSection(latest, 'treatment', r.output, Date.now(), readRevs));
      return r;
    });
  };

  /** Tự viết: tạo khung trống theo các phần của thể loại (hoặc 1 phần), chia đều số giây. */
  const startManual = () =>
    setSection((latest) => {
      const names = requiredParts.length ? requiredParts : ['Phần 1'];
      const cuts = names.map((_, i) => Math.round((total * i) / names.length)).concat(total);
      const phan: PhanTruyen[] = names.map((ten, i) => ({ id: `P${i + 1}`, ten, vaiTro: '', batDau: cuts[i], ketThuc: cuts[i + 1], tomTat: '', mocTruyen: [], phanDoan: [] }));
      return freshSection(latest, 'treatment', { phan, caiDung: [] }, Date.now());
    });

  /** Thêm phần: còn khoảng trống cuối phim thì lấp khoảng đó; hết chỗ thì chia đôi phần cuối. */
  const addPart = () =>
    edit((t) => {
      const last = t.phan[t.phan.length - 1];
      const id = nextId(t.phan.map((p) => p.id), 'P');
      const blank = (batDau: number, ketThuc: number): PhanTruyen => ({ id, ten: '', vaiTro: '', batDau, ketThuc, tomTat: '', mocTruyen: [], phanDoan: [] });
      if (!last || !Number.isFinite(last.ketThuc) || last.ketThuc < total) return { ...t, phan: [...t.phan, blank(last && Number.isFinite(last.ketThuc) ? last.ketThuc : 0, total)] };
      const mid = Math.round((last.batDau + last.ketThuc) / 2);
      return { ...t, phan: [...t.phan.slice(0, -1), { ...last, ketThuc: mid, phanDoan: [] }, blank(mid, last.ketThuc)] };
    });

  const removePart = async (p: PhanTruyen, i: number) => {
    if (!(await askConfirm(`Xoá phần ${i + 1}${p.ten ? ` "${p.ten}"` : ''}? Các dòng Cài – Dùng trỏ tới phần này sẽ phải chọn lại.`, { okLabel: 'Xoá', danger: true }))) return;
    edit((t) => ({
      ...t,
      phan: t.phan.filter((x) => x.id !== p.id),
      caiDung: t.caiDung.map((c) => ({ ...c, cai: c.cai === p.id ? '' : c.cai, dung: c.dung === p.id ? '' : c.dung })),
    }));
  };

  const approve = () => setSection((latest) => (latest.sections.treatment ? approveSection(latest, 'treatment', latest.sections.treatment, Date.now()) : undefined));
  const keep = () => setSection((latest) => (latest.sections.treatment ? keepSection(latest, 'treatment', latest.sections.treatment, Date.now()) : undefined));

  return (
    <div className="space-y-6">
      <ScreenIntro no={3} title="Treatment">
        Câu chuyện tóm tắt theo từng phần, có số giây. {needSeq ? 'Phim từ 3 phút nên mỗi phần chia thêm thành phân đoạn. ' : ''}Bảng Cài – Dùng ghi các chi tiết được cài trước và dùng lại về sau.
      </ScreenIntro>

      <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-3">
        <b>Logline:</b> {brief.logline} · <b>Thời lượng:</b> {fmtGiay(total)}
        {requiredParts.length > 0 && (
          <>
            {' '}
            · <b>Khung thể loại:</b> {requiredParts.join(' → ')}
          </>
        )}
      </p>

      <UpstreamBanner project={project} sectionKey="treatment" onGo={onGo} />

      {genreError && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-red-700">
          {genreError}
          <button onClick={loadGenres} className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-primary-100 font-bold text-black">Đọc lại thể loại</button>
        </div>
      )}

      {!section && (
        <div className="flex flex-wrap gap-2">
          <RunButton onClick={() => generate()} busy={busy === 'tao'} busyLabel="AI đang viết treatment…" icon={BookOpen} disabled={!!busy || blocked}>
            Viết treatment
          </RunButton>
          <button onClick={startManual} disabled={!!busy || genres === null} className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-primary-100 font-bold flex items-center gap-2 disabled:opacity-50">
            <PenLine className="w-4 h-4" /> Tự viết
          </button>
        </div>
      )}

      <ErrorBox message={error} />
      <Issues errors={notes.errors} warnings={[]} title={notes.errors.length ? 'AI đã được gửi lại 2 lần nhưng kết quả vẫn còn lỗi — bạn sửa tay hoặc tạo lại:' : undefined} />

      {data && (
        <>
          <Timeline phan={data.phan} total={total} />

          <div className="space-y-4">
            {data.phan.map((p, i) => (
              <article key={p.id} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <span className={`w-3 h-8 rounded ${COLORS[i % COLORS.length]}`} aria-hidden="true" />
                  <div className="flex-1 min-w-[10rem]">
                    <Field label={`Phần ${i + 1}`} value={p.ten} onChange={(v) => editPart(p.id, { ten: v })} />
                  </div>
                  <NumberField label="Từ giây" value={p.batDau} onChange={(v) => editPart(p.id, { batDau: v })} />
                  <NumberField label="Đến giây" value={p.ketThuc} onChange={(v) => editPart(p.id, { ketThuc: v })} />
                  <span className="text-sm text-gray-500 pb-2.5">{fmtGiay(p.ketThuc - p.batDau)}</span>
                  <button onClick={() => removePart(p, i)} title="Xoá phần" aria-label={`Xoá phần ${i + 1}`} className="p-2.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <Field label="Vai trò" value={p.vaiTro} onChange={(v) => editPart(p.id, { vaiTro: v })} />
                <Field label="Tóm tắt" rows={4} value={p.tomTat} onChange={(v) => editPart(p.id, { tomTat: v })} />
                <Field
                  label="Mốc truyện (mỗi dòng một mốc)"
                  rows={2}
                  value={p.mocTruyen.join('\n')}
                  onChange={(v) => editPart(p.id, { mocTruyen: v.split('\n') })}
                />

                {needSeq && (
                  <div className="space-y-3 pt-2">
                    <p className="text-sm font-bold text-black">Phân đoạn</p>
                    {p.phanDoan.map((s) => (
                      <SeqRow
                        key={s.id}
                        s={s}
                        onChange={(patch) => editSeq(p.id, s.id, patch)}
                        onRemove={() => edit((t) => ({ ...t, phan: t.phan.map((x) => (x.id === p.id ? { ...x, phanDoan: x.phanDoan.filter((y) => y.id !== s.id) } : x)) }))}
                      />
                    ))}
                    <button
                      onClick={() =>
                        edit((t) => ({
                          ...t,
                          phan: t.phan.map((x) => {
                            if (x.id !== p.id) return x;
                            const last = x.phanDoan[x.phanDoan.length - 1];
                            const n = x.phanDoan.reduce((m, y) => Math.max(m, Number(/(\d+)$/.exec(y.id)?.[1] || 0)), 0) + 1;
                            const id = `${x.id}.${n}`;
                            // Còn khoảng trống sau phân đoạn cuối → lấp khoảng đó; hết chỗ → chia đôi phân đoạn cuối
                            if (!last || last.ketThuc < x.ketThuc) {
                              return { ...x, phanDoan: [...x.phanDoan, { id, ten: '', mucTieu: '', batDau: last ? last.ketThuc : x.batDau, ketThuc: x.ketThuc, tomTat: '' }] };
                            }
                            const mid = Math.round((last.batDau + last.ketThuc) / 2);
                            return { ...x, phanDoan: [...x.phanDoan.slice(0, -1), { ...last, ketThuc: mid }, { id, ten: '', mucTieu: '', batDau: mid, ketThuc: last.ketThuc, tomTat: '' }] };
                          }),
                        }))
                      }
                      className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-primary-100 text-sm font-bold flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Thêm phân đoạn
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>

          <button onClick={addPart} className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-primary-100 text-sm font-bold flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Thêm phần
          </button>

          {/* ---------- Cài – Dùng ---------- */}
          <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-black">Cài – Dùng</h3>
            <p className="text-sm text-gray-600 -mt-2">Chi tiết được cài ở một phần và dùng lại về sau. Màn 4 phải viết đúng bảng này, màn 5 dùng nó để kiểm tra.</p>
            {data.caiDung.map((c) => (
              <div key={c.id} className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[12rem]">
                  <Field label="Chi tiết" value={c.chiTiet} onChange={(v) => editCd(c.id, { chiTiet: v })} />
                </div>
                {(['cai', 'dung'] as const).map((k) => (
                  <div key={k}>
                    <label htmlFor={`${c.id}-${k}`} className="block text-xs font-bold text-gray-600 mb-1">{k === 'cai' ? 'Cài ở' : 'Dùng ở'}</label>
                    <select id={`${c.id}-${k}`} value={c[k]} onChange={(e) => editCd(c.id, { [k]: e.target.value } as Partial<CaiDung>)} className={`${fieldCls} w-44`}>
                      <option value="">— chọn phần —</option>
                      {data.phan.map((p, i) => (
                        <option key={p.id} value={p.id}>
                          {i + 1}. {p.ten}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <button onClick={() => edit((t) => ({ ...t, caiDung: t.caiDung.filter((x) => x.id !== c.id) }))} title="Xoá dòng" aria-label="Xoá dòng Cài – Dùng" className="p-2.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => edit((t) => ({ ...t, caiDung: [...t.caiDung, { id: nextId(t.caiDung.map((c) => c.id), 'C'), chiTiet: '', cai: '', dung: '' }] }))}
              className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-primary-100 text-sm font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Thêm dòng
            </button>
          </section>

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={() => generate()} busy={busy === 'tao'} busyLabel="AI đang viết lại…" icon={RefreshCw} variant="ghost" disabled={!!busy || blocked}>
              Viết lại toàn bộ
            </RunButton>
          </div>
          <ReviseBox onSubmit={(t) => generate(t)} busy={busy === 'sua'} disabled={!!busy || blocked} placeholder="VD: phần Gợn sóng thêm một tin nhắn của mẹ, rút phần Dư âm ngắn lại…" />

          <Issues errors={check.errors} warnings={check.warnings} />

          <StatusBar project={project} sectionKey="treatment" blocking={blocking} onApprove={approve} onKeep={keep} onRegenerate={() => generate()} busy={!!busy} />

          {section?.meta.status === 'duyet' && !blocked && (
            <div className="flex justify-end">
              <button onClick={() => onGo('kichBan')} className="py-3 px-6 rounded-xl bg-black hover:bg-gray-800 text-primary-400 font-bold flex items-center gap-2">
                Sang màn 4: Kịch bản <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
