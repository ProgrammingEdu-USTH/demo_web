# Góc học · Programming EDU

Màn hình chính của Programming EDU: một căn phòng học anime lofi bên cửa sổ lúc hoàng hôn. Mỗi đồ vật trong phòng là lối vào một tính năng (laptop → Học tiếp, bảng ghim → Lộ trình, tủ sách → Khóa học, cuốn sổ → Luyện tập, cúp/huy chương → Thành tựu, điện thoại → Hồ sơ và Xếp hạng, lịch → chuỗi ngày học, cốc → nghỉ một ngụm, cửa sổ → mở/đóng).

Toàn bộ là frontend, dữ liệu hiện là mock. Nguồn sự thật về giao diện và chuyển động là prototype trong `handoff/reference/prototype/goc-hoc.html` (xem thêm `CLAUDE.md`).

## Chạy

Cần Node.js 20 trở lên.

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # bản production
npm start            # chạy bản production (sau build)
npm run lint
npx tsc --noEmit     # kiểm tra kiểu
```

Mở thẳng một trang con bằng URL: `/?p=learn`, `/?p=roadmap`, `/?p=courses`, `/?p=practice`, `/?p=achievements`, `/?p=phone`. Thêm `&shelf=<kệ>&lesson=<bài>` để mở một bài cụ thể (đánh số từ 0, vd. `/?p=learn&shelf=2&lesson=5`), `&tab=me|rank` cho điện thoại. Mở bằng link thẳng thì bỏ qua màn mở đầu.

Màn mở đầu chỉ chạy lần đầu trong phiên (khoá `gocHoc.introSeen` trong `sessionStorage`). Muốn xem lại: bảng tuỳ chỉnh (nút thanh trượt góc trên phải) → "Xem lại màn mở đầu", hoặc mở tab mới.

Xem prototype để so: `npx serve handoff/reference/prototype` rồi mở `/goc-hoc`.

## Test đối chiếu (Playwright)

Dùng Chrome cài sẵn trên máy. Máy không có Chrome: `npx playwright install chromium` rồi đặt biến môi trường `PW_CHANNEL=chromium`. Playwright tự chạy app (`npm run build && npm start -- -p 3100`) và prototype (`serve`, cổng 5050); nếu hai cổng đó đã có server thì dùng luôn server đang chạy.

```bash
npm run test:e2e:baseline   # chụp ảnh mẫu từ prototype → e2e/__screenshots__/ (chạy lần đầu, hoặc khi prototype đổi)
npm run test:e2e            # so ảnh app với ảnh mẫu (ngưỡng 1,5% điểm ảnh) + test luồng
npm run test:e2e:diff       # so chặt (0 điểm ảnh): xuất ảnh diff của mọi chỗ lệch vào test-results/
npx playwright show-report  # xem báo cáo, có ảnh mẫu / ảnh app / diff cạnh nhau
```

- `e2e/visual.spec.ts`: màn chính, hover sách bài 4, cửa sổ mở, lịch đang xem, 6 trang con. Khung 1440×900, giờ cố định 18:00 qua bảng tuỳ chỉnh, bỏ qua màn mở đầu, chuột đưa về giữa cho parallax về 0 rồi ra ngoài khung. Phần chạy theo thời gian hoặc ngẫu nhiên (mây, code laptop đang gõ, giấy note, số chuông, đếm ngược, lá bay) được ẩn lúc chụp bằng `e2e/hide-dynamic.css`.
- `e2e/flows.spec.ts` (chỉ chạy trên app): vào/thoát từng trang bằng đồ vật và menu, đổi tab, Esc (cả lúc đang chuyển cảnh), back/forward trình duyệt, sách khoá báo toast, thêm ghi chú thứ 5 thì tờ cũ nhất bị gỡ.
- Ảnh mẫu phụ thuộc font và cách render của máy nên không đưa vào git; mỗi máy tự chụp lại bằng `test:e2e:baseline`.

## Cấu trúc thư mục

```
handoff/                      tài liệu bàn giao — không sửa
  assets/                     ảnh gốc (đã copy sang public/goc-hoc/)
  reference/layout/           items_data.json, scene.json: toạ độ đồ vật, vùng bấm, đèn dây, màn hình laptop, lưới lịch
  reference/prototype/        prototype chạy được

public/goc-hoc/               ảnh dùng trong app (bản sao của handoff/assets/)
  room.webp, room-blur.webp   ảnh phòng và bản mờ (lớp nền khi mở trang con)
  sash-*.webp, front.webp…    cánh cửa sổ, lớp phía trước, mặt nạ trời/mây
  items/<key>.webp            từng đồ vật cắt rời; items/<key>-g.webp là viền sáng khi hover
  items/held/                 đồ vật cầm trên tay (cốc, cúp, huy chương)
  items/page/                 ảnh của trang con (bảng ghim, sổ, bìa sách, khung điện thoại, lịch, giấy note)

src/app/                      layout (font, CSS), page (lấy dữ liệu qua data.ts, preload ảnh)
src/styles/goc-hoc/           CSS port từ prototype, giữ nguyên tên class/id
  tokens.css                  design token, reset
  room.css                    căn phòng và đồ vật
  hud.css                     giao diện phủ (hồ sơ, cột phải, gợi ý, bảng tuỳ chỉnh, popover, toast)
  pages.css                   khung trang con và 6 trang
src/features/goc-hoc/
  GocHocApp.tsx               ghép mọi thứ: cảnh, HUD, ghi chú, trang con, màn mở đầu
  data.ts                     lớp truy cập dữ liệu (hàm async) — chỗ nối API thật
  mock/                       dữ liệu mẫu (tiếng Việt chép nguyên từ prototype)
  types.ts                    kiểu dữ liệu dùng chung
  config/                     scene.ts (toạ độ, đọc từ handoff/…/*.json), objects.ts (bảng đồ vật), shelves.ts (3 kệ sách)
  scene/                      cảnh tĩnh: RoomStage, đồ vật, vùng bấm, laptop, lịch; layout() đặt phòng 2752×1536 vào màn hình
  ambient/                    chuyển động nền: giờ trong ngày, mây, parallax, lá bay, đèn dây, laptop tự gõ…
  hud/                        hồ sơ, cột phải, gợi ý, bảng tuỳ chỉnh, popover, nhãn đồ vật
  notes/                      giấy note thông báo dưới cửa sổ, pushNote()
  transitions/                engine chuyển cảnh: camera, ZOOM, PICK, lịch (PEEK), cốc (SIP), URL, useScene()
  pages/                      6 trang con; pages/fx/ là hiệu ứng hiện/ẩn riêng của từng trang
  intro/                      màn mở đầu
```

Toạ độ trong phòng luôn là pixel của ảnh gốc 2752×1536 ("room-space"); cả phòng được scale/translate một lần cho vừa màn hình (`scene/layout.ts`). Không đổi toạ độ sang % hay vw.

## Thay ảnh

- **Cùng kích thước, cùng vị trí**: chỉ cần thay file trong `public/goc-hoc/`, giữ nguyên tên. Ví dụ ảnh phòng theo buổi sáng: thay `room.webp` (và `room-blur.webp` cho bản mờ).
- **Đổi kích thước hoặc vị trí đồ vật**: cập nhật `handoff/reference/layout/items_data.json` — `meta.<key>` là `[x, y, w, h]` trong room-space, `hits.<key>` là polygon vùng bấm, `cols.<key>` là màu gáy sách. Thêm đồ vật mới thì thêm cả `items/<key>.webp` và `items/<key>-g.webp`, rồi khai báo nhóm trong `config/objects.ts`.
- **Đèn dây, lớp phía trước, màn hình laptop, lưới lịch**: `handoff/reference/layout/scene.json` (`bulbs`, `front`, `screen` — 4 góc màn hình tính theo ảnh laptop, `cal`).
- `config/scene.ts` import thẳng hai file JSON trên, không cần sửa code. (Hai file này nằm trong `handoff/`; nếu muốn giữ `handoff/` đúng bản bàn giao thì chép chúng vào `src/` và đổi đường dẫn import trong `config/scene.ts`.)
- Ảnh của phòng được preload trong `<head>`: danh sách `PRELOAD_ASSETS`/`PRELOAD_MASKS` trong `config/scene.ts`. Ảnh trang con và đồ cầm tay được tải lúc rảnh sau màn mở đầu (`LAZY_ASSETS`). Thêm ảnh mới thì thêm vào danh sách tương ứng.

## Nối API thật

Mọi dữ liệu đi qua các hàm async trong `src/features/goc-hoc/data.ts`; giao diện chỉ phụ thuộc kiểu trả về trong `types.ts`. Thay thân các hàm đó bằng lời gọi API, giữ nguyên kiểu:

| Hàm | Dùng ở |
|---|---|
| `getUser()` | hồ sơ, pill XP/huy hiệu, streak, điện thoại |
| `getCurrentLesson()`, `getLaptopCode()` | thẻ "Học tiếp", màn hình laptop |
| `getLessonBodies()`, `getLessonBody()`, `getLessonQuiz()` | trang Học tiếp (đoạn văn và code là HTML tô màu sẵn — nếu API trả HTML thì cần làm sạch) |
| `getDailyQuests()`, `getWeeklyEvent()` | "Nhiệm vụ hôm nay", "Thử thách tuần" (đếm ngược theo `endsAt`) |
| `getRoadmap()`, `getCourses()`, `getPracticeSummary()`, `getPracticePage()` | Lộ trình, Khóa học, Luyện tập |
| `getBadges()`, `getBadgeSummary()`, `getLeaderboard()` | Thành tựu, Xếp hạng |
| `getNotePool()` | 2 tờ ghi chú lúc vào và các tờ mẫu |
| `getHintQuestions()` | ô "Hỏi gợi ý…" (chỉ câu hỏi gợi mở, không đưa đáp án) |
| `getServerTime()` | mốc giờ server, để đếm ngược khớp lúc hydrate |

Trang `/` render theo request (dữ liệu theo người dùng), lấy tất cả trong `src/app/page.tsx`.

**Thông báo theo thời gian thực**: gọi `pushNote(note)` từ `src/features/goc-hoc/notes/notesBus.ts` (vd. khi nhận tin qua WebSocket hoặc polling). Tờ note mới bay vào dưới cửa sổ, điện thoại rung, chuông lắc; đủ 4 tờ thì tờ cũ nhất bị bóc ra. Gọi trước khi phòng hiện ra cũng được — note được giữ lại và dán sau.

**Điều hướng từ code**: trong component con, `useScene()` cho `go(route, opts)`, `back()`, `sibling(route, opts)`, `updateOpts(opts)`, cùng trạng thái `route`, `busy`, `peeking`.

## Khác prototype (có chủ ý)

- Chuyển động: giấy note dồn chỗ bằng `translate`, vệt sáng trên kệ huy hiệu chạy bằng `translate` (prototype dùng `left`) — không phải tính lại layout mỗi khung hình. Ảnh trong phòng giải mã bất đồng bộ; các lớp tĩnh của cảnh được memo.
- Giảm chuyển động: tắt hẳn hơi cà phê (prototype chỉ tạm dừng); bản nhân đồ vật không đè lên trang; parallax về giữa ngay khi bật.
- Bàn phím: HUD và vùng bấm không nhận Tab khi đang ở trang con/xem lịch/màn mở đầu; mở trang thì focus vào "Góc học", quay về thì trả focus về chỗ cũ; ô gợi ý có vòng focus; Enter trên tờ note đưa focus vào popover.
- `#app` dùng `overflow: clip` (prototype `hidden` cho phép trình duyệt cuộn lệch cả app khi focus vào nút nằm ngoài khung).
- Engine không kẹt state: Esc / back trình duyệt giữa lúc chuyển cảnh được làm ngay sau khi chuyển cảnh xong (prototype bỏ qua), kể cả Esc lúc lịch đang phóng ra.
- Theo giờ thật vẫn cập nhật mỗi 30 giây sau khi đã chỉnh giờ tay (prototype dừng hẳn sau lần chuyển dần đầu tiên).
- Chuỗi font `--f-*` dùng tên font gốc như prototype thay vì `var(--font-*)` của next/font (lý do trong `src/styles/goc-hoc/tokens.css`).
- Prototype render ở quirks mode (thiếu `<!doctype html>`), app ở standards mode: ô "Hỏi gợi ý…", khung "Thử thách tuần" và thẻ số liệu trong điện thoại lệch vài pixel so với prototype.
