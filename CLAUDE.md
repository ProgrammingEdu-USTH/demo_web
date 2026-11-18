# Góc học · Programming EDU

## Dự án là gì
Màn hình chính của Programming EDU (PE), nền tảng dạy tư duy lập trình cho sinh viên IT, có gamification (XP, level, streak 12 ngày, huy hiệu). Màn hình là một căn phòng học anime lofi bên cửa sổ lúc hoàng hôn. Mỗi đồ vật trong phòng là lối vào một tính năng:

| Đồ vật | Tương tác | Đích |
|---|---|---|
| Laptop | ZOOM | Học tiếp (bài đang học) |
| Bảng ghim | ZOOM | Lộ trình |
| Tủ sách / mục menu Khóa học | ZOOM | Khóa học |
| Từng cuốn sách (3 kệ = 3 khóa, mỗi cuốn = 1 bài) | PICK | Bài học tương ứng |
| Cuốn sổ | PICK | Luyện tập |
| Điện thoại / avatar | PICK | Hồ sơ và Bảng xếp hạng |
| Cúp, huy chương | PICK | Thành tựu |
| Lịch | PEEK (không đổi trang) | Chuỗi ngày học |
| Cốc cà phê | SIP (không đổi trang) | Nghỉ một ngụm |
| Cửa sổ | TOGGLE | Mở/đóng hóng gió |
| Giấy note dưới cửa sổ | Popover | Thông báo, tối đa 4 tờ |

- **ZOOM**: camera zoom vào đồ vật rồi trang hiện ra từ đó.
- **PICK**: đồ vật được nhấc lên, bay về phía người xem rồi biến thành trang; quay lại thì bay về chỗ cũ. Không vẽ bàn tay, góc nhìn thứ nhất.

## Nguồn sự thật
- `handoff/reference/prototype/goc-hoc.html`: prototype chạy được. Mọi toạ độ, thứ tự lớp, easing, thời lượng animation và nội dung tiếng Việt phải khớp với file này. **Không tự thiết kế lại.** File dài, hãy grep theo tên hàm hoặc class thay vì đọc hết một lượt.
- `handoff/reference/layout/items_data.json`: `meta` (x, y, w, h của từng đồ vật), `hits` (polygon vùng bấm), `cols` (màu gáy sách).
- `handoff/reference/layout/scene.json`: `bulbs`, `front`, `screen` (4 góc màn hình laptop, tương đối với ảnh laptop), `cal` (lưới ngày của lịch, toạ độ ảnh nguồn và toạ độ phòng).
- `handoff/assets/`: ảnh đã tách lớp, copy vào `public/goc-hoc/` giữ nguyên cấu trúc.
- **Không sửa gì trong `handoff/`.**

## Stack và quy ước
- Next.js (App Router, bản mới nhất ổn định) + TypeScript strict, mã nguồn trong `src/`, alias `@/*`. Không dùng Tailwind; port CSS từ prototype thành file CSS global trong `src/styles/` (giữ tên class vì animation dựa vào chúng).
- Toàn bộ là frontend, **chỉ dùng mock data** trong `src/features/goc-hoc/mock/`, truy cập qua các hàm async trong `data.ts` để sau thay bằng API thật.
- Hệ toạ độ "room" là ảnh gốc 2752×1536 px. Mọi lớp của phòng nằm trong một div đúng kích thước đó, rồi scale và translate cho vừa màn hình. Không quy đổi toạ độ sang % hay vw.
- Animation dùng Web Animations API (`element.animate`) như prototype, bọc trong util TypeScript. Không thêm thư viện animation nếu chưa hỏi.
- Phần cảnh và chuyển cảnh là client component.
- Tôn trọng `prefers-reduced-motion` và công tắc "Giảm chuyển động" (các nhánh `RM` trong prototype).
- `localStorage`/`sessionStorage` luôn bọc try/catch.
- Giao diện, nhãn và aria-label đều bằng tiếng Việt.

## Cách làm việc
- Trả lời bằng tiếng Việt. Trước mỗi bước, liệt kê ngắn các file sẽ tạo hoặc sửa.
- Xong mỗi bước: chạy `npm run lint`, `npx tsc --noEmit` và `npm run build`, sửa hết lỗi rồi mới báo xong.
- Thấy prototype mâu thuẫn hoặc thiếu thông tin thì hỏi, đừng tự đoán.
