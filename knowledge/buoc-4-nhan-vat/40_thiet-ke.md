# BƯỚC 2: THIẾT KẾ NHÂN VẬT & ĐẠO CỤ

## 2.1 — Nhân vật

**Phong cách thiết kế theo style của dự án** (hoạt hình thiết kế theo tính cách; người thật mô tả như hồ sơ casting).

```
@tên (một từ, không dấu, dưới 15 ký tự)
Tuổi · Tính cách (lấy từ hồ sơ nhân vật người dùng nhập)
Ngoại hình · Trang phục · Biểu cảm mặc định · Style
Mô tả ngắn cho ô Note (1–2 câu, chỉ đặc điểm nhìn thấy được)
```

**Dòng “Mô tả ngắn cho ô Note” là bắt buộc.** Công cụ tạo video dùng nội dung ô Note làm mô tả nhận dạng mỗi khi nhân vật xuất hiện. Để trống thì công cụ video dễ vẽ nhân vật theo kiểu “gốc” và mất trang phục.

🔹 **Standard Image Prompt:** [1 góc chính]

🔹 **Character Reference Sheet Prompt:**

```
A professional character reference sheet, 4x2 grid layout, pure white background, high resolution. The subject is a single consistent character in all panels. Studio lighting, sharp focus, no text.
Top Row: 1. Front view of the head. 2. Side profile of the head. 3. Back view of the head. 4. Top-down view of the head.
Bottom Row: 1. Full-body front view. 2. Full-body side view. 3. Full-body back view. 4. Close-up of both hands and forearms.
Character details: [toàn bộ mô tả nhân vật]
```

## 2.2 — Đạo cụ

Tạo ảnh **trạng thái gốc** cho mọi ★ đạo cụ,. Trạng thái sau chụp từ video.

```
@tên
Mô tả: [hình dáng, chất liệu, màu, kích thước NEO VÀO CƠ THỂ nhân vật]
Mô tả ngắn cho ô Note: [1 câu]
Prompt tạo ảnh: [nền trắng, ánh sáng studio, sắc nét]
  + kết bằng: no text, no letters, no logos, no engraving or writing on the surface
```

⚠️ **Ảnh đạo cụ không được có chữ trên thân vật** — công cụ video chép lại mọi chữ nhìn thấy, kể cả tên tag.
⚠️ **Hình dáng phải cho phép hành động trong kịch bản.** Kịch bản cần hộp “chụp úp trùm lên” nhân vật mà ảnh là hộp đóng kín → mâu thuẫn. Sửa ảnh (hộp mở nắp) hoặc sửa hành động.

-----

