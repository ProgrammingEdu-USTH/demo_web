-- LỚP GHI NHẬT KÝ LẦN THỬ — một bảng MỚI, không sửa một bảng nào đang có.
--
-- ============================================================================
-- VẤN ĐỀ ĐANG SỬA
-- ============================================================================
-- `lesson_progress` có đúng 4 cột dữ liệu (`status · quiz_score · xp_earned ·
-- completed_at`), khoá chính (user_id, lesson_id), và hàng CHỈ được tạo bên
-- trong `completeLesson`. Hệ quả, đo trên chính cấu trúc đó:
--   (a) người mở bài rồi bỏ KHÔNG để lại dấu vết nào;
--   (b) hoàn thành sau 1 lần thử và sau 20 lần thử là hai hàng GIỐNG HỆT NHAU;
--   (c) `quiz_score` do client báo nên nó là tự thuật, không phải phép đo.
-- Bộ chấm trong trình duyệt đã biết CHÍNH XÁC ca nào trượt — thông tin đó đang
-- bị bỏ ngay sau khi hiện lên màn hình. Bảng này là chỗ nó được giữ lại.
--
-- ============================================================================
-- VÌ SAO LÀ BẢNG MỚI, KHÔNG PHẢI THÊM CỘT VÀO `lesson_progress`
-- ============================================================================
-- DB dùng chung với bản Django cũ (xem README + AGENTS.md): migration chỉ được
-- THÊM. Thêm cột "số lần thử" vào `lesson_progress` thì vẫn mất (a) và (c), vì
-- hàng chỉ sinh ra lúc HOÀN THÀNH — người bỏ dở vẫn không có hàng nào. Một bảng
-- phụ lục theo thời gian là hình dạng duy nhất ghi được "đã xảy ra chuyện gì",
-- chứ không chỉ "kết quả cuối là gì".
--
-- ============================================================================
-- BA QUYẾT ĐỊNH VỀ CỘT, mỗi cái có lý do và đều dễ làm sai
-- ============================================================================
-- 1) `id` là SERIAL (int 4 byte), KHÔNG phải BIGSERIAL. Cohort là 20–40 người
--    thử trong một đợt: kể cả nhịp heartbeat 30 giây suốt 30 ngày cũng chỉ cỡ
--    vài triệu hàng, còn xa trần 2,1 tỉ. Và BIGSERIAL mang theo một cái bẫy
--    thật: Prisma map BIGINT sang `BigInt` của JS, mà `JSON.stringify` của
--    BigInt NÉM TypeError — nên ngày ai đó thêm một route đọc lại bảng này,
--    route đó sẽ 500 ở chỗ không ai nghĩ tới.
--
-- 2) KHÔNG có `lesson_id` và KHÔNG có `lesson_code`, và đó không phải thiếu
--    sót. Hai lý do:
--    · Toàn hệ thống tra bài theo `(course_id, sort_order)` chứ không theo `id`
--      (xem migration 20261012000000 và AGENTS.md) — nên `lesson_no` ở đây là
--      `sort_order`, đúng khoá mà câu SQL drop-off cần để XẾP THỨ BẬC bài.
--    · Client KHÔNG CÓ hai giá trị kia trong tay: `getLessonContent` chỉ select
--      `id/title/subtitle/module/sortOrder/xpReward/contentJson`, nên response
--      `/content` không mang `lesson_code` và không mang `lesson.id` ra ngoài.
--      MỘT CỘT LUÔN NULL TỆ HƠN MỘT CỘT KHÔNG TỒN TẠI — nó mời người đọc sau
--      này tin là có dữ liệu ở đó.
--    Cả hai lấy được bằng JOIN `lessons` theo (course_id, lesson_no), và các
--    câu trong scripts/learning-events/truy-van.sql làm đúng thế.
--    GIÁ PHẢI TRẢ, có chủ đích: nếu giáo trình được dựng lại GIỮA đợt thử
--    nghiệm và ánh xạ sort_order → lesson_code đổi, thì JOIN sẽ gán mã MỚI cho
--    sự kiện CŨ. Muốn chống chuyện đó thì phải thêm `lesson_code` ở đây VÀ cho
--    `getLessonContent` trả nó ra — tức đổi hình dạng API; đừng làm một nửa.
--
-- 3) KHOÁ NGOẠI chỉ gắn vào `users`, KHÔNG gắn vào `lessons`/`courses`.
--    `user_id` đến từ JWT nên chắc chắn có thật. Còn `course_id`/`lesson_no` là
--    dữ liệu CLIENT GỬI: một giá trị rác sẽ làm câu `INSERT ... createMany` của
--    cả LÔ thất bại vì vi phạm khoá ngoại, tức một sự kiện hỏng làm mất cả lô —
--    đúng điều lớp này phải không bao giờ làm. Giá phải trả, có chủ đích: bảng
--    có thể chứa mã bài không tồn tại; câu SQL phân tích dùng INNER JOIN với
--    `lessons` khi cần loại chúng ra.
--
-- `payload` JSONB: phần nội dung khác nhau theo `kind` (ca nào trượt, loại
-- exception, lượt này có giống lượt trước không, khoảng cách tới lượt trước…).
-- Nó được CẮT TRẦN ở tầng service trước khi tới đây — xem
-- src/learning-events/learning-events.sanitize.ts.
--
-- MÃ NGUỒN CỦA NGƯỜI HỌC KHÔNG BAO GIỜ NẰM TRONG BẢNG NÀY — kể cả dưới dạng
-- HASH. `code` và `codeHash` đều nằm trong `KHOA_CAM_PAYLOAD`, và một sự kiện
-- mang khoá đó bị BỎ CẢ SỰ KIỆN (hỏng ồn ào, không hỏng im lặng). Thứ bảng này
-- giữ là KẾT LUẬN: `sameAsPrev` một bit và `repeatStreak` một số đếm — phép so
-- chạy trong trình duyệt, nơi mã gốc vẫn còn trong tay, nên máy chủ không cần
-- dấu vân tay để tự so. Lý do đầy đủ: "QUYẾT ĐỊNH 2" trong
-- src/learning-events/learning-event-kinds.ts.
--
-- ============================================================================
-- HẠN LƯU: 90 NGÀY, và đường xoá nằm sẵn trong repo
-- ============================================================================
-- Bảng này chứa dữ liệu THEO DÕI HÀNH VI của người học, và một đợt thử nghiệm
-- chỉ kéo dài vài tuần. Sau 90 ngày mọi câu hỏi mà bảng trả lời được đã được
-- hỏi xong, và phần còn lại chỉ là rủi ro không có người dùng. Câu `DELETE` có
-- sẵn ở CUỐI scripts/learning-events/truy-van.sql — nói ra ngay thay vì để
-- thành "sẽ nghĩ sau". Hằng `HAN_LUU_NGAY` trong learning-event-kinds.ts là
-- con số mà cả ba chỗ (chú thích này, model Prisma, câu DELETE) cùng dẫn về.
--
-- KHÔNG có job tự xoá, và nói rõ ra: việc xoá là một lệnh người chạy. Một job
-- tự xoá chưa ai kiểm là thứ sẽ hoặc không chạy (rồi tưởng đã chạy) hoặc chạy
-- quá tay. Đợt thử nghiệm xong thì xoá bằng câu đó.
--
-- `ON DELETE CASCADE` ở khoá ngoại là nửa thứ hai của đường xoá: dọn một tài
-- khoản khách là log của họ đi theo, không cần nhớ thêm một bước nào.
--
-- ============================================================================
-- GIẢM MỨC NỐI THEO TỪNG NGƯỜI
-- ============================================================================
-- Cả BA câu phân tích trong truy-van.sql đều GỘP XUYÊN NGƯỜI: (a) bài nào có
-- người đâm tường, (b) số lần thử tới khi đạt theo bài, (c) drop-off theo thứ
-- bậc bài. `user_id` cần cho (b) và (c) — (b) phải đếm lần thử TRONG một người
-- rồi mới lấy trung vị, (c) phải đếm số người RIÊNG BIỆT — nhưng KHÔNG câu nào
-- theo dõi một cá nhân xuyên bài, và không câu nào trả về `user_id` ra ngoài.
-- Nếu sau này cần một truy vấn theo dõi một người xuyên bài thì phải nói ra và
-- quyết riêng, đừng coi là đã được phép sẵn.
--
-- ============================================================================
-- BA DẤU THỜI GIAN, KHÔNG PHẢI HAI — và cái thứ hai là cái dễ bị bỏ
-- ============================================================================
--   `client_at`      thiết bị TẠO sự kiện   (Snowplow gọi `dtm`)
--   `client_sent_at` thiết bị GỬI lô đi     (Snowplow gọi `stm`)
--   `created_at`     máy chủ NHẬN được      (Snowplow gọi `collector_tstamp`)
--
-- Hai mốc đầu đọc từ CÙNG MỘT đồng hồ nên chúng sai theo đúng cùng một cách:
-- HIỆU của chúng đúng dù giờ máy người học lệch hẳn. Vì vậy mốc dùng cho mọi
-- phép so GIỮA người học là mốc SUY RA, không phải `client_at`:
--
--   derived_at = created_at - (client_sent_at - client_at)
--
-- Chỉ hai mốc thì không có phép này: `client_at` một mình sai theo độ lệch đồng
-- hồ, `created_at` một mình thì cả lô cùng một giá trị nên không xếp được thứ
-- tự BÊN TRONG lô. Câu SQL nào so thời gian giữa người học phải tự tính
-- `derived_at` — xem scripts/learning-events/truy-van.sql.
--
-- KHÔNG có số thứ tự đơn điệu phía client: rà 6 SDK lớn thì không SDK nào có,
-- câu trả lời của ngành cho việc sắp thứ tự là đúng cặp dấu thời gian trên.
--
-- ============================================================================
-- VỀ INDEX TRÊN `payload`: KHÔNG có GIN, có chủ đích
-- ============================================================================
-- `lessons.content_json` có index GIN vì truy vấn trên nó là tìm theo khoá bất
-- kỳ. Ở đây thì ngược: các khoá hay dùng đã BIẾT TRƯỚC (`passed`, `reason`,
-- `env`). Tài liệu Postgres nói với một khoá nóng đã biết thì INDEX BIỂU THỨC
-- CÓ ĐÍCH "likely to be smaller and faster to search than a simple index" (so
-- với GIN trên cả document). Nên chưa đặt index nào trên `payload`: ba câu
-- trong truy-van.sql lọc theo `kind` TRƯỚC, mà `kind` đã có index, nên phần lọc
-- theo payload chạy trên một tập đã nhỏ. Khi một khoá cụ thể trở thành nút
-- thắt ĐO ĐƯỢC thì thêm một index biểu thức cho đúng khoá đó, đừng thêm GIN.
--
-- ============================================================================
-- PHÂN VÙNG: ngoài phạm vi hôm nay, nhưng lý do thật của nó là HẠN LƯU
-- ============================================================================
-- Luật của tài liệu Postgres là "the size of the table should exceed the
-- physical memory of the database server" — bảng này còn xa mức đó. Ghi lại vì
-- sao nó sẽ đáng làm: lợi ích thật ở đây KHÔNG phải tốc độ truy vấn mà là việc
-- XOÁ. Phân vùng theo tháng thì dọn dữ liệu quá hạn là `DROP TABLE` một phân
-- vùng — tức thì, không sinh dead tuple; còn `DELETE` khối lớn thì phải
-- `VACUUM` sau đó và giữ bloat trong lúc chờ. Nếu đợt thử nghiệm kéo dài nhiều
-- tháng thì đây là đường đáng đi.
--
-- Chi phí dung lượng của JSONB so với cột riêng: KHÔNG có số chính thức. Phép
-- đo duy nhất tìm được là một bài blog (164 MB jsonb so với 79 MB cột, ~2×) —
-- dùng làm cảm giác, đừng trích như sự thật.

-- CreateTable
CREATE TABLE "learning_events" (
    "id" SERIAL NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "course_id" TEXT,
    "lesson_no" INTEGER,
    "screen_key" TEXT,
    "kind" TEXT NOT NULL,
    "payload" JSONB,
    "client_at" TIMESTAMPTZ(6),
    "client_sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- `event_id` là UUID v4 do CLIENT sinh cho TỪNG sự kiện. UNIQUE ở đây là nửa
-- thứ hai của phép chống trùng: một lô gửi lúc trang ẩn có thể TỚI máy chủ
-- nhưng phản hồi không về kịp, nên client gửi lại — không có ràng buộc này thì
-- mọi sự kiện của lô đó bị đếm hai lần, và "số lần thử tới khi đạt" phồng gấp
-- đôi ở đúng những người mạng kém.
--
-- Ghép với `createMany({ skipDuplicates: true })`, Prisma trả về số hàng THẬT
-- SỰ được chèn — nên tỉ lệ trùng là một số đo MIỄN PHÍ (`duplicates` trong
-- response), không phải một thứ phải đi đo riêng.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_learning_events_event_id" ON "learning_events"("event_id");

-- AddForeignKey
-- ON DELETE CASCADE: tài khoản khách bị dọn thì log của họ đi theo. Mọi bảng
-- khác trong schema dùng RESTRICT, nhưng ở đây RESTRICT nghĩa là không xoá được
-- một tài khoản rác nào nữa mà không dọn tay — và log hành vi không phải dữ liệu
-- phải giữ lại sau khi chủ nó biến mất.
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- BA INDEX, PHỤC VỤ ĐÚNG BA CÂU SQL trong scripts/learning-events/truy-van.sql
-- ---------------------------------------------------------------------------

-- Câu (a) "bài nào có người đâm tường" và câu (b) "số lần thử tới khi đạt":
-- cả hai lọc theo `kind` TRƯỚC rồi mới gộp theo bài. `kind` đứng đầu vì nó là
-- cột có độ chọn lọc cao nhất trong bảng này — heartbeat sẽ là loại đông nhất,
-- nên lọc nó ra trước là bỏ được phần lớn bảng.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_learning_events_kind_lesson" ON "learning_events"("kind", "course_id", "lesson_no");

-- Câu (b) đếm theo TỪNG NGƯỜI trên TỪNG BÀI, và câu (c) đếm số người RIÊNG BIỆT
-- đã mở mỗi bài. Cả hai đi theo (user_id, bài).
-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_learning_events_user_lesson" ON "learning_events"("user_id", "course_id", "lesson_no", "kind");

-- Khoanh vùng một ĐỢT thử nghiệm theo thời gian (và dọn log cũ). Không có index
-- này thì mỗi câu phân tích quét toàn bảng chỉ để bỏ dữ liệu của đợt trước.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_learning_events_created" ON "learning_events"("created_at" DESC);
