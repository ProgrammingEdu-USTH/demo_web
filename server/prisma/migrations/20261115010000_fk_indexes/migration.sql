-- Chỉ mục cho 22 cột khoá ngoại chưa đứng đầu chỉ mục nào.
--
-- Vì sao: Postgres KHÔNG tự tạo chỉ mục cho cột khoá ngoại. Thiếu chúng thì mỗi lần
-- xoá/sửa hàng cha (xoá user, xoá bài) phải quét tuần tự cả bảng con để kiểm tra
-- ràng buộc, và mọi truy vấn "lấy con theo cha" cũng quét cả bảng. Đo 9/11:
-- auth_sessions quét tuần tự 641 lần so với 11 lần dùng chỉ mục; users 2.960 so
-- với 676. Bảng còn nhỏ nên Postgres chọn quét tuần tự là bình thường; thêm chỉ mục
-- để khi bảng lớn lên khỏi phải sửa gấp.
--
-- Chỉ THÊM (AGENTS.md: DB dùng chung với bản Django cũ). Không CONCURRENTLY vì Prisma
-- bọc migration trong một transaction (xem chú thích đầu migration 20261012000000);
-- các bảng đều nhỏ nên build dưới một giây. IF NOT EXISTS để ai đã tạo tay thì thành no-op.
--
-- Hoàn tác: DROP INDEX IF EXISTS "<tên chỉ mục>"; cho từng dòng bên dưới.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "comment_likes_user_id_idx" ON "comment_likes"("user_id");
CREATE INDEX IF NOT EXISTS "comments_user_id_idx" ON "comments"("user_id");
CREATE INDEX IF NOT EXISTS "comments_parent_comment_id_idx" ON "comments"("parent_comment_id");
CREATE INDEX IF NOT EXISTS "course_ratings_course_id_idx" ON "course_ratings"("course_id");
CREATE INDEX IF NOT EXISTS "courses_instructor_id_idx" ON "courses"("instructor_id");
CREATE INDEX IF NOT EXISTS "email_verifications_user_id_idx" ON "email_verifications"("user_id");
CREATE INDEX IF NOT EXISTS "enrollments_course_id_idx" ON "enrollments"("course_id");
CREATE INDEX IF NOT EXISTS "lesson_progress_course_id_idx" ON "lesson_progress"("course_id");
CREATE INDEX IF NOT EXISTS "lesson_progress_lesson_id_idx" ON "lesson_progress"("lesson_id");
CREATE INDEX IF NOT EXISTS "missions_course_id_idx" ON "missions"("course_id");
CREATE INDEX IF NOT EXISTS "post_likes_post_id_idx" ON "post_likes"("post_id");
CREATE INDEX IF NOT EXISTS "posts_user_id_idx" ON "posts"("user_id");
CREATE INDEX IF NOT EXISTS "quizzes_course_id_idx" ON "quizzes"("course_id");
CREATE INDEX IF NOT EXISTS "roadmap_progress_roadmap_id_idx" ON "roadmap_progress"("roadmap_id");
CREATE INDEX IF NOT EXISTS "roadmaps_user_id_idx" ON "roadmaps"("user_id");
CREATE INDEX IF NOT EXISTS "roadmaps_generated_from_survey_id_idx" ON "roadmaps"("generated_from_survey_id");
CREATE INDEX IF NOT EXISTS "surveys_user_id_idx" ON "surveys"("user_id");
CREATE INDEX IF NOT EXISTS "user_achievements_achievement_id_idx" ON "user_achievements"("achievement_id");
CREATE INDEX IF NOT EXISTS "user_badges_badge_id_idx" ON "user_badges"("badge_id");
CREATE INDEX IF NOT EXISTS "user_follows_followee_id_idx" ON "user_follows"("followee_id");
CREATE INDEX IF NOT EXISTS "user_oauth_accounts_user_id_idx" ON "user_oauth_accounts"("user_id");
