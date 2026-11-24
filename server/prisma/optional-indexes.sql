-- Index cho hiệu năng khi tải cao — BẢN CONCURRENTLY, CHẠY TAY (tuỳ chọn).
--
-- ĐÃ ĐƯỢC NÂNG THÀNH MIGRATION: tất cả các index dưới đây giờ nằm trong
--   prisma/migrations/20261012000000_critical_indexes_and_lesson_sort_unique/
-- và được `npm run migrate:deploy` áp dụng TỰ ĐỘNG. Không cần chạy file này
-- trong trường hợp bình thường.
--
-- File này còn tồn tại vì một việc duy nhất mà migration KHÔNG làm được:
-- Prisma Migrate bọc mỗi migration trong một transaction, còn Postgres không
-- cho `CREATE INDEX CONCURRENTLY` chạy trong transaction block (lỗi 25001).
-- Migration vì thế dùng `CREATE INDEX` thường, giữ khoá SHARE và CHẶN GHI trên
-- bảng suốt lúc build index.
--
-- Khi bảng đã lớn (notifications, auth_sessions) và không được phép chặn ghi,
-- dùng đường zero-downtime: chạy file này TRƯỚC khi deploy, ngoài Prisma:
--     psql "$DIRECT_URL" -f prisma/optional-indexes.sql
-- Tên index ở đây TRÙNG từng ký tự với tên trong migration và với `map:` trong
-- schema.prisma, nên sau đó mọi câu `CREATE ... IF NOT EXISTS` trong migration
-- là no-op và `migrate deploy` vẫn ghi nhận migration đã áp dụng. KHÔNG đổi tên
-- index trong file này mà không đổi ở cả hai nơi kia.
--
-- TRƯỚC KHI CHẠY: unique index ở mục (6) sẽ báo lỗi nếu dữ liệu đã có cặp
-- (course_id, sort_order) trùng. Kiểm tra bằng truy vấn ở ngay trên mục đó.
-- Tất cả câu lệnh đều IF NOT EXISTS + CONCURRENTLY nên an toàn chạy lại nhiều lần.
-- Lưu ý: một CREATE INDEX CONCURRENTLY bị lỗi để lại index INVALID; dò bằng
--     SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
-- rồi DROP INDEX index_đó và chạy lại.

-- 1) auth_sessions.token: mọi lần refresh token đều tra theo cột này.
--    Không có index -> full table scan trên bảng phình liên tục theo login.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_sessions_token
  ON auth_sessions (token);

-- 2) notifications (user_id, is_read, created_at): endpoint /api/notifications/badge
--    được client poll ~45s/lần KHÔNG rate-limit — đây là query nóng nhất hệ thống.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read_created
  ON notifications (user_id, is_read, created_at DESC);

-- 3) lesson_progress (user_id, course_id): tính lại progress khi enroll/complete
--    lọc theo cặp này; PK (user_id, lesson_id) không phủ được course_id.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lesson_progress_user_course
  ON lesson_progress (user_id, course_id);

-- 4) user_daily_xp_logs (user_id, log_date): leaderboard weekly SUM theo tuần.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_xp_user_date
  ON user_daily_xp_logs (user_id, log_date);

-- 5) users.xp / users.streak: bảng xếp hạng ORDER BY ... LIMIT 20.
--    Không có index thì mỗi lần mở bảng xếp hạng phải sắp xếp TOÀN BỘ bảng users.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_xp_desc
  ON users (xp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_streak_desc
  ON users (streak DESC);

-- 6) RÀNG BUỘC DUY NHẤT lessons(course_id, sort_order) — QUAN TRỌNG, không chỉ
--    là tối ưu tốc độ. Khi hoàn thành một bài học chưa có trong DB, hệ thống tạo
--    bản ghi bài học đó. Ràng buộc unique hiện có là (course_id, lesson_code),
--    nhưng bản ghi tự tạo để lesson_code NULL — Postgres coi mọi NULL là khác
--    nhau nên ràng buộc đó KHÔNG chặn được gì. Hai request song song sẽ tạo hai
--    bài học trùng thứ tự, dẫn tới cộng XP hai lần và tiến độ khoá học sai.
--    Lệnh này sẽ BÁO LỖI nếu dữ liệu hiện tại đã có cặp trùng; kiểm tra trước bằng:
--      SELECT course_id, sort_order, count(*) FROM lessons
--      GROUP BY 1,2 HAVING count(*) > 1;
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_lessons_course_sort
  ON lessons (course_id, sort_order);

-- 7) comments(post_id, parent_comment_id, created_at): phân trang bình luận gốc
--    và nạp reply theo bài viết.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_post_parent_created
  ON comments (post_id, parent_comment_id, created_at);
