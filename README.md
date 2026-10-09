# Xưởng phim AI — lượt 1

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

Màn ④ ⑤ ⑦ ⑧: lượt 2–4.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `prompts/` | Mỗi tác vụ AI một file khung prompt. Sửa file là có hiệu lực ngay ở lần gọi sau |
| `knowledge/the-loai/` | Mỗi thể loại một file. Dòng `- **Các phần:** …` là các phần bắt buộc của treatment |
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
