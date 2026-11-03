import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { IsInt, IsString, Max, Min } from 'class-validator';
import {
  CurrentUser,
  CurrentUserId,
} from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/public.decorators';
import { CoursesService } from './courses.service';

export class RateCourseDto {
  @IsString({ message: 'Thiếu mã khoá học' })
  course_id!: string;

  @IsInt({ message: 'Đánh giá phải từ 1 đến 5 sao' })
  @Min(1, { message: 'Đánh giá phải từ 1 đến 5 sao' })
  @Max(5, { message: 'Đánh giá phải từ 1 đến 5 sao' })
  rating!: number;
}

@Controller()
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  // ---------- Task 98 ----------
  @Get('courses')
  list(
    @CurrentUserId() userId: number,
    @CurrentUser('role') role: string | undefined,
    @Query('q') q?: string,
    @Query('level') level?: string,
    @Query('language') language?: string,
  ) {
    return this.courses.listCourses(userId, q, level, language, role);
  }

  // ---------- Task 99 ----------
  @Get('enrolled')
  enrolled(@CurrentUserId() userId: number) {
    return this.courses.getEnrolled(userId);
  }

  // ---------- Task 100 ----------
  @Get('courses-enrolled')
  coursesEnrolled(
    @CurrentUserId() userId: number,
    @CurrentUser('role') role: string | undefined,
  ) {
    return this.courses.getCoursesEnrolled(userId, role);
  }

  // ---------- Task 101 ----------
  @Post('courses/:id/enroll')
  @HttpCode(HttpStatus.OK)
  enroll(
    @CurrentUserId() userId: number,
    @CurrentUser('role') role: string | undefined,
    @Param('id') courseId: string,
  ) {
    return this.courses.enroll(userId, courseId, role);
  }

  // ---------- Task 102 ----------
  @Delete('courses/:id/enroll')
  @HttpCode(HttpStatus.OK)
  unenroll(@CurrentUserId() userId: number, @Param('id') courseId: string) {
    return this.courses.unenroll(userId, courseId);
  }

  // ---------- Task 103 ----------
  @Post('course/rating')
  @HttpCode(HttpStatus.OK)
  rate(@CurrentUserId() userId: number, @Body() dto: RateCourseDto) {
    return this.courses.rateCourse(userId, dto.course_id, dto.rating);
  }

  // ---------- Task 104 ----------
  @Get('course/:id/rating')
  rating(@Param('id') courseId: string) {
    return this.courses.getCourseRating(courseId);
  }

  // ---------- Task 105 ----------
  @Get('skills')
  skills(@CurrentUserId() userId: number) {
    return this.courses.getSkills(userId);
  }
}

/**
 * Danh mục khoá học công khai cho trang chủ khách. @Public() vì JwtAuthGuard là
 * APP_GUARD toàn cục; throttler IP vẫn áp dụng để chống cào.
 */
@Controller('public/courses')
@Public()
export class PublicCoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  list() {
    return this.courses.listPublicCourses();
  }
}

/** Dữ liệu riêng của người dùng đang đăng nhập (JWT guard toàn cục). */
@Controller('me')
export class MeController {
  constructor(private readonly courses: CoursesService) {}

  @Get('resume')
  resume(@CurrentUserId() userId: number) {
    return this.courses.getResume(userId);
  }
}
