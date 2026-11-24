import { Module } from '@nestjs/common';
import { LessonImportService } from './lesson-import.service';
import { CourseAdminService } from './course-admin.service';
import { CourseAdminController } from './course-admin.controller';

@Module({
  controllers: [CourseAdminController],
  providers: [CourseAdminService, LessonImportService],
  exports: [CourseAdminService],
})
export class CourseAdminModule {}
