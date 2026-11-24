-- courses.content_version và lessons.content_hash — phục vụ cache và nạp nội dung an toàn.
--
-- Vì sao: cache nội dung bài (LESSON_CACHE_TTL_MS) hiện chỉ biết hết hạn theo giờ;
-- có hai cột này thì có thể xoá cache đúng lúc nội dung đổi, và script nạp lại
-- (update-lesson-content.ts) so được hash cũ → mới thay vì tính lại mỗi lần.
--
-- Chỉ THÊM CỘT NULLABLE, không default, không viết lại bảng (AGENTS.md: DB dùng chung
-- với bản Django, bản đó không biết hai cột này và không bị ảnh hưởng). NULL nghĩa là
-- "chưa đánh phiên bản / chưa tính hash".
--
-- Hoàn tác (chưa có dữ liệu nào ghi vào thì không mất gì):
--   ALTER TABLE "courses" DROP COLUMN IF EXISTS "content_version";
--   ALTER TABLE "lessons" DROP COLUMN IF EXISTS "content_hash";

-- AlterTable
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "content_version" INTEGER;

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "content_hash" TEXT;
