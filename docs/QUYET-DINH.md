# Xưởng phim AI — Các quyết định đã chốt

Cập nhật: 2026-10-09. Mọi thiết kế và code sau này phải khớp với file này. Đổi quyết định nào thì sửa ở đây trước.

## 1. Phạm vi và nguyên tắc

- App đi từ **ý tưởng đến prompt video**. Không tạo video trong app; bạn tạo ở Flow.
- Code cũ đã bỏ. Chỉ giữ: **giao diện**, **cài đặt key / model / đếm token**, **phần Nhân vật & đạo cụ** (prompt của phần này sẽ viết lại).
- **Không mang lối làm cũ vào**: không LÕI, không module, không engine phân cảnh hay engine Đạo diễn cũ. Prompt và luật viết mới.
- Công cụ video: **Gemini Omni Flash**, mỗi lần tạo **tối đa 10 giây** (tối thiểu 3 giây).
- Nội dung: cả **dọc 9:16** (TikTok) và **ngang 16:9** (YouTube). Thời lượng phim **tối đa khoảng 12 phút**.

## 2. Quy trình: 3 giai đoạn, 8 màn

| Giai đoạn | Màn | Kết quả |
|---|---|---|
| Phát triển | ① Ý tưởng & định hướng | Brief + logline |
| | ② Nhân vật | Hồ sơ nhân vật (câu chuyện) |
| | ③ Treatment | Tóm tắt theo hồi, bước ngoặt, số giây |
| | ④ Kịch bản | Dàn ý cảnh → các beat của từng cảnh |
| | ⑤ Rà soát | Chấm điểm, đề xuất sửa → kịch bản chốt |
| Tiền kỳ | ⑥ Bible & tham chiếu | Bóc tách tự động, style, ánh sáng theo cảnh, mô tả cố định, giọng nhân vật, ảnh tham chiếu |
| | ⑦ Phân cảnh | Mỗi beat chia thành shot, có ô Mô tả tiếng Việt |
| Sản xuất | ⑧ Prompt | Prompt video cho từng beat (làm sau cùng) |

- **Scene** = các beat cùng một bối cảnh và một mạch thời gian.
- Màn sau chỉ đọc **bản đã duyệt** của các màn trước. Sửa màn trên thì màn dưới hiện cờ **"đã cũ"**.

## 3. Dữ liệu

- Kịch bản lưu **dạng dữ liệu có cấu trúc** (cảnh → beat → các ô). App hiển thị như văn bản, xuất ra file khi cần.
- Mỗi mục có **mã cố định**, **trạng thái** (nháp / đã duyệt / đã cũ), và **dựa trên phiên bản nào** của mục phía trên.

## 4. Kiến thức thể loại

- **Mỗi loại kịch bản một file** trong `knowledge/the-loai/`, gọn, chia mục theo màn dùng nó.
- Thể loại đầu tiên: **phim đời thường** (`doi-thuong.md`). Nội dung sẽ chỉnh sau.

## 5. Phân cảnh và tạo video

- **Bỏ ô The Script.** Mỗi shot trong bảng phân cảnh có ô **Mô tả** tiếng Việt, là nguồn duy nhất cho câu hành động.
- Tạo video **theo thành phần** (nạp ảnh tham chiếu). **Không** tạo ảnh khung đầu. Nạp được **hơn 10 ảnh**.
- **Một beat = một prompt = một lần tạo**, kể cả khi beat có nhiều shot. Không có tùy chọn tách shot.
- **Không dùng Extend.**
- **Frame nối, bản gọn:** bạn chụp frame từ video beat trước, dán vào beat đó; app tự thêm frame vào danh sách ảnh và prompt của beat sau (code làm, không gọi AI). Không chấm điểm frame. Chưa có frame thì prompt vẫn dùng được, kèm ghi chú độ khớp thấp hơn.

## 6. Khung prompt video (màn ⑧)

| Phần | Nội dung | Ai điền |
|---|---|---|
| ① Ảnh tham chiếu | "Using the provided images: @a as …" — mỗi ảnh một vai trò | Code |
| ② Không gian | Style + bối cảnh + ánh sáng của cảnh, giống từng chữ ở mọi beat cùng cảnh | Code chép bible |
| ③ Lúc bắt đầu | Ai ở đâu, đồ vật trạng thái gì | Code từ trạng thái đầu beat |
| ④ Các shot | `[00:00–00:03]` + câu máy + hành động; "Hard cut to" giữa các shot | Code (mốc giây, máy) + AI (dịch hành động) |
| ⑤ Âm thanh | Ambient / Music / Dialogue | Code ghép, AI dịch |
| ⑥ Giữ đúng | Số shot, 2–3 điều riêng của beat, không phụ đề | Code |

- Beat một shot: thêm "in a single continuous shot with no scene cuts" (Omni tự cắt nếu không dặn).
- Mục tiêu độ dài: khoảng 150–220 từ cho beat 2 shot.
- Code tự kiểm trước khi xuất: tag nạp và tag trong prompt khớp nhau; tổng giây khớp; phần ② giống các beat cùng cảnh; câu hành động không tả lại bối cảnh hay ánh sáng.
