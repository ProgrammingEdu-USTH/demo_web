import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Throttle, days, hours } from '@nestjs/throttler';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { ArenaQuizService } from './arena-quiz.service';
import { QuizAnswerDto } from './dto/arena-quiz.dto';

// Trận đoán output poll mỗi giây (~3600/giờ) → nới tier mặc định 1000/giờ.
const POLL_THROTTLE = {
  ip_hour: { limit: 8000, ttl: hours(1) },
  ip_day: { limit: 60000, ttl: days(1) },
};

// Không @Public(): JwtAuthGuard toàn cục bắt buộc đăng nhập (frontend PE-3d tự vào bằng tài khoản khách).
@Controller('arena/quiz')
export class ArenaQuizController {
  constructor(private readonly quiz: ArenaQuizService) {}

  @Get('me')
  me(@CurrentUserId() userId: number) {
    return this.quiz.getMe(userId);
  }

  @Get('leaderboard')
  leaderboard(@CurrentUserId() userId: number) {
    return this.quiz.leaderboard(userId);
  }

  @Post('queue')
  @HttpCode(HttpStatus.OK)
  queue(@CurrentUserId() userId: number) {
    return this.quiz.queue(userId);
  }

  // Khai báo TRƯỚC `matches/:id` để "current" không bị bắt làm :id.
  @Get('matches/current')
  @Throttle(POLL_THROTTLE)
  current(@CurrentUserId() userId: number) {
    return this.quiz.getCurrent(userId);
  }

  @Get('matches/:id')
  @Throttle(POLL_THROTTLE)
  match(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.quiz.getMatch(userId, id);
  }

  @Post('matches/:id/answer')
  @HttpCode(HttpStatus.OK)
  @Throttle(POLL_THROTTLE)
  answer(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: QuizAnswerDto,
  ) {
    return this.quiz.answer(userId, id, dto.index, dto.choice);
  }

  @Post('matches/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.quiz.cancel(userId, id);
  }

  @Post('matches/:id/forfeit')
  @HttpCode(HttpStatus.OK)
  forfeit(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.quiz.forfeit(userId, id);
  }
}
