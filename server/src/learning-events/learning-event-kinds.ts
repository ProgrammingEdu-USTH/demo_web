/**
 * HỢP ĐỒNG của lớp ghi nhật ký lần thử — danh sách `kind` ĐÓNG và các trần.
 *
 * ============================================================================
 * FILE NÀY TỒN TẠI HAI BẢN, GIỐNG NHAU TỪNG KÝ TỰ
 * ============================================================================
 *   NGUỒN   : src/learning-events/learning-event-kinds.ts   (sửa ở đây)
 *   BẢN CHÉP: frontend/src/lib/learning-event-kinds.ts
 *
 * Phải chép vì frontend là một project TypeScript riêng (rootDir/tsconfig
 * khác) nên không import được sang `src/` của backend.
 * `frontend/e2e/unit/learning-events.test.mjs` đọc CẢ HAI file rồi đòi chúng
 * khớp từng ký tự; lệch nhau là trượt ở đó kèm đúng câu phải làm — cùng cách
 * `tracer-web-sync.test.mjs` canh hai bản của bộ ghi vết.
 *
 * ============================================================================
 * CỔNG ĐỒNG Ý — ĐIỀU KIỆN ĐỂ LỚP NÀY PHÁT RA DÙ CHỈ MỘT SỰ KIỆN
 * ============================================================================
 * Lớp này ghi dữ liệu THEO DÕI HÀNH VI của người học. Rà soát nội bộ (xem
 * ghi-chu-local/research_notes/) đọc ra rằng ở Việt Nam loại dữ liệu này đã
 * chuyển sang nhóm được đối xử nghiêm hơn, và rằng im lặng / không phản hồi
 * KHÔNG được coi là đồng ý. Hệ quả THIẾT KẾ (không phải kết luận pháp lý — đó
 * là việc của người khác), và cả ba đều là ràng buộc mã, không phải lời khuyên:
 *
 *  1. MẶC ĐỊNH LÀ TẮT. `taoBoGhi()` ở frontend không xếp sự kiện nào vào hàng
 *     chờ, không ghi gì xuống localStorage, không gửi gì — cho tới khi có ai
 *     gọi `datDongY(true)`. Không có cờ env nào bật sẵn, không có ô tick sẵn.
 *  2. RÚT LẠI LÀ XOÁ HÀNG CHỜ, KHÔNG PHẢI ĐẨY NỐT. `datDongY(false)` bỏ sạch
 *     những gì đang chờ. Đẩy nốt "cho khỏi mất dữ liệu" là gửi đúng thứ người
 *     ta vừa nói đừng gửi.
 *  3. TỪ CHỐI KHÔNG ẢNH HƯỞNG VIỆC HỌC. Không một đường nào trong bài học đọc
 *     cờ đồng ý: không chặn, không nhắc lại, không giảm tính năng. Bài học chạy
 *     y nguyên như khi lớp này không tồn tại — đó là cách duy nhất để sự đồng ý
 *     không bị gói chung với quyền dùng sản phẩm.
 *
 * CHƯA LÀM, và nó là thứ CHẶN việc bật lớp này: giao diện xin đồng ý và BẢN GHI
 * ĐỒNG Ý ở máy chủ (ai đồng ý, lúc nào, cho mục đích gì). Hôm nay chưa chỗ nào
 * gọi `datDongY(true)`, nên lớp này nằm im — và đó là trạng thái ĐÚNG, không
 * phải việc còn sót. Đừng "bật tạm cho có dữ liệu".
 *
 * Và KHÔNG thu dữ liệu nhân khẩu, không một trường nào. Nhóm Blackbox (bộ dữ
 * liệu lập trình giáo dục lớn nhất từng có) cố ý từ chối thu nhân khẩu vì
 * "managing this for hundreds of thousands of users seemed untenable"; ở cỡ
 * 20–40 người thì nó còn vô dụng hơn — mọi phân khúc theo nhân khẩu ở cỡ đó là
 * nhóm 3–5 người. Biến phân khúc duy nhất đáng có là một bài TIỀN KIỂM, và đó
 * là hạng mục #10 của báo cáo, không phải một cột trong bảng này.
 *
 * ============================================================================
 * VÌ SAO KHÔNG DÙNG NHÀ CUNG CẤP ANALYTICS — lý do CỨNG, không phải chi phí
 * ============================================================================
 * CSP của repo là `connect-src 'self' ${API_ORIGIN}` (frontend/next.config.ts),
 * và ba worker Python còn bị siết tiếp xuống `connect-src 'self'`. Một SDK
 * analytics bên thứ ba BỊ CHẶN THẲNG. Nới CSP cho nó là mở lại đúng cái lỗ mà
 * bản sửa worker-CSP đã bịt — mã Python của học viên dùng `pyodide.ffi` gọi
 * `fetch(API_ORIGIN + '/auth/refresh', { credentials: 'include' })` và nhận về
 * access token THẬT (đo trong Chrome 155, 25/10/2026). Lỗ đó đang có 7 ca test
 * canh (`worker-csp.test.mjs`). Nên "dùng vendor" không phải đắt, nó PHÁ MỘT
 * HÀNG RÀO AN NINH. Ở cỡ 20–40 người thì một bảng Postgres và ba câu SQL làm
 * đủ việc, còn phiên CÓ ĐIỀU PHỐI thay cho session replay.
 *
 * ============================================================================
 * TÊN `kind` ĐI THEO ProgSnap2 v8, KHÔNG TỰ NGHĨ
 * ============================================================================
 * ProgSnap2 (đặc tả v8, 18/12/2020) là định dạng chuẩn cho dữ liệu quá trình
 * lập trình, với enum `EventType` 22 giá trị và tiền tố `X-` dành riêng cho sự
 * kiện của nền tảng. Đặt tên theo nó thì dữ liệu của đợt thử nghiệm này còn so
 * được với bộ của người khác; tự nghĩ tên thì không.
 *
 * Bốn tên dưới đây là tên CHUẨN của ProgSnap2, dùng đúng nghĩa của nó:
 *   `Run.Test`      chạy bộ ca kiểm thử (ở đây: nút "Chạy thử")
 *   `Submit`        nộp để chấm             (ở đây: nút "Nộp & Chấm điểm")
 *   `Resource.View` người học mở một tài nguyên (gợi ý / lời giải mẫu)
 *   `X-*`           phần còn lại — chỗ hợp lệ cho những loại chỉ repo này có
 *
 * `Run.Test` và `Submit` là HAI loại chứ không phải một loại kèm cờ `submit`:
 * ProgSnap2 tách chúng, và ở sản phẩm này chúng khác nhau thật — chỉ lượt NỘP
 * mới ghi tiến độ và mở lời giải ở bài cửa. Giá phải trả: câu SQL đếm lần thử
 * phải `kind IN ('Run.Test','Submit')` thay vì một phép so bằng.
 *
 * KHÔNG dùng được bộ 5 cột bắt buộc của ProgSnap2 (`EventType, EventID,
 * SubjectID, ToolInstances, CodeStateID`) nguyên vẹn: `CodeStateID` trỏ tới một
 * bản lưu MÃ NGUỒN của người học, mà lớp này cố ý không giữ mã nguồn (xem
 * QUYẾT ĐỊNH 2 dưới). Nên đây là "đặt tên theo ProgSnap2", không phải "xuất ra
 * ProgSnap2" — đừng ghi vào đâu rằng bảng này là một bộ ProgSnap2 hợp lệ.
 *
 * ============================================================================
 * KHÔNG THI HÀNH Error Quotient / RED — đã có bằng chứng ngược
 * ============================================================================
 * EQ (Jadud) và RED là hai độ đo quen tên, và chỗ dễ sai là đi tính chúng.
 * Có đúng MỘT bài áp chúng vào khoá PYTHON với cohort 12 người — đúng cỡ của
 * mình (Araujo, Bittencourt & Chavez, EduComp 2022) — và kết quả là: RED cho
 * điểm khác 0 ở chỉ ~12% dự án, tức trên phần lớn dữ liệu nó không phân biệt
 * được gì; EQ + RED + Error Count gộp lại giải thích nhiều nhất 26% phương sai
 * điểm thi, trong khi ĐIỂM BÀI TẬP VỀ NHÀ một mình đạt R² = 0,330 — tức chúng
 * KÉM HƠN thứ dự án này đã có. Thêm nữa luật "+3 nếu cùng LOẠI lỗi" của EQ dựa
 * vào việc có nhiều loại lỗi để phân biệt, mà Python chỉ có một nhóm hẹp.
 *
 * Vì vậy bảng này ghi SỰ VIỆC THÔ và không tính độ đo tổng hợp nào. Tín hiệu
 * đã công bố và dùng được ngay là một TỈ SỐ, không phải một điểm:
 *   nhiều lần SỬA + ít lần CHẠY  = tắc ở NGỮ NGHĨA (không biết viết gì)
 *   nhiều lần SỬA + nhiều lần CHẠY = tắc ở CÚ PHÁP (sửa mò cho hết lỗi)
 * Nên payload của `Run.Test`/`Submit` mang `editsSinceLastRun`. ĐỌC KỸ CHỖ NÀY:
 * nó là một SỐ ĐẾM trên sự kiện chạy, KHÔNG phải một loại sự kiện `File.Edit`
 * riêng cho từng lần gõ. Blackbox cố ý chọn mức dòng thay vì click-stream vì
 * "data-cleaning proved to be a significant problem", và một sự kiện mỗi lần gõ
 * ở đây là click-stream: nó nhân số hàng lên hàng trăm lần, chở nhiều về thao
 * tác soạn thảo hơn về việc học, và vẫn cho ra đúng con số mà một bộ đếm cho ra.
 */

/**
 * MƯỜI loại sự kiện. Mỗi loại tồn tại vì nó ghi được một thứ mà KHÔNG loại nào
 * khác suy ra được — đó là tiêu chí, không phải "cho đủ bộ".
 *
 *  1. `X-Lesson.Open`      mở bài. Mẫu số của mọi phép đo drop-off.
 *  2. `X-Lesson.Heartbeat` còn đang mở bài (nhịp cố định). Thời gian trên tác
 *     vụ CHỈ suy ra được từ đây: `X-Lesson.Open` một mình không phân biệt được
 *     "đọc 20 phút" với "mở tab rồi đi ăn cơm" — nhịp dừng là lúc họ rời đi.
 *  3. `X-Lesson.Abandon`   rời bài khi chưa hoàn thành, kèm `screen_key`. Khác
 *     hẳn "thiếu heartbeat": heartbeat tắt cũng xảy ra khi máy sleep, còn đây
 *     là `pagehide`/tab ẩn — một hành vi, không phải một khoảng lặng.
 *  4. `Run.Test`           một lượt "Chạy thử" bài tập CÓ CHẤM: ca nào trượt,
 *     loại + nội dung exception, lượt này có giống lượt trước không, số lần
 *     sửa kể từ lượt chạy trước, khoảng cách tới lượt trước.
 *  5. `Submit`             như trên, nhưng là lượt NỘP để chấm. Tách khỏi
 *     `Run.Test` theo ProgSnap2, và vì chỉ lượt này ghi tiến độ.
 *  6. `X-Repeat.Fail`      lượt vừa rồi trượt Y HỆT lượt trước (cùng mã, cùng
 *     tập ca trượt, cùng loại lỗi). KHÔNG suy được rẻ ở phía SQL — nó cần so
 *     hai hàng liền nhau của cùng một người trên cùng một bài, mà dấu hiệu
 *     "đâm tường" là thứ phải đọc được bằng một câu `WHERE kind = ...`.
 *  7. `X-Run.Interrupted`  lượt chạy KHÔNG có kết quả học tập nào: bấm Dừng,
 *     bị cắt vì quá hạn, hoặc chạm trần đầu ra (`payload.reason`). Theo Akers
 *     (CHI 2009) các sự kiện kiểu undo/erase lộ hơn 90% vấn đề được chấm là
 *     nghiêm trọng, và "bấm Dừng" chính là bản undo/erase của sản phẩm này.
 *  8. `X-Runtime.Failure`  lỗi HẠ TẦNG, tách khỏi lỗi người học: worker không
 *     nạp được, tải Python quá lâu, thiếu wheel. Trộn nó vào lượt trượt là biến
 *     một sự cố của mình thành "bài này khó".
 *  9. `Resource.View`      mở gợi ý hoặc chèn lời giải mẫu. `lesson_progress`
 *     không có chỗ nào ghi việc này, mà nó là dấu hiệu bỏ-cuộc mạnh nhất còn
 *     trong bài.
 * 10. `X-Quiz.Answer`      đáp án trắc nghiệm CHI TIẾT: chọn phương án nào,
 *     đúng/sai, lần thứ mấy. `quiz_score` của `lesson_progress` chỉ là một con
 *     số gộp nên không chỉ ra được distractor nào bị chọn lặp lại — mà đúng cái
 *     đó mới quyết định được bài nào cần `MisconceptionScreen`.
 *
 * KHÔNG có `lesson_complete`: `lesson_progress.completed_at` đã ghi đúng việc
 * đó, và hai nguồn cho một sự thật là chỗ chúng lệch nhau (xem bẫy "Hai nguồn
 * danh sách bài" trong AGENTS.md).
 */
export const LEARNING_EVENT_KINDS = [
  'X-Lesson.Open',
  'X-Lesson.Heartbeat',
  'X-Lesson.Abandon',
  'Run.Test',
  'Submit',
  'X-Repeat.Fail',
  'X-Run.Interrupted',
  'X-Runtime.Failure',
  'Resource.View',
  'X-Quiz.Answer',
] as const;

export type LearningEventKind = (typeof LEARNING_EVENT_KINDS)[number];

/** Hai loại đếm là "một lần thử" — mọi chỗ khác phải dẫn về đây, đừng gõ lại. */
export const KIND_LAN_THU: readonly LearningEventKind[] = [
  'Run.Test',
  'Submit',
];

/** Tra cứu O(1) — `includes` trên mảng 10 phần tử gọi mỗi sự kiện của mỗi lô. */
const TAP_KIND: ReadonlySet<string> = new Set<string>(LEARNING_EVENT_KINDS);

export function laKindHopLe(kind: unknown): kind is LearningEventKind {
  return typeof kind === 'string' && TAP_KIND.has(kind);
}

/**
 * Nơi mã của bài chạy. MỌI phép gộp thời gian phải TÁCH THEO TRƯỜNG NÀY.
 *
 * Vì sao: khoá 172 bài có 131 bài chạy trong trình duyệt, 14 hỗn hợp và 27 chạy
 * TRÊN MÁY người học (AGENTS.md). Với 27 bài kia, `machineMs` của worker không
 * đo cái gì cả — mã thật chạy ở chỗ mình không thấy. Gộp chung là lấy trung
 * bình của hai thứ khác loại.
 */
export const MOI_TRUONG_CHAY = ['browser', 'mixed', 'local'] as const;
export type MoiTruongChay = (typeof MOI_TRUONG_CHAY)[number];

/**
 * HAI HẰNG SỐ VỀ THỜI GIAN, cả hai có tiền lệ công bố — đừng tự chọn lại.
 *
 * `TRAN_KHOANG_CACH_MS` (10 phút): PSLC DataShop để `Duration` NULL khi khoảng
 * cách giữa hai hành động vượt 10 phút, hoặc khi nó vắt qua hai phiên. Lý do
 * thẳng: quá 10 phút thì con số không còn đo "người này nghĩ bao lâu" mà đo
 * "người này đi đâu đó". Nên `sincePrevMs` là `null` khi vượt mốc này — null
 * chứ không phải một số lớn, vì một số lớn sẽ bị tính vào trung bình.
 *
 * `NGUONG_PHIEN_MS` (5 phút): Jadud gộp các lượt biên dịch thành phiên theo
 * ngưỡng 5 phút. Dùng để đánh dấu `newSession` trên sự kiện chạy — "quay lại
 * sau một lúc" khác hẳn "bấm lại ngay", và đó là ranh giới mà mọi phép đếm
 * trong-một-phiên cần.
 *
 * Hai số KHÁC NHAU và không được gộp: một cái quyết định "có đo thời gian hay
 * không", cái kia quyết định "đây có phải lượt đầu của một phiên mới hay không".
 */
export const TRAN_KHOANG_CACH_MS = 10 * 60 * 1000;
export const NGUONG_PHIEN_MS = 5 * 60 * 1000;

/**
 * BA DẤU THỜI GIAN, không phải hai. Mẫu của Snowplow, và lý do thì sắc:
 *
 *   `clientAt`     — thiết bị TẠO sự kiện  (Snowplow gọi `dtm`)
 *   `clientSentAt` — thiết bị GỬI lô đi    (Snowplow gọi `stm`)
 *   `createdAt`    — máy chủ NHẬN được     (Snowplow gọi `collector_tstamp`)
 *
 * Hai mốc đầu đọc từ CÙNG MỘT đồng hồ, nên chúng "inaccurate in precisely the
 * same way": HIỆU của chúng đúng dù giờ máy người học sai hẳn. Vì vậy mốc dùng
 * được cho mọi phép so GIỮA người học là mốc SUY RA:
 *
 *   derivedAt = createdAt - (clientSentAt - clientAt)
 *
 * Chỉ hai mốc thì không có phép này: `clientAt` một mình thì sai theo độ lệch
 * đồng hồ, `createdAt` một mình thì cả lô cùng một giá trị nên không xếp được
 * thứ tự bên trong lô.
 *
 * Và KHÔNG có số thứ tự đơn điệu phía client. Rà soát 6 SDK lớn: không SDK nào
 * có. Câu trả lời của ngành cho việc sắp thứ tự là đúng cặp dấu thời gian trên.
 * Thêm một bộ đếm là tự nghĩ ra một mẫu chưa ai dùng.
 */

/**
 * `eid` — UUID v4 do CLIENT sinh, trên MỌI sự kiện, VÔ ĐIỀU KIỆN.
 *
 * Đây là khoá chống trùng, mẫu của Snowplow, và nó giải quyết một chuyện thật:
 * một lô gửi lúc trang ẩn có thể tới máy chủ NHƯNG phản hồi không về kịp, nên
 * client không biết là đã tới và gửi lại — không có `eid` thì mọi sự kiện của
 * lô đó bị đếm hai lần, và "số lần thử tới khi đạt" phồng lên gấp đôi ở đúng
 * những người bị mạng kém.
 *
 * Ghép với `UNIQUE(event_id)` + `skipDuplicates` ở Postgres thì phép chèn tự
 * bỏ bản trùng, VÀ `createMany` trả về số hàng THẬT SỰ ĐƯỢC CHÈN — nên tỉ lệ
 * trùng là một số đo MIỄN PHÍ (`duplicates` trong response), không phải một
 * thứ phải đi đo riêng.
 *
 * Sự kiện thiếu `eid` hoặc `eid` sai hình dạng thì BỊ BỎ, không được máy chủ
 * tự sinh hộ: máy chủ sinh hộ nghĩa là hàng đó không có cách nào khử trùng, mà
 * `accepted`/`duplicates` thì vẫn trông như đáng tin.
 */
export const RE_UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * TRẦN BYTE của một lô, phía CLIENT. Phải đo trước khi gửi, không được để nó
 * tự nổ.
 *
 * WHATWG Fetch, nguyên văn: "If the sum of contentLength and
 * inflightKeepaliveBytes is greater than 64 kibibytes, then return a network
 * error." — tức 64 KiB là NGÂN SÁCH GỘP của cả fetch group, không phải trần
 * cho một request (MDN ghi con số mà không nói nó dùng chung — một lỗ tài
 * liệu thật). Vượt trần là `network error`, KHÔNG PHÂN BIỆT ĐƯỢC với mất mạng,
 * và máy chủ không bao giờ thấy request đó.
 *
 * 52 000 byte ≈ 64 KiB × 0,8 — cùng cách tính ngân sách của posthog-js. Phần
 * 20% chừa cho một lô khác đang bay (đổi bài ngay sau một lô vừa gửi) và cho
 * phần header/overhead mà `contentLength` không nói hết.
 */
export const TRAN_BYTE_MOI_LO = 52_000;

/**
 * Trần của ĐỆM trong bộ nhớ: quá thì bỏ CÁI CŨ NHẤT.
 *
 * 1000 là con số của Snowplow — chính sách đệm duy nhất được tài liệu hoá rõ
 * trong 6 SDK đã soát (PostHog để trong bộ nhớ và KHÔNG có trần). Bỏ cái cũ
 * nhất, không bỏ cái mới nhất: khi đệm phình tới mức này thì đường gửi đang
 * hỏng, và thứ đáng giữ là trạng thái GẦN ĐÂY của người học.
 */
export const TRAN_DEM = 1000;

/**
 * CHỐNG LẠM DỤNG — chỗ dựa tiêu chuẩn, và chỗ không có tiêu chuẩn.
 *
 * `POST /api/events` nhận một LÔ, nên nó đúng hình dạng mà OWASP
 * **API4:2023 Unrestricted Resource Consumption** cảnh báo: kịch bản "GraphQL
 * batching" của mục đó là nhiều tác vụ trong MỘT request để lách giới hạn tính
 * theo request. Các gạch đầu dòng phòng ngừa của nó khớp gần một-một với hàng
 * rào ở đây: trần kích thước payload, trần số phần tử mảng, rate-limit theo
 * endpoint, throttle theo client, và **validate ở SERVER mọi số lượng do client
 * gửi**. Thêm **BLA7:2025 Resource Quota Violation** cho chuyện lạm dụng hạn
 * mức miễn phí — ở đây là dùng endpoint này làm kho lưu trữ.
 *
 * Nói thẳng chỗ KHÔNG có tiêu chuẩn: OWASP buộc phải CÓ trần nhưng không nói
 * trần bằng bao nhiêu, và không tìm được một post-mortem nào về một endpoint
 * telemetry bị lạm dụng làm kho lưu trữ. Nên mọi con số trong `GIOI_HAN` là
 * một QUYẾT ĐỊNH KỸ THUẬT có lý do viết kèm, không phải một khuyến nghị dẫn
 * được từ nguồn.
 */

/**
 * Trần cho mọi thứ client gửi.
 *
 * Con số ở đây KHÔNG canh "tốc độ", chúng canh "một client hỏng không làm gì
 * được" — nên đặt rộng rãi hơn ca dùng thật, và đóng chặt hơn vô hạn.
 */
export const GIOI_HAN = {
  /**
   * Số sự kiện tối đa trong MỘT lô. Nhịp gửi thật của frontend là 20 sự kiện
   * hoặc 20 giây, cái nào tới trước, nên 50 là hơn hai lần ca dùng bình thường
   * — chừa chỗ cho lô đẩy lúc `pagehide` gom thêm vài sự kiện cuối. Và nó còn
   * phải vừa trần 64 KiB của `fetch(keepalive)`: lô dày nhất ước ~20 KB.
   */
  suKienMoiLo: 50,
  /**
   * Trần BYTE của thân request, phía máy chủ. Trùng `TRAN_BYTE_MOI_LO` của
   * client có chủ đích: client đo rồi cắt, máy chủ đo lại — OWASP API4:2023
   * nói validate ở SERVER mọi số lượng do client gửi, và một client đã sửa thì
   * không còn đo hộ ai nữa.
   */
  byteMoiLo: 52_000,
  /** Số khoá tối đa trong `payload`. Sự kiện dày nhất (`Submit`) dùng 11. */
  khoaPayload: 24,
  /**
   * Độ dài tối đa của MỖI chuỗi trong payload. 500 ký tự đủ cho một dòng
   * traceback cuối — thứ thật sự đọc được — và quá ngắn để nhét cả mã nguồn.
   */
  kyTuChuoi: 500,
  /** Số phần tử tối đa của một mảng trong payload (vd danh sách ca trượt). */
  phanTuMang: 12,
  kyTuCourseId: 64,
  kyTuScreenKey: 64,
  /**
   * `client_at` lệch quá mức này so với giờ máy chủ thì BỎ cột đó (ghi null),
   * không bỏ cả sự kiện: đồng hồ máy người học lệch là chuyện thường, nhưng một
   * mốc thời gian năm 2097 sẽ phá mọi câu SQL có `WHERE created_at BETWEEN`.
   */
  lechClientAtMs: 7 * 24 * 3600 * 1000,
} as const;

/**
 * Khoá payload bị TỪ CHỐI THẲNG, vì tên của chúng nói rằng chúng chở mã nguồn
 * của người học — nguyên văn HAY dưới dạng dấu vân tay.
 *
 * ============================================================================
 * QUYẾT ĐỊNH 1: không ghi mã nguồn thô. Ba lý do.
 * ============================================================================
 *  1. Nó không cần thiết cho câu hỏi đang hỏi. Mọi phép đo trong báo cáo —
 *     "bài nào có người đâm tường", "số lần thử tới khi đạt", "trượt y hệt lặp
 *     lại" — chỉ cần biết mã CÓ ĐỔI so với lượt trước hay không.
 *  2. Mã nguồn là thứ người học viết tự do: nó có thể chứa tên, đường dẫn máy,
 *     hay dữ liệu họ dán vào từ chỗ khác.
 *  3. Nó không có trần tự nhiên. Ô soạn mã nhận được 100 000 ký tự
 *     (`MAX_IDE_AUTOSAVE_CHARS`), nhân với mỗi lượt Chạy của mỗi người.
 * Muốn đọc mã thật thì đường đúng là phiên CÓ ĐIỀU PHỐI, không phải log.
 *
 * ============================================================================
 * QUYẾT ĐỊNH 2: cũng KHÔNG ghi HASH của mã. `codeHash` nằm trong danh sách cấm.
 * ============================================================================
 * Bản đầu của lớp này gửi `codeHash` (FNV-1a 8 ký tự hex) và nó là mảnh yếu
 * nhất của cả schema. Hai lý do, lý do thứ hai mới là lý do quyết định:
 *
 *  · Nó KHÔNG mua thêm thông tin nào. Thứ duy nhất đọc hash là phép so "lượt
 *    này có giống lượt trước không", mà phép so đó chạy TRONG TRÌNH DUYỆT, nơi
 *    mã gốc vẫn còn trong tay. Nên máy chủ chỉ cần KẾT LUẬN — `sameAsPrev` một
 *    bit và `repeatStreak` một số đếm — chứ không cần dấu vân tay để tự so.
 *    Gửi hash là gửi một thứ không ai dùng tới.
 *  · Nó làm bản ghi DỄ NỐI HƠN, không phải khó hơn. Một hash là dấu vân tay
 *    tra-được-bằng-bảng trên một chuỗi mà người học viết ra: với một bài có 124
 *    lời giải khả dĩ, dựng bảng tra là chuyện vài phút. Hướng rà soát pháp lý
 *    nội bộ (xem ghi-chu-local/research_notes/) đọc ra rằng phép biến đổi có
 *    thể đảo bằng tra bảng thì KHÔNG đưa dữ liệu ra ngoài phạm vi dữ liệu cá
 *    nhân — nên hash vừa không có ích vừa làm mức phơi bày cao hơn. Đây là ghi
 *    chú THIẾT KẾ, không phải kết luận pháp lý: kết luận là việc của người khác.
 *
 * Ba cách khác đã xét và bỏ: (a) hash cắt còn 2 byte — vẫn là dấu vân tay, chỉ
 * nhiễu hơn, và nhiễu thì làm phép so "y hệt" sai; (b) hash kèm muối theo phiên
 * rồi bỏ muối — vẫn phải GIỮ muối suốt phiên, tức vẫn nối được trong đúng
 * khoảng thời gian đang phân tích; (c) chỉ hash khi trượt — thu hẹp phạm vi
 * nhưng không đổi bản chất. Cả ba đều kém hơn cách đơn giản nhất: đừng gửi.
 */
export const KHOA_CAM_PAYLOAD: readonly string[] = [
  'code',
  'source',
  'sourceCode',
  'solution',
  'solutionCode',
  'stdout',
  'stderr',
  'output',
  'draft',
  'program',
  'script',
  // Dấu vân tay của mã — xem QUYẾT ĐỊNH 2. Nằm trong danh sách cấm để một bản
  // sửa sau này không lặng lẽ đưa nó trở lại: thêm `codeHash` vào payload thì
  // CẢ SỰ KIỆN bị bỏ và `dropped` trong response nhảy lên, chứ không im lặng.
  'codeHash',
  'codeFingerprint',
  'codeState',
  'codeStateId',
  'hash',
];

/**
 * HẠN LƯU — nói ra ngay ở đây, không để thành "sẽ nghĩ sau".
 *
 * 90 ngày kể từ `created_at`. Căn cứ: một đợt thử nghiệm kéo dài vài tuần, cộng
 * thời gian phân tích; sau đó mọi câu hỏi mà bảng này trả lời được đã được hỏi
 * xong, và dữ liệu hành vi còn lại chỉ là rủi ro không có người dùng. Đường xoá
 * là một câu `DELETE` có sẵn ở CUỐI `scripts/learning-events/truy-van.sql` —
 * không phải một việc phải nghĩ lại từ đầu lúc cần.
 *
 * Hằng này KHÔNG được code đọc: không có job tự xoá. Nó là con số mà câu DELETE
 * và chú thích schema cùng dẫn về, để ba chỗ không nói ba hạn khác nhau.
 */
export const HAN_LUU_NGAY = 90;
