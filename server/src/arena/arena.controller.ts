import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Throttle, days, hours, seconds } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { ArenaService } from './arena.service';
import { ArenaHttpError } from './arena.errors';
import {
  CreateRoomDto,
  HistoryQueryDto,
  JoinRoomDto,
  SubmitCodeDto,
} from './dto/arena.dto';

// Route poll (3 s/lần = 1200/giờ) phải nới tier mặc định 1000/giờ.
const POLL_THROTTLE = {
  ip_hour: { limit: 4000, ttl: hours(1) },
  ip_day: { limit: 40000, ttl: days(1) },
};

// Không @Public(): JwtAuthGuard toàn cục bắt buộc đăng nhập.
@Controller('arena')
export class ArenaController {
  constructor(private readonly arena: ArenaService) {}

  @Get('problems')
  problems() {
    return this.arena.listProblems();
  }

  @Get('problems/:id')
  problem(@Param('id') id: string) {
    return this.arena.getProblemDetail(id);
  }

  @Get('me')
  me(@CurrentUserId() userId: number) {
    return this.arena.getMe(userId);
  }

  @Post('rooms')
  createRoom(@CurrentUserId() userId: number, @Body() dto: CreateRoomDto) {
    return this.arena.createRoom(userId, dto.problemId);
  }

  @Post('rooms/join')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    ip_hour: { limit: 10, ttl: seconds(60) },
    ip_day: { limit: 500, ttl: days(1) },
  })
  joinRoom(@CurrentUserId() userId: number, @Body() dto: JoinRoomDto) {
    return this.arena.joinRoom(userId, dto.code);
  }

  @Post('queue')
  @HttpCode(HttpStatus.OK)
  queue(@CurrentUserId() userId: number) {
    return this.arena.queue(userId);
  }

  // Khai báo TRƯỚC `matches/:id` để "current" không bị bắt làm :id.
  @Get('matches/current')
  @Throttle(POLL_THROTTLE)
  current(@CurrentUserId() userId: number) {
    return this.arena.getCurrent(userId);
  }

  @Get('matches/:id')
  @Throttle(POLL_THROTTLE)
  match(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.arena.getMatch(userId, id);
  }

  @Post('matches/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.arena.cancel(userId, id);
  }

  @Post('matches/:id/forfeit')
  @HttpCode(HttpStatus.OK)
  forfeit(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.arena.forfeit(userId, id);
  }

  @Post('matches/:id/submissions')
  @Throttle({
    ip_hour: { limit: 20, ttl: seconds(60) },
    ip_day: { limit: 500, ttl: days(1) },
  })
  async submit(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      return await this.arena.submit(userId, id, dto.code);
    } catch (e) {
      if (e instanceof ArenaHttpError && e.retryAfterSec) {
        res.setHeader('Retry-After', String(e.retryAfterSec));
      }
      throw e;
    }
  }

  @Get('matches/:id/submissions')
  submissions(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.arena.listSubmissions(userId, id);
  }

  @Get('history')
  history(@CurrentUserId() userId: number, @Query() q: HistoryQueryDto) {
    return this.arena.history(userId, q.limit, q.before);
  }

  @Get('leaderboard')
  leaderboard(@CurrentUserId() userId: number) {
    return this.arena.leaderboard(userId);
  }
}
