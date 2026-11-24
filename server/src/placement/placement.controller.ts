import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/public.decorators';
import { SubmitPlacementDto } from './dto/placement.dto';
import { PlacementService } from './placement.service';

@Controller()
export class PlacementController {
  constructor(private readonly placement: PlacementService) {}

  // Công khai: khách chưa có tài khoản vẫn xem được câu hỏi (không kèm đáp án đúng).
  @Public()
  @Get('placement/questions')
  questions() {
    return this.placement.getQuestions();
  }

  // Cần JWT (khách cũng có JWT sau POST /auth/guest): chỉ lúc NỘP mới cần danh tính.
  @Post('placement/submit')
  @HttpCode(HttpStatus.OK)
  submit(@CurrentUserId() userId: number, @Body() dto: SubmitPlacementDto) {
    return this.placement.submit(userId, dto);
  }

  @Get('me/placement')
  mine(@CurrentUserId() userId: number) {
    return this.placement.getMine(userId);
  }
}
