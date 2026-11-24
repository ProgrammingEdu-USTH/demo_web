import { SetMetadata } from '@nestjs/common';

/**
 * Câu báo lỗi riêng cho 429 của MỘT route.
 *
 * Vì sao cần: 429 có hai nguyên nhân hoàn toàn khác nhau và người dùng phải xử
 * lý khác nhau. "Bạn bấm quá nhiều" là lỗi của chính họ, chờ một phút là xong.
 * "Máy chủ đang quá tải" là hàng đợi phía server đầy, chờ vài giây rồi thử lại.
 * Nói nhầm câu thứ nhất khi thật ra là câu thứ hai sẽ khiến người học tưởng
 * mình bị phạt oan và bỏ cuộc.
 *
 * Thông điệp mặc định của @nestjs/throttler là "ThrottlerException: Too Many
 * Requests" — tiếng Anh, và không phân biệt được hai trường hợp trên.
 *
 * Đọc ở `CustomThrottlerGuard.getErrorMessage`.
 */
export const THROTTLE_MESSAGE_KEY = 'throttle:message';

export const ThrottleMessage = (message: string) =>
  SetMetadata(THROTTLE_MESSAGE_KEY, message);
