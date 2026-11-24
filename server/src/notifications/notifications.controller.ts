import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { SkipThrottle, Throttle, seconds } from '@nestjs/throttler';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { UpdateSettingsDto } from './dto/notifications.dto';

@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // ---------- Task 205 ----------
  @Get('notifications')
  getSettings(@CurrentUserId() userId: number) {
    return this.notifications.getSettings(userId);
  }

  // ---------- Task 206 ----------
  @Put('notifications')
  updateSettings(
    @CurrentUserId() userId: number,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.notifications.updateSettings(userId, dto);
  }

  // ---------- Task 207 ----------
  @Get('notifications/feed')
  feed(@CurrentUserId() userId: number) {
    return this.notifications.getFeed(userId);
  }

  // ---------- Task 208 ----------
  // Client poll nền ~45 giây/lần nên KHÔNG áp quota chung (sẽ tự gây 429 giả),
  // nhưng cũng KHÔNG được bỏ trắng mọi giới hạn: đây là endpoint được gọi nhiều
  // nhất hệ thống và mỗi lượt đều chạm DB. Bỏ hết giới hạn nghĩa là một script
  // gọi liên tục có thể một mình làm cạn connection pool và treo cả web.
  // Hạn mức riêng đủ rộng cho nhịp poll thật (45s/lần = ~80 lượt/giờ) nhưng chặn
  // được lạm dụng.
  @Get('notifications/badge')
  @SkipThrottle({ ip_day: true })
  @Throttle({
    ip_hour: {
      limit: Number(process.env.THROTTLE_BADGE_LIMIT ?? 240),
      ttl: seconds(3600),
    },
  })
  badge(@CurrentUserId() userId: number) {
    return this.notifications.getBadge(userId);
  }

  // ---------- Task 209 ----------
  @Post('notifications/feed/:id/read')
  @HttpCode(HttpStatus.OK)
  markRead(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notifications.markRead(userId, id);
  }

  // ---------- Task 210 ----------
  @Post('notifications/feed/read-all')
  @HttpCode(HttpStatus.OK)
  markAllRead(@CurrentUserId() userId: number) {
    return this.notifications.markAllRead(userId);
  }
}
