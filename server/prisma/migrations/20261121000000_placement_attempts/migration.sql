-- Lưu bài kiểm tra đầu vào (placement) cho cả khách lẫn người đăng nhập.
--
-- Hiện trạng (đo 19/11/2026 trên branch thử): `questionnaires` (ngân hàng câu hỏi có phiên bản) và
-- `surveys` (một cục JSON hồ sơ: nghề/mục đích/kinh nghiệm) đều 0 hàng và KHÔNG có chỗ nào lưu
-- "người này chọn gì, được mấy điểm". `surveys` không hợp: nó là hồ sơ tự khai, không có điểm.
-- Khách cũng là một dòng `users` (email @guest.local) nên một khoá ngoại tới users là đủ cho cả hai loại.
--
-- Thiết kế (tối ưu chỗ nào, vì sao):
--  · Một dòng cho mỗi (người, phiên bản câu hỏi): answers là mảng SMALLINT (chỉ số lựa chọn) thay vì
--    một dòng mỗi câu — 5 câu thì ít hơn 5 lần hàng, và vẫn phân tích được bằng unnest(). Cỡ dòng ~80 byte,
--    100.000 người ≈ 8 MB cả bảng.
--  · UNIQUE (user_id, questionnaire_id): gửi lại không sinh bản trùng, và nó dẫn đầu bằng user_id nên
--    đã là chỉ mục cho khoá ngoại user_id. Chỉ cần thêm chỉ mục cho questionnaire_id.
--  · Chấm điểm ở SERVER (score/total), vì câu hỏi chứa đáp án đúng (questions_json) và FE không được thấy.
--  · KHÔNG có cột "level": cấp độ suy ra từ score/total bằng một hàm ở code, đổi ngưỡng không cần migration.
--  · user_id ON DELETE CASCADE: dọn khách (src/auth/guest-cleanup.ts, CASCADE_REFS) xoá theo; questionnaire_id
--    mặc định RESTRICT: không xoá được bản câu hỏi đã có người làm.
--  · questionnaires.version UNIQUE: hai bản cùng số phiên bản sẽ làm kết quả cũ mơ hồ. Bảng đang rỗng nên
--    thêm được an toàn; nếu DB thật đã có hàng trùng version thì CREATE UNIQUE INDEX thất bại — kiểm trước:
--      SELECT version, count(*) FROM questionnaires GROUP BY 1 HAVING count(*) > 1;
--
-- Chỉ THÊM (AGENTS.md: DB dùng chung với bản Django). Hoàn tác:
--   DROP TABLE IF EXISTS "placement_attempts"; DROP INDEX IF EXISTS "uq_questionnaires_version";

CREATE UNIQUE INDEX IF NOT EXISTS "uq_questionnaires_version" ON "questionnaires"("version");

CREATE TABLE IF NOT EXISTS "placement_attempts" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "questionnaire_id" INTEGER NOT NULL,
    "answers" SMALLINT[] NOT NULL,
    "score" SMALLINT NOT NULL,
    "total" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "placement_attempts_pkey" PRIMARY KEY ("id"),
    -- Điểm nằm trong [0, total] và có đúng một đáp án cho mỗi câu.
    CONSTRAINT "placement_attempts_score_check" CHECK ("total" > 0 AND "score" >= 0 AND "score" <= "total" AND cardinality("answers") = "total")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_placement_user_questionnaire" ON "placement_attempts"("user_id", "questionnaire_id");
CREATE INDEX IF NOT EXISTS "idx_placement_questionnaire" ON "placement_attempts"("questionnaire_id");

ALTER TABLE "placement_attempts" ADD CONSTRAINT "placement_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_attempts" ADD CONSTRAINT "placement_attempts_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "questionnaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
