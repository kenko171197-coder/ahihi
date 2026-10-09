# Lượt 2 — Màn ④ Kịch bản + ⑤ Rà soát (ĐÃ DUYỆT 2026-10-09)

Người dùng đã duyệt bản này, gồm 7 điểm đề xuất và 4 lựa chọn ở cuối file.

## Bối cảnh từ các quyết định đã chốt

- Scene = các beat cùng **một bối cảnh và một mạch thời gian liên tục**. Đổi địa điểm hoặc nhảy thời gian → scene mới.
- Một beat = một prompt = một lần tạo video trên Omni Flash → **mỗi beat 3–10 giây**.
- Phim tới 12 phút → có thể 100–150 beat → **viết từng cảnh một**, không viết cả phim trong một lần gọi.
- Màn ④ phải để lại đủ dữ liệu cho ⑥ (bóc tách tự động) và ⑦ ⑧ (prompt): **ai / vật gì có mặt, thay đổi trạng thái, trạng thái đầu – cuối, vị trí**.
- Kịch bản lưu dạng dữ liệu có cấu trúc; hiển thị như văn; xuất file khi cần.

## Trạng thái (dùng chung cho dàn ý và beat)

- Trạng thái = danh sách dòng, **mỗi người / vật một dòng**: `@lan: ngồi bệt cạnh thùng, giữa phòng; áo khoác đã cởi`. Vị trí gộp vào đây.
- **Code tự lấy trạng thái đầu beat** = trạng thái cuối beat trước; beat đầu cảnh lấy trạng thái đầu cảnh trong dàn ý. AI chỉ viết trạng thái cuối beat.
- Màn ⑧ chép thẳng trạng thái đầu beat vào phần "Lúc bắt đầu".

## Màn ④ — Kịch bản (2 bước trong một màn)

### Bước A — Dàn ý cảnh (tác vụ `dan-y-canh`, gọi 1 lần)

**Đọc:** brief, nhân vật, treatment (cả phân đoạn và bảng Cài – Dùng), mục *Viết kịch bản* của file thể loại.

**AI trả mỗi cảnh:** mã cảnh (code đặt, cố định: S1, S2…) · thuộc phần nào · địa điểm + tag địa điểm (`@phongtro`) · thời điểm · ánh sáng (tiếng Việt) · chuyển biến (đầu → cuối) · nhân vật có mặt · bắt đầu – kết thúc (giây) · trạng thái đầu cảnh / cuối cảnh. Cùng bảng: mỗi dòng Cài – Dùng của treatment nằm ở cảnh nào (cài / dùng).

**Code kiểm — lỗi:** các cảnh nối liền phủ kín 0 → tổng thời lượng; mỗi cảnh ≥ 3 giây; mỗi cảnh thuộc một phần có thật; cùng tên địa điểm thì cùng tag, cùng tag thì cùng tên; tag địa điểm đúng dạng và không trùng tag nhân vật; nhân vật có mặt phải có ở màn ②; mỗi dòng Cài – Dùng của treatment có cảnh cài và cảnh dùng, cài trước hoặc cùng cảnh dùng.
**Cảnh báo:** cùng địa điểm liên tiếp mà trạng thái đầu cảnh sau khác cuối cảnh trước; nhân vật gián tiếp có mặt; cảnh cài / dùng không nằm trong phần treatment đã ghi.

Sửa tay, thêm / xoá / đổi chỗ cảnh, sửa theo yêu cầu. **Duyệt dàn ý** riêng trước khi viết beat.

### Bước B — Viết beat từng cảnh (tác vụ `viet-canh`, gọi 1 lần mỗi cảnh; "Viết tất cả" chạy lần lượt)

**Đọc:** brief, nhân vật, treatment, toàn bộ dàn ý, cảnh đang viết, **trạng thái cuối và 1–2 beat cuối của cảnh trước**, đạo cụ đã khai ở các cảnh trước, mục *Viết kịch bản* của thể loại.

**AI trả mỗi beat:** mã (code đặt, B001…, cố định, không đánh lại số, không dùng lại số đã xoá) · số giây · hành động · thoại (`ai`, `cachNoi`, `cau`) · âm thanh, nhạc · cảm xúc / nhịp · có mặt (tag) · đạo cụ mới (tag + mô tả) · thay đổi trạng thái (`@thungxop`: đóng → mở) · Cài – Dùng thể hiện ở beat này · trạng thái cuối beat.

**Code kiểm — lỗi:** tổng giây các beat = giây của cảnh; mỗi beat 3–10 giây; tag có mặt / trạng thái / thay đổi phải là nhân vật ở ② hoặc đạo cụ đã khai; đạo cụ mới không trùng tag nhân vật, địa điểm, đạo cụ đã có; brief "không thoại" thì không có thoại; mỗi dòng Cài – Dùng của cảnh có beat thể hiện.
**Cảnh báo:** thoại quá dài so với số giây; beat ngoài khoảng giây thể loại khuyên (`- **Độ dài beat:**` trong file thể loại); trạng thái cuối beat cuối khác trạng thái cuối cảnh trong dàn ý; người không có ở ② nói thoại; nhân vật gián tiếp có mặt; brief "không nhạc" mà ô âm thanh có nhạc; người / vật có mặt mà không có dòng trạng thái cuối.

**Trạng thái từng cảnh:** chưa viết · nháp · **cần xem lại**. Code ghi lại "đầu vào" của cảnh lúc viết (dòng dàn ý của cảnh + trạng thái cuối thật của cảnh trước). Đầu vào đổi → "cần xem lại" (chỉ cảnh đó, và cảnh ngay sau nếu trạng thái cuối đổi). Nút "Vẫn đúng" xoá cờ.

**Hiển thị:** đọc như kịch bản (tiêu đề cảnh, beat có giây và thoại), sửa tay từng beat, thêm / xoá / tách beat; đồng hồ tổng thời lượng. "Viết tất cả" viết các cảnh chưa viết theo thứ tự, **dừng ở cảnh còn lỗi** sau 3 lần thử.

**Duyệt màn ④:** dàn ý đã duyệt, mọi cảnh đã viết, không cảnh nào "cần xem lại", không còn lỗi.

## Màn ⑤ — Rà soát (tác vụ `ra-soat`)

**Đọc:** brief, nhân vật, treatment, toàn bộ kịch bản, mục *Rà soát* của thể loại (bảng lỗi hay gặp + thang chấm), các vấn đề người dùng đã bỏ qua trước đó (không nêu lại).

**AI trả:** điểm từng tiêu chí của thang thể loại (kèm nhận xét) và danh sách vấn đề: loại (nhân quả, cài – dùng, nhịp, thời lượng, thoại, khó với AI video, đúng thể loại, khác), mức (cao / vừa / thấp), cảnh / beat liên quan, mô tả, đề xuất sửa, có cần sửa dàn ý không.

**Code kiểm:** code tự cộng điểm (không để AI cộng), điểm từng tiêu chí không vượt tối đa, đủ tiêu chí; cảnh / beat nhắc tới phải có thật; vấn đề nào cũng có đề xuất; vấn đề không cần sửa dàn ý phải chỉ ra cảnh.

**Người dùng:** nhận / bỏ từng đề xuất (bỏ thì ghi lại, kèm lý do nếu có). Bấm "Sửa các đề xuất đã nhận" → app gom đề xuất theo cảnh, gửi `viet-canh` ở chế độ sửa cho từng cảnh → hiện bản mới cạnh bản cũ → bạn nhận → app **ghi thẳng vào ④ và tự duyệt lại ④** (nếu ④ không còn lỗi / cảnh cần xem lại) → bấm "Rà lại" một lần.

Đề xuất cần sửa dàn ý (thêm / bớt cảnh, đổi giây của cảnh) không sửa tự động: ghi "cần sửa ở dàn ý", bạn quay lại ④.

**Cổng:** điểm dưới ngưỡng chỉ báo. Duyệt ⑤ khi không còn vấn đề mức "cao" chưa xử lý (đã sửa, hoặc bỏ qua có ghi lại).

**Màn ⑥ ⑦ dựa trên ⑤** (kịch bản chốt), không chỉ ④.

## Bốn lựa chọn đã chốt

- a. Người không có ở ② (shipper, người qua đường) được xuất hiện trong câu hành động, **không tag, không ảnh tham chiếu**; có thoại thì cảnh báo.
- b. Điểm rà soát dưới ngưỡng: **chỉ báo**, không chặn.
- c. Beat ngoài 3–10 giây: **lỗi**; ngoài khoảng của thể loại: **cảnh báo**.
- d. Chỉ khai đạo cụ có tag cho vật **được cầm / dùng, đổi trạng thái, hoặc quay lại ở cảnh khác**. Đồ bày trong phòng thuộc bối cảnh (màn ⑥).

## Việc kèm theo

- `DEPS`: `bible` và `phanCanh` thêm `raSoat`.
- File thể loại thêm dòng `- **Độ dài beat:** 4–8 giây`.
- Test: code kiểm dàn ý và beat, nối trạng thái, cờ "cần xem lại", id cố định khi chèn / xoá, AI giả cho cả ba tác vụ.
