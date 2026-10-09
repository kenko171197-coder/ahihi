// Mô hình dữ liệu dự án — dùng chung cho server và giao diện. Không import thư viện ngoài (để test chạy được).
// Khớp docs/QUYET-DINH.md mục 2–3: 8 màn, mỗi phần có trạng thái nháp / đã duyệt, rev, basedOn, cờ "đã cũ".

/* ============================ CÁC PHẦN CỦA DỰ ÁN ============================ */

/** Khoá của từng phần (mỗi màn sở hữu một phần). */
export type SectionKey = 'brief' | 'nhanVat' | 'treatment' | 'kichBan' | 'raSoat' | 'bible' | 'phanCanh' | 'prompt';

/** Phần nào dựa trên phần nào. Sửa phần trên → phần dưới "đã cũ". */
export const DEPS: Record<SectionKey, SectionKey[]> = {
  brief: [],
  nhanVat: ['brief'],
  treatment: ['brief', 'nhanVat'],
  kichBan: ['brief', 'nhanVat', 'treatment'],
  raSoat: ['kichBan'],
  // Màn ⑥ trở đi đọc kịch bản chốt (sau khi ⑤ duyệt)
  bible: ['brief', 'nhanVat', 'kichBan', 'raSoat'],
  phanCanh: ['kichBan', 'raSoat', 'bible'],
  prompt: ['phanCanh', 'bible'],
};

/** 8 màn theo thứ tự. */
export const SCREENS: { key: SectionKey; no: number; label: string; stage: 1 | 2 | 3 }[] = [
  { key: 'brief', no: 1, label: 'Ý tưởng & định hướng', stage: 1 },
  { key: 'nhanVat', no: 2, label: 'Nhân vật', stage: 1 },
  { key: 'treatment', no: 3, label: 'Treatment', stage: 1 },
  { key: 'kichBan', no: 4, label: 'Kịch bản', stage: 1 },
  { key: 'raSoat', no: 5, label: 'Rà soát', stage: 1 },
  { key: 'bible', no: 6, label: 'Bible & tham chiếu', stage: 2 },
  { key: 'phanCanh', no: 7, label: 'Phân cảnh', stage: 2 },
  { key: 'prompt', no: 8, label: 'Prompt', stage: 3 },
];

export type Status = 'nhap' | 'duyet';

export interface Meta {
  /** Tăng mỗi lần duyệt một nội dung mới */
  rev: number;
  status: Status;
  /** rev của các phần phía trên lúc phần này được tạo / duyệt */
  basedOn: Partial<Record<SectionKey, number>>;
  updatedAt: number;
}

export interface Section<T> {
  data: T;
  meta: Meta;
}

/* ============================ MÀN ① — BRIEF ============================ */

export type NenTang = 'doc' | 'ngang';
export type HinhThuc = 'nguoi-that' | 'hoat-hinh-3d' | 'hoat-hinh-2d';
export type MucThoai = 'khong' | 'it' | 'nhieu';
export type NhacNen = 'khong' | 'co' | 'ai-de-xuat';

/** Những gì người dùng nhập ở màn ①. */
export interface BriefInput {
  yTuong: string;
  theLoai: string; // id file thể loại
  nenTang: NenTang;
  thoiLuongGiay: number;
  hinhThuc: HinhThuc;
  thoai: { mucDo: MucThoai; ngonNgu: string };
  nhacNen: NhacNen;
  ghiChu: string;
}

export interface HoiLaiCau {
  id: string;
  cauHoi: string;
  luaChon: string[];
  traLoi: string;
}

export interface LoglineOption {
  logline: string;
  thongDiep: string;
  camXuc: string;
  khanGia: string;
  viSaoHop: string;
}

/** Brief đã duyệt — phần các màn sau đọc. */
export interface Brief extends BriefInput {
  tiLe: '9:16' | '16:9';
  logline: string;
  thongDiep: string;
  camXuc: string;
  khanGia: string;
}

/** Trạng thái làm việc của màn ① (chưa phải brief đã duyệt). */
export interface BriefWork {
  input: BriefInput;
  cauHoi: HoiLaiCau[];
  nhanXet: string;
  phuongAn: LoglineOption[];
  chon: number; // -1 = chưa chọn
}

/* ============================ MÀN ② — NHÂN VẬT ============================ */

export type VaiNhanVat = 'chinh' | 'phu' | 'gian-tiep';

export interface Character {
  id: string;
  ten: string;
  tag: string;
  vai: VaiNhanVat;
  tuoi: string;
  muon: string;
  can: string;
  tinhCach: string;
  chiTiet: string;
  quanHe: string;
  ghiChuThietKe: string;
}

export interface NhanVatData {
  list: Character[];
}

/* ============================ MÀN ③ — TREATMENT ============================ */

export interface PhanDoan {
  id: string;
  ten: string;
  mucTieu: string;
  batDau: number;
  ketThuc: number;
  tomTat: string;
}

export interface PhanTruyen {
  id: string;
  ten: string;
  vaiTro: string;
  batDau: number;
  ketThuc: number;
  tomTat: string;
  mocTruyen: string[];
  phanDoan: PhanDoan[];
}

export interface CaiDung {
  id: string;
  chiTiet: string;
  /** id phần cài */
  cai: string;
  /** id phần dùng */
  dung: string;
}

export interface TreatmentData {
  phan: PhanTruyen[];
  caiDung: CaiDung[];
}

/** Từ bao nhiêu giây thì mỗi phần phải chia thành phân đoạn. */
export const PHAN_DOAN_TU_GIAY = 180;

/* ============================ MÀN ④ — KỊCH BẢN ============================ */

/** Một dòng trạng thái: một người hoặc một vật (vị trí + tình trạng). */
export interface DongTrangThai {
  tag: string;
  moTa: string;
}

export interface CanhDanY {
  /** Mã cố định: S1, S2… (không đánh lại số khi chèn / xoá) */
  id: string;
  /** id phần của treatment (P1…) */
  phan: string;
  diaDiem: string;
  tagDiaDiem: string;
  thoiDiem: string;
  /** Ánh sáng, tiếng Việt (màn ⑥ chuyển thành mô tả cố định) */
  anhSang: string;
  /** Đầu cảnh thế nào → cuối cảnh thế nào */
  chuyenBien: string;
  /** Tag nhân vật có mặt */
  coMat: string[];
  batDau: number;
  ketThuc: number;
  dauCanh: DongTrangThai[];
  cuoiCanh: DongTrangThai[];
}

/** Dòng Cài – Dùng của treatment đặt vào cảnh. id = id dòng ở treatment (C1…); cai / dung = id cảnh. */
export interface CaiDungCanh {
  id: string;
  cai: string;
  dung: string;
}

export interface DanY {
  canh: CanhDanY[];
  caiDung: CaiDungCanh[];
}

export interface ThoaiCau {
  /** Tag nhân vật, hoặc tên người không có ở màn ② (người qua đường…) */
  ai: string;
  cachNoi: string;
  cau: string;
}

export interface DaoCu {
  tag: string;
  moTa: string;
}

export interface ThayDoi {
  tag: string;
  truoc: string;
  sau: string;
}

export interface Beat {
  /** Mã cố định: B001… (không đánh lại số, không dùng lại số đã xoá) */
  id: string;
  giay: number;
  hanhDong: string;
  thoai: ThoaiCau[];
  amThanh: string;
  camXuc: string;
  /** Tag người / vật có mặt */
  coMat: string[];
  /** Đạo cụ xuất hiện lần đầu ở beat này */
  daoCuMoi: DaoCu[];
  thayDoi: ThayDoi[];
  /** id dòng Cài – Dùng thể hiện ở beat này */
  caiDung: string[];
  /** Trạng thái cuối beat. Trạng thái đầu beat do code lấy từ cuối beat trước. */
  cuoiBeat: DongTrangThai[];
}

export interface CanhViet {
  beats: Beat[];
  /** Dấu "đầu vào" lúc viết (dòng dàn ý + trạng thái cuối cảnh trước). Đổi → cảnh cần xem lại. */
  dauVao: string;
  updatedAt: number;
}

export interface KichBanData {
  danY: DanY;
  /** Dàn ý đã được duyệt riêng (mới viết beat được) */
  danYDuyet: boolean;
  /** Beat của từng cảnh, theo id cảnh */
  canh: Record<string, CanhViet>;
  /** Số tiếp theo cho mã cảnh / beat — chỉ tăng */
  soCanh: number;
  soBeat: number;
}

/** Mỗi beat 3–10 giây (một lần tạo video trên Omni Flash). */
export const BEAT_MIN = 3;
export const BEAT_MAX = 10;

/* ============================ MÀN ⑤ — RÀ SOÁT ============================ */

export type MucVanDe = 'cao' | 'vua' | 'thap';
/** chua: chưa quyết · nhan: nhận, chờ sửa · da-sua: đã sửa · bo: bỏ qua */
export type XuLy = 'chua' | 'nhan' | 'da-sua' | 'bo';

export const LOAI_VAN_DE = ['nhân quả', 'cài – dùng', 'nhịp', 'thời lượng', 'thoại', 'khó với AI video', 'đúng thể loại', 'khác'] as const;

export interface DiemTieuChi {
  ten: string;
  toiDa: number;
  diem: number;
  nhanXet: string;
}

export interface VanDe {
  id: string;
  loai: string;
  muc: MucVanDe;
  /** id cảnh liên quan */
  canh: string[];
  /** id beat liên quan */
  beat: string[];
  moTa: string;
  deXuat: string;
  /** Cần thêm / bớt cảnh hoặc đổi giây của cảnh → không sửa tự động */
  canSuaDanY: boolean;
  /** Các cảnh của vấn đề đã nhận bản sửa — đủ hết mới là "đã sửa" */
  daSuaCanh: string[];
  xuLy: XuLy;
  lyDo: string;
}

/** Bản viết lại một cảnh theo đề xuất, chờ người dùng nhận. */
export interface BanSua {
  canhId: string;
  vanDe: string[];
  beats: Beat[];
  /** Dấu các beat gốc lúc gửi AI — đổi nghĩa là cảnh đã được sửa ở màn ④ trong lúc chờ */
  goc: string;
  /** Dấu đầu vào của cảnh lúc gửi AI (cảnh trước đổi sau đó → cảnh hiện "cần xem lại") */
  dauVao: string;
  errors: string[];
  warnings: string[];
}

export interface RaSoatData {
  diem: DiemTieuChi[];
  /** Điểm đạt (từ thang của thể loại) */
  nguong: number;
  nhanXet: string;
  vanDe: VanDe[];
  banSua: BanSua[];
  /** Các vấn đề đã bỏ qua, giữ qua các lần rà lại */
  daBoQua: { moTa: string; lyDo: string; at: number }[];
}

/* ============================ MÀN ⑦ — PHÂN CẢNH ============================ */

export type CoCanh = 'toan' | 'toan-trung' | 'trung' | 'can-trung' | 'can' | 'dac-ta';
export type GocMay = 'ngang' | 'thap' | 'cao' | 'tren-xuong' | 'qua-vai' | 'goc-nhin';
export type ChuyenDong = 'tinh' | 'lia-ngang' | 'lia-doc' | 'day-vao' | 'keo-ra' | 'di-theo' | 'cam-tay';

export interface Shot {
  /** Mã cố định trong beat: B007.1, B007.2… (không đánh lại số) */
  id: string;
  /** Số giây, bước 0,5 */
  giay: number;
  coCanh: CoCanh;
  gocMay: GocMay;
  chuyenDong: ChuyenDong;
  /** Mô tả tiếng Việt — nguồn duy nhất cho câu hành động ở màn ⑧ */
  moTa: string;
  /** Tag người / vật trong khung */
  trongKhung: string[];
  /** Vị trí (0, 1, …) các câu thoại của beat nói trong shot này */
  thoai: number[];
}

export interface PhanCanhBeat {
  shots: Shot[];
  /** Số tiếp theo cho mã shot của beat — chỉ tăng */
  soShot: number;
}

export interface PhanCanhCanh {
  /** Shot theo id beat */
  beats: Record<string, PhanCanhBeat>;
  /** Dấu các beat của cảnh lúc phân cảnh — đổi → cảnh cần xem lại */
  dauVao: string;
  updatedAt: number;
}

export interface PhanCanhData {
  canh: Record<string, PhanCanhCanh>;
}

/* ============================ MÀN ⑧ — PROMPT ============================ */

/** Một câu tiếng Anh về một người / vật lúc bắt đầu beat. */
export interface CauTag {
  tag: string;
  cau: string;
}

/** Phần AI dịch cho một câu thoại (câu thoại giữ nguyên văn, code chép). */
export interface ThoaiDich {
  /** Cách nói, tiếng Anh ("softly") */
  cachNoi: string;
  /** Người nói, tiếng Anh — dùng khi người nói không có ảnh nạp ở beat (nói qua điện thoại, người qua đường) */
  nguoiNoi: string;
}

/** Phần AI dịch của một beat. Phần cố định (ảnh, không gian, máy, giọng, thoại) do code ghép lúc hiển thị. */
export interface PromptBeat {
  lucBatDau: CauTag[];
  /** Câu hành động tiếng Anh theo mã shot */
  shots: Record<string, string>;
  ambient: string;
  music: string;
  /** Theo vị trí câu thoại của beat */
  thoai: ThoaiDich[];
  /** 2–3 điều riêng của beat cần giữ đúng, tiếng Anh */
  giuDung: string[];
}

export interface PromptCanh {
  beats: Record<string, PromptBeat>;
  /** Dấu chữ tiếng Việt nguồn lúc dịch — đổi → cảnh cần dịch lại */
  dauVao: string;
  updatedAt: number;
}

export interface PromptData {
  canh: Record<string, PromptCanh>;
  /** Frame cuối video của beat (id ảnh trong kho ảnh), dùng làm frame nối cho beat sau cùng cảnh */
  frame: Record<string, string>;
  /** Beat đã tạo video ở Flow */
  daTao: Record<string, boolean>;
}

/* ============================ DỰ ÁN ============================ */

/* ============================ MÀN ⑥ — BIBLE & THAM CHIẾU ============================ */

/** Một bộ đồ của nhân vật = một ảnh tham chiếu. */
export interface BoDo {
  /** Tag ảnh: bộ đầu = tag nhân vật, bộ thêm do code đặt (lanngu) */
  tag: string;
  /** Tên bộ đồ, tiếng Việt ("đồ đi làm", "đồ ngủ") */
  ten: string;
  /** Cảnh nhân vật mặc bộ này */
  canh: string[];
  /** Mô tả cố định, tiếng Anh: ngoại hình + trang phục (chép nguyên văn vào prompt ảnh và prompt video) */
  moTa: string;
  /** Ô Note của ảnh, tiếng Việt */
  note: string;
  /** Khung ảnh, tiếng Anh: góc, tư thế, nền */
  khungAnh: string;
  /** Vai trò ảnh ở màn ⑧, tiếng Anh ngắn ("Lan in her office clothes") */
  vaiTro: string;
}

export interface BibleNhanVat {
  tag: string;
  ten: string;
  /** Cảnh có mặt (cần ảnh) */
  canh: string[];
  coThoai: boolean;
  /** Giọng, tiếng Anh — chỉ dùng trong prompt video (phần thoại) */
  giong: string;
  /** Rỗng nếu nhân vật không có mặt (chỉ có giọng) */
  bo: BoDo[];
  /** Không còn trong kịch bản (sau khi bóc tách lại) */
  khongDung?: boolean;
}

export interface BibleDaoCu {
  tag: string;
  /** Mô tả trong kịch bản (tiếng Việt) */
  moTaKichBan: string;
  /** Các trạng thái gặp trong phim, theo thứ tự (tiếng Việt) */
  trangThai: string[];
  canh: string[];
  moTa: string;
  note: string;
  khungAnh: string;
  vaiTro: string;
  khongDung?: boolean;
}

/** Một ảnh bối cảnh: một cặp địa điểm + thời điểm. */
export interface BienTheBoiCanh {
  tag: string;
  thoiDiem: string;
  canh: string[];
  note: string;
  khungAnh: string;
  vaiTro: string;
  /** Thời điểm này không còn trong kịch bản (giữ lại để người dùng xoá) */
  khongDung?: boolean;
}

export interface BibleBoiCanh {
  /** Tag địa điểm của dàn ý */
  tag: string;
  ten: string;
  canh: string[];
  /** Mô tả cố định của không gian, tiếng Anh */
  moTa: string;
  bienThe: BienTheBoiCanh[];
  khongDung?: boolean;
}

export interface AnhSangCanh {
  canh: string;
  /** Tag địa điểm + thời điểm + ánh sáng tiếng Việt của dàn ý (để biết cảnh nào giống nhau) */
  diaDiem: string;
  thoiDiem: string;
  goc: string;
  /** Câu ánh sáng tiếng Anh cố định */
  moTa: string;
}

export interface AnhThamChieu {
  imageId?: string;
  /** AI thấy gì trong ảnh lúc quét */
  seen?: string;
  warning?: string;
}

export interface BibleData {
  style: string;
  phuongAnStyle: { style: string; giaiThich: string }[];
  nhanVat: BibleNhanVat[];
  daoCu: BibleDaoCu[];
  boiCanh: BibleBoiCanh[];
  anhSang: AnhSangCanh[];
  /** Ảnh tham chiếu theo tag */
  anh: Record<string, AnhThamChieu>;
}

export interface Project {
  id: string;
  version: 3;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Màn đang mở */
  manHinh: SectionKey;
  briefWork: BriefWork;
  sections: {
    brief?: Section<Brief>;
    nhanVat?: Section<NhanVatData>;
    treatment?: Section<TreatmentData>;
    kichBan?: Section<KichBanData>;
    raSoat?: Section<RaSoatData>;
    bible?: Section<BibleData>;
    phanCanh?: Section<PhanCanhData>;
    prompt?: Section<PromptData>;
  };
}

export type ProjectPatch = Partial<Project> | ((latest: Project) => Partial<Project>);

/* ============================ HÀM TIỆN ÍCH (thuần) ============================ */

export const tiLeCua = (n: NenTang): '9:16' | '16:9' => (n === 'doc' ? '9:16' : '16:9');

export const DEFAULT_BRIEF_INPUT: BriefInput = {
  yTuong: '',
  theLoai: '',
  nenTang: 'doc',
  thoiLuongGiay: 60,
  hinhThuc: 'nguoi-that',
  thoai: { mucDo: 'it', ngonNgu: 'tiếng Việt' },
  nhacNen: 'ai-de-xuat',
  ghiChu: '',
};

export function newProjectData(id: string, now: number, title = 'Dự án mới'): Project {
  return {
    id,
    version: 3,
    title,
    createdAt: now,
    updatedAt: now,
    manHinh: 'brief',
    briefWork: { input: { ...DEFAULT_BRIEF_INPUT, thoai: { ...DEFAULT_BRIEF_INPUT.thoai } }, cauHoi: [], nhanXet: '', phuongAn: [], chon: -1 },
    sections: {},
  };
}

/** Lấy phần của dự án (các màn chưa làm trả về undefined). */
export function getSection(p: Project, key: SectionKey): Section<any> | undefined {
  return (p.sections as Record<string, Section<any> | undefined>)[key];
}

/** rev hiện tại của các phụ thuộc. */
export function depRevs(p: Project, key: SectionKey): Partial<Record<SectionKey, number>> {
  const out: Partial<Record<SectionKey, number>> = {};
  DEPS[key].forEach((d) => {
    const s = getSection(p, d);
    if (s) out[d] = s.meta.rev;
  });
  return out;
}

/** Phụ thuộc CHƯA TỪNG được duyệt → màn bị khoá hẳn (chưa có gì để làm). */
export function missingDeps(p: Project, key: SectionKey): SectionKey[] {
  return DEPS[key].filter((d) => {
    const s = getSection(p, d);
    return !s || (s.meta.rev === 0 && s.meta.status !== 'duyet');
  });
}

/** Phụ thuộc đang nháp hoặc đã cũ → màn vẫn xem được, nhưng chưa được tạo / duyệt / giữ nguyên.
 *  Tính lan theo chuỗi: ② đã cũ thì ③ cũng bị chặn. */
export function blockedDeps(p: Project, key: SectionKey): SectionKey[] {
  return DEPS[key].filter((d) => {
    const s = getSection(p, d);
    return !s || s.meta.status !== 'duyet' || isStale(p, d);
  });
}

/** Phần phía trên nào đã đổi sau khi phần này được tạo / duyệt. */
export function staleDeps(p: Project, key: SectionKey): SectionKey[] {
  const s = getSection(p, key);
  if (!s) return [];
  return DEPS[key].filter((d) => {
    const dep = getSection(p, d);
    if (!dep) return false;
    const seen = s.meta.basedOn[d];
    return seen === undefined || dep.meta.rev !== seen || dep.meta.status !== 'duyet';
  });
}

export function isStale(p: Project, key: SectionKey): boolean {
  return staleDeps(p, key).length > 0;
}

/** Tạo phần mới từ kết quả AI (trạng thái nháp).
 *  basedOn: phiên bản các phần phía trên mà AI đã ĐỌC — chụp lúc bấm nút, để nếu phần trên đổi trong lúc AI chạy
 *  thì kết quả được đánh dấu "đã cũ". Không truyền thì lấy phiên bản hiện tại. */
export function freshSection<T>(p: Project, key: SectionKey, data: T, now: number, basedOn?: Partial<Record<SectionKey, number>>): Section<T> {
  const old = getSection(p, key);
  return { data, meta: { rev: old?.meta.rev ?? 0, status: 'nhap', basedOn: basedOn ?? depRevs(p, key), updatedAt: now } };
}

/** Sửa tay dữ liệu: về nháp, giữ basedOn (vẫn dựa trên cùng phần phía trên). */
export function editSection<T>(s: Section<T>, data: T, now: number): Section<T> {
  return { data, meta: { ...s.meta, status: 'nhap', updatedAt: now } };
}

/** Duyệt: rev + 1, ghi lại phụ thuộc hiện tại. */
export function approveSection<T>(p: Project, key: SectionKey, s: Section<T>, now: number): Section<T> {
  return { data: s.data, meta: { rev: s.meta.rev + 1, status: 'duyet', basedOn: depRevs(p, key), updatedAt: now } };
}

/** "Giữ nguyên": phần phía trên đổi nhưng người dùng xác nhận phần này vẫn đúng → duyệt lại với phụ thuộc mới. */
export const keepSection = approveSection;

/* ============================ TAG ============================ */

/** "Chó Cái" → "chocai": viết liền, không dấu, chữ thường, tối đa 15 ký tự. */
export function toTag(input: string): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 15);
}

/** Tag không trùng: thêm số ở cuối nếu đã có. */
export function uniqueTag(base: string, taken: Set<string>): string {
  const b = toTag(base) || 'nv';
  if (!taken.has(b)) return b;
  for (let i = 2; i < 100; i++) {
    const t = `${b.slice(0, 15 - String(i).length)}${i}`;
    if (!taken.has(t)) return t;
  }
  return `${b.slice(0, 11)}${Date.now() % 10000}`;
}

/** Định dạng giây: 75 → "1:15". */
export function fmtGiay(s: number): string {
  if (!Number.isFinite(s)) return '—';
  const n = Math.max(0, Math.round(s));
  return n >= 60 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : `${n}s`;
}

/** Số nhân vật tối đa hợp lý theo thời lượng (chỉ để cảnh báo). */
export function maxNhanVat(giay: number): number {
  if (giay < 180) return 3;
  if (giay <= 600) return 6;
  return 8;
}
