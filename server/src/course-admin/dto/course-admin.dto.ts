import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { emptyToUndefined } from 'src/auth/dto/register.dto';
export { ARCHIVED_SORT_ORDER } from '../course-lesson-count';

/**
 * Bài có sort_order từ mốc này trở lên là bài LƯU TRỮ của giáo trình cũ —
 * scripts/seed-pe-v3.ts dời toàn bộ bài cũ của khoá python sang 1000 + số cũ để
 * giữ lesson_progress của học viên mà không lẫn vào giáo trình mới.
 */
/** Giá trị hợp lệ của enum course_level trong DB. */
export const COURSE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

const LEVEL_MESSAGE = 'Cấp độ phải là beginner, intermediate hoặc advanced';

/**
 * Các trường mô tả KHÔNG có cột riêng trong bảng courses (chỉ có id, title,
 * level, rating, lessons, instructor_id, xp_reward, is_published, content_meta,
 * language, accent_color). Chúng được gom vào cột JSONB content_meta — spec cấm
 * tuyệt đối việc chạy migration đổi cấu trúc DB dùng chung với bản Django.
 */
export const COURSE_META_FIELDS = [
  'subtitle',
  'description',
  'duration',
  'tag',
  'image',
  'color',
] as const;

/**
 * Form quản trị gửi 10 trường; DTO cũ chỉ khai 7 và dùng camelCase `accentColor`
 * trong khi form gửi `accent_color` -> forbidNonWhitelisted làm MỌI thao tác
 * thêm/sửa khoá học đều 400. Khai đủ theo đúng tên form gửi.
 */
export class CreateCourseDto {
  @IsString({ message: 'Thiếu mã khoá học' }) id!: string;
  @IsOptional() @IsString() title?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(COURSE_LEVELS, { message: LEVEL_MESSAGE })
  level?: string;

  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() accent_color?: string;
  /** Bí danh camelCase, giữ cho client cũ. */
  @IsOptional() @IsString() accentColor?: string;
  @IsOptional() @IsInt() xp_reward?: number;
  @IsOptional() @IsInt() instructorId?: number;

  @IsOptional() @IsString() subtitle?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() duration?: string;
  @IsOptional() @IsString() tag?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsString() color?: string;
}

export class UpdateCourseDto {
  /** Form PUT gửi kèm id trong body; chấp nhận rồi bỏ qua (id lấy từ URL). */
  @IsOptional() @IsString() id?: string;

  @IsOptional() @IsString() title?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(COURSE_LEVELS, { message: LEVEL_MESSAGE })
  level?: string;

  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() accent_color?: string;
  @IsOptional() @IsString() accentColor?: string;
  @IsOptional() @IsInt() xp_reward?: number;

  @IsOptional() @IsString() subtitle?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() duration?: string;
  @IsOptional() @IsString() tag?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsString() color?: string;
}

export class CreateLessonDto {
  @IsString({ message: 'Thiếu mã khoá học' }) course_id!: string;
  @IsInt({ message: 'Thiếu thứ tự bài học' }) sort_order!: number;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() module?: string;
  /** Nội dung bài giảng -> lưu vào cột content_json (bảng không có cột `content`). */
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() lesson_code?: string;
  @IsOptional() @IsInt() xp_reward?: number;
}

export class UpdateLessonDto {
  /** Form PUT gửi kèm course_id; chấp nhận rồi bỏ qua (bài học không đổi khoá). */
  @IsOptional() @IsString() course_id?: string;

  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() module?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() lesson_code?: string;
  @IsOptional()
  @IsInt({ message: 'Thứ tự bài học phải là số' })
  sort_order?: number;
  @IsOptional() @IsInt() xp_reward?: number;
}
