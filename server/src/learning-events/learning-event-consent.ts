/**
 * Luật ĐỒNG Ý của lớp ghi nhật ký lần thử — hàm thuần, không đụng DB.
 *
 * Bảng `learning_event_consents` chỉ THÊM HÀNG (xem chú thích model
 * `LearningEventConsent` trong schema.prisma): trạng thái hiện tại là hàng MỚI
 * NHẤT. File này biến hàng đó thành đúng hình dạng frontend đọc
 * (`TrangThaiDongY` trong frontend/src/lib/log-consent.ts):
 * `{ granted, shouldAsk, version }`.
 */

/**
 * Phiên bản BẢN MÔ TẢ mà người học đồng ý với — tức `MO_TA_PHAM_VI` trong
 * frontend/src/lib/log-consent.ts (thu gì, không thu gì, hạn lưu, dùng để làm gì).
 *
 * ĐỔI CHUỖI NÀY MỖI KHI PHẠM VI THU THẬP RỘNG RA (thêm loại sự kiện, thêm trường
 * payload, đổi hạn lưu). Không đổi thì phạm vi mới chạy dưới sự đồng ý cũ mà
 * không ai biết: "đã đồng ý" không có nghĩa là "đồng ý điều NÀY". Đổi rồi thì
 * mọi người được hỏi lại và chưa ai được ghi cho tới khi họ trả lời.
 */
export const PHIEN_BAN_DONG_Y = '2026-11-v1';

export type TrangThaiDongY = {
  granted: boolean;
  shouldAsk: boolean;
  version: string;
};

/** Phần của hàng mới nhất mà luật cần. `null` = người này chưa quyết lần nào. */
export type HangDongY = { granted: boolean; version: string } | null;

export function trangThaiDongY(
  moiNhat: HangDongY,
  phienBan: string = PHIEN_BAN_DONG_Y,
): TrangThaiDongY {
  // Chưa quyết, HOẶC quyết cho một bản mô tả cũ: hỏi, và coi là CHƯA đồng ý.
  // Im lặng không phải đồng ý (xem đầu learning-event-kinds.ts), nên đồng ý bản
  // cũ không được kéo sang bản mới.
  if (!moiNhat || moiNhat.version !== phienBan) {
    return { granted: false, shouldAsk: true, version: phienBan };
  }
  // Đã quyết cho đúng bản này — kể cả TỪ CHỐI — thì không hỏi lại. Hỏi lại người
  // vừa từ chối là ép đồng ý bằng sự phiền, trái luật "từ chối không ảnh hưởng gì".
  return { granted: moiNhat.granted, shouldAsk: false, version: phienBan };
}
