import { lockCourseEnrollment } from 'src/common/lock-course-enrollment';
import { cacheVersion } from 'src/api-gateway/http-cache';
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
export const STUDIO_COURSES = ['python_advanced'];

/** DB lưu enum tiếng Anh; card trên dashboard cần nhãn tiếng Việt. */
/**
 * Đúng các cột `mapCourse()` đọc. Bảng courses không có cột nào lớn ngoài
 * `content_meta` (mà card vẫn cần), nên đây là để KHÔNG kéo thêm cột mới nào
 * vào đường nóng mỗi khi bảng được thêm cột, chứ không phải để bớt byte hôm nay.
 */
const COURSE_CARD_SELECT = {
  id: true,
  title: true,
  level: true,
  rating: true,
  lessonCount: true,
  xp_reward: true,
  isPublished: true,
  language: true,
  accentColor: true,
  contentMeta: true,
} satisfies Prisma.CourseSelect;

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
  ) {
    const where: Prisma.CourseWhereInput = {};
    const and: Prisma.CourseWhereInput[] = [];

    // Bước 0: cột courses.is_published có từ đầu nhưng CHƯA từng được dùng để
    // lọc — khoá seed với is_published = false (vd. python_advanced, xem
    // scripts/seed-python-advanced.ts) vẫn nằm trên trang khám phá và ai cũng
    // đăng ký được. Học viên thường chỉ thấy khoá đã phát hành; quản trị viên
    // thấy tất cả để xem trước bản nháp trước khi mở cho học viên.
    if (!(await this.isAdmin(userId))) {
      and.push({ isPublished: true });
    }

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

    const [courses, enrollments] = await Promise.all([
      this.prisma.course.findMany({ where, orderBy: { id: 'asc' } }),
      this.prisma.enrollment.findMany({
        where: { userId },
        select: { courseId: true },
      }),
    ]);

    const enrolledIds = new Set(enrollments.map((e) => e.courseId));

    return {
      ok: true,
      courses: courses.map((c) => this.mapCourse(c, enrolledIds.has(c.id))),
    };
  }

  /** Danh mục không mang ghi danh/tiến độ; giữ bộ lọc và quyền xem khoá nháp. */
  async getCatalog(
    userId: number,
    q?: string,
    level?: string,
    language?: string,
  ) {
    const result = await this.listCourses(userId, q, level, language);
    const courses = result.courses.map(({ enrolled, ...course }) => {
      void enrolled;
      return course;
    });
    // Chỉ băm các trường thẻ khoá nhỏ, không băm content_json bài học.
    return cacheVersion({ ok: true, courses }, courses);
  }

  // ---------- Task 89 ----------
  /**
   * Nuôi "Khoá học của tôi" và mọi chỗ frontend cần tiến độ (mở bài, dashboard,
   * luyện tập…), nên đây là route gọi nhiều nhất.
   *
   * Bản cũ đi 5 vòng DB nối đuôi (đo trong BE1): enrollments → courses (của
   * `include`) → tên bài → lesson_progress → lessons.sort_order (của quan hệ
   * lồng). Nay là HAI câu chạy song song, tức một vòng: `docGhiDanh()` gộp ba
   * vòng đầu bằng JOIN, `docBaiStudioDaXong()` gộp hai vòng cuối. Câu thứ hai
   * không cần chờ câu đầu vì nó lọc theo hằng `STUDIO_COURSES`, không theo
   * danh sách ghi danh.
   */
  async getEnrolled(userId: number) {
    const [rows, studioDone] = await Promise.all([
      this.docGhiDanh(userId),
      this.docBaiStudioDaXong(userId),
    ]);

    // Trước đây chỗ này còn truy vấn `lessons` của khoá 'python' bài 11 để trả
    // thêm field `pythonStudio` cho card trên dashboard cũ. Khoá 'python' đã
    // được gỡ (chỉ còn python_advanced) và không client nào đọc field đó nữa —
    // giữ lại chỉ là thêm một vòng gọi Neon (~237ms) trên đường nóng của mọi
    // lần mở bài học, để lấy về null.
    return {
      ok: true,
      enrolled: rows.map((r) => ({
        ...this.mapEnrollment(r),
        // Chỉ khoá studio ĐÃ ghi danh mới có field này: `studioDone` lấy theo
        // hằng `STUDIO_COURSES` nên có thể chứa tiến độ của khoá đã huỷ ghi danh.
        ...(STUDIO_COURSES.includes(r.courseId)
          ? {
              completedLessonNumbers: studioDone
                .filter((p) => p.courseId === r.courseId)
                .map((p) => p.sortOrder),
            }
          : {}),
      })),
    };
  }

  // ---------- Task 90 ----------
  async getCoursesEnrolled(userId: number) {
    // Khác listCourses() một chút: endpoint này nuôi cả trang "Khoá học của
    // tôi", nên ngoài khoá đã phát hành còn phải giữ khoá mà CHÍNH user này đã
    // ghi danh. Nếu lọc cứng is_published = true, học viên đang học một khoá bị
    // ẩn sẽ thấy khoá đó biến mất khỏi danh sách và không vào học được nữa —
    // chỉ việc KHÁM PHÁ bị chặn, không phải việc học đang dở.
    const visible: Prisma.CourseWhereInput | undefined = (await this.isAdmin(
      userId,
    ))
      ? undefined
      : { OR: [{ isPublished: true }, { enrollments: { some: { userId } } }] };

    const [courses, rows] = await Promise.all([
      this.prisma.course.findMany({
        where: visible,
        orderBy: { id: 'asc' },
        select: COURSE_CARD_SELECT,
      }),
      this.docGhiDanh(userId),
    ]);

    const enrolledIds = new Set(rows.map((r) => r.courseId));
    return {
      ok: true,
      courses: courses.map((c) => this.mapCourse(c, enrolledIds.has(c.id))),
      enrolled: rows.map((r) => this.mapEnrollment(r)),
    };
  }

  // ---------- Task 91-92 ----------
  async enroll(userId: number, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new NotFoundException('Không tìm thấy khoá học');

    // Khoá chưa phát hành không được nhận ghi danh MỚI: trước đây enroll() bỏ
    // qua hẳn is_published nên bất kỳ ai biết mã khoá (python_advanced) đều
    // đăng ký được vào bản nháp.
    //
    // Chỉ chặn người CHƯA ghi danh. Học viên đã ghi danh từ trước khi khoá bị
    // ẩn vẫn gọi lại enroll() được, vì endpoint này đồng thời tính lại tiến độ
    // (recomputeProgress) — chặn họ ở đây là cắt luôn đường học tiếp.
    if (!course.isPublished) {
      const existing = await this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { userId: true },
      });
      if (!existing && !(await this.isAdmin(userId))) {
        throw new ForbiddenException('Khoá học này chưa được phát hành');
      }
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

  /** Chỉ reset khi người học chủ động yêu cầu; lưu lịch sử trước khi xoá. */
  async reset(userId: number, courseId: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockCourseEnrollment(tx, userId, courseId);
      const resetAt = new Date();
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO lesson_progress_archive
          (user_id, lesson_id, course_id, status, quiz_score, xp_earned, completed_at, archived_at)
        SELECT user_id, lesson_id, course_id, status, quiz_score, xp_earned, completed_at, ${resetAt}
        FROM lesson_progress WHERE user_id = ${userId} AND course_id = ${courseId}
      `);
      await tx.lessonProgress.deleteMany({ where: { userId, courseId } });
      await tx.enrollment.update({
        where: { userId_courseId: { userId, courseId } },
        data: { completedLessons: 0, progress: 0, resetAt },
      });
      return {
        ok: true,
        completedLessons: 0,
        progress: 0,
        reset_at: resetAt.toISOString(),
      };
    }, TX_OPTIONS);
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

    // Bước 3: bảng kỹ năng dựng từ lessons của MỌI khoá, nên nó cũng là một
    // đường khám phá: khoá nháp bị lộ cả mã khoá lẫn tên module (0%). Lọc ở
    // đây thay vì trong getSkillStructure() vì structure được cache 5 phút và
    // dùng chung cho mọi user — cờ is_published phải đọc tươi theo từng request.
    // Vẫn giữ khoá mà user đã ghi danh, để tiến độ của học viên đang học một
    // khoá bị ẩn không bốc hơi khỏi bảng kỹ năng.
    const visibleIds = (await this.isAdmin(userId))
      ? null
      : new Set(
          (
            await this.prisma.course.findMany({
              where: {
                OR: [
                  { isPublished: true },
                  { enrollments: { some: { userId } } },
                ],
              },
              select: { id: true },
            })
          ).map((c) => c.id),
        );

    const skills = structure
      .filter((s) => !visibleIds || visibleIds.has(s.courseId))
      .map((s) => {
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

  /**
   * Người xem có phải quản trị viên không?
   *
   * Đọc cột users.role y như lessons.service.ts#getLessonContent (và cùng một
   * khái niệm role = 'admin' mà AdminGuard dùng) — KHÔNG tự bày ra cơ chế
   * quyền mới. Phải truy vấn DB vì các service ở đây chỉ nhận userId từ
   * @CurrentUserId(), không thấy payload JWT.
   */
  private async isAdmin(userId: number): Promise<boolean> {
    const viewer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return viewer?.role === 'admin';
  }

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
    // COUNT và UPDATE cùng một câu, bớt một vòng giữ connection. CTE vẫn trả
    // thống kê khi ghi danh vừa bị huỷ (hành vi cũ của hàm dùng chung này).
    // Tỷ lệ không âm nên ROUND(numeric) khớp Math.round, kể cả đúng nửa điểm.
    const [stats] = await tx.$queryRaw<
      { completedLessons: number; progress: number }[]
    >(Prisma.sql`
      WITH stats AS (
        SELECT count(*)::int AS n FROM lesson_progress p
        JOIN lessons l ON l.id = p.lesson_id
        WHERE p.user_id = ${userId} AND p.course_id = ${courseId}
          AND p.status = 'completed' AND l.sort_order BETWEEN 1 AND ${totalLessons}
      ), result AS (
        SELECT n AS "completedLessons",
          CASE WHEN ${totalLessons} > 0
            THEN LEAST(100, ROUND(n * 100.0 / ${totalLessons}))::int
            ELSE 0 END AS progress FROM stats
      ), updated AS (
        UPDATE enrollments e
        SET completed_lessons = r."completedLessons", progress = r.progress
        FROM result r WHERE e.user_id = ${userId} AND e.course_id = ${courseId}
        RETURNING e.user_id
      ) SELECT "completedLessons", progress FROM result
    `);
    return stats;
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
  private mapEnrollment(r: {
    courseId: string;
    progress: number;
    completedLessons: number;
    status: string | null;
    timeSpent: string | null;
    enrolledAt: Date;
    resetAt?: Date | null;
    course: {
      title: string | null;
      lessonCount: number;
      accentColor: string | null;
      contentMeta?: Prisma.JsonValue;
    };
    baiVuaXong: string | null;
    baiKe: string | null;
  }) {
    const meta = (r.course.contentMeta ?? {}) as Record<string, string>;
    const done = r.completedLessons;

    return {
      // `id` là trường frontend thực sự dùng; giữ `courseId` cho client cũ.
      id: r.courseId,
      courseId: r.courseId,
      reset_at: r.resetAt?.toISOString() ?? null,
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
      // `||` chứ không `??`: tên bài là chuỗi RỖNG cũng phải rơi về "Bài n",
      // đúng như bản cũ lọc `l.title` trước khi đưa vào bảng tra.
      lastLesson: done > 0 ? r.baiVuaXong || `Bài ${done}` : 'Chưa bắt đầu',
      nextLesson:
        done < r.course.lessonCount
          ? r.baiKe || `Bài ${done + 1}`
          : 'Đã hoàn thành khoá học',
      enrolledAt: r.enrolledAt,
    };
  }

  /**
   * Mọi khoá user đã ghi danh, kèm cột khoá mà `mapEnrollment()` đọc và tên bài
   * vừa xong / bài kế — trong MỘT câu SQL, MỘT vòng tới Neon.
   *
   * Thay cho `enrollment.findMany({ include: { course: true } })` (hai vòng, vì
   * Prisma đọc quan hệ bằng một câu riêng) cộng `fetchLessonTitles()` (vòng
   * thứ ba, phải chờ kết quả hai vòng trước). Tên bài tra theo
   * `(course_id, sort_order)`, có unique `uq_lessons_course_sort` nên mỗi LEFT
   * JOIN ra tối đa một hàng.
   *
   * KHÔNG lọc `is_published`: học viên đã ghi danh vẫn phải thấy khoá dù khoá
   * sau đó bị ẩn (xem getCoursesEnrolled()).
   */
  private async docGhiDanh(userId: number) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        courseId: string;
        progress: number;
        completedLessons: number;
        status: string | null;
        timeSpent: string | null;
        enrolledAt: Date;
        resetAt?: Date | null;
        title: string | null;
        lessonCount: number;
        accentColor: string | null;
        contentMeta: Prisma.JsonValue;
        baiVuaXong: string | null;
        baiKe: string | null;
      }>
    >(Prisma.sql`
      SELECT e.course_id AS "courseId", e.progress,
             e.completed_lessons AS "completedLessons", e.status,
             e.time_spent AS "timeSpent", e.enrolled_at AS "enrolledAt",
             e.reset_at AS "resetAt",
             c.title, c.lessons AS "lessonCount",
             c.accent_color AS "accentColor", c.content_meta AS "contentMeta",
             lv.title AS "baiVuaXong", lk.title AS "baiKe"
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      LEFT JOIN lessons lv
        ON lv.course_id = e.course_id AND lv.sort_order = e.completed_lessons
      LEFT JOIN lessons lk
        ON lk.course_id = e.course_id AND lk.sort_order = e.completed_lessons + 1
      WHERE e.user_id = ${userId}
      ORDER BY e.enrolled_at DESC
    `);

    return rows.map(
      ({ title, lessonCount, accentColor, contentMeta, ...r }) => ({
        ...r,
        course: { title, lessonCount, accentColor, contentMeta },
      }),
    );
  }

  /**
   * `sort_order` của các bài ĐÃ XONG ở khoá studio — frontend mở khoá bài theo
   * đúng danh sách này, không theo tổng số bài.
   *
   * Thay cho `lessonProgress.findMany` kèm quan hệ lồng `lesson.sortOrder`
   * (hai vòng, và vòng thứ hai vẫn chạy với `IN (NULL)` khi chưa xong bài nào).
   */
  private docBaiStudioDaXong(userId: number) {
    return this.prisma.$queryRaw<
      Array<{ courseId: string; sortOrder: number }>
    >(
      Prisma.sql`
        SELECT lp.course_id AS "courseId", l.sort_order AS "sortOrder"
        FROM lesson_progress lp
        JOIN lessons l ON l.id = lp.lesson_id
        WHERE lp.user_id = ${userId}
          AND lp.course_id = ANY(${STUDIO_COURSES}::text[])
          AND lp.status = 'completed'
        ORDER BY l.sort_order
      `,
    );
  }
}
