# PE-3d · backend (`server/`)

Backend NestJS 11 + Prisma 7 + PostgreSQL (Neon) cho PE-3d. Gồm:

- Toàn bộ backend của **pe-usth** (nhánh `test`, commit `0335243f`, 23/11/2026): auth (JWT + refresh cookie,
  tài khoản khách, OAuth), khoá học, bài học, quiz, diễn đàn, bảng xếp hạng, lộ trình, chatbot, Python runner…
- Module **Arena** (đấu code 1v1) của **demo_web** (nhánh `test-usth`, commit `e4a0c14c`): `src/arena/`
  (ghép trận, phòng riêng có mã, chấm bài bằng Pyodide trong `worker_threads`, Elo K=32 + XP),
  3 bảng `arena_*` trong `prisma/schema.prisma`, migration `prisma/migrations/20261124000000_arena`
  (đổi tên từ `20261017000000_arena` cho đứng sau các migration của pe-usth).

- Module **Arena · Đoán output** (`src/arena-quiz/`, viết mới cho PE-3d): chuyển app "Arena" trong máy tính
  Góc học của pe-usth (nhánh `test`, `frontend/public/goc-hoc/may-tinh/mac.js`) thành trận online 1v1:
  5 câu, 15 giây/câu, đoán đoạn code in ra gì; đúng được 100 + 10 điểm/giây còn lại; câu đóng sớm khi cả hai
  đã trả lời. Server giữ đáp án (chỉ lộ khi câu đã đóng) và đồng hồ; Elo riêng (K=32, hạng Đồng → Kim cương ở
  frontend), XP 15/8/4. Ngân hàng câu `src/arena-quiz/quiz-bank.json` = 38 ví dụ có output cố định trong
  "Sổ Học" của pe-usth; frontend nạp cùng file này cho chế độ đấu với máy. 3 bảng `arena_quiz_*`, migration
  `prisma/migrations/20261124100000_arena_quiz`.

Frontend dùng nó: `web/src/arena/` (`api.js` gọi API, `engine.js` giữ trạng thái + poll cho đấu code,
`quiz.js` cho Đoán output — online và đấu với máy, `ui.js` vẽ và chuyển hai chế độ). Trong phòng, **laptop
trên bàn là lối vào Đấu trường** (poster trên tường chỉ còn để trang trí; "Học tiếp" mở từ cuốn sách đang học).

## Chạy cục bộ

Yêu cầu Node 22+.

```powershell
npm --prefix server install
```

```powershell
npm --prefix server run start:dev
```

```powershell
npm --prefix web run dev
```

- Backend nghe cổng **5100** (`PORT` trong `server/.env`; 5100 để không đụng backend pe-usth thường chạy ở 5000).
- `web/vite.config.js` proxy `/api`, `/auth`, `/health` sang `http://localhost:5100` cho cả `vite` và
  `vite preview`, nên trình duyệt gọi cùng origin. Đổi đích bằng biến `PE_API_TARGET`.
- Trong app Claude: cấu hình `pe-3d-server` (backend), `pe-3d` (Vite dev), `pe-3d-dist` (xem `web/dist`) ở `.claude/launch.json`.
- Kiểm tra: `http://localhost:5100/health/ready` → `{"db":"up"}`.

Mở Góc học → **Đấu trường**. Lần đầu frontend tự tạo tài khoản khách (`POST /auth/guest`) và đặt tên
hiển thị bằng tên người chơi trong Góc học (`PUT /api/user`). Access token nằm trong `localStorage`
(`pe-arena-access`), refresh token trong cookie httpOnly `pe_refresh` (30 ngày, `JWT_REFRESH_EXPIRES`).

Đấu thử một mình: mở arena ở hai trình duyệt khác nhau (hoặc một cửa sổ ẩn danh), một bên “Tạo phòng riêng”,
bên kia nhập mã vào “Vào phòng”. “Tìm trận ngay” ghép với người đang chờ trong hàng công khai.

## Đấu với máy (offline)

Cả hai chế độ đều có nút **Đấu với máy · offline**, chạy hoàn toàn trên trình duyệt, không cần backend
(không tính Elo/XP): đấu code dùng `web/src/arena/offline.js` — bot nộp bài theo lịch, bài của bạn được chấm
bằng Pyodide ngay trên máy; Đoán output dùng bot trong `web/src/arena/quiz.js`. Khi không kết nối được máy chủ,
sảnh hiện banner **Offline**, khoá các nút online và tự thử lại mỗi 10 giây.

Kho đề offline `web/src/arena/offline-problems.json` được xuất từ `src/arena/problems/*.ts` (gồm cả test ẩn,
chấp nhận được vì trận với máy không tính điểm). Sửa đề xong thì xuất lại:

```powershell
npm --prefix server run build; npm --prefix server run export:offline
```

## Cấu hình (`server/.env`)

Sao từ `.env.example`. Bắt buộc: `DATABASE_URL` (Neon, endpoint `-pooler`), `DIRECT_URL` (không `-pooler`,
dùng cho Prisma CLI), `JWT_ACCESS_SECRET` (≥ 32 ký tự), `FRONTEND_URL`, `ALLOWED_ORIGINS`.
Danh sách đầy đủ ở `src/config/env.validation.ts` — app từ chối khởi động nếu sai.

Arena: `ARENA_GRADER_ENABLED` (mặc định `true`), `ARENA_GRADER_CONCURRENCY` (1–8, mặc định 1).

API Đoán output (cần JWT như mọi route arena): `GET /api/arena/quiz/me`, `GET /api/arena/quiz/leaderboard`,
`POST /api/arena/quiz/queue`, `GET /api/arena/quiz/matches/current`, `GET /api/arena/quiz/matches/:id`,
`POST /api/arena/quiz/matches/:id/answer` (`{index, choice}`), `POST …/cancel`, `POST …/forfeit`.
Phòng chờ tự huỷ sau 60 s; chỉ ghép với phòng có chủ vừa poll trong 8 s (chủ đã rời trang thì thôi).

**Sau khi kéo code mới về** (schema đổi): `npx prisma generate` rồi build/khởi động lại backend — bản build cũ
chưa có model mới sẽ báo `Cannot read properties of undefined (reading 'findUnique')` ở `/api/arena/quiz/*`.

## Database

Prisma Migrate, thư mục `prisma/migrations/`. DB mới hoàn toàn: `npx prisma migrate deploy` (trong `server/`).

DB Neon hiện tại đã có sẵn schema pe-usth (tạo trước đó, không có bảng `_prisma_migrations`). Đã baseline theo
README gốc của pe-usth: so `prisma migrate diff` thấy DB chỉ thiếu đúng phần arena → đánh dấu 16 migration
pe-usth là đã áp (`prisma migrate resolve --applied …`), rồi `migrate deploy` tạo 3 bảng `arena_*`
(chỉ thêm bảng, không đổi dữ liệu cũ); `autovacuum_tuning` được chạy lại bằng `prisma db execute`.

Sau này sửa schema: `npx prisma migrate dev --name <ten>` trên DB dev, `npm run migrate:deploy` trên DB thật.

## Kiểm thử

```powershell
npm --prefix server run typecheck
```

```powershell
cd server; npx jest src/arena src/arena-quiz
```

## Khác so với bản gốc

- `package.json`: thêm `pyodide@0.27.7` (bộ chấm Arena), đổi tên gói thành `pe-3d-server`.
- `src/app.module.ts`: đăng ký `ArenaModule`. `schema.prisma`: thêm enum/model Arena và quan hệ trên `User`.
- `.env.example`: `PORT=5100`, origin của Vite (5173/4173), mặc định JWT, biến `ARENA_*`;
  `RUNNER_URL`/`RUNNER_SECRET` để dạng comment (rỗng thì Joi từ chối khởi động; chỉ cần khi `PY_RUNNER_MODE=remote`).
- Không mang theo: `frontend/` (Next.js), `runner/` (máy chạy Python từ xa), `design/`, các script giáo trình/seed.
