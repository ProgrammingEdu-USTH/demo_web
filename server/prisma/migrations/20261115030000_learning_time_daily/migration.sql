-- Bảng tóm tắt thời gian học theo ngày, để gộp được X-Lesson.Heartbeat mà không mất thông tin.
--
-- Vì sao: Heartbeat gửi mỗi 30 giây nên là loại sự kiện đông nhất (đo 15/11 trên branch test:
-- 255/494 hàng = 52%; một người học 30 phút/ngày sinh ~60 hàng/ngày). Nó chỉ mang MỘT thông tin
-- ("còn đang mở bài") nên giữ dạng "số phút" là đủ. scripts/learning-events/rollup-heartbeats.ts
-- gộp Heartbeat cũ vào bảng này rồi xoá hàng thô, trong MỘT câu lệnh để không thể mất hàng nào.
--
-- Chỉ THÊM BẢNG MỚI (AGENTS.md: DB dùng chung với bản Django cũ, bản đó không biết bảng này).
-- Khoá chính ghép dẫn đầu bằng user_id nên khoá ngoại user_id đã có chỉ mục. course_id/lesson_no
-- mặc định ''/0 vì cột khoá chính không được NULL. Hạn giữ 90 ngày bằng HAN_LUU_NGAY của
-- learning_events — không giữ lâu hơn điều đã hứa với người học.
--
-- Hoàn tác (mất tóm tắt đã gộp, KHÔNG mất hàng thô còn lại):
--   DROP TABLE IF EXISTS "learning_time_daily";

-- CreateTable
CREATE TABLE IF NOT EXISTS "learning_time_daily" (
    "user_id" INTEGER NOT NULL,
    "day" DATE NOT NULL,
    "course_id" TEXT NOT NULL DEFAULT '',
    "lesson_no" INTEGER NOT NULL DEFAULT 0,
    "active_minutes" INTEGER NOT NULL,
    "heartbeats" INTEGER NOT NULL,

    CONSTRAINT "learning_time_daily_pkey" PRIMARY KEY ("user_id","day","course_id","lesson_no"),
    -- Hai heartbeat cùng phút tính một phút, nên phút không bao giờ vượt số heartbeat.
    CONSTRAINT "learning_time_daily_minutes_check" CHECK ("active_minutes" >= 0 AND "heartbeats" >= "active_minutes")
);

-- AddForeignKey
ALTER TABLE "learning_time_daily" ADD CONSTRAINT "learning_time_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
