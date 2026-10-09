# Lượt 2 — Màn ④ Kịch bản + ⑤ Rà soát (BẢN NHÁP, chờ người dùng duyệt)

Bản nháp này soạn từ các trao đổi khi thiết kế app. Trình bày lại cho người dùng, sửa theo góp ý, **chỉ code khi đã được duyệt**.

## Bối cảnh từ các quyết định đã chốt

- Scene = các beat cùng **một bối cảnh và một mạch thời gian liên tục**. Đổi địa điểm hoặc nhảy thời gian → scene mới.
- Một beat = một prompt = một lần tạo video trên Omni Flash → **mỗi beat 3–10 giây**.
- Phim tới 12 phút → có thể 100–150 beat → **viết từng cảnh một**, không viết cả phim trong một lần gọi.
- Màn ④ phải để lại đủ dữ liệu cho ⑥ (bóc tách tự động) và ⑦ ⑧ (prompt): **ai / vật gì có mặt, thay đổi trạng thái, trạng thái đầu – cuối, vị trí**.
- Kịch bản lưu dạng dữ liệu có cấu trúc; hiển thị như văn; xuất file khi cần.

## Màn ④ — Kịch bản (2 bước trong một màn)

### Bước A — Dàn ý cảnh (tác vụ `dan-y-canh`, gọi 1 lần)

**Đọc:** brief, nhân vật, treatment (cả phân đoạn và bảng Cài – Dùng), mục *Viết kịch bản* của file thể loại.

**AI trả mỗi cảnh:**

| Ô | Ví dụ |
|---|---|
| id (code đặt, cố định) | S1 |
| Thuộc phần / phân đoạn | P1 (có thể trải sang phần sau) |
| Địa điểm + tag địa điểm | Phòng trọ của Lan · `@phongtro` (cùng nơi → cùng tag) |
| Thời điểm | Khuya |
| Ánh sáng (tiếng Việt) | Đèn tuýp trần trắng, đèn bàn vàng |
| Mục đích, chuyển biến | Từ định bỏ bữa → ngồi ăn cơm mẹ gửi |
| Nhân vật có mặt (tag) | `@lan` |
| Bắt đầu – kết thúc (giây) | 12–60 |
| Trạng thái đầu cảnh / cuối cảnh | … |
| Chi tiết Cài – Dùng nằm trong cảnh | C1 (cài) |

**Code kiểm:** các cảnh nối liền phủ kín 0 → tổng thời lượng; cùng tên địa điểm thì cùng tag; tag nhân vật phải có ở màn ②; mỗi dòng Cài – Dùng có cảnh cài và cảnh dùng, cài trước hoặc cùng cảnh dùng; trạng thái đầu cảnh sau khớp trạng thái cuối cảnh trước (cảnh báo).

Người dùng duyệt dàn ý trước khi viết beat (duyệt riêng phần dàn ý trong màn ④).

### Bước B — Viết beat từng cảnh (tác vụ `viet-canh`, gọi 1 lần mỗi cảnh; có nút "Viết tất cả" chạy lần lượt)

**Đọc:** brief, nhân vật, treatment, toàn bộ dàn ý (ngắn), cảnh đang viết, **trạng thái cuối và 1–2 beat cuối của cảnh trước**, danh sách đạo cụ đã có, mục *Viết kịch bản* của thể loại.

**AI trả mỗi beat:**

| Ô | Ví dụ |
|---|---|
| id (code đặt, cố định, không đánh lại số) | B007 |
| Số giây | 3–10 |
| Hành động (văn, tiếng Việt) | Dưới đáy thùng có mẩu giấy. Lan cầm lên, ngón tay miết nhẹ lên nét chữ. |
| Thoại | `[{ ai: "@lan", cachNoi: "khẽ", cau: "…" }]` |
| Âm thanh, nhạc | Im lặng, xe máy xa xa |
| Cảm xúc / nhịp | Khoảnh khắc chạm, chậm |
| Có mặt | `@lan`, `@manhgiay` |
| Đạo cụ mới xuất hiện lần đầu | `@manhgiay` — mẩu giấy viết tay gấp đôi |
| Thay đổi trạng thái | `@thungxop`: đóng → mở |
| Trạng thái đầu beat / cuối beat | … |
| Vị trí trong bối cảnh | Lan ngồi bệt cạnh thùng, giữa phòng |

**Code kiểm:** tổng giây các beat = giây của cảnh; mỗi beat 3–10 giây; tag có mặt phải là nhân vật đã duyệt hoặc đạo cụ đã khai; đạo cụ không trùng tag; thoại không quá dài so với số giây (cảnh báo); beat đầu khớp trạng thái đầu cảnh, beat cuối khớp trạng thái cuối cảnh (cảnh báo); chi tiết Cài – Dùng của cảnh có beat thể hiện.

**Đã cũ theo cảnh:** viết lại cảnh k làm cảnh k+1 hiện "cần xem lại" nếu trạng thái cuối cảnh k đổi.

**Hiển thị:** đọc như kịch bản (tiêu đề cảnh, các beat có giây và thoại), sửa tay từng beat, thêm / xoá / tách beat; đồng hồ tổng thời lượng.

## Màn ⑤ — Rà soát (tác vụ `ra-soat`)

**Đọc:** brief, nhân vật, treatment, toàn bộ kịch bản, mục *Rà soát* của thể loại (bảng lỗi hay gặp + thang chấm).

**AI trả:** điểm theo thang của thể loại (từng tiêu chí + tổng, đạt / chưa đạt) và danh sách vấn đề: loại (nhân quả, cài – dùng, nhịp, thời lượng, khó với AI video…), mức (cao / vừa / thấp), cảnh / beat liên quan, mô tả, đề xuất sửa.

**Người dùng:** nhận / bỏ từng đề xuất. Đề xuất được nhận → app gửi `viet-canh` ở chế độ "sửa theo yêu cầu" cho đúng cảnh đó (chỉ cảnh đó viết lại), rồi rà lại.

**Cổng:** duyệt màn ⑤ khi không còn vấn đề mức "cao" chưa xử lý (hoặc người dùng chủ động bỏ qua, có ghi lại).

## Việc kèm theo

- Thêm `DEPS` / màn ④ ⑤ vào thanh màn (đã có sẵn khoá `kichBan`, `raSoat` trong `shared/project.ts`).
- File thể loại `doi-thuong.md` đã có mục *Viết kịch bản* và *Rà soát*.
- Test: code kiểm dàn ý và beat, nối trạng thái giữa cảnh, id cố định khi chèn / xoá, AI giả cho cả hai tác vụ.
