-- Chỉ mục cho danh sách diễn đàn (GET /api/posts) — BE7.
--
-- Vì sao: listPosts lọc theo `category` rồi sắp `created_at DESC` (mặc định),
-- `created_at ASC` (?sort=oldest) hoặc `like_count DESC` (?sort=likes), kèm
-- OFFSET phân trang. Bảng posts trước đây chỉ có chỉ mục `user_id` (fk_indexes),
-- nên mọi trang danh sách là quét tuần tự cả bảng rồi sắp. Hôm nay posts gần như
-- rỗng nên chưa đau; thêm sẵn để khi giao diện diễn đàn lên không phải sửa gấp.
--
-- Ba chỉ mục, không phải hai: `(category, created_at)` không phục vụ được trang
-- MẶC ĐỊNH (không lọc chuyên mục, sắp mới nhất) — Postgres không dùng được chỉ
-- mục ghép khi thiếu cột dẫn đầu — nên `created_at` cần chỉ mục riêng. Chỉ mục
-- B-tree đọc được cả hai chiều nên `DESC` vẫn phục vụ ?sort=oldest.
--
-- Chỉ THÊM chỉ mục (AGENTS.md: DB dùng chung với bản Django; bản đó không bị ảnh
-- hưởng). Không CONCURRENTLY vì Prisma bọc cả file trong một transaction.
--
-- Hoàn tác (không mất dữ liệu):
--   DROP INDEX IF EXISTS "posts_category_created_at_idx";
--   DROP INDEX IF EXISTS "posts_created_at_idx";
--   DROP INDEX IF EXISTS "posts_like_count_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "posts_category_created_at_idx" ON "posts"("category", "created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "posts_created_at_idx" ON "posts"("created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "posts_like_count_idx" ON "posts"("like_count" DESC);
