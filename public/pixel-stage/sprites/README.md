# Spritesheet Pixel Stage: bộ mẫu cho người vẽ

Các file ở đây được xuất từ sprite placeholder vẽ bằng code (`npm run export:pixel-sprites`), đúng định dạng Aseprite
"Export Sprite Sheet → JSON Data (Hash)". Mỗi sprite gồm `<tên>.png` và `<tên>.json`, xếp theo thế giới.

Khi vẽ bản thật, giữ nguyên:

- **Tên file / tên sprite**: ví dụ `kitchen/cook`.
- **Kích thước một khung**: nhân vật 32×32 (chân đứng ở mép dưới, giữa khung), đạo cụ 16×16 (tâm ở giữa khung).
- **Tag (frameTags)**: nhân vật cần đủ `idle`, `walk`, `work`, `happy`, `confused`; đạo cụ cần `idle`. Mỗi tag tối thiểu 2 frame.
- **Nhịp**: engine chạy frame 10 fps (100 ms/frame), không nội suy.
- **Màu**: chỉ dùng bảng màu gốc trong `src/pixel-stage/tokens/palette.ts`, viền 1px màu `ink` (#1b1626), sáng từ trên-trái, tối đa 3 tông mỗi vật.

Xuất từ Aseprite: File → Export Sprite Sheet → Layout "Horizontal Strip", Output: JSON Data dạng Hash, bật "Tags".
Rồi khai báo trong `src/pixel-stage/assets/manifest.ts`, ví dụ `"kitchen/cook": "/pixel-stage/sprites/kitchen/cook.json"`.
Sheet sai kích thước hoặc thiếu tag sẽ bị bỏ qua (có cảnh báo trong console) và engine tiếp tục dùng placeholder.
