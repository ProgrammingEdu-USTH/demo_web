import { Module } from '@nestjs/common';
import { LearningEventsController } from './learning-events.controller';
import { LearningEventsService } from './learning-events.service';

@Module({
  controllers: [LearningEventsController],
  providers: [LearningEventsService],
})
export class LearningEventsModule {}
