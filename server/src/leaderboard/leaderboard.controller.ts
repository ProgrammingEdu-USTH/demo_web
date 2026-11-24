import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { LeaderboardService } from './leaderboard.service';

@Controller()
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get('leaderboard')
  get(@CurrentUserId() userId: number, @Query('type') type?: string) {
    return this.leaderboard.getLeaderboard(userId, type);
  }
}
