# Lượt 4 — Màn ⑧ Prompt · Frame nối · Xuất file (BẢN NHÁP, chờ người dùng duyệt)

Màn ⑧ ghép **một prompt video tiếng Anh cho mỗi beat** (một beat = một lần tạo trên Omni Flash). Đọc phân cảnh đã duyệt (⑦), bible đã duyệt (⑥) và ảnh tham chiếu.
Nguyên tắc: **code ghép mọi phần cố định**; AI chỉ **dịch** phần tiếng Việt (trạng thái đầu beat, mô tả shot, âm thanh, cách nói) và chọn 2–3 điều cần giữ đúng.

## 1. Prompt một beat — ai điền gì

| Phần | Nội dung | Ai điền | Lấy từ |
|---|---|---|---|
| ① Ảnh tham chiếu | `Using the provided images: @lan as …, @thungxop as …, @phongtro as …` | Code | Ảnh của beat: bộ đồ nhân vật mặc ở cảnh (chỉ người có trong khung), đạo cụ trong khung, ảnh bối cảnh (địa điểm + thời điểm của cảnh); vai trò ảnh ở ⑥. Có frame nối → thêm `@noitiep as …` |
| ② Không gian | Style + mô tả bối cảnh + câu ánh sáng của cảnh | Code chép nguyên văn ⑥ | **Giống từng chữ** ở mọi beat cùng cảnh |
| ③ Lúc bắt đầu | Ai ở đâu, vật trạng thái gì | AI dịch, code xếp | Trạng thái đầu beat (④) |
| ④ Các shot | `[00:00–00:04] Medium shot, eye level, static camera. <hành động>` · nối bằng `Hard cut to` | Code: mốc giây, câu máy · AI: dịch ô Mô tả | Phân cảnh (⑦) |
| ⑤ Âm thanh | `Ambient: …` · `Music: …` · `Dialogue:` từng câu, ghi rõ shot nào | Code ghép · AI dịch tiếng động và cách nói | Âm thanh của beat (④), nhạc nền ở brief (①), thoại (④) gán theo shot (⑦), giọng (⑥) |
| ⑥ Giữ đúng | Số shot · 2–3 điều riêng của beat · không phụ đề, không chữ trên hình | Code + AI chọn 2–3 điều | Beat một shot: `in a single continuous shot with no scene cuts` |

- **Câu thoại giữ nguyên ngôn ngữ nói** (ngôn ngữ thoại ở brief), code chép nguyên văn, không dịch. AI chỉ dịch cách nói ("khẽ" → "softly").
- **Giọng** chép từ bible: `@lan (young woman, soft husky voice, Northern accent) says softly in Vietnamese: "…"`.
- Brief chọn "không nhạc nền" → `Music: none.` (code ghi, AI không thêm nhạc).
- Mô tả ngoại hình nhân vật **không** chép vào prompt: ảnh tham chiếu lo ngoại hình, prompt giữ 150–220 từ. *(Câu hỏi 1 cho người dùng.)*

## 2. Tác vụ `prompt-canh` (một lần mỗi cảnh; "Tạo tất cả" chạy lần lượt)

Gọi theo cảnh (không theo beat) để các beat cùng cảnh dịch thống nhất và ít lượt gọi (phim 12 phút ≈ 20 cảnh).

**Đọc:** brief (ngôn ngữ thoại, nhạc nền), các beat của cảnh (trạng thái đầu, âm thanh, thoại), shot của từng beat (ô Mô tả, trong khung), danh sách tag có trong beat.

**AI trả mỗi beat:**
- lúc bắt đầu: mỗi tag một câu tiếng Anh
- mỗi shot: câu hành động tiếng Anh, gọi người / vật bằng `@tag` hoặc tên
- âm thanh: ambient, music (bỏ trống nếu brief không nhạc)
- cách nói của từng câu thoại (tiếng Anh, 1–3 từ)
- giữ đúng: 2–3 điều, mỗi điều ≤ 12 từ

**Code kiểm — lỗi (gửi lại AI):** đủ beat, đủ shot, đủ câu thoại; phần tiếng Anh không có chữ tiếng Việt có dấu; tag nhắc trong câu phải có trong beat; câu hành động không trống.
**Cảnh báo:** câu hành động tả ánh sáng / bối cảnh / ngoại hình (bible đã lo); prompt ngoài khoảng 120–260 từ; câu hành động nhắc người không có trong khung shot đó.

## 3. Kiểm trước khi chép (code, mỗi beat)

- Tag nạp (phần ①) và tag xuất hiện trong prompt **khớp nhau**: tag nào nhắc tới cũng có ảnh trong danh sách nạp; ảnh nạp nào cũng được nhắc.
- Tổng giây shot = giây beat (3–10).
- Phần ② giống nhau ở mọi beat cùng cảnh (code bảo đảm, vẫn kiểm).
- **Thiếu ảnh** ở ⑥ cho tag cần nạp → cảnh báo đỏ ở beat đó (vẫn chép được).

## 4. Frame nối (bản gọn — code làm, không gọi AI)

- Mỗi beat có ô **"Frame cuối"**: bạn chụp frame cuối video beat đó ở Flow, dán / kéo vào.
- Beat **kế tiếp trong cùng cảnh** tự thêm ảnh `@noitiep` vào danh sách nạp và câu: `@noitiep as the final frame of the previous clip — start from this exact moment, same positions and lighting`.
- Beat đầu cảnh mới: không dùng frame nối (đổi bối cảnh hoặc nhảy thời gian).
- Chưa có frame: prompt vẫn dùng được; ô beat ghi "chưa có frame nối — độ khớp thấp hơn" (chỉ hiện trong app, không vào prompt).
- Không chấm điểm frame.

## 5. Hiển thị màn ⑧

- Theo cảnh → beat. Mỗi beat một thẻ: **prompt tiếng Anh + nút Chép**, danh sách **ảnh cần nạp** (ảnh nhỏ kèm @tag, lấy từ ⑥), ô Frame cuối, số từ, lỗi / cảnh báo, ô tick "đã tạo video".
- Sửa tay được các phần AI dịch (từng ô); phần cố định chỉ sửa ở màn gốc (⑥ ⑦).
- **Cờ "cần dịch lại" theo cảnh:** khi chữ tiếng Việt nguồn đổi (mô tả shot, trạng thái, âm thanh, thoại). Đổi style / ánh sáng / vai trò ảnh ở ⑥ → prompt **tự ghép lại**, không cần gọi AI.
- Màn ⑧ không có nút duyệt (không còn màn nào phía sau). Phân cảnh hoặc bible đổi → hiện "đã cũ" như các màn khác.

## 6. Xuất file

| File | Nội dung |
|---|---|
| Prompt (.txt) | Mọi beat theo thứ tự: mã beat, số giây, danh sách ảnh cần nạp, prompt |
| Kịch bản (.txt) | Đọc như kịch bản: tiêu đề cảnh, beat có giây, hành động, thoại |
| Sao lưu dự án (.json) | Đã có sẵn |

*(Câu hỏi 2 cho người dùng: định dạng file xuất.)*

## 7. Việc kèm theo

- `shared/prompt.ts`: ghép prompt, đếm từ, kiểm tag (thuần, dùng chung).
- Lưu ảnh frame nối trong IndexedDB như ảnh tham chiếu; sao lưu dự án mang theo.
- Test: ghép đủ 6 phần, beat một shot, không nhạc, thoại giữ nguyên văn, tag nạp khớp tag nhắc, frame nối chỉ trong cùng cảnh, phần ② giống nhau trong cảnh, cờ cần dịch lại, AI giả cho `prompt-canh`.
