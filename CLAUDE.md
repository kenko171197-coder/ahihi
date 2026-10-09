# Xưởng phim AI — hướng dẫn cho Claude Code

App đi từ ý tưởng phim tới prompt video cho **Gemini Omni Flash** (tạo video ở Flow, không trong app). 3 giai đoạn, 8 màn.
Người dùng là nhà làm phim, không phải lập trình viên: **trả lời bằng tiếng Việt, câu ngắn, không thuật ngữ lập trình** khi nói chuyện.

## Tài liệu gốc — đọc trước khi làm bất cứ gì

@docs/QUYET-DINH.md

- Bản thiết kế lượt 2 (đã làm): `docs/LUOT-2.md`. Lượt 3: `docs/LUOT-3.md` (màn ⑥ đã duyệt; màn ⑦ thiết kế sau).
- Mọi thay đổi phải khớp `docs/QUYET-DINH.md`. Muốn làm khác quyết định đã chốt → hỏi người dùng trước, sửa file đó trước rồi mới code.

## Cách làm việc (bắt buộc)

1. **Thiết kế trước, code sau.** Đầu mỗi lượt: trình bày bản thiết kế ngắn của các màn trong lượt (bạn nhập gì, AI trả gì, code kiểm gì), chờ người dùng duyệt rồi mới code.
2. **Không mang lối làm của app cũ vào** (LÕI, module, engine phân cảnh / engine Đạo diễn cũ, ô The Script). Mọi prompt viết mới.
3. **Sau khi code:** chạy `npm test` và `npm run lint`, sửa hết lỗi. Chạy thử app (`npm run dev`) và tự bấm qua các màn đã làm nếu có công cụ trình duyệt.
4. **Soát độc lập:** cuối lượt, dùng một subagent chưa thấy quá trình làm để đọc lại code so với thiết kế và `docs/QUYET-DINH.md`; sửa các lỗi nó tìm ra, rồi nhờ nó kiểm lại.
5. **Bàn giao:** tóm tắt cho người dùng bằng tiếng Việt dễ hiểu: đã làm gì, cách thử, chỗ nào cần họ kiểm. Cập nhật mục "Trạng thái" cuối file này và README.
6. Dùng git: commit sau mỗi phần làm xong, để quay lại được.

## Kiến trúc

| Chỗ | Vai trò |
|---|---|
| `shared/project.ts` | Mô hình dữ liệu dự án: `SectionKey`, `DEPS` (phần nào dựa trên phần nào), `SCREENS`, trạng thái nháp/duyệt, `rev`, `basedOn`; hàm `freshSection / editSection / approveSection / keepSection / staleDeps / isStale / missingDeps / blockedDeps` |
| `shared/kichBan.ts` | Kịch bản: mã cảnh / beat cố định (`ganMaBeat`), trạng thái theo dòng (`parseTrangThai`), trạng thái đầu beat (`dauBeat`), cờ "cần xem lại" theo cảnh (`dauVaoCanh`, `tinhTrangCanh`), đạo cụ đã khai (`daoCuTruoc`), ghi cảnh (`ghiCanh` = kết quả AI / "vẫn đúng", `suaCanh` = sửa tay) |
| `shared/checks.ts` | Code kiểm dùng chung cho server (kiểm kết quả AI) và giao diện (kiểm bản sửa tay) |
| `server/tasks/framework.ts` | Khung chung mọi tác vụ AI: khuôn prompt → gọi AI với khuôn trả về → `normalize` → `check` → sai thì gửi lại kèm lỗi (tối đa 2 lần) → nhật ký |
| `server/tasks/defs/*.ts` | Từng tác vụ (`TaskDef`): `parseInput`, `genreId`, `vars`, `schema`, `normalize`, `check`, `isEmpty` |
| `server/tasks/registry.ts` | Danh sách tác vụ; route chung `POST /api/task/:id` |
| `server/tasks/node.ts` | Đọc file prompt / thể loại, ghi nhật ký `logs/ai-calls.jsonl`, gọi Gemini |
| `prompts/*.md` | Mỗi tác vụ một file khung prompt (tiếng Việt). Cú pháp: `{{bien}}`, `{{#bien}}…{{/bien}}`, `{{^bien}}…{{/bien}}`, ghi chú `<!-- -->` |
| `knowledge/the-loai/*.md` | Mỗi thể loại một file, mục `## …` theo màn (`server/tasks/genre.ts` → `SECTION_OF_SCREEN`); dòng `- **Các phần:** …` |
| `src/components/screens/` | Các màn. `common.tsx`: `StatusBar`, `UpstreamBanner`, `Issues`, `ReviseBox`, `useRunner`, ô nhập |
| `src/components/Projects.tsx` | Thanh 8 màn, trạng thái từng màn, chọn màn hiển thị |
| `shared/models.ts` | `TASKS`: model mặc định cho từng tác vụ (khoá = id tác vụ) |
| `src/lib/usage.ts` | `FEATURE_NAMES`: tên tác vụ trong bảng đếm token (khoá = `/api/task/<id>`) |
| `tests/run.ts` | Test logic (không gọi AI thật; AI giả trong `fakeDeps`) |

## Quy ước

- **Thêm tác vụ AI:** viết `TaskDef` trong `server/tasks/defs/`, thêm vào `registry.ts`, thêm file `prompts/`, thêm dòng vào `TASKS` và `FEATURE_NAMES`, viết test (gồm test "file prompt chỉ dùng biến tác vụ cung cấp" — đã có sẵn, tự chạy cho mọi tác vụ trong registry).
- **Code kiểm** đặt ở `shared/checks.ts` để cả server lẫn giao diện dùng. Lỗi (`errors`) chặn duyệt và làm AI bị gửi lại; cảnh báo (`warnings`) chỉ báo.
- **Ghi dữ liệu dự án** luôn qua `onUpdate((latest) => …)` (không dùng bản `project` cũ sau `await`).
- **Kết quả AI** lưu bằng `freshSection(latest, key, data, now, readRevs)` với `readRevs = depRevs(project, key)` chụp **lúc bấm nút**; hỏi trước khi ghi đè nếu người dùng đã sửa trong lúc AI chạy (xem `NhanVatScreen.tsx`).
- **Mã cố định:** id cảnh / beat / nhân vật không bao giờ đánh lại số khi chèn hoặc xoá.
- **Màn sau chỉ đọc bản đã duyệt** của màn trước; nút tạo / duyệt bị chặn khi `blockedDeps` khác rỗng.
- Thông tin cố định (style, mô tả nhân vật, ánh sáng cảnh) do **code chép nguyên văn** vào prompt, không để AI viết lại.
- Ô nhập, nút, màu: dùng thành phần sẵn có trong `src/components/ui.tsx` và `screens/common.tsx`; giữ phong cách giao diện hiện tại.

## Lệnh

- `npm install` · `npm run dev` (http://localhost:3000) · `npm test` · `npm run lint`

## Trạng thái

- **Lượt 1 — xong:** nền móng + màn ① Ý tưởng & định hướng, ② Nhân vật, ③ Treatment. Màn ⑥ tạm dùng bước thiết kế cũ.
- **Lượt 2 — xong:** màn ④ Kịch bản (dàn ý cảnh `dan-y-canh` + viết beat từng cảnh `viet-canh`) và ⑤ Rà soát (`ra-soat`, sửa đề xuất bằng `viet-canh` chế độ sửa, ghi thẳng vào ④). Màn ⑥ ⑦ dựa trên ⑤. Thiết kế: `docs/LUOT-2.md`.
- **Lượt 3 — tiếp theo:** ⑥ Bible & tham chiếu (bóc tách tự động, bối cảnh, ánh sáng theo cảnh, giọng) + ⑦ Phân cảnh. Lượt 4: ⑧ Prompt + frame nối + xuất file.
