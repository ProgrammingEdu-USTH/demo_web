import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  PayloadTooLargeException,
  Post,
} from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { ThrottleMessage } from 'src/common/decorators/throttle-message.decorator';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { GuiLoSuKienDto, QuyetDinhDongYDto } from './dto/learning-events.dto';
import { GIOI_HAN } from './learning-event-kinds';
import { LearningEventsService } from './learning-events.service';

/**
 * Lớp ghi nhật ký lần thử. Frontend đã gọi ba đường này từ trang bài học
 * (frontend/src/lib/learning-events.ts, log-consent.ts) trong khi backend của
 * nhánh test chưa có module — nên trước đây cả ba trả 404, hộp hỏi đồng ý không
 * lưu được lựa chọn và mọi sự kiện học bị mất.
 *
 * Prefix `/api` do gateway gắn; ở đây chỉ viết `events` (AGENTS.md).
 * Cần JWT (guard toàn cục). Hạn mức: `CustomThrottlerGuard` đếm theo
 * `user:<id>` khi đã đăng nhập, nên cả phòng máy chung một NAT không chia nhau.
 */
@Controller('events')
export class LearningEventsController {
  constructor(private readonly events: LearningEventsService) {}

  // Frontend gửi tối đa ~360 lô/giờ/người (một lô mỗi 10 giây). Trần mặc định
  // 600 rộng hơn ca thật để không bao giờ chặn người học bình thường, nhưng vẫn
  // chặn một client hỏng gửi liên tục.
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({
    ip_hour: {
      limit: Number(process.env.THROTTLE_EVENTS_LIMIT ?? 600),
      ttl: seconds(Number(process.env.THROTTLE_EVENTS_TTL_SECONDS ?? 3600)),
    },
  })
  @ThrottleMessage('Gửi nhật ký học quá dày, tạm dừng một lúc')
  ghiLo(@CurrentUserId() userId: number, @Body() dto: GuiLoSuKienDto) {
    // Trần BYTE đo lại ở máy chủ (OWASP API4:2023): client tự cắt ở 52 000 byte
    // nhưng một client đã sửa thì không đo hộ ai. Đo trên thân đã parse — xấp xỉ,
    // đủ để chặn việc dùng endpoint này làm kho lưu trữ.
    if (Buffer.byteLength(JSON.stringify(dto), 'utf8') > GIOI_HAN.byteMoiLo) {
      throw new PayloadTooLargeException(
        `Lô sự kiện vượt ${GIOI_HAN.byteMoiLo} byte`,
      );
    }
    return this.events.ghiLo(userId, dto.events, dto.sentAt);
  }

  @Get('consent')
  layDongY(@CurrentUserId() userId: number) {
    return this.events.layDongY(userId);
  }

  @Post('consent')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    ip_hour: {
      limit: Number(process.env.THROTTLE_EVENTS_CONSENT_LIMIT ?? 30),
      ttl: seconds(
        Number(process.env.THROTTLE_EVENTS_CONSENT_TTL_SECONDS ?? 3600),
      ),
    },
  })
  @ThrottleMessage('Bạn đổi lựa chọn hơi nhanh, đợi một lúc rồi thử lại')
  ghiDongY(@CurrentUserId() userId: number, @Body() dto: QuyetDinhDongYDto) {
    return this.events.ghiQuyetDinh(userId, dto.granted);
  }
}
