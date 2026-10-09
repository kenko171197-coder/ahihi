# Lượt 3 — Màn ⑥ Bible & tham chiếu · Màn ⑦ Phân cảnh (ĐÃ DUYỆT 2026-10-09)

Lượt 3 chia hai phần: **3a = màn ⑥** (làm trước, người dùng thử), **3b = màn ⑦** (trình bày thiết kế sau khi 3a xong).

## Màn ⑥ — Bible & tham chiếu

Gom mọi thứ **cố định** của phim. Màn ⑧ chép nguyên văn vào prompt video. Đọc **kịch bản chốt** (sau ⑤). Thay màn ⑥ tạm (bước Nhân vật & đạo cụ cũ); giữ phần tải ảnh / quét ảnh gán tag.

### Bước 1 — Bóc tách (code, không gọi AI)

| Loại | Lấy từ | Ghi chú |
|---|---|---|
| Nhân vật | Tag nhân vật ② có mặt (dàn ý hoặc beat) hoặc có thoại | Cảnh có mặt; có thoại hay không. Chỉ có thoại (gián tiếp qua điện thoại) → chỉ cần giọng, không cần ảnh |
| Đạo cụ | `daoCuMoi` của mọi beat | Mô tả trong kịch bản, các trạng thái (từ `thayDoi`), cảnh dùng |
| Bối cảnh | Mỗi tag địa điểm của dàn ý | Biến thể theo **thời điểm** (mỗi cặp địa điểm + thời điểm có trong phim = một ảnh). Biến thể đầu dùng tag địa điểm, biến thể sau code đặt tag (`phongtrosang`) |
| Ánh sáng | Mỗi cảnh một dòng | Từ `thoiDiem` + `anhSang` của dàn ý |

Bóc tách lại (kịch bản đổi): mục còn trong kịch bản giữ nguyên mô tả và ảnh; mục mới thêm vào; mục không còn dùng giữ lại, đánh dấu "không còn dùng" để người dùng xoá (cả ảnh bối cảnh của thời điểm không còn dùng, cả bộ đồ của nhân vật chuyển sang chỉ có giọng). Tag mới không bao giờ lấy lại tag đã có ảnh.

### Bước 2 — Style (một style cố định, xuyên suốt phim)

Người dùng tự gõ, hoặc AI (`bible-style`) đề xuất 3 phương án (tiếng Anh 1–2 câu + giải thích tiếng Việt) để chọn. Code chép nguyên văn style vào mọi prompt ảnh và prompt video. Đổi style → mọi prompt ghép lại theo.

### Bước 3 — Phần cố định (AI viết, code ghép)

| Tác vụ | AI viết mỗi mục | Code tự thêm |
|---|---|---|
| `bible-nhan-vat` | Mỗi nhân vật: **giọng** (tiếng Anh: tuổi, giới, chất giọng, tốc độ, vùng miền) và các **bộ đồ**. Bộ đồ: tên (tiếng Việt), cảnh mặc, mô tả cố định (tiếng Anh: ngoại hình + trang phục, không tính cách), ô Note, khung ảnh (góc, tư thế, nền), vai trò ảnh | Đúng một bộ mang tag nhân vật; bộ thêm code đặt tag (`lanngu`). AI viết lại: bộ cùng tên giữ tag cũ (ảnh không bị tráo). Prompt ảnh = mô tả + khung + style; reference sheet = khuôn cố định + mô tả + style |
| `bible-dao-cu` | Mô tả cố định (hình dáng, chất liệu, màu, kích thước so với người), ô Note, khung ảnh (nền trắng, trạng thái đầu tiên trong phim), vai trò ảnh | Prompt ảnh = mô tả + khung + style + "no text, no letters, no logos, no engraving or writing on the surface" |
| `bible-boi-canh` | Mỗi địa điểm: mô tả cố định (không gian, đồ bày, dấu vết sống). Mỗi biến thể: khung ảnh (giờ, ánh sáng, góc rộng), ô Note, vai trò ảnh. Mỗi cảnh: câu **ánh sáng** tiếng Anh | Prompt ảnh = mô tả + khung + style + tỉ lệ khung phim + "empty scene with no people, no text…". Cảnh cùng địa điểm + thời điểm + ánh sáng tiếng Việt → code chép **cùng một câu** ánh sáng |

- **Giọng** chỉ dùng ở màn ⑧, phần thoại của Âm thanh. Không nằm trong ảnh.
- **Trang phục:** mặc định một bộ; kịch bản cần đổi đồ thì AI đề xuất thêm bộ; mỗi cảnh nhân vật có mặt dùng đúng một bộ.

**Code kiểm — lỗi:** bible khớp kịch bản chốt hiện tại (lệch → "Bóc tách lại"); có style; đủ mọi mục đã bóc tách, đúng tag, không tag lạ; mô tả / khung ảnh / giọng / ánh sáng / style / vai trò viết tiếng Anh (không chữ tiếng Việt có dấu); mô tả nhân vật ≤ 60 từ, đạo cụ ≤ 40, bối cảnh ≤ 60, khung ảnh ≤ 40, giọng ≤ 30, ánh sáng ≤ 30, style ≤ 50, vai trò ≤ 10; mô tả không có `@` và không nhắc tên nhân vật khác (bối cảnh, đạo cụ, style: không nhắc tên nhân vật nào); nhân vật có thoại có giọng; mỗi cảnh có câu ánh sáng; mỗi cảnh nhân vật có mặt thuộc đúng một bộ đồ; tag bộ đồ không trùng tag khác; có ô Note.
**Cảnh báo:** mô tả nhân vật có từ chỉ tính cách; mô tả / khung ảnh bối cảnh nhắc tới người; nhân vật quá 4 bộ đồ; mục "không còn dùng"; tag chưa có ảnh; cảnh cùng địa điểm + thời điểm + ánh sáng mà câu tiếng Anh khác nhau.

Sửa tay mọi ô; sửa theo yêu cầu từng nhóm; "Tạo tất cả" chạy lần lượt nhân vật → đạo cụ → bối cảnh (cần style trước).

### Bước 4 — Ảnh tham chiếu

Giữ cách cũ: tải / dán / kéo ảnh theo lô → AI quét gán tag → duyệt rồi lưu; mỗi tag cũng gắn ảnh riêng được. Thêm loại **bối cảnh**. Mỗi ảnh hiện vai trò cho màn ⑧ ("@lan as …"). Thiếu ảnh chỉ cảnh báo.

### Duyệt / đã cũ

Duyệt khi có style, mọi mục có phần cố định, không lỗi, khớp kịch bản. Kịch bản đổi → "đã cũ" → "Bóc tách lại" (giữ phần đã làm); nút AI tạm khoá tới khi bóc tách lại.

**Ảnh tham chiếu nằm ngoài việc duyệt** (chốt sau lượt soát, chờ người dùng xác nhận): thêm / thay / gỡ ảnh không làm màn ⑥ về nháp và không làm màn ⑦ "đã cũ". Màn ⑧ tự kiểm đủ ảnh.

## Màn ⑦ — Phân cảnh

Mỗi beat chia thành các shot. **Một beat vẫn là một lần tạo video**; các shot nối bằng "Hard cut to" ở màn ⑧. Đọc kịch bản chốt (⑤) và bible (⑥).

### Mỗi shot

| Ô | Ai điền |
|---|---|
| Số giây — bước 0,5 (1,5 giây được), tối thiểu 1 giây | AI đề xuất, người dùng sửa |
| Mốc giây `[00:00–00:01.5]` | Code tính |
| Cỡ cảnh · góc máy · chuyển động máy — chọn trong danh sách cố định, mỗi mục có sẵn câu tiếng Anh (code ghép câu máy cho ⑧) | AI chọn, người dùng sửa |
| **Mô tả** tiếng Việt — nguồn duy nhất cho câu hành động ở ⑧; không tả bối cảnh, ánh sáng, ngoại hình (code chép từ bible) | AI viết, người dùng sửa |
| Trong khung — tag người / vật có mặt ở beat | AI chọn |
| Thoại — câu nào của beat nói trong shot; shot ngắn thường một câu, shot dài được nhiều câu; mỗi câu thuộc đúng một shot | AI gán |

Danh sách: **cỡ cảnh** toàn cảnh, toàn trung, trung cảnh, cận trung, cận cảnh, đặc tả · **góc máy** ngang tầm mắt, máy thấp, máy cao, từ trên xuống, qua vai, góc nhìn nhân vật · **chuyển động** máy tĩnh, lia ngang, lia dọc, đẩy vào, kéo ra, đi theo, cầm tay nhẹ.

**Số shot không giới hạn:** tuỳ tình tiết trong beat và ý đồ đạo diễn.

### Tác vụ `phan-canh` (một lần mỗi cảnh; "Phân cảnh tất cả" chạy lần lượt, dừng ở cảnh còn lỗi)

Đọc: brief (khung dọc / ngang), mục *Cách quay* của thể loại, dòng dàn ý của cảnh, các beat (trạng thái đầu / cuối, thoại đánh số), mục *Cách quay* của thể loại.

**Code kiểm — lỗi:** mọi beat có ít nhất một shot; tổng giây các shot = giây của beat; mỗi shot ≥ 1 giây, bước 0,5; có mô tả; cỡ / góc / chuyển động thuộc danh sách; trong khung ⊂ có mặt của beat; mỗi câu thoại thuộc đúng một shot.
**Cảnh báo:** shot dưới 1,5 giây; thoại quá dài so với giây của shot (khoảng 3 chữ / giây); mô tả nhắc ánh sáng hoặc tên địa điểm; người nói (có tag) không ở trong khung shot đó, trừ khi nói qua điện thoại / giọng.

**Hiển thị:** mỗi cảnh một bảng, mỗi beat các dòng shot; sửa tay, thêm / xoá / tách shot, mốc giây tự tính lại. Cờ **"cần xem lại" theo cảnh** (beat của cảnh đổi ở ④ ⑤) + "Vẫn đúng".

**Duyệt ⑦:** mọi beat có shot, không lỗi, không cảnh nào "cần xem lại".
