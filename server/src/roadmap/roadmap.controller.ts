import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { SaveRoadmapDto, UpdateRoadmapItemDto } from './dto/roadmap.dto';
import { RoadmapService } from './roadmap.service';

@Controller()
export class RoadmapController {
  constructor(private readonly roadmap: RoadmapService) {}

  // ---------- Task 219 ----------
  @Get('roadmaps')
  getRoadmaps(@CurrentUserId() userId: number) {
    return this.roadmap.getRoadmaps(userId);
  }

  // ---------- Task 220 ----------
  @Get('roadmap')
  progress(
    @CurrentUserId() userId: number,
    @Query('roadmap_id') roadmapId?: string,
  ) {
    return this.roadmap.getRoadmapProgress(userId, roadmapId);
  }

  // ---------- Task 221 ----------
  @Get('me/roadmap')
  mine(@CurrentUserId() userId: number) {
    return this.roadmap.getMyRoadmap(userId);
  }

  // ---------- Task 222 ----------
  @Post('me/roadmap')
  @HttpCode(HttpStatus.OK)
  save(@CurrentUserId() userId: number, @Body() dto: SaveRoadmapDto) {
    return this.roadmap.saveMyRoadmap(userId, dto);
  }

  // ---------- Task 223 ----------
  @Post('me/roadmap/ai')
  ai() {
    return this.roadmap.aiRoadmap();
  }

  // ---------- Task 224 ----------
  @Put('roadmap/:itemId')
  updateItem(
    @CurrentUserId() userId: number,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateRoadmapItemDto,
  ) {
    return this.roadmap.updateRoadmapItem(userId, itemId, dto);
  }
}
