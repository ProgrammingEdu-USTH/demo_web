import { Module } from '@nestjs/common';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [ForumController],
  providers: [ForumService],
  exports: [ForumService],
})
export class ForumModule {}
