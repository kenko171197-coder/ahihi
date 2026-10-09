# Lượt 3 — Màn ⑥ Bible & tham chiếu (ĐÃ DUYỆT 2026-10-09) · Màn ⑦ Phân cảnh (thiết kế sau)

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

Bóc tách lại (kịch bản đổi): mục còn trong kịch bản giữ nguyên mô tả và ảnh; mục mới thêm vào; mục không còn dùng giữ lại, đánh dấu "không còn dùng" để người dùng xoá.

### Bước 2 — Style (một style cố định, xuyên suốt phim)

Người dùng tự gõ, hoặc AI (`bible-style`) đề xuất 3 phương án (tiếng Anh 1–2 câu + giải thích tiếng Việt) để chọn. Code chép nguyên văn style vào mọi prompt ảnh và prompt video. Đổi style → mọi prompt ghép lại theo.

### Bước 3 — Phần cố định (AI viết, code ghép)

| Tác vụ | AI viết mỗi mục | Code tự thêm |
|---|---|---|
| `bible-nhan-vat` | Mỗi nhân vật: **giọng** (tiếng Anh: tuổi, giới, chất giọng, tốc độ, vùng miền) và các **bộ đồ**. Bộ đồ: tên (tiếng Việt), cảnh mặc, mô tả cố định (tiếng Anh: ngoại hình + trang phục, không tính cách), ô Note, khung ảnh (góc, tư thế, nền), vai trò ảnh | Bộ đầu mang tag nhân vật; bộ thêm code đặt tag (`lanngu`). Prompt ảnh = mô tả + khung + style; reference sheet = khuôn cố định + mô tả + style |
| `bible-dao-cu` | Mô tả cố định (hình dáng, chất liệu, màu, kích thước so với người), ô Note, khung ảnh (nền trắng, trạng thái đầu tiên trong phim), vai trò ảnh | Prompt ảnh = mô tả + khung + style + "no text, no letters, no logos, no engraving or writing on the surface" |
| `bible-boi-canh` | Mỗi địa điểm: mô tả cố định (không gian, đồ bày, dấu vết sống). Mỗi biến thể: khung ảnh (giờ, ánh sáng, góc rộng), ô Note, vai trò ảnh. Mỗi cảnh: câu **ánh sáng** tiếng Anh | Prompt ảnh = mô tả + khung + style + tỉ lệ khung phim + "empty scene with no people, no text…". Cảnh cùng địa điểm + thời điểm + ánh sáng tiếng Việt → code chép **cùng một câu** ánh sáng |

- **Giọng** chỉ dùng ở màn ⑧, phần thoại của Âm thanh. Không nằm trong ảnh.
- **Trang phục:** mặc định một bộ; kịch bản cần đổi đồ thì AI đề xuất thêm bộ; mỗi cảnh nhân vật có mặt dùng đúng một bộ.

**Code kiểm — lỗi:** có style; đủ mọi mục đã bóc tách, đúng tag, không tag lạ; mô tả / khung ảnh / giọng / ánh sáng / style / vai trò viết tiếng Anh (không chữ tiếng Việt có dấu); mô tả nhân vật ≤ 60 từ, đạo cụ ≤ 40, bối cảnh ≤ 60, khung ảnh ≤ 40, giọng ≤ 30, ánh sáng ≤ 30, style ≤ 50, vai trò ≤ 10; mô tả không có `@` và không nhắc tên nhân vật khác (bối cảnh, đạo cụ, style: không nhắc tên nhân vật nào); nhân vật có thoại có giọng; mỗi cảnh có câu ánh sáng; mỗi cảnh nhân vật có mặt thuộc đúng một bộ đồ; tag bộ đồ không trùng tag khác; có ô Note.
**Cảnh báo:** mô tả nhân vật có từ chỉ tính cách; mô tả / khung ảnh bối cảnh nhắc tới người; nhân vật quá 4 bộ đồ; mục "không còn dùng"; tag chưa có ảnh; cảnh cùng địa điểm + thời điểm + ánh sáng mà câu tiếng Anh khác nhau.

Sửa tay mọi ô; sửa theo yêu cầu từng nhóm; "Tạo tất cả" chạy lần lượt nhân vật → đạo cụ → bối cảnh (cần style trước).

### Bước 4 — Ảnh tham chiếu

Giữ cách cũ: tải / dán / kéo ảnh theo lô → AI quét gán tag → duyệt rồi lưu; mỗi tag cũng gắn ảnh riêng được. Thêm loại **bối cảnh**. Mỗi ảnh hiện vai trò cho màn ⑧ ("@lan as …"). Thiếu ảnh chỉ cảnh báo.

### Duyệt / đã cũ

Duyệt khi có style, mọi mục có phần cố định, không lỗi. Kịch bản đổi → "đã cũ" → "Bóc tách lại" (giữ phần đã làm) hoặc giữ nguyên.

## Màn ⑦ — Phân cảnh

Thiết kế sau khi người dùng thử xong màn ⑥.
