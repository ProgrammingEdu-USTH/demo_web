import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseLevel, Prisma } from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import { TX_OPTIONS } from 'src/common/prisma-tx.options';

const VALID_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const VALID_LANGUAGES = [
  'python',
  'javascript',
  'java',
  'c',
  'c++',
  'csharp',
  'go',
  'rust',
  'sql',
] as const;

const SKILLS_CACHE_TTL_MS = 5 * 60 * 1000; // Task 96: cache 5 phút

/** Icon cố định theo course id (task 89). */
const COURSE_ICONS: Record<string, string> = {
  python: '🐍',
  python_advanced: '🐍',
  javascript: '📜',
  java: '☕',
  c: '🔧',
  'c++': '⚙️',
  sql: '🗄️',
  go: '🐹',
  rust: '🦀',
};

/**
 * Khoá học bằng Python Studio: trang khoá học cần biết CHÍNH XÁC bài số mấy đã
 * xong (mở khoá tuần tự), không chỉ tổng số bài — xem getEnrolled().
 */
export const STUDIO_COURSES = ['python', 'python_advanced'];

/**
 * Khoá chưa công khai (is_published = false) chỉ hiện với admin và người đã
 * ghi danh từ trước — người khác không thấy trong danh sách, không ghi danh được.
 */
function canSee(
  course: { id: string; isPublished: boolean },
  enrolledIds: Set<string>,
  role?: string,
): boolean {
  return course.isPublished || role === 'admin' || enrolledIds.has(course.id);
}

/** Trang bài học của từng khoá (khớp LESSON_URLS ở frontend/src/lib/curricula.json). */
const LESSON_URLS: Record<string, string> = {
  python: '/lesson/python',
  python_advanced: '/lesson/python_advanced',
  java: '/lesson/java',
  htmlcss: '/lesson/htmlcss',
  cpp: '/interface',
  db_design: '/lesson/db_design',
};

/** DB lưu enum tiếng Anh; card trên dashboard cần nhãn tiếng Việt. */
const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Cơ bản',
  intermediate: 'Trung cấp',
  advanced: 'Nâng cao',
};

/**
 * content_meta.image có phải giá trị do seed tự sinh (chưa ai tùy chỉnh) không?
 * Seed cũ ghi đúng `static/images/<id>.svg`; chỉ khi khớp y hệt chuỗi đó — hoặc
 * bỏ trống — ta mới thay bằng ảnh bìa mới, để không đè lên ảnh quản trị tự đặt.
 */
function isAutoImage(image: string | undefined, courseId: string): boolean {
  return !image || image === `static/images/${courseId}.svg`;
}

@Injectable()
export class CoursesService {
  private skillsCache: { data: unknown; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  // ---------- Task 87-88 ----------
  async listCourses(
    userId: number,
    q?: string,
    level?: string,
    language?: string,
    role?: string,
  ) {
    const where: Prisma.CourseWhereInput = {};
    const and: Prisma.CourseWhereInput[] = [];

    // Bước 1: search động trên nhiều cột.
    if (q?.trim()) {
      const term = q.trim();
      const lower = term.toLowerCase();

      // Case đặc biệt: 'c' và 'c++' — search ILIKE '%c%' sẽ khớp gần như mọi khoá.
      // Với 2 từ khoá này phải so khớp CHÍNH XÁC cột language/title.
      if (lower === 'c' || lower === 'c++') {
        and.push({
          OR: [
            { language: { equals: lower, mode: 'insensitive' } },
            { title: { equals: term, mode: 'insensitive' } },
          ],
        });
      } else {
        and.push({
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { language: { contains: term, mode: 'insensitive' } },
            { id: { contains: term, mode: 'insensitive' } },
          ],
        });
      }
    }

    // Bước 2: filter level + language theo danh sách cố định (giá trị lạ -> bỏ qua,
    // không ném lỗi, để FE gửi filter rỗng vẫn hoạt động).
    if (level && (VALID_LEVELS as readonly string[]).includes(level)) {
      and.push({ level: level as CourseLevel });
    }
    if (
      language &&
      (VALID_LANGUAGES as readonly string[]).includes(language.toLowerCase())
    ) {
      and.push({
        language: { equals: language.toLowerCase(), mode: 'insensitive' },
      });
    }
    if (and.length) where.AND = and;

    const [rawCourses, enrollments] = await Promise.all([
      this.prisma.course.findMany({ where, orderBy: { id: 'asc' } }),
      this.prisma.enrollment.findMany({
        where: { userId },
        select: { courseId: true },
      }),
    ]);

    const enrolledIds = new Set(enrollments.map((e) => e.courseId));
    const courses = rawCourses.filter((c) => canSee(c, enrolledIds, role));

    return {
      ok: true,
      courses: courses.map((c) => this.mapCourse(c, enrolledIds.has(c.id))),
    };
  }

  /**
   * Danh mục khoá học công khai cho trang chủ KHÁCH (chưa đăng nhập).
   * Chỉ khoá is_published = true và chỉ các trường danh mục: tuyệt đối không có
   * `enrolled`, tiến độ hay dữ liệu người dùng. Tách khỏi listCourses() để không
   * đổi hành vi /api/courses mà bản Django dùng chung DB vẫn dựa vào.
   */
  async listPublicCourses() {
    const rows = await this.prisma.course.findMany({
      where: { isPublished: true },
      orderBy: { id: 'asc' },
    });
    return {
      ok: true,
      courses: rows.map((c) => {
        const m = this.mapCourse(c, false);
        return {
          id: m.id,
          title: m.title,
          subtitle: m.subtitle,
          description: m.description,
          level: m.level,
          language: m.language,
          tag: m.tag,
          icon: m.icon,
          image: m.image,
          color: m.color,
          duration: m.duration,
          rating: m.rating,
          totalLessons: m.totalLessons,
        };
      }),
    };
  }

  // ---------- Task 89 ----------
  async getEnrolled(userId: number) {
    const rows = await this.prisma.enrollment.findMany({
      where: { userId },
      include: { course: true },
      orderBy: { enrolledAt: 'desc' },
    });

    const titles = await this.fetchLessonTitles(rows);
    const studioIds = rows
      .map((r) => r.courseId)
      .filter((id) => STUDIO_COURSES.includes(id));
    const studioCompleted = studioIds.length
      ? await this.prisma.lessonProgress.findMany({
          where: { userId, courseId: { in: studioIds }, status: 'completed' },
          select: { courseId: true, lesson: { select: { sortOrder: true } } },
        })
      : [];
    const studioLesson = await this.prisma.lesson.findFirst({
      where: { courseId: 'python', sortOrder: 11 },
      select: { xpReward: true },
    });
    return {
      ok: true,
      pythonStudio: {
        lessonNumber: 11,
        xpReward:
          studioLesson && studioLesson.xpReward > 0
            ? Math.min(studioLesson.xpReward, 500)
            : 50,
      },
      enrolled: rows.map((r) => ({
        ...this.mapEnrollment(r, titles),
        ...(STUDIO_COURSES.includes(r.courseId)
          ? {
              completedLessonNumbers: studioCompleted
                .filter((p) => p.courseId === r.courseId)
                .map((p) => p.lesson.sortOrder),
            }
          : {}),
      })),
    };
  }

  /**
   * "Tiếp tục học" cho dashboard: mỗi khoá đã đăng ký còn bài chưa xong -> bài kế
   * tiếp, sắp theo lần học gần nhất (completedAt lớn nhất; chưa học bài nào thì
   * dùng ngày đăng ký). Không thêm bảng/cột: dữ liệu đã có sẵn.
   */
  async getResume(userId: number) {
    const rows = await this.prisma.enrollment.findMany({
      where: { userId },
      include: { course: true },
    });
    if (!rows.length) return [];

    const ids = rows.map((r) => r.courseId);
    const progress = await this.prisma.lessonProgress.findMany({
      where: { userId, courseId: { in: ids } },
      select: {
        courseId: true,
        completedAt: true,
        status: true,
        lesson: { select: { sortOrder: true } },
      },
    });

    const items = rows.flatMap((r) => {
      const mine = progress.filter((p) => p.courseId === r.courseId);
      // Khoá Studio theo số thứ tự bài đã xong; khoá khác theo completedLessons.
      const doneNos = new Set(
        mine
          .filter((p) => p.status === 'completed')
          .map((p) => p.lesson.sortOrder),
      );
      let next = r.completedLessons + 1;
      if (STUDIO_COURSES.includes(r.courseId)) {
        next = 1;
        while (doneNos.has(next)) next++;
      }
      if (next > r.course.lessonCount) return [];
      const last = mine.reduce<Date>(
        (m, p) => (p.completedAt > m ? p.completedAt : m),
        r.enrolledAt,
      );
      return [{ r, next, last }];
    });
    if (!items.length) return [];

    const lessons = await this.prisma.lesson.findMany({
      where: {
        OR: items.map((i) => ({ courseId: i.r.courseId, sortOrder: i.next })),
      },
      select: { courseId: true, sortOrder: true, title: true },
    });
    const titleOf = new Map(
      lessons.map((l) => [`${l.courseId}:${l.sortOrder}`, l.title]),
    );

    return items
      .sort((a, b) => b.last.getTime() - a.last.getTime())
      .map(({ r, next }) => ({
        courseId: r.courseId,
        courseName: r.course.title,
        lessonNo: next,
        lessonTitle: titleOf.get(`${r.courseId}:${next}`) ?? `Bài ${next}`,
        lessonUrl: `${LESSON_URLS[r.courseId] ?? `/lesson/${r.courseId}`}?lesson=${next}`,
        percent: r.progress,
      }));
  }

  // ---------- Task 90 ----------
  async getCoursesEnrolled(userId: number, role?: string) {
    const [courses, rows] = await Promise.all([
      this.prisma.course.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.enrollment.findMany({
        where: { userId },
        include: { course: true },
        orderBy: { enrolledAt: 'desc' },
      }),
    ]);

    const enrolledIds = new Set(rows.map((r) => r.courseId));
    const titles = await this.fetchLessonTitles(rows);
    return {
      ok: true,
      courses: courses
        .filter((c) => canSee(c, enrolledIds, role))
        .map((c) => this.mapCourse(c, enrolledIds.has(c.id))),
      enrolled: rows.map((r) => this.mapEnrollment(r, titles)),
    };
  }

  // ---------- Task 91-92 ----------
  async enroll(userId: number, courseId: string, role?: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new NotFoundException('Không tìm thấy khoá học');
    // Khoá chưa công khai: chỉ admin (xem trước) và người đã ghi danh từ trước.
    // Cùng thông báo như khoá không tồn tại — không xác nhận là khoá có thật.
    if (!course.isPublished && role !== 'admin') {
      const already = await this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { userId: true },
      });
      if (!already) throw new NotFoundException('Không tìm thấy khoá học');
    }

    return this.prisma.$transaction(async (tx) => {
      // Bước 1: ON CONFLICT DO NOTHING — re-enroll không ghi đè dữ liệu cũ.
      await tx.enrollment.createMany({
        data: [{ userId, courseId, progress: 0, completedLessons: 0 }],
        skipDuplicates: true,
      });

      // Bước 2: tính LẠI tiến độ từ lesson_progress. Nếu bỏ bước này, user từng học
      // rồi unenroll → enroll lại sẽ thấy 0% dù lesson_progress vẫn còn nguyên.
      const stats = await this.recomputeProgress(
        tx,
        userId,
        courseId,
        course.lessonCount,
      );

      return { ok: true, ...stats };
    }, TX_OPTIONS);
  }

  // ---------- Task 93 ----------
  async unenroll(userId: number, courseId: string) {
    // CHỈ xoá enrollment — giữ lesson_progress để tiến độ còn nguyên khi học lại.
    await this.prisma.enrollment.deleteMany({ where: { userId, courseId } });
    return { ok: true };
  }

  // ---------- Task 94 ----------
  async rateCourse(userId: number, courseId: string, rating: number) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Đánh giá phải từ 1 đến 5 sao');
    }

    const enrolled = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrolled) {
      throw new ForbiddenException(
        'Bạn cần đăng ký khoá học trước khi đánh giá',
      );
    }

    // Ghi đánh giá + đồng bộ cột courses.rating trong CÙNG transaction.
    // Trước đây chỉ upsert vào course_ratings, trong khi mapCourse() đọc cột
    // tĩnh courses.rating -> user chấm 5 sao nhưng card khoá học vẫn hiện
    // điểm seed cũ mãi mãi.
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.courseRating.upsert({
        where: { userId_courseId: { userId, courseId } },
        create: { userId, courseId, rating },
        update: { rating },
      });

      const agg = await tx.courseRating.aggregate({
        where: { courseId },
        _avg: { rating: true },
        _count: { rating: true },
      });
      const average = agg._avg.rating
        ? Math.round(agg._avg.rating * 10) / 10
        : 0;

      await tx.course.update({
        where: { id: courseId },
        data: { rating: average },
      });

      return { average, count: agg._count.rating };
    }, TX_OPTIONS);

    return { ok: true, ...result };
  }

  // ---------- Task 95 ----------
  async getCourseRating(courseId: string) {
    const agg = await this.prisma.courseRating.aggregate({
      where: { courseId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
      count: agg._count.rating,
    };
  }

  // ---------- Task 96-97 ----------
  async getSkills(userId: number) {
    // Bước 1: cấu trúc lessons×courses gần như tĩnh -> cache 5 phút.
    const structure = await this.getSkillStructure();

    // Bước 2: tiến độ riêng từng user -> luôn query mới.
    const done = await this.prisma.lessonProgress.findMany({
      where: { userId, status: 'completed' },
      select: { lessonId: true },
    });
    const doneIds = new Set(done.map((d) => d.lessonId));

    const skills = structure.map((s) => {
      const completed = s.lessonIds.filter((id) => doneIds.has(id)).length;
      return {
        courseId: s.courseId,
        skill: s.module,
        total: s.lessonIds.length,
        completed,
        progress: s.lessonIds.length
          ? Math.round((completed / s.lessonIds.length) * 100)
          : 0,
      };
    });

    return { ok: true, skills };
  }

  // ---------- helpers ----------

  private async getSkillStructure() {
    if (this.skillsCache && this.skillsCache.expiresAt > Date.now()) {
      return this.skillsCache.data as Array<{
        courseId: string;
        module: string;
        lessonIds: number[];
      }>;
    }

    const lessons = await this.prisma.lesson.findMany({
      where: { module: { not: null } },
      select: { id: true, courseId: true, module: true, sortOrder: true },
      orderBy: [{ courseId: 'asc' }, { sortOrder: 'asc' }],
    });

    const grouped = new Map<
      string,
      { courseId: string; module: string; lessonIds: number[] }
    >();
    for (const l of lessons) {
      if (!l.module || l.module.trim() === '') continue; // module <> ''
      const key = `${l.courseId}::${l.module}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          courseId: l.courseId,
          module: l.module,
          lessonIds: [],
        });
      }
      grouped.get(key)!.lessonIds.push(l.id);
    }

    const data = [...grouped.values()];
    this.skillsCache = { data, expiresAt: Date.now() + SKILLS_CACHE_TTL_MS };
    return data;
  }

  /** Dùng chung bởi enroll() và completeLesson() — luôn tính lại từ lesson_progress. */
  async recomputeProgress(
    tx: Prisma.TransactionClient,
    userId: number,
    courseId: string,
    totalLessons: number,
  ) {
    // Chỉ đếm bài đang nằm trong giáo trình (sort_order 1..totalLessons). Khi
    // thay giáo trình (vd. khoá python chuyển sang PE v3 — scripts/seed-pe-v3.ts),
    // bài cũ được lưu trữ ở sort_order >= 1000 cùng lesson_progress của nó; nếu
    // đếm cả chúng thì học viên cũ hiện sẵn % hoàn thành của khoá mới.
    const completedLessons = await tx.lessonProgress.count({
      where: {
        userId,
        courseId,
        status: 'completed',
        lesson: { sortOrder: { gte: 1, lte: totalLessons } },
      },
    });

    const progress =
      totalLessons > 0
        ? Math.min(100, Math.round((completedLessons / totalLessons) * 100))
        : 0;

    await tx.enrollment.updateMany({
      where: { userId, courseId },
      data: { completedLessons, progress },
    });

    return { completedLessons, progress };
  }

  private mapCourse(
    c: {
      id: string;
      title: string | null;
      level: CourseLevel | null;
      rating: number;
      lessonCount: number;
      xp_reward: number;
      isPublished: boolean;
      language: string | null;
      accentColor: string | null;
      contentMeta?: Prisma.JsonValue;
    },
    enrolled: boolean,
  ) {
    // Trường mô tả (subtitle/description/duration/tag/image/color) không có cột
    // riêng — nằm trong content_meta (xem course-admin.module.ts). Trước đây
    // mapCourse() bỏ hẳn các trường này khỏi response, nên dashboard.js/main.js
    // vẽ card với ảnh vỡ (undefined) và text "undefined" ở mô tả/badge màu.
    const meta = (c.contentMeta ?? {}) as Record<string, string>;

    // Response dùng camelCase (Sheet 3: FE Next.js đang đọc đúng tên này).
    return {
      id: c.id,
      title: c.title,
      // DB lưu enum tiếng Anh; card hiện tiếng Việt như bản gốc.
      level: c.level ? (LEVEL_LABELS[c.level] ?? c.level) : null,
      rating: c.rating,
      totalLessons: c.lessonCount,
      xpReward: c.xp_reward,
      isPublished: c.isPublished,
      language: c.language,
      accentColor: c.accentColor,
      icon: COURSE_ICONS[c.id.toLowerCase()] ?? '📘',
      enrolled,
      // Trường hiển thị card — có fallback an toàn nếu content_meta trống.
      subtitle: meta.subtitle ?? '',
      description: meta.description ?? '',
      duration: meta.duration ?? '',
      tag: meta.tag ?? (c.language ?? '').toUpperCase(),
      // Ảnh bìa: từ 13/08/2026 mỗi khóa có ảnh thật (WebP) thay cho icon SVG
      // phẳng. Giá trị cũ trong content_meta do seed ghi theo ĐÚNG quy ước
      // `static/images/<id>.svg`, nên coi giá trị khớp y hệt quy ước đó là
      // "chưa ai tùy chỉnh" và trả về ảnh mới — nhờ vậy không phải ghi lại
      // cơ sở dữ liệu. Ảnh do quản trị đặt riêng (khác quy ước) vẫn giữ nguyên.
      image: isAutoImage(meta.image, c.id)
        ? `static/images/${c.id}.webp`
        : meta.image,
      color: meta.color ?? c.accentColor ?? '#3B82F6',
      students: '0',
      lessons: c.lessonCount,
    };
  }

  /**
   * Dựng thẻ "Khoá học của tôi" cho frontend.
   *
   * QUAN TRỌNG — hình dạng dữ liệu phải khớp ĐÚNG cái frontend đọc:
   * main.js renderMyCourses() dùng c.id, c.color, c.subtitle, c.duration,
   * c.lastLesson, c.nextLesson. Bản trước chỉ trả `courseId` (không có `id`) và
   * thiếu hẳn 5 trường kia, nên sau khi đăng ký thành công người dùng vẫn KHÔNG
   * vào học được: nút "Tiếp tục học" tra COURSE_URLS[undefined] nên không gắn
   * được sự kiện bấm, còn nút "Huỷ đăng ký" thì gọi với id 'undefined'.
   */
  private mapEnrollment(
    r: {
      courseId: string;
      progress: number;
      completedLessons: number;
      status: string | null;
      timeSpent: string | null;
      enrolledAt: Date;
      course: {
        title: string | null;
        lessonCount: number;
        accentColor: string | null;
        contentMeta?: Prisma.JsonValue;
      };
    },
    lessonTitles?: Map<string, string>,
  ) {
    const meta = (r.course.contentMeta ?? {}) as Record<string, string>;
    const done = r.completedLessons;

    return {
      // `id` là trường frontend thực sự dùng; giữ `courseId` cho client cũ.
      id: r.courseId,
      courseId: r.courseId,
      title: r.course.title,
      subtitle: meta.subtitle ?? '',
      duration: meta.duration ?? '',
      color: meta.color ?? r.course.accentColor ?? '#3B82F6',
      accentColor: r.course.accentColor ?? meta.color ?? '#3B82F6',
      // Cùng logic ảnh bìa với mapCourse() — /api/courses đã có ảnh thật từ
      // 13/08/2026 nhưng mapEnrollment() (nuôi /api/enrolled, tức "Bài học gần
      // đây" trên dashboard) bị bỏ sót nên card đó vẫn kẹt ở vân chéo CSS.
      image: isAutoImage(meta.image, r.courseId)
        ? `static/images/${r.courseId}.webp`
        : meta.image,
      progress: r.progress,
      completedLessons: done,
      totalLessons: r.course.lessonCount,
      // Cột time_spent cho phép NULL; trả chuỗi rỗng sẽ hiện "null" trên giao diện.
      timeSpent: r.timeSpent ?? '0h',
      status: r.status,
      icon: COURSE_ICONS[r.courseId.toLowerCase()] ?? '📘',
      lastLesson:
        done > 0
          ? (lessonTitles?.get(`${r.courseId}:${done}`) ?? `Bài ${done}`)
          : 'Chưa bắt đầu',
      nextLesson:
        done < r.course.lessonCount
          ? (lessonTitles?.get(`${r.courseId}:${done + 1}`) ??
            `Bài ${done + 1}`)
          : 'Đã hoàn thành khoá học',
      enrolledAt: r.enrolledAt,
    };
  }

  /**
   * Lấy tên bài vừa học xong và bài kế tiếp cho tất cả khoá đã đăng ký bằng
   * MỘT truy vấn duy nhất (thay vì 2 truy vấn cho mỗi khoá).
   */
  private async fetchLessonTitles(
    rows: Array<{ courseId: string; completedLessons: number }>,
  ): Promise<Map<string, string>> {
    if (!rows.length) return new Map();

    const or = rows.flatMap((r) => [
      { courseId: r.courseId, sortOrder: r.completedLessons },
      { courseId: r.courseId, sortOrder: r.completedLessons + 1 },
    ]);

    const lessons = await this.prisma.lesson.findMany({
      where: { OR: or },
      select: { courseId: true, sortOrder: true, title: true },
    });

    return new Map(
      lessons
        .filter((l) => l.title)
        .map((l) => [`${l.courseId}:${l.sortOrder}`, l.title as string]),
    );
  }
}
