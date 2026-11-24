-- Nâng các mục QUAN TRỌNG trong prisma/optional-indexes.sql thành migration thật,
-- để `npm run migrate:deploy` tự áp dụng thay vì phải chạy tay.
--
-- ============================================================================
-- VỀ `CONCURRENTLY` — ĐỌC TRƯỚC KHI SỬA FILE NÀY
-- ============================================================================
-- prisma/optional-indexes.sql dùng `CREATE INDEX CONCURRENTLY`. KHÔNG thể dùng
-- CONCURRENTLY ở đây: Prisma Migrate bọc mỗi file migration trong MỘT transaction,
-- còn Postgres từ chối `CREATE INDEX CONCURRENTLY` trong transaction block
-- (lỗi 25001: "CREATE INDEX CONCURRENTLY cannot run inside a transaction block").
-- Migration sẽ hỏng ngay ở câu lệnh đầu tiên.
--
-- Vì vậy file này dùng `CREATE INDEX` thường. Hệ quả về khoá:
--   * `CREATE INDEX` thường giữ khoá SHARE trên bảng suốt thời gian build:
--     SELECT vẫn chạy, nhưng INSERT/UPDATE/DELETE trên bảng đó bị CHẶN.
--   * Với quy mô hiện tại (vài nghìn → vài chục nghìn dòng) thời gian build là
--     dưới một giây, nên deploy trực tiếp là chấp nhận được.
--   * Khi `notifications` / `auth_sessions` đã lớn và không được chặn ghi, dùng
--     ĐƯỜNG ZERO-DOWNTIME: chạy tay prisma/optional-indexes.sql (bản
--     CONCURRENTLY, NGOÀI transaction, ngoài Prisma) TRƯỚC khi deploy:
--         psql "$DIRECT_URL" -f prisma/optional-indexes.sql
--     Tên index trong file đó TRÙNG KHỚP từng ký tự với tên ở đây, nên mọi câu
--     `IF NOT EXISTS` bên dưới trở thành no-op và migration vẫn được Prisma ghi
--     nhận là đã áp dụng. Đây là lý do mọi câu lệnh ở đây đều có IF NOT EXISTS
--     và đều dùng tên `idx_*` / `uq_*` thay vì tên mặc định của Prisma.
--
-- ============================================================================
-- KIỂM TRA BẮT BUỘC TRƯỚC KHI ÁP DỤNG (unique index có thể BÁO LỖI)
-- ============================================================================
--   SELECT course_id, sort_order, count(*) AS n
--   FROM lessons
--   GROUP BY 1, 2
--   HAVING count(*) > 1
--   ORDER BY n DESC;
--
-- Phải trả về 0 dòng. Nếu có dòng -> DỪNG, không deploy. Khối DO bên dưới sẽ
-- chủ động RAISE để migration thất bại với thông báo rõ ràng thay vì lỗi 23505
-- khó hiểu. Migration này KHÔNG tự xoá dữ liệu trùng: việc gộp/xoá bài học trùng
-- là quyết định nghiệp vụ (bản ghi lesson_progress và XP đã trao gắn vào
-- lesson_id cũ), phải do người làm bằng tay và kiểm tra lại.
--
-- Cả file nằm trong một transaction nên nếu khối DO bắn lỗi thì KHÔNG index nào
-- được tạo. Unique index được đặt ĐẦU FILE một cách có chủ ý: đây là mục duy
-- nhất có thể thất bại, nên để nó fail-fast trước khi mất thời gian build 7
-- index còn lại rồi rollback hết.
--
-- Khi migration thất bại, Prisma đánh dấu nó là failed và chặn `migrate deploy`
-- lần sau. Sau khi đã dọn dữ liệu trùng, gỡ trạng thái failed rồi chạy lại:
--     npx prisma migrate resolve --rolled-back 20261012000000_critical_indexes_and_lesson_sort_unique
--     npm run migrate:deploy
--
-- Toàn bộ file chỉ THÊM index — không đổi tên, không xoá cột, không sửa kiểu dữ
-- liệu — nên tương thích ngược với bản Django đang dùng chung DB (xem README).

-- ---------------------------------------------------------------------------
-- 1) RÀNG BUỘC DUY NHẤT lessons(course_id, sort_order) — SỬA LỖI ĐÚNG/SAI,
--    không phải tối ưu tốc độ.
--
--    LessonsService.resolveLesson() tự tạo bản ghi lesson khi người học hoàn
--    thành một bài chưa có trong DB, và bản ghi tự tạo đó để lesson_code = NULL.
--    Ràng buộc duy nhất hiện có là lessons_course_id_lesson_code_key trên
--    (course_id, lesson_code), nhưng Postgres coi MỌI NULL là khác nhau, nên với
--    lesson_code NULL ràng buộc đó KHÔNG chặn được gì: (python, NULL) và
--    (python, NULL) cùng tồn tại hợp lệ.
--
--    Kết quả: hai request hoàn thành bài chạy song song đều không thấy bản ghi
--    nào ở findFirst, cả hai đều INSERT, DB có hai bài học trùng
--    (course_id, sort_order) -> XP được cộng HAI LẦN và completed_lessons /
--    tiến độ khoá học sai.
--
--    resolveLesson() đã có nhánh bắt P2002 để đọc lại bản ghi của request thắng,
--    nhưng nhánh đó chỉ chạy khi index này tồn tại. Trước migration này, cơ chế
--    chống trùng của backend thực tế KHÔNG hoạt động trên production.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  dup_pairs bigint;
  dup_rows  bigint;
BEGIN
  SELECT count(*), coalesce(sum(n), 0)
    INTO dup_pairs, dup_rows
    FROM (
      SELECT count(*) AS n
        FROM lessons
       GROUP BY course_id, sort_order
      HAVING count(*) > 1
    ) d;

  IF dup_pairs > 0 THEN
    RAISE EXCEPTION
      'Không thể tạo uq_lessons_course_sort: đã có % cặp (course_id, sort_order) trùng, tổng % dòng.',
      dup_pairs, dup_rows
      USING HINT =
        'Chạy: SELECT course_id, sort_order, count(*) FROM lessons GROUP BY 1,2 HAVING count(*) > 1; '
        || 'rồi gộp/xoá bài học trùng bằng tay (chuyển lesson_progress sang lesson_id giữ lại) trước khi deploy lại. '
        || 'Migration này không tự xoá dữ liệu.';
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "uq_lessons_course_sort" ON "lessons"("course_id", "sort_order");

-- ---------------------------------------------------------------------------
-- 2) Các index cho truy vấn nóng.
-- ---------------------------------------------------------------------------

-- auth_sessions.token: mọi lần refresh token đều tra theo cột này; không có
-- index là full table scan trên bảng phình liên tục theo số lần đăng nhập.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_auth_sessions_token" ON "auth_sessions"("token");

-- notifications(user_id, is_read, created_at DESC): /api/notifications/badge bị
-- client poll ~45s/lần và không rate-limit — truy vấn nóng nhất hệ thống.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_notifications_user_read_created" ON "notifications"("user_id", "is_read", "created_at" DESC);

-- lesson_progress(user_id, course_id): tính lại tiến độ khi enroll/complete lọc
-- theo cặp này; khoá chính (user_id, lesson_id) không phủ được course_id.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_lesson_progress_user_course" ON "lesson_progress"("user_id", "course_id");

-- user_daily_xp_logs(user_id, log_date): leaderboard tuần SUM theo khoảng ngày.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_daily_xp_user_date" ON "user_daily_xp_logs"("user_id", "log_date");

-- users(xp DESC) / users(streak DESC): bảng xếp hạng ORDER BY ... LIMIT 20;
-- không có index thì mỗi lần mở phải sắp xếp TOÀN BỘ bảng users.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_users_xp_desc" ON "users"("xp" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_users_streak_desc" ON "users"("streak" DESC);

-- comments(post_id, parent_comment_id, created_at): phân trang bình luận gốc và
-- nạp reply theo bài viết.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_comments_post_parent_created" ON "comments"("post_id", "parent_comment_id", "created_at");
