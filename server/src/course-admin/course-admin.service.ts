import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseLevel, Prisma } from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  COURSE_META_FIELDS,
  CreateCourseDto,
  CreateLessonDto,
  UpdateCourseDto,
  UpdateLessonDto,
} from './dto/course-admin.dto';
import { ACTIVE_LESSON_SORT_ORDER } from './course-lesson-count';

/**
 * Gom các trường mô tả (không có cột riêng) thành object cho content_meta.
 * Trả null nếu request không gửi trường nào -> giữ nguyên content_meta cũ.
 */
function pickCourseMeta(
  dto: CreateCourseDto | UpdateCourseDto,
): Record<string, string> | null {
  const meta: Record<string, string> = {};
  for (const key of COURSE_META_FIELDS) {
    const value = (dto as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim() !== '') {
      meta[key] = value;
    }
  }
  return Object.keys(meta).length ? meta : null;
}

/**
 * Nội dung bài giảng từ ô textarea -> content_json.
 * Nếu admin dán JSON hợp lệ thì lưu nguyên cấu trúc (để tương thích với dạng
 * {step_1, step_2:{mcq:[...]}} mà QuizzesModule đọc khi sinh quiz ôn tập);
 * còn lại bọc thành {text} để không mất dữ liệu. Trả null = không đổi.
 */
function parseLessonContent(content?: string): Prisma.InputJsonValue | null {
  if (content === undefined) return null;
  const trimmed = content.trim();
  if (trimmed === '') return null;

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as Prisma.InputJsonValue;
    } catch {
      // Không phải JSON hợp lệ -> rơi xuống nhánh bọc text bên dưới.
    }
  }
  return { text: trimmed };
}

@Injectable()
export class CourseAdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Task 226 ----------
  async listCourses() {
    const courses = await this.prisma.course.findMany({
      orderBy: { id: 'asc' },
    });
    return { ok: true, courses };
  }

  // ---------- Task 227 ----------
  async createCourse(dto: CreateCourseDto, creatorId: number) {
    // id do người tạo tự đặt -> phải check trùng TRƯỚC, tránh lỗi 500 từ DB.
    const existed = await this.prisma.course.findUnique({
      where: { id: dto.id },
    });
    if (existed) throw new ConflictException('Mã khoá học đã tồn tại');

    const meta = pickCourseMeta(dto);

    const course = await this.prisma.course.create({
      data: {
        id: dto.id,
        title: dto.title ?? null,
        level: (dto.level as CourseLevel) ?? null,
        language: dto.language ?? null,
        accentColor: dto.accent_color ?? dto.accentColor ?? null,
        rating: 0,
        lessonCount: 0,
        // Mặc định instructor = admin đang tạo khoá (trước đây hardcode id 1 —
        // nổ FK trên DB không có user 1, hoặc gán nhầm giảng viên).
        instructorId: dto.instructorId ?? creatorId,
        xp_reward: dto.xp_reward ?? 0,
        ...(meta ? { contentMeta: meta } : {}),
      },
    });
    return { ok: true, course };
  }

  // ---------- Task 228 ----------
  async updateCourse(id: string, dto: UpdateCourseDto) {
    await this.requireCourse(id);

    // SET động: chỉ cập nhật field CÓ trong body, không ghi đè field vắng mặt
    // thành null (đây là điểm khác biệt giữa PUT ngây thơ và PATCH đúng nghĩa).
    const data: Prisma.CourseUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.level !== undefined) data.level = dto.level as CourseLevel;
    if (dto.language !== undefined) data.language = dto.language;
    const accent = dto.accent_color ?? dto.accentColor;
    if (accent !== undefined) data.accentColor = accent;
    if (dto.xp_reward !== undefined) data.xp_reward = dto.xp_reward;

    // Trường mô tả không có cột riêng -> gộp vào content_meta, hợp nhất với giá
    // trị cũ để không xoá mất khoá mà lần cập nhật này không gửi.
    const meta = pickCourseMeta(dto);
    if (meta) {
      const current = await this.prisma.course.findUnique({
        where: { id },
        select: { contentMeta: true },
      });
      const merged = {
        ...((current?.contentMeta as Record<string, unknown>) ?? {}),
        ...meta,
      };
      data.contentMeta = merged as Prisma.InputJsonValue;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Không có trường nào để cập nhật');
    }

    const course = await this.prisma.course.update({ where: { id }, data });
    return { ok: true, course };
  }

  // ---------- Task 229 ----------
  async deleteCourse(id: string) {
    await this.requireCourse(id);

    const enrolled = await this.prisma.enrollment.count({
      where: { courseId: id },
    });
    if (enrolled > 0) {
      throw new ConflictException(
        `Không thể xoá: còn ${enrolled} lượt đăng ký trong khoá học này`,
      );
    }

    // Xoá dữ liệu phụ thuộc theo ĐÚNG thứ tự khoá ngoại trước khi xoá khoá —
    // khoá từng có học viên vẫn còn lesson_progress (unenroll cố ý giữ lại),
    // course_ratings, missions, quizzes... nên xoá thẳng course sẽ nổ P2003.
    // Xoá TƯỜNG MINH, không dựa vào onDelete: Cascade trong schema: DB thật
    // dùng chung với bản Django nên có thể không có CASCADE.
    await this.prisma.$transaction(async (tx) => {
      await tx.reviewQuizResult.deleteMany({
        where: { quiz: { courseId: id } },
      });
      await tx.quiz.deleteMany({ where: { courseId: id } });
      await tx.lessonProgress.deleteMany({ where: { courseId: id } });
      await tx.courseRating.deleteMany({ where: { courseId: id } });
      await tx.mission.deleteMany({ where: { courseId: id } });
      await tx.lesson.deleteMany({ where: { courseId: id } });
      await tx.course.delete({ where: { id } });
    });

    return { ok: true };
  }

  // ---------- Task 230 ----------
  async listLessonsByCourse(courseId: string) {
    await this.requireCourse(courseId);
    const lessons = await this.prisma.lesson.findMany({
      where: { courseId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return { ok: true, lessons };
  }

  // ---------- Task 231 ----------
  async createLesson(dto: CreateLessonDto) {
    await this.requireCourse(dto.course_id);

    const lesson = await this.prisma.lesson.create({
      data: {
        courseId: dto.course_id,
        sortOrder: dto.sort_order,
        title: dto.title ?? null,
        module: dto.module ?? null,
        lessonCode: dto.lesson_code ?? null,
        xpReward: dto.xp_reward ?? 0,
        // Bảng lessons không có cột `content` — nội dung vào content_json.
        ...(parseLessonContent(dto.content) !== null
          ? { contentJson: parseLessonContent(dto.content)! }
          : {}),
      },
    });

    await this.syncLessonCount(dto.course_id);
    return { ok: true, lesson };
  }

  // ---------- Task 232 ----------
  async updateLesson(id: number, dto: UpdateLessonDto) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học');

    const data: Prisma.LessonUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.module !== undefined) data.module = dto.module;
    if (dto.lesson_code !== undefined) data.lessonCode = dto.lesson_code;
    if (dto.sort_order !== undefined) data.sortOrder = dto.sort_order;
    if (dto.xp_reward !== undefined) data.xpReward = dto.xp_reward;
    const content = parseLessonContent(dto.content);
    if (content !== null) data.contentJson = content;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Không có trường nào để cập nhật');
    }

    const updated = await this.prisma.lesson.update({ where: { id }, data });
    await this.syncLessonCount(lesson.courseId);
    return { ok: true, lesson: updated };
  }

  // ---------- Task 233 ----------
  async deleteLesson(id: number) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học');

    await this.prisma.$transaction(async (tx) => {
      await tx.lessonProgress.deleteMany({ where: { lessonId: id } });
      await tx.lesson.delete({ where: { id } });
    });

    await this.syncLessonCount(lesson.courseId);
    return { ok: true };
  }

  /**
   * Đồng bộ courses.lessons = số bài ĐANG HOẠT ĐỘNG sau mọi thay đổi bài học.
   * Bài lưu trữ của giáo trình cũ (sort_order >= ARCHIVED_SORT_ORDER) chỉ còn
   * để giữ lịch sử học, không tính vào số bài của khoá.
   */
  private async syncLessonCount(courseId: string) {
    const lessonCount = await this.prisma.lesson.count({
      where: { courseId, sortOrder: ACTIVE_LESSON_SORT_ORDER },
    });
    await this.prisma.course.update({
      where: { id: courseId },
      data: { lessonCount },
    });
  }

  private async requireCourse(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Không tìm thấy khoá học');
    return course;
  }
}
