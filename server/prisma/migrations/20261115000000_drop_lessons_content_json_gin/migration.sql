-- Bỏ chỉ mục GIN lessons_content_json_idx.
--
-- NGOẠI LỆ của luật "migration chỉ được THÊM" (AGENTS.md; DB dùng chung với bản
-- Django): migration này chỉ bỏ một CHỈ MỤC, không mất dữ liệu và không đổi tên/kiểu
-- cột nào, nên bản Django vẫn đọc/ghi lessons như cũ. Người quyết: Nhân.
--
-- Vì sao bỏ (đo 9/11 bằng pg_stat_user_indexes, đo lại trên branch test 15/11):
--   * idx_scan = 0 — chưa từng được dùng. Chỉ mục khác của lessons đều được dùng
--     (uq_lessons_course_sort, lessons_pkey).
--   * Nặng ~3,5 MB trên bảng lessons ~5,5 MB, trong khi nội dung thật chỉ ~0,7 MB.
--   * Đã grep code: content_json chỉ được đọc/ghi nguyên cột, không có truy vấn
--     JSONB nào lọc theo nội dung (path, @>, ->, ?).
--
-- Hoàn tác nếu cần (không mất dữ liệu, build lại vài trăm ms):
--   CREATE INDEX "lessons_content_json_idx" ON "lessons" USING GIN ("content_json");
--
-- Dùng IF EXISTS để chạy lại không lỗi.

-- DropIndex
DROP INDEX IF EXISTS "lessons_content_json_idx";
