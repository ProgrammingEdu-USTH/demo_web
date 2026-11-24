-- BÀI HẬU KIỂM CÓ TRỄ — một cột nullable và một index, không có gì khác.
--
-- VÌ SAO CẦN
-- ----------
-- Bài hậu kiểm là NHẠC CỤ ĐO, không phải bài ôn tập: nó chỉ có nghĩa khi được
-- làm MỘT LẦN, bằng những câu người học chưa từng thấy. Hai nửa của tính chất
-- đó nằm ở hai chỗ khác nhau:
--   · "câu chưa từng thấy" do `src/quizzes/post-test-bank.json` lo — 516 biến
--     thể mà `scripts/pe-da/build.py` KHÔNG phát vào bài;
--   · "một lần" thì không có chỗ nào ghi được. Bảng `quizzes` chỉ có
--     (user_id, course_id, status, questions_json, created_at), và `status`
--     là enum `quiz_status` dùng chung với bản Django cũ — thêm giá trị vào
--     enum đó là ĐỔI KIỂU, mà luật của repo (README/AGENTS.md) chỉ cho THÊM
--     cột nullable hoặc THÊM index.
-- Nên: một cột `kind TEXT` nullable. NULL = mọi đề ôn tập, cũ và mới.
--
-- VÌ SAO KHÔNG PHẢI MỘT BẢNG MỚI
-- ------------------------------
-- Luồng hậu kiểm dùng lại NGUYÊN cơ chế đang có: bản ghi `quizzes` giữ
-- snapshot kèm đáp án, `review_quiz_results` giữ kết quả, `submitQuiz` chấm ở
-- server và chặn lần nộp thứ hai bằng compare-and-set trên `status`. Dựng bảng
-- riêng là dựng cơ chế thứ hai phải khớp với cơ chế thứ nhất — và nó sẽ lệch.
-- Thứ duy nhất còn thiếu là một NHÃN, nên chỉ thêm một nhãn.
--
-- VÀ KHÔNG CẦN BẢNG `(user, item, last_seen)` NÀO
-- -----------------------------------------------
-- Luật nổi lên của bài hậu kiểm là "chỉ hỏi về bài đã hoàn thành từ >= N ngày".
-- `lesson_progress(user_id, lesson_id, status, completed_at)` ĐÃ là đúng bảng
-- đó: item là bài học, `completed_at` là last_seen, và vì các biến thể hậu kiểm
-- chưa bao giờ được phát ra thì lần "gặp" duy nhất của người học với khái niệm
-- đó chính là lúc họ học bài. Thêm bảng nữa là thêm một nguồn sự thật thứ hai
-- cho cùng một con số.
--
-- TƯƠNG THÍCH NGƯỢC: cột nullable, không default, không ràng buộc — bản Django
-- dùng chung DB vẫn INSERT vào `quizzes` được y như trước (cột nhận NULL).
-- Toàn bộ file chỉ THÊM: không đổi tên, không xoá cột, không đổi kiểu.

-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "kind" TEXT;

-- CreateIndex
-- Cổng một-lần chạy `SELECT ... WHERE user_id = ? AND course_id = ? AND kind = ?`
-- mỗi lần người học mở trang khoá học. Không CONCURRENTLY vì Prisma Migrate bọc
-- file này trong một transaction và Postgres từ chối CONCURRENTLY trong
-- transaction block (lỗi 25001) — xem đầu file migration
-- 20261012000000_critical_indexes_and_lesson_sort_unique. Bảng `quizzes` hiện
-- rất nhỏ nên build dưới một giây.
CREATE INDEX IF NOT EXISTS "idx_quizzes_user_course_kind" ON "quizzes"("user_id", "course_id", "kind");

-- CreateIndex
-- CỔNG MỘT-LẦN THẬT SỰ, không phải phép kiểm trong code.
--
-- `generatePostTest()` đọc "đã phát chưa" rồi mới INSERT. Ở mức cô lập READ
-- COMMITTED (mặc định của Postgres) hai request giống nhau gửi song song (bấm
-- đúp, client tự thử lại) đều đọc ra "chưa phát" rồi CẢ HAI cùng INSERT — học
-- viên nhận hai đề hậu kiểm và nộp được cả hai, tức hai con số cho một phép
-- đo. Đúng họ lỗi mà `uq_lessons_course_sort` đã sửa cho `lesson_progress`.
-- Có index này thì request thua nhận P2002, và `generatePostTest()` đổi nó
-- thành 409 — cùng câu trả lời mà phép kiểm trong code vẫn đưa ra.
--
-- MỘT PHẦN (`WHERE kind = 'post_test'`) vì `kind` NULL là MỌI đề ôn tập, và
-- một người học phải được ôn tập nhiều lần trong cùng một khoá.
--
-- PRISMA KHÔNG BIẾT INDEX NÀY: schema.prisma không diễn đạt được index một
-- phần, nên `@@index([userId, courseId, kind])` ở trên là index THƯỜNG (phục
-- vụ đọc) còn ràng buộc duy nhất này chỉ sống trong SQL. `migrate deploy` chỉ
-- chạy file SQL nên không quan tâm; `prisma migrate dev` / `db push` thì sẽ
-- coi nó là drift và muốn xoá — ĐỪNG chạy hai lệnh đó trên repo này (cả
-- prisma/optional-indexes.sql cũng chứa index hand-managed cùng kiểu).
CREATE UNIQUE INDEX IF NOT EXISTS "uq_quizzes_one_post_test"
  ON "quizzes"("user_id", "course_id")
  WHERE "kind" = 'post_test';
