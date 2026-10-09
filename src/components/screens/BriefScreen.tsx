// Màn ① — Ý tưởng & định hướng: nhập → (hỏi lại) → 3 phương án logline → chọn, sửa → duyệt brief.
import React, { useEffect, useState } from 'react';
import { HelpCircle, Sparkles, RefreshCw, ArrowRight, Check } from 'lucide-react';
import type { Project, ProjectPatch, BriefInput, BriefWork, Brief, LoglineOption, HoiLaiCau, GenreInfo, SectionKey } from '../../types';
import { approveSection, editSection, fmtGiay, tiLeCua } from '../../../shared/project';
import { sentenceCount } from '../../../shared/checks';
import { runTask, getGenres } from '../../services/api';
import { askConfirm } from '../../lib/dialog';
import { ErrorBox, RunButton } from '../ui';
import { ScreenIntro, StatusBar, Issues, ReviseBox, Field, fieldCls, useRunner } from './common';

const THOI_LUONG_MIN = 15;
const THOI_LUONG_MAX = 720;
const QUICK_DURATIONS = [30, 60, 90, 180, 300, 600];

interface Props {
  project: Project;
  onUpdate: (patch: ProjectPatch) => void;
  onGo: (k: SectionKey) => void;
}

/** Lỗi chặn duyệt brief. */
export function briefBlocking(w: BriefWork): string[] {
  const e: string[] = [];
  const i = w.input;
  if (!i.yTuong.trim()) e.push('Chưa nhập ý tưởng.');
  if (!i.theLoai) e.push('Chưa chọn thể loại.');
  if (!Number.isFinite(i.thoiLuongGiay) || i.thoiLuongGiay < THOI_LUONG_MIN || i.thoiLuongGiay > THOI_LUONG_MAX) e.push('Thời lượng phải từ 15 giây tới 12 phút.');
  const o = w.phuongAn[w.chon];
  if (!o) e.push('Chưa chọn phương án logline.');
  else {
    if (!o.logline.trim()) e.push('Logline đang trống.');
    else if (sentenceCount(o.logline) > 2) e.push('Logline dài quá 2 câu.');
    if (!o.thongDiep.trim()) e.push('Thông điệp đang trống.');
  }
  return e;
}

/** Brief sẽ được lưu nếu duyệt bây giờ (undefined nếu chưa chọn phương án). */
function buildBrief(w: BriefWork): Brief | undefined {
  const o = w.phuongAn[w.chon];
  if (!o) return undefined;
  return { ...w.input, tiLe: tiLeCua(w.input.nenTang), logline: o.logline.trim(), thongDiep: o.thongDiep.trim(), camXuc: o.camXuc.trim(), khanGia: o.khanGia.trim() };
}

/** So sánh nội dung, không phụ thuộc thứ tự khoá (dự án mở lại từ bộ nhớ có thể đổi thứ tự). */
const stable = (v: unknown): string =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`
    : Array.isArray(v)
    ? `[${v.map(stable).join(',')}]`
    : JSON.stringify(v);
const sameBrief = (a: Brief | undefined, b: Brief) => !!a && stable(a) === stable(b);

export default function BriefScreen({ project, onUpdate, onGo }: Props) {
  const w = project.briefWork;
  const section = project.sections.brief;
  const { busy, error, notes, run } = useRunner();
  const [genres, setGenres] = useState<GenreInfo[]>([]);
  const [genreError, setGenreError] = useState('');

  useEffect(() => {
    getGenres()
      .then((g) => {
        setGenres(g);
        if (!w.input.theLoai && g.length === 1) setInput({ theLoai: g[0].id });
      })
      .catch((e) => setGenreError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Đổi dữ liệu làm việc. Chỉ khi brief SẼ LƯU khác bản đã duyệt thì mới về nháp (các màn sau thấy "đã cũ").
   *  Sửa rồi sửa ngược về đúng bản đã duyệt → tự trở lại "đã duyệt", không tăng số bản. */
  const setWork = (fn: (w: BriefWork) => BriefWork) =>
    onUpdate((latest) => {
      const next = fn(latest.briefWork);
      const s = latest.sections.brief;
      if (!s || s.meta.rev === 0) return { briefWork: next };
      const same = sameBrief(buildBrief(next), s.data);
      if (!same && s.meta.status === 'duyet') return { briefWork: next, sections: { ...latest.sections, brief: editSection(s, s.data, Date.now()) } };
      if (same && s.meta.status !== 'duyet') return { briefWork: next, sections: { ...latest.sections, brief: { ...s, meta: { ...s.meta, status: 'duyet' as const } } } };
      return { briefWork: next };
    });
  const setInput = (patch: Partial<BriefInput>) => setWork((x) => ({ ...x, input: { ...x.input, ...patch } }));
  const setOption = (patch: Partial<LoglineOption>) =>
    setWork((x) => ({ ...x, phuongAn: x.phuongAn.map((o, i) => (i === x.chon ? { ...o, ...patch } : o)) }));
  const setAnswer = (id: string, traLoi: string) => setWork((x) => ({ ...x, cauHoi: x.cauHoi.map((c) => (c.id === id ? { ...c, traLoi } : c)) }));

  const genre = genres.find((g) => g.id === w.input.theLoai);
  const inputErrors = briefBlocking({ ...w, chon: 0, phuongAn: [{ logline: 'x', thongDiep: 'x', camXuc: '', khanGia: '', viSaoHop: '' }] });

  const askQuestions = () =>
    run('hoi', async () => {
      const r = await runTask<HoiLaiCau[]>('hoi-lai', { brief: w.input }, project.id);
      setWork((x) => ({ ...x, cauHoi: r.output }));
      return r;
    });

  const makeLoglines = async (sua?: string) => {
    if (!sua && w.phuongAn.length && !(await askConfirm('Tạo 3 phương án mới? Các phương án hiện tại (kể cả chỗ bạn đã sửa) sẽ bị thay.', { okLabel: 'Tạo mới' }))) return;
    run(sua ? 'sua' : 'logline', async () => {
      const r = await runTask<{ nhanXet: string; phuongAn: LoglineOption[] }>(
        'logline',
        { brief: w.input, cauHoi: w.cauHoi, sua: sua ? { truoc: { nhanXet: w.nhanXet, phuongAn: w.phuongAn }, yeuCau: sua } : undefined },
        project.id
      );
      setWork((x) => ({ ...x, nhanXet: r.output.nhanXet, phuongAn: r.output.phuongAn, chon: sua && x.chon < r.output.phuongAn.length ? x.chon : -1 }));
      return r;
    });
  };

  const blocking = briefBlocking(w);
  const approve = () =>
    onUpdate((latest) => {
      const lw = latest.briefWork;
      const data = buildBrief(lw);
      if (briefBlocking(lw).length || !data) return {};
      const old = latest.sections.brief;
      // Nội dung y hệt bản đã duyệt → chỉ trả lại trạng thái, không tăng số bản (màn sau không bị "đã cũ")
      if (old && old.meta.rev > 0 && sameBrief(data, old.data)) return { sections: { ...latest.sections, brief: { ...old, meta: { ...old.meta, status: 'duyet' as const } } } };
      const base = old || { data, meta: { rev: 0, status: 'nhap' as const, basedOn: {}, updatedAt: Date.now() } };
      return {
        title: latest.title === 'Dự án mới' ? data.logline.slice(0, 60) : latest.title,
        sections: { ...latest.sections, brief: approveSection(latest, 'brief', { ...base, data }, Date.now()) },
      };
    });

  return (
    <div className="space-y-6">
      <ScreenIntro no={1} title="Ý tưởng & định hướng">
        Nhập ý tưởng và các thông số chính. AI có thể hỏi lại vài câu cho rõ, rồi đề xuất 3 phương án logline. Bạn chọn một, sửa nếu cần, rồi duyệt.
      </ScreenIntro>

      {/* ---------- Nhập ---------- */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-5">
        <Field label="Ý tưởng" rows={3} value={w.input.yTuong} onChange={(v) => setInput({ yTuong: v })} placeholder="Một câu cũng được. VD: Con gái đi làm xa nhận thùng đồ ăn mẹ gửi lên." />

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="theloai" className="block text-sm font-bold text-black mb-1">Thể loại</label>
            <select id="theloai" value={w.input.theLoai} onChange={(e) => setInput({ theLoai: e.target.value })} className={fieldCls}>
              <option value="">— Chọn thể loại —</option>
              {genres.map((g) => (
                <option key={g.id} value={g.id}>{g.ten}</option>
              ))}
            </select>
            {genre && <p className="text-xs text-gray-500 mt-1">{genre.moTa}{genre.thoiLuong ? ` Thời lượng hợp: ${genre.thoiLuong}.` : ''}</p>}
            {genreError && <p className="text-xs text-red-600 mt-1">{genreError}</p>}
            {!genreError && !genres.length && <p className="text-xs text-gray-500 mt-1">Chưa có file thể loại nào trong knowledge/the-loai/.</p>}
          </div>
          <div>
            <label htmlFor="nentang" className="block text-sm font-bold text-black mb-1">Nền tảng</label>
            <select id="nentang" value={w.input.nenTang} onChange={(e) => setInput({ nenTang: e.target.value as BriefInput['nenTang'] })} className={fieldCls}>
              <option value="doc">TikTok / Reels — dọc 9:16</option>
              <option value="ngang">YouTube — ngang 16:9</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="thoiluong" className="block text-sm font-bold text-black mb-1">Thời lượng (giây)</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="thoiluong"
              type="number"
              inputMode="numeric"
              min={THOI_LUONG_MIN}
              max={THOI_LUONG_MAX}
              value={Number.isFinite(w.input.thoiLuongGiay) ? w.input.thoiLuongGiay : ''}
              onChange={(e) => setInput({ thoiLuongGiay: e.target.value === '' ? NaN : Math.round(Number(e.target.value)) })}
              className={`${fieldCls} w-28`}
            />
            <span className="text-sm text-gray-600">= {Number.isFinite(w.input.thoiLuongGiay) ? fmtGiay(w.input.thoiLuongGiay) : '—'}</span>
            {QUICK_DURATIONS.map((s) => (
              <button key={s} type="button" onClick={() => setInput({ thoiLuongGiay: s })} className={`px-3 py-1.5 rounded-full text-xs font-bold ${w.input.thoiLuongGiay === s ? 'bg-black text-primary-400' : 'bg-gray-100 hover:bg-primary-100'}`}>
                {fmtGiay(s)}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">Từ 15 giây tới 12 phút.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="hinhthuc" className="block text-sm font-bold text-black mb-1">Hình thức</label>
            <select id="hinhthuc" value={w.input.hinhThuc} onChange={(e) => setInput({ hinhThuc: e.target.value as BriefInput['hinhThuc'] })} className={fieldCls}>
              <option value="nguoi-that">Người thật</option>
              <option value="hoat-hinh-3d">Hoạt hình 3D</option>
              <option value="hoat-hinh-2d">Hoạt hình 2D</option>
            </select>
          </div>
          <div>
            <label htmlFor="thoai" className="block text-sm font-bold text-black mb-1">Thoại</label>
            <div className="flex gap-2">
              <select id="thoai" value={w.input.thoai.mucDo} onChange={(e) => setInput({ thoai: { ...w.input.thoai, mucDo: e.target.value as BriefInput['thoai']['mucDo'] } })} className={fieldCls}>
                <option value="khong">Không thoại</option>
                <option value="it">Ít</option>
                <option value="nhieu">Nhiều</option>
              </select>
              {w.input.thoai.mucDo !== 'khong' && (
                <input aria-label="Ngôn ngữ thoại" value={w.input.thoai.ngonNgu} onChange={(e) => setInput({ thoai: { ...w.input.thoai, ngonNgu: e.target.value } })} className={fieldCls} />
              )}
            </div>
          </div>
          <div>
            <label htmlFor="nhac" className="block text-sm font-bold text-black mb-1">Nhạc nền</label>
            <select id="nhac" value={w.input.nhacNen} onChange={(e) => setInput({ nhacNen: e.target.value as BriefInput['nhacNen'] })} className={fieldCls}>
              <option value="ai-de-xuat">Để AI đề xuất</option>
              <option value="co">Có</option>
              <option value="khong">Không</option>
            </select>
          </div>
        </div>

        <Field label="Ghi chú thêm (tuỳ chọn)" rows={2} value={w.input.ghiChu} onChange={(v) => setInput({ ghiChu: v })} placeholder="Điều bạn muốn nhấn mạnh, điều cần tránh…" />

        {inputErrors.length > 0 && <Issues errors={inputErrors} warnings={[]} />}

        <div className="flex flex-wrap gap-2">
          <RunButton onClick={askQuestions} busy={busy === 'hoi'} busyLabel="AI đang nghĩ câu hỏi…" icon={HelpCircle} variant="ghost" disabled={!!busy || inputErrors.length > 0}>
            Hỏi lại cho rõ (tuỳ chọn)
          </RunButton>
          <RunButton onClick={() => makeLoglines()} busy={busy === 'logline'} busyLabel="AI đang viết logline…" icon={w.phuongAn.length ? RefreshCw : Sparkles} disabled={!!busy || inputErrors.length > 0}>
            {w.phuongAn.length ? 'Tạo 3 phương án khác' : 'Đề xuất logline'}
          </RunButton>
        </div>
      </section>

      <ErrorBox message={error} />
      <Issues errors={notes.errors} warnings={notes.warnings} title={notes.errors.length ? 'AI đã được gửi lại 2 lần nhưng kết quả vẫn còn lỗi — bạn sửa tay hoặc tạo lại:' : undefined} />

      {/* ---------- Câu hỏi làm rõ ---------- */}
      {w.cauHoi.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-black">Câu hỏi làm rõ</h3>
          <p className="text-sm text-gray-600 -mt-2">Chọn hoặc tự gõ câu trả lời. Câu nào bỏ trống thì AI tự quyết. Trả lời xong bấm "Đề xuất logline".</p>
          {w.cauHoi.map((c) => (
            <div key={c.id} className="space-y-2">
              <p className="text-sm font-bold text-black">{c.cauHoi}</p>
              <div className="flex flex-wrap gap-2">
                {c.luaChon.map((o) => (
                  <button key={o} type="button" onClick={() => setAnswer(c.id, c.traLoi === o ? '' : o)} className={`px-3 py-1.5 rounded-full text-sm ${c.traLoi === o ? 'bg-black text-primary-400 font-bold' : 'bg-gray-100 hover:bg-primary-100'}`}>
                    {o}
                  </button>
                ))}
              </div>
              <input aria-label={`Câu trả lời khác cho: ${c.cauHoi}`} value={c.luaChon.includes(c.traLoi) ? '' : c.traLoi} onChange={(e) => setAnswer(c.id, e.target.value)} placeholder="Hoặc tự gõ câu trả lời…" className={fieldCls} />
            </div>
          ))}
        </section>
      )}

      {/* ---------- Phương án logline ---------- */}
      {w.phuongAn.length > 0 && (
        <section className="space-y-4">
          <h3 className="font-bold text-black text-lg">Phương án logline</h3>
          {w.nhanXet && (
            <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-3">
              <span className="font-bold">Nhận xét ý tưởng: </span>
              {w.nhanXet}
            </p>
          )}
          <div className="grid lg:grid-cols-3 gap-3">
            {w.phuongAn.map((o, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setWork((x) => ({ ...x, chon: i }))}
                aria-pressed={w.chon === i}
                className={`text-left rounded-2xl border p-4 space-y-2 transition-colors ${w.chon === i ? 'border-black bg-primary-50 ring-2 ring-black' : 'border-gray-200 bg-white hover:border-primary-400'}`}
              >
                <p className="text-xs font-bold text-gray-500 flex items-center gap-1">
                  {w.chon === i && <Check className="w-3.5 h-3.5" />} Phương án {i + 1}
                </p>
                <p className="font-bold text-black">{o.logline}</p>
                <p className="text-sm text-gray-700"><b>Thông điệp:</b> {o.thongDiep}</p>
                <p className="text-sm text-gray-700"><b>Cảm xúc:</b> {o.camXuc} · <b>Khán giả:</b> {o.khanGia}</p>
                <p className="text-xs text-gray-500">{o.viSaoHop}</p>
              </button>
            ))}
          </div>

          <ReviseBox onSubmit={(t) => makeLoglines(t)} busy={busy === 'sua'} disabled={!!busy} placeholder="Yêu cầu sửa cả 3 phương án, VD: kết vui hơn, nhân vật là bố thay vì mẹ…" />

          {w.chon >= 0 && w.phuongAn[w.chon] && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
              <h4 className="font-bold text-black">Sửa phương án đã chọn trước khi duyệt</h4>
              <Field label="Logline (tối đa 2 câu)" rows={2} value={w.phuongAn[w.chon].logline} onChange={(v) => setOption({ logline: v })} />
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="Thông điệp" value={w.phuongAn[w.chon].thongDiep} onChange={(v) => setOption({ thongDiep: v })} />
                <Field label="Cảm xúc đọng lại" value={w.phuongAn[w.chon].camXuc} onChange={(v) => setOption({ camXuc: v })} />
                <Field label="Khán giả chính" value={w.phuongAn[w.chon].khanGia} onChange={(v) => setOption({ khanGia: v })} />
              </div>
            </div>
          )}
        </section>
      )}

      {/* ---------- Duyệt ---------- */}
      {w.phuongAn.length > 0 && (
        <section className="space-y-3">
          {section ? (
            <StatusBar project={project} sectionKey="brief" blocking={blocking} onApprove={approve} onKeep={approve} onRegenerate={() => makeLoglines()} busy={!!busy} />
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl p-4 bg-gray-50 border border-gray-200">
              <p className="text-sm font-bold text-gray-700">Chọn một phương án, sửa nếu cần, rồi duyệt brief để mở màn 2.</p>
              <RunButton onClick={approve} busy={false} busyLabel="" icon={Check} disabled={!!busy || blocking.length > 0}>
                Duyệt brief
              </RunButton>
            </div>
          )}
          {blocking.length > 0 && <Issues errors={blocking} warnings={[]} />}
          {section?.meta.status === 'duyet' && (
            <div className="flex justify-end">
              <button onClick={() => onGo('nhanVat')} className="py-3 px-6 rounded-xl bg-black hover:bg-gray-800 text-primary-400 font-bold flex items-center gap-2">
                Sang màn 2: Nhân vật <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
