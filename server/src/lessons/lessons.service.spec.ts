import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { StreakService } from 'src/common/streak/streak.service';
import { AchievementsService } from 'src/achievements/achievements.service';
import { CoursesService } from 'src/courses/courses.service';
import { LessonsService, scaledXp } from './lessons.service';

/**
 * Một hàm Prisma giả. `Promise<unknown>` cho giá trị TRẢ VỀ là đủ (mỗi ca tự
 * `mockResolvedValue()` hình dạng nó cần); phần ĐỐI SỐ mới là chỗ cần kiểu thật
 * vì test đọc lại `mock.calls` để chứng minh "XP do SERVER quyết".
 *
 * Trước đây `prisma` khai `any`: `mock.calls[0][0].data.xp.increment` cũng là
 * `any`, nên gõ sai đường dẫn (`.data.xp.inc`) vẫn biên dịch được và chỉ so
 * `undefined` với 50 — test đỏ ở chỗ khó hiểu, hoặc tệ hơn là xanh vô nghĩa.
 */
type AsyncMock<A extends unknown[] = unknown[]> = jest.Mock<
  Promise<unknown>,
  A
>;

const asyncMock = <A extends unknown[] = unknown[]>(): AsyncMock<A> =>
  jest.fn<Promise<unknown>, A>();

/** Đối số `prisma.user.update()` ở nhánh cộng XP. */
type UserUpdateArg = {
  data: { xp: { increment: number }; gems: { increment: number } };
};

/** Đối số `userDailyXpLog.upsert()` — xem src/common/xp/daily-xp-log.ts. */
type DailyXpUpsertArg = {
  where: { userId_logDate: { userId: number; logDate: Date } };
  update: { xpEarned: { increment: number } };
  create: { userId: number; logDate: Date; xpEarned: number };
};

type PrismaMock = {
  $queryRaw: AsyncMock;
  lessonProgressArchive: { findFirst: AsyncMock };
  course: { findUnique: AsyncMock };
  enrollment: { findUnique: AsyncMock };
  lesson: { findFirst: AsyncMock; create: AsyncMock };
  lessonProgress: {
    createMany: AsyncMock;
    updateMany: AsyncMock;
    count: AsyncMock;
  };
  user: { findUnique: AsyncMock; update: AsyncMock<[UserUpdateArg]> };
  userDailyXpLog: { upsert: AsyncMock<[DailyXpUpsertArg]> };
  $transaction: AsyncMock<[(tx: PrismaMock) => Promise<unknown>]>;
};

/** Chỉ hàm của CoursesService mà completeLesson() gọi tới. */
type CoursesMock = { recomputeProgress: AsyncMock };

describe('LessonsService.completeLesson', () => {
  let service: LessonsService;
  let prisma: PrismaMock;
  let courses: CoursesMock;

  beforeEach(async () => {
    prisma = {
      $queryRaw: asyncMock().mockResolvedValue([{ user_id: 1 }]),
      lessonProgressArchive: { findFirst: asyncMock().mockResolvedValue(null) },
      course: { findUnique: asyncMock() },
      enrollment: { findUnique: asyncMock() },
      lesson: { findFirst: asyncMock(), create: asyncMock() },
      lessonProgress: {
        createMany: asyncMock().mockResolvedValue({ count: 1 }),
        updateMany: asyncMock().mockResolvedValue({ count: 0 }),
        count: asyncMock().mockResolvedValue(1),
      },
      user: {
        findUnique: asyncMock().mockResolvedValue({
          streak: 0,
          lastStudyDate: null,
        }),
        update: asyncMock<[UserUpdateArg]>().mockResolvedValue({}),
      },
      userDailyXpLog: {
        upsert: asyncMock<[DailyXpUpsertArg]>().mockResolvedValue({}),
      },
      $transaction: jest.fn<
        Promise<unknown>,
        [(tx: PrismaMock) => Promise<unknown>]
      >((cb) => cb(prisma)),
    };

    courses = {
      recomputeProgress: asyncMock().mockResolvedValue({
        completedLessons: 1,
        progress: 5,
      }),
    };

    const mod = await Test.createTestingModule({
      providers: [
        LessonsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: StreakService,
          useValue: { computeNewStreak: jest.fn().mockReturnValue(1) },
        },
        {
          provide: AchievementsService,
          useValue: {
            checkAndAwardAchievements: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: CoursesService, useValue: courses },
      ],
    }).compile();
    service = mod.get(LessonsService);
  });

  const COURSE = { id: 'python', lessonCount: 20 };

  it.each([NaN, 0, 1.5, 2_147_483_648])(
    'BE10 số bài %s không vào Prisma trước khi trả 400',
    async (lessonNo) => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.enrollment.findUnique.mockResolvedValue({ userId: 1 });
      await expect(
        service.completeLesson(1, lessonNo, { courseId: 'python' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.lesson.findFirst).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('BE10 đọc bài trước transaction, bài đã có không bị đọc lại sau khoá', async () => {
    prisma.course.findUnique.mockResolvedValue(COURSE);
    prisma.enrollment.findUnique.mockResolvedValue({ userId: 1 });
    prisma.lesson.findFirst.mockResolvedValue({ id: 10, xpReward: 50 });
    await service.completeLesson(1, 1, { courseId: 'python' });
    expect(prisma.lesson.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.lesson.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.$transaction.mock.invocationCallOrder[0],
    );
    expect(prisma.lesson.create).not.toHaveBeenCalled();
  });

  it('BE10 không tạo bài khi số bài ngoài khoảng dù chưa có bản ghi', async () => {
    prisma.course.findUnique.mockResolvedValue(COURSE);
    prisma.enrollment.findUnique.mockResolvedValue({ userId: 1 });
    prisma.lesson.findFirst.mockResolvedValue(null);
    await expect(
      service.completeLesson(1, 21, { courseId: 'python' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.lesson.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  describe('BE8: thưởng khi học lại', () => {
    beforeEach(() => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.enrollment.findUnique.mockResolvedValue({ userId: 1 });
      prisma.lesson.findFirst.mockResolvedValue({ id: 10, xpReward: 50 });
    });

    it('hai lượt học lại đều cập nhật tiến độ nhưng không cộng XP/gems hoặc XP ngày', async () => {
      prisma.lessonProgressArchive.findFirst.mockResolvedValue({ id: 1n });
      for (let i = 0; i < 2; i++) {
        const res = await service.completeLesson(1, 1, { courseId: 'python' });
        expect(res.xpGained).toBe(0);
        expect(res.completedLessons).toBe(1);
      }
      expect(prisma.lessonProgressArchive.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 1,
          lessonId: 10,
          OR: [{ status: 'completed' }, { xpEarned: { gt: 0 } }],
        },
        select: { id: true },
      });
      for (const [arg] of prisma.user.update.mock.calls) {
        expect(arg.data.xp.increment).toBe(0);
        expect(arg.data.gems.increment).toBe(0);
      }
      expect(prisma.userDailyXpLog.upsert).not.toHaveBeenCalled();
      expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.lessonProgressArchive.findFirst.mock.invocationCallOrder[0],
      );
    });

    it('chưa có lịch sử nhận thưởng thì vẫn nhận XP lần đầu', async () => {
      const res = await service.completeLesson(1, 1, { courseId: 'python' });
      expect(res.xpGained).toBe(50);
      expect(prisma.userDailyXpLog.upsert).toHaveBeenCalledTimes(1);
    });

    it('ghi danh bị xoá giữa bước kiểm và transaction thì không tạo tiến độ hay thưởng', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      await expect(
        service.completeLesson(1, 1, { courseId: 'python' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.lessonProgress.createMany).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ---------- BB2-7 ----------
  describe('BẮT BUỘC ghi danh trước khi hoàn thành bài (chặn farm XP)', () => {
    it('CHƯA ghi danh -> 403 và KHÔNG cộng XP/streak, KHÔNG ghi tiến độ', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.enrollment.findUnique.mockResolvedValue(null); // chưa đăng ký

      await expect(
        service.completeLesson(1, 1, { courseId: 'python' }),
      ).rejects.toThrow(ForbiddenException);

      // Không được chạm tới bất kỳ đường ghi nào.
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.lessonProgress.createMany).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.userDailyXpLog.upsert).not.toHaveBeenCalled();
    });

    it('ĐÃ ghi danh -> chạy bình thường, có cộng XP', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.enrollment.findUnique.mockResolvedValue({
        userId: 1,
        courseId: 'python',
      });
      prisma.lesson.findFirst.mockResolvedValue({ id: 10, xpReward: 0 });

      const res = await service.completeLesson(1, 1, { courseId: 'python' });

      expect(res.ok).toBe(true);
      expect(res.xpGained).toBeGreaterThan(0);
      expect(prisma.user.update).toHaveBeenCalled();
      // XP cộng phải là giá trị SERVER quyết định, không theo client gửi lên
      const xpArg = prisma.user.update.mock.calls[0][0].data.xp.increment;
      expect(xpArg).toBe(50); // DEFAULT_XP khi lesson.xpReward = 0
    });

    it('client gửi xpEarned rất lớn -> vẫn chỉ cộng theo server', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.enrollment.findUnique.mockResolvedValue({
        userId: 1,
        courseId: 'python',
      });
      prisma.lesson.findFirst.mockResolvedValue({ id: 10, xpReward: 0 });

      await service.completeLesson(1, 1, {
        courseId: 'python',
        xpEarned: 999999,
      });

      expect(prisma.user.update.mock.calls[0][0].data.xp.increment).toBe(50);
    });
  });

  // ---------- BE3 ----------
  // Hai câu đọc trước transaction từng chạy NỐI ĐUÔI (2 vòng tới Neon, đo trong
  // BE1-MOC-DO.md). Gộp song song thì phải giữ nguyên thứ tự lỗi 404 → 403 → 400.
  describe('course + enrollment đọc song song, thứ tự lỗi giữ nguyên', () => {
    it('enrollment được gọi khi course CHƯA trả về (song song thật, không nối đuôi)', async () => {
      // course.findUnique chỉ trả về SAU KHI enrollment.findUnique đã được gọi.
      // Code nối đuôi (await course rồi mới gọi enrollment) không bao giờ gọi
      // tới enrollment, nên course chờ mãi và hết hạn bên dưới ném lỗi.
      let baoEnrollmentDaGoi!: () => void;
      const enrollmentDaGoi = new Promise<void>((r) => {
        baoEnrollmentDaGoi = r;
      });
      let hetHan: NodeJS.Timeout | undefined;
      prisma.course.findUnique.mockImplementation(async () => {
        try {
          await Promise.race([
            enrollmentDaGoi,
            new Promise((_, reject) => {
              hetHan = setTimeout(
                () =>
                  reject(
                    new Error(
                      'course.findUnique chờ mãi mà enrollment chưa được gọi — hai truy vấn đang NỐI ĐUÔI',
                    ),
                  ),
                1000,
              );
            }),
          ]);
        } finally {
          // Không dọn thì đồng hồ còn treo sau khi ca đã đạt, Jest báo
          // "worker failed to exit gracefully".
          clearTimeout(hetHan);
        }
        return COURSE;
      });
      prisma.enrollment.findUnique.mockImplementation(() => {
        baoEnrollmentDaGoi();
        return Promise.resolve({ userId: 1 });
      });
      prisma.lesson.findFirst.mockResolvedValue({ id: 10, xpReward: 0 });

      const res = await service.completeLesson(1, 1, { courseId: 'python' });
      expect(res.ok).toBe(true);
    });

    it('chỉ lấy cột cần dùng — không kéo JSONB content_meta của course', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.enrollment.findUnique.mockResolvedValue({ userId: 1 });
      prisma.lesson.findFirst.mockResolvedValue({ id: 10, xpReward: 0 });

      await service.completeLesson(1, 1, { courseId: 'python' });

      expect(prisma.course.findUnique).toHaveBeenCalledWith({
        where: { id: 'python' },
        select: { id: true, lessonCount: true },
      });
      expect(prisma.enrollment.findUnique).toHaveBeenCalledWith({
        where: { userId_courseId: { userId: 1, courseId: 'python' } },
        select: { userId: true },
      });
    });

    it('khoá KHÔNG tồn tại và cũng chưa ghi danh -> vẫn 404, không phải 403', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      prisma.enrollment.findUnique.mockResolvedValue(null);

      await expect(
        service.completeLesson(1, 1, { courseId: 'khong-co' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('chưa ghi danh VÀ lessonNo ngoài khoảng -> 403 trước 400', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.enrollment.findUnique.mockResolvedValue(null);

      await expect(
        service.completeLesson(1, 999999, { courseId: 'python' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ---------- BE3 ----------
  // Nhật ký XP theo ngày: MỘT câu upsert trên unique (user_id, log_date), không
  // còn "findFirst rồi update/create" (thêm một vòng, và chạy đua thì sinh hàng
  // trùng — nay thì ném P2002 vì bảng đã có unique).
  describe('nhật ký XP theo ngày ghi bằng một câu upsert', () => {
    beforeEach(() => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.enrollment.findUnique.mockResolvedValue({ userId: 1 });
      prisma.lesson.findFirst.mockResolvedValue({ id: 10, xpReward: 0 });
    });

    it('hoàn thành lần đầu -> upsert đúng (user, ngày), cộng dồn đúng số XP server tính', async () => {
      await service.completeLesson(7, 1, { courseId: 'python' });

      expect(prisma.userDailyXpLog.upsert).toHaveBeenCalledTimes(1);
      const arg = prisma.userDailyXpLog.upsert.mock.calls[0][0];
      const logDate = arg.where.userId_logDate.logDate;
      // toStudyDate(): UTC midnight của cột @db.Date — lệch là ghi sang ngày khác.
      expect(logDate.getUTCHours()).toBe(0);
      expect(logDate.getUTCMinutes()).toBe(0);
      expect(arg).toEqual({
        where: { userId_logDate: { userId: 7, logDate } },
        update: { xpEarned: { increment: 50 } },
        create: { userId: 7, logDate, xpEarned: 50 },
      });
    });

    it('làm lại bài đã xong -> KHÔNG ghi nhật ký XP', async () => {
      prisma.lessonProgress.createMany.mockResolvedValue({ count: 0 });
      prisma.lessonProgress.updateMany.mockResolvedValue({ count: 0 });

      const res = await service.completeLesson(7, 1, { courseId: 'python' });

      expect(res.xpGained).toBe(0);
      expect(prisma.userDailyXpLog.upsert).not.toHaveBeenCalled();
    });
  });

  // Các chốt chặn có sẵn phải còn nguyên sau khi thêm kiểm tra ghi danh —
  // và phải chặn TRƯỚC khi kiểm tra ghi danh hoặc ngay sau, miễn là vẫn chặn.
  describe('các chốt chặn khác vẫn giữ nguyên', () => {
    it('thiếu courseId -> 400', async () => {
      await expect(service.completeLesson(1, 1, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('khoá học không tồn tại -> 404', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      await expect(
        service.completeLesson(1, 1, { courseId: 'khong-co' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lessonNo vượt số bài của khoá -> 400, không tạo bài rác', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.enrollment.findUnique.mockResolvedValue({
        userId: 1,
        courseId: 'python',
      });

      await expect(
        service.completeLesson(1, 999999, { courseId: 'python' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.lesson.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('lessonNo đúng bằng lessonCount -> hoàn thành được bài cuối', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.enrollment.findUnique.mockResolvedValue({
        userId: 1,
        courseId: 'python',
      });
      prisma.lesson.findFirst.mockResolvedValue({ id: 20, xpReward: 0 });

      await expect(
        service.completeLesson(1, 20, { courseId: 'python' }),
      ).resolves.toMatchObject({ ok: true });
    });

    it('lessonNo ngay sau lessonCount -> 400, không tạo bài rác', async () => {
      prisma.course.findUnique.mockResolvedValue(COURSE);
      prisma.enrollment.findUnique.mockResolvedValue({
        userId: 1,
        courseId: 'python',
      });

      await expect(
        service.completeLesson(1, 21, { courseId: 'python' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.lesson.create).not.toHaveBeenCalled();
    });

    it('khoá lessonCount = 0 -> chặn MỌI lessonNo, không còn farm XP vô hạn', async () => {
      // Khoá mới tạo mặc định 0 bài; guard cũ (lessonCount > 0 && ...) cho qua
      // hết nên gọi N=1,2,3,... là tự tạo bài rác + cộng 50 XP mỗi lần.
      prisma.course.findUnique.mockResolvedValue({ id: 'moi', lessonCount: 0 });
      prisma.enrollment.findUnique.mockResolvedValue({
        userId: 1,
        courseId: 'moi',
      });

      await expect(
        service.completeLesson(1, 1, { courseId: 'moi' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.lesson.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});

describe('scaledXp — XP theo chất lượng làm bài (khoá Python Advanced)', () => {
  it('không gửi điểm thì nhận đủ xp_reward', () => {
    expect(scaledXp(20, undefined)).toBe(20);
  });

  it('chia trong khung 50–100% theo % màn đúng ngay lần đầu', () => {
    expect(scaledXp(20, 100)).toBe(20);
    expect(scaledXp(20, 50)).toBe(15);
    expect(scaledXp(20, 0)).toBe(10);
  });

  it('client gửi điểm vượt khung cũng không vượt xp_reward', () => {
    expect(scaledXp(20, 1000)).toBe(20);
    expect(scaledXp(20, -50)).toBe(10);
    expect(scaledXp(20, Number.NaN)).toBe(20);
  });
});
