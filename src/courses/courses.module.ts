import { Module } from '@nestjs/common';
import {
  CoursesController,
  MeController,
  PublicCoursesController,
} from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  controllers: [CoursesController, MeController, PublicCoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
