-- BE3: mỗi người MỘT hàng nhật ký XP mỗi ngày.
--
-- Vì sao: completeLesson và completeMission từng ghi nhật ký bằng "findFirst
-- rồi update/create" — thêm một vòng trong transaction, và hai request song
-- song của cùng người trong cùng ngày tạo được HAI hàng. Unique này cho phép
-- code dùng upsert (INSERT … ON CONFLICT DO UPDATE), xem src/common/xp/daily-xp-log.ts.
--
-- Chỉ THÊM (AGENTS.md: DB dùng chung với bản Django cũ). GIỮ nguyên
-- idx_daily_xp_user_date dù nay nó thừa.
--
-- KHÔNG dùng CONCURRENTLY: Prisma bọc migration trong transaction (xem chú
-- thích đầu migration 20261012000000). CREATE UNIQUE INDEX thường chặn ghi
-- bảng này trong lúc build — bảng nhỏ (một hàng / người / ngày học) nên dưới
-- một giây. Tên uq_* + IF NOT EXISTS để ai đã tạo tay index cùng tên bằng
-- CONCURRENTLY thì câu này thành no-op.
--
-- KIỂM TRƯỚC KHI ÁP (phải ra 0 dòng — đo 09/11 trên DB thật và 11/11 trên
-- branch đo: rỗng):
--   SELECT user_id, log_date, count(*) FROM user_daily_xp_logs
--   GROUP BY 1, 2 HAVING count(*) > 1;
-- Có dòng trùng thì khối DO dưới đây dừng migration với thông báo rõ ràng.
-- Migration KHÔNG tự gộp: gộp hàng trùng (cộng xp_earned) là việc làm tay.

DO $$
DECLARE
  so_cap integer;
BEGIN
  SELECT count(*) INTO so_cap FROM (
    SELECT 1 FROM "user_daily_xp_logs"
    GROUP BY "user_id", "log_date"
    HAVING count(*) > 1
  ) t;
  IF so_cap > 0 THEN
    RAISE EXCEPTION
      'Không thể tạo uq_daily_xp_user_date: đã có % cặp (user_id, log_date) trùng. Gộp tay rồi chạy lại.',
      so_cap;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_daily_xp_user_date" ON "user_daily_xp_logs"("user_id", "log_date");
