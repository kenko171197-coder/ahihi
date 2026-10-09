# Xưởng phim AI — lượt 3

Đi từ ý tưởng tới prompt video cho Gemini Omni Flash, qua 3 giai đoạn, 8 màn. Mọi quyết định thiết kế: `docs/QUYET-DINH.md`.

## Chạy

1. `npm install`
2. `npm run dev`, mở http://localhost:3000
3. Tab **Cài đặt** → nhập Gemini API key.
4. (Tuỳ chọn) `npm test` — chạy test phần logic, không gọi AI.

## Đã làm ở lượt 1

- **Nền móng:** mô hình dữ liệu dự án (trạng thái nháp / đã duyệt, bản số mấy, cờ "đã cũ"); khung chung cho mọi tác vụ AI (file prompt + khuôn trả về + code kiểm + tự gửi lại tối đa 2 lần + nhật ký).
- **Màn ① Ý tưởng & định hướng**, **② Nhân vật**, **③ Treatment**.
- **Màn ⑥** tạm dùng bước Nhân vật & đạo cụ cũ (làm lại ở lượt 3).
- **Nhật ký AI** ở tab Cài đặt: xem prompt đã gửi, kết quả, lỗi.

## Đã làm ở lượt 2

- **Màn ④ Kịch bản**, hai bước:
  - **A. Dàn ý cảnh:** AI chia phim thành cảnh (địa điểm + tag, thời điểm, ánh sáng, chuyển biến, ai có mặt, số giây, trạng thái đầu / cuối cảnh, Cài – Dùng theo cảnh). Bạn sửa tay, thêm / xoá / đổi chỗ cảnh, rồi duyệt dàn ý.
  - **B. Viết beat từng cảnh:** mỗi cảnh một lần gọi AI; nút "Viết tất cả" chạy lần lượt và dừng ở cảnh còn lỗi. Mỗi beat 3–10 giây (một lần tạo video). Đọc như kịch bản; sửa tay, thêm / xoá / tách beat. Trạng thái đầu beat do app tự lấy từ cuối beat trước. Cảnh có dàn ý hoặc cảnh trước đổi thì hiện "cần xem lại".
- **Màn ⑤ Rà soát:** AI chấm theo thang của thể loại (app tự cộng điểm) và nêu vấn đề. Bạn nhận / bỏ qua (có ghi lý do) từng đề xuất. Đề xuất được nhận → AI viết lại đúng cảnh đó → bạn xem bản sửa cạnh bản cũ → nhận thì ghi thẳng vào màn ④ (màn ④ tự duyệt lại nếu không còn lỗi). Duyệt được khi không còn vấn đề mức "cao" chưa xử lý.
- Màn ⑥ ⑦ giờ dựa trên kịch bản đã qua ⑤.

## Đã làm ở lượt 3a

- **Màn ⑥ Bible & tham chiếu** (thay bước Nhân vật & đạo cụ cũ):
  - **Bóc tách** từ kịch bản chốt (app tự làm, không tốn tiền): nhân vật (có mặt / chỉ có giọng), đạo cụ và các trạng thái, bối cảnh — mỗi cặp địa điểm + thời điểm một ảnh, ánh sáng từng cảnh.
  - **Style** cố định cả phim: tự gõ hoặc AI đề xuất 3 phương án.
  - AI viết **phần cố định** (tiếng Anh): nhân vật (giọng, các bộ đồ), đạo cụ, bối cảnh, câu ánh sáng từng cảnh. App tự ghép prompt ảnh: mô tả cố định + khung ảnh + style (+ "không chữ" với đạo cụ, "không người" với bối cảnh).
  - **Ảnh tham chiếu**: gửi ảnh theo lô, AI quét gán @tag (cả bối cảnh), mỗi ảnh có vai trò cho màn ⑧.
  - Kịch bản đổi → "Bóc tách lại": giữ phần đã làm, thêm mục mới, đánh dấu mục không còn dùng.

## Đã làm ở lượt 3b

- **Màn ⑦ Phân cảnh:** mỗi beat chia thành shot — số giây (bước 0,5), cỡ cảnh, góc máy, chuyển động (chọn trong danh sách, app tự ghép câu máy tiếng Anh cho màn ⑧), ô **Mô tả** tiếng Việt (nguồn duy nhất cho câu hành động), ai / vật trong khung, câu thoại nào nói trong shot. AI làm từng cảnh ("Phân cảnh tất cả" chạy lần lượt); sửa tay, thêm / xoá / tách shot, mốc giây tự tính. Beat của cảnh đổi ở màn ④ ⑤ → cảnh đó "cần xem lại".

Màn ⑧: lượt 4.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `prompts/` | Mỗi tác vụ AI một file khung prompt. Sửa file là có hiệu lực ngay ở lần gọi sau |
| `knowledge/the-loai/` | Mỗi thể loại một file. Mục "Hình ảnh" dùng ở màn ⑥. Dòng `- **Các phần:** …` là các phần bắt buộc của treatment; `- **Độ dài beat:** 4–8 giây` là khoảng giây khuyên cho mỗi beat; bảng "Chấm nhanh" ở mục Rà soát là thang chấm của màn ⑤ |
| `shared/` | Mô hình dữ liệu và code kiểm, dùng chung cho server và giao diện |
| `server/tasks/` | Khung tác vụ AI (`framework.ts`), từng tác vụ (`defs/`), danh sách tác vụ (`registry.ts`) |
| `src/components/screens/` | Các màn |
| `tests/run.ts` | Test logic |
| `logs/ai-calls.jsonl` | Nhật ký mọi lần gọi AI (tự tạo khi chạy) |

## Khuôn file prompt

- `{{ten}}` thay bằng giá trị; `{{#ten}}…{{/ten}}` chỉ giữ khi có giá trị; `{{^ten}}…{{/ten}}` chỉ giữ khi không có.
- Dòng `<!-- … -->` là ghi chú cho người sửa, không gửi cho AI.
- Test kiểm mỗi file prompt chỉ dùng biến mà tác vụ cung cấp.

## Dữ liệu

Lưu trong trình duyệt (localStorage, ảnh trong IndexedDB). Nút **Lưu ra file** / **Mở** để sao lưu. File của các bản trước không mở được ở bản này.

## Lưu ý

- **Nhật ký AI** chứa prompt và ý tưởng của bạn. App chỉ trả nhật ký cho trình duyệt có gửi kèm key, nhưng server vẫn mở cho cả mạng nội bộ (`0.0.0.0`, như bản cũ, để chạy được trong khung xem trước). Nếu chạy trên mạng dùng chung (quán cà phê, công ty), nên xoá thư mục `logs/` sau khi dùng.
- Phần kiểm tra trong lượt này chỉ chạy được test logic và kiểm kiểu; giao diện cần bạn chạy thử trên máy.
