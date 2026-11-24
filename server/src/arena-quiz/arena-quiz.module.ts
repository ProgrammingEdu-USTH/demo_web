import { Module } from '@nestjs/common';
import { ArenaQuizController } from './arena-quiz.controller';
import { ArenaQuizService } from './arena-quiz.service';

/** Arena · Đoán output: đấu nhanh 1v1 (từ app Arena trong máy tính Góc học của pe-usth). */
@Module({
  controllers: [ArenaQuizController],
  providers: [ArenaQuizService],
})
export class ArenaQuizModule {}
