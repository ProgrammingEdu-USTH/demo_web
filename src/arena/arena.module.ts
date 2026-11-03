import { Module } from '@nestjs/common';
import { ArenaController } from './arena.controller';
import { ArenaGraderService } from './arena-grader.service';
import { ArenaService } from './arena.service';

@Module({
  controllers: [ArenaController],
  providers: [ArenaService, ArenaGraderService],
})
export class ArenaModule {}
