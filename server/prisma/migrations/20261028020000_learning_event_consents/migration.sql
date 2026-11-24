-- SỰ ĐỒNG Ý cho lớp ghi nhật ký — một bảng MỚI, không sửa bảng nào đang có.
--
-- ============================================================================
-- VẤN ĐỀ ĐANG SỬA
-- ============================================================================
-- Lớp ghi nhật ký lần thử (migration 20261028000000) đã dựng xong và đang TẮT.
-- Cổng duy nhất của nó là `let dongY = false` trong
-- `frontend/src/lib/learning-events.ts` — một cổng Ở PHÍA CLIENT. Và
-- `LearningEventsController` KHÔNG kiểm gì cả: lô nào tới cũng được ghi.
--
-- Một cổng ở client không phải bằng chứng đồng ý. Nó không nói được ai đã đồng
-- ý, lúc nào, và đồng ý với ĐIỀU GÌ; nó biến mất cùng localStorage; và nó không
-- chặn được một request gửi tay. Luật 91/2025 + Nghị định 356/2025 đưa dữ liệu
-- THEO DÕI HÀNH VI vào nhóm NHẠY CẢM, và Điều 9(4) nói nguyên văn rằng "sự im
-- lặng hoặc không phản hồi không được coi là sự đồng ý".
--
-- Bảng này là nửa còn lại: bản ghi ở MÁY CHỦ, và là thứ `record()` đọc trước
-- khi ghi bất cứ sự kiện nào.
--
-- ============================================================================
-- VÌ SAO APPEND-ONLY, KHÔNG PHẢI MỘT CỘT TRÊN `users`
-- ============================================================================
-- Một cột `log_consent_at` trên `users` sẽ ngắn hơn và vẫn là migration chỉ
-- THÊM. Nhưng nó bị GHI ĐÈ, nên nó trả lời được "hiện tại có đồng ý không" mà
-- không trả lời được "sự đồng ý đó có từ lúc nào" và "đã từng rút lại chưa" —
-- mà chứng minh được sự đồng ý chính là lý do bảng tồn tại. Một hàng cho mỗi
-- lần quyết, kể cả lần RÚT LẠI (`granted = false`); trạng thái hiện tại là hàng
-- mới nhất.
--
-- Và nó rẻ: cohort là 20–40 người thử, mỗi người quyết một hoặc hai lần. Bảng
-- này sẽ có vài chục hàng, không phải vài triệu như `learning_events`.
--
-- ============================================================================
-- CỘT `version` — thứ dễ bị bỏ, và bỏ nó thì sai IM LẶNG
-- ============================================================================
-- Sự đồng ý luôn là đồng ý với MỘT bản mô tả cụ thể ("ghi 10 loại sự kiện này,
-- giữ 90 ngày"). Ngày ai đó thêm loại thứ 11 hoặc nâng hạn lưu lên 365 ngày thì
-- bản ghi CŨ không còn phủ việc đang làm — nhưng không có gì báo: hàng vẫn
-- `granted = true`, lớp ghi vẫn chạy, và dự án đang thu thập thứ chưa ai đồng ý
-- cho. Có `version` thì `conHieuLuc()` trả về false khi lệch, và lớp ghi tự tắt
-- cho tới khi người học trả lời câu hỏi MỚI.
--
-- `src/learning-events/learning-event-consent.ts` giữ `PHIEN_BAN_DONG_Y` (chuỗi
-- người viết, đọc được) cùng một dấu ấn tính từ chính phạm vi thu thập; một ca
-- test ghim cặp đó, nên mở rộng phạm vi mà quên đổi phiên bản là test ĐỎ.
--
-- ============================================================================
-- KHÔNG CÓ RÀNG BUỘC UNIQUE TRÊN `user_id`
-- ============================================================================
-- Có chủ đích, và ngược với `uq_quizzes_one_post_test` của migration trước.
-- Ở đó "một lần" là tính chất phải cưỡng chế; ở đây NHIỀU hàng mỗi người là
-- đúng hình dạng — đồng ý, rồi rút lại, rồi đồng ý lại ở phiên bản mới. Thêm
-- UNIQUE là làm việc rút lại không ghi được.
--
-- Hệ quả phải biết: bấm đúp nút đồng ý sinh HAI hàng giống nhau. Vô hại (trạng
-- thái hiện tại vẫn là hàng mới nhất, cùng giá trị) nên không đáng đổi hình
-- dạng bảng để chặn; `POST /events/consent` là idempotent theo nghĩa kết quả.
--
-- ON DELETE CASCADE: dọn một tài khoản khách là bản ghi đồng ý đi theo, giống
-- `learning_events`. Hai bảng phải cùng luật — nếu không thì dọn tài khoản để
-- lại một hàng đồng ý trỏ vào người không còn tồn tại.

-- CreateTable
CREATE TABLE IF NOT EXISTS "learning_event_consents" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "version" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_event_consents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "learning_event_consents"
  ADD CONSTRAINT "learning_event_consents_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
-- Đọc trạng thái là `WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`, và nó
-- chạy MỘT LẦN MỖI LÔ sự kiện (xem `record()` trong learning-events.service.ts)
-- — tức đây là đường nóng nhất của bảng này, dù bảng chỉ có vài chục hàng. Index
-- phủ đúng hình dạng truy vấn, không chỉ `user_id`, để nó là một index-only scan.
CREATE INDEX IF NOT EXISTS "idx_log_consents_user_created"
  ON "learning_event_consents"("user_id", "created_at" DESC);
