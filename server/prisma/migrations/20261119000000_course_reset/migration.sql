-- BE8: reset lưu lịch sử để không cộng thưởng lại sau khi xoá tiến độ.
-- Chỉ thêm bảng/cột/index; reset_at nullable giữ tương thích bản Django.
-- Hoàn tác ứng dụng: tắt route reset, giữ bảng lịch sử và reset_at để bảo toàn
-- bằng chứng đã thưởng. Không DROP bảng lịch sử trên DB có người học.
-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS     "reset_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE IF NOT EXISTS "lesson_progress_archive" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "course_id" TEXT NOT NULL,
    "status" TEXT,
    "quiz_score" INTEGER NOT NULL,
    "xp_earned" INTEGER NOT NULL,
    "completed_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_progress_archive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lesson_progress_archive_user_id_course_id_idx" ON "lesson_progress_archive"("user_id", "course_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lesson_progress_archive_user_id_lesson_id_idx" ON "lesson_progress_archive"("user_id", "lesson_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lesson_progress_archive_lesson_id_idx" ON "lesson_progress_archive"("lesson_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lesson_progress_archive_course_id_idx" ON "lesson_progress_archive"("course_id");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_progress_archive_user_id_fkey' AND conrelid = 'lesson_progress_archive'::regclass) THEN
    ALTER TABLE "lesson_progress_archive" ADD CONSTRAINT "lesson_progress_archive_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_progress_archive_lesson_id_fkey' AND conrelid = 'lesson_progress_archive'::regclass) THEN
    ALTER TABLE "lesson_progress_archive" ADD CONSTRAINT "lesson_progress_archive_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_progress_archive_course_id_fkey' AND conrelid = 'lesson_progress_archive'::regclass) THEN
    ALTER TABLE "lesson_progress_archive" ADD CONSTRAINT "lesson_progress_archive_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;


DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_progress_archive_xp_nonnegative' AND conrelid = 'lesson_progress_archive'::regclass) THEN
  ALTER TABLE "lesson_progress_archive" ADD CONSTRAINT "lesson_progress_archive_xp_nonnegative" CHECK (xp_earned >= 0);
 END IF;
END $$;
