import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from 'src/common/guards/admin/admin.guard';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { LessonImportService } from './lesson-import.service';
import {
  CreateCourseDto,
  CreateLessonDto,
  UpdateCourseDto,
  UpdateLessonDto,
} from './dto/course-admin.dto';
import { CourseAdminService } from './course-admin.service';

// ---------- Task 225: AdminGuard áp cho TOÀN BỘ route trong module ----------
@Controller('admin')
@UseGuards(AdminGuard)
export class CourseAdminController {
  constructor(
    private readonly admin: CourseAdminService,
    private readonly importer: LessonImportService,
  ) {}

  /**
   * Đọc một file .md/.pdf và trả BẢN NHÁP studio-lesson/v1 — KHÔNG ghi DB.
   * Admin xem lại rồi mới lưu qua POST admin/lessons như bình thường.
   */
  @Post('lessons/import')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      // Giáo trình một bài hiếm khi quá 8 MB; chặn ở đây để không nuốt nguyên
      // file lớn vào RAM rồi mới từ chối.
      limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    }),
  )
  importLesson(
    @UploadedFile()
    file?: {
      originalname: string;
      buffer: Buffer;
      mimetype?: string;
    },
  ) {
    if (!file) throw new BadRequestException('Chưa chọn file để nhập');
    return this.importer.importFile(file);
  }

  @Get('courses') // Task 234
  listCourses() {
    return this.admin.listCourses();
  }

  @Post('courses') // Task 235
  @HttpCode(HttpStatus.OK)
  createCourse(@Body() dto: CreateCourseDto, @CurrentUserId() userId: number) {
    return this.admin.createCourse(dto, userId);
  }

  @Put('courses/:id') // Task 236
  updateCourse(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.admin.updateCourse(id, dto);
  }

  @Delete('courses/:id') // Task 237
  @HttpCode(HttpStatus.OK)
  deleteCourse(@Param('id') id: string) {
    return this.admin.deleteCourse(id);
  }

  @Get('courses/:id/lessons') // Task 238
  listLessons(@Param('id') id: string) {
    return this.admin.listLessonsByCourse(id);
  }

  @Post('lessons') // Task 239
  @HttpCode(HttpStatus.OK)
  createLesson(@Body() dto: CreateLessonDto) {
    return this.admin.createLesson(dto);
  }

  @Put('lessons/:id') // Task 240
  updateLesson(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.admin.updateLesson(id, dto);
  }

  @Delete('lessons/:id') // Task 241
  @HttpCode(HttpStatus.OK)
  deleteLesson(@Param('id', ParseIntPipe) id: number) {
    return this.admin.deleteLesson(id);
  }
}
