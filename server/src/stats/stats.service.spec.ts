import { Test } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { AchievementsService } from 'src/achievements/achievements.service';
import { StreakService } from 'src/common/streak/streak.service';
import { StatsService, parseTimeSpent } from './stats.service';

describe('parseTimeSpent (Task 138)', () => {
  it("parse chuỗi dạng '12.5h' ra số giờ", () => {
    expect(parseTimeSpent('12.5h')).toBe(12.5);
    expect(parseTimeSpent('3h')).toBe(3);
    expect(parseTimeSpent('0.5 h')).toBe(0.5);
  });

  it('nhận luôn kiểu number', () => {
    expect(parseTimeSpent(42)).toBe(42);
  });

  it('giá trị rỗng/không parse được -> 0 (không NaN)', () => {
    expect(parseTimeSpent(null)).toBe(0);
    expect(parseTimeSpent(undefined)).toBe(0);
    expect(parseTimeSpent('')).toBe(0);
    expect(parseTimeSpent('abc')).toBe(0);
    expect(parseTimeSpent({})).toBe(0);
  });

  it('clamp trong khoảng 0..500', () => {
    expect(parseTimeSpent('9999h')).toBe(500);
    expect(parseTimeSpent('-5h')).toBe(0);
    expect(parseTimeSpent(1000)).toBe(500);
  });
});

// ---------- Task 143 ----------
/**
 * Hàm Prisma giả. `Promise<unknown>` cho giá trị TRẢ VỀ là đủ: mỗi ca tự
 * `mockResolvedValue()`. Chỉ phần ĐỐI SỐ cần kiểu thật — xem cùng khuôn ở
 * `lessons/lesson-content.spec.ts` và `courses/courses.service.spec.ts`, kèm
 * hai số đo trong AGENTS.md về việc `any` che được lỗi gõ sai tới đâu.
 */
type AsyncMock<A extends unknown[] = unknown[]> = jest.Mock<
  Promise<unknown>,
  A
>;

const asyncMock = <A extends unknown[] = unknown[]>(): AsyncMock<A> =>
  jest.fn<Promise<unknown>, A>();

/** Đối số truy vấn mà bộ test này đọc lại qua `mock.calls`. */
type TruyVan = { where?: Record<string, unknown> };

/** Chỉ những bảng/hàm mà getReviewQuizStatus() gọi tới. */
type PrismaMock = {
  user: { findUnique: AsyncMock<[TruyVan]> };
  lessonProgress: { findMany: AsyncMock<[TruyVan]> };
  reviewQuizResult: { findFirst: AsyncMock<[TruyVan]> };
};

describe('getReviewQuizStatus — mở khoá đếm lại từ 0 mỗi ngày', () => {
  let service: StatsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: asyncMock<[TruyVan]>().mockResolvedValue({ streak: 3 }),
      },
      lessonProgress: { findMany: asyncMock<[TruyVan]>() },
      reviewQuizResult: {
        findFirst: asyncMock<[TruyVan]>().mockResolvedValue(null),
      },
    };

    const mod = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StreakService, useValue: {} },
        { provide: AchievementsService, useValue: {} },
      ],
    }).compile();
    service = mod.get(StatsService);
  });

  const gioHomNay = (h: number) => {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    return d;
  };
  const homQua = new Date(Date.now() - 26 * 3_600_000);

  it('2 bài hôm nay + 3 bài hôm qua -> chỉ đếm 2, KHÔNG cộng dồn', async () => {
    prisma.lessonProgress.findMany.mockResolvedValue([
      { completedAt: gioHomNay(8) },
      { completedAt: gioHomNay(9) },
      { completedAt: homQua },
    ]);

    const res = await service.getReviewQuizStatus(1);

    expect(res.lessons_completed).toBe(2);
    expect(res.lessons_remaining).toBe(3);
    expect(res.is_unlocked).toBe(false);
  });

  it('đủ 5 bài hôm nay -> mở khoá', async () => {
    prisma.lessonProgress.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ completedAt: gioHomNay(8 + i) })),
    );

    const res = await service.getReviewQuizStatus(1);
    expect(res.lessons_completed).toBe(5);
    expect(res.is_unlocked).toBe(true);
    expect(res.lessons_remaining).toBe(0);
  });

  it('từng đủ 5 bài NHƯNG là của hôm qua -> hôm nay lại khoá (đếm lại từ 0)', async () => {
    prisma.lessonProgress.findMany.mockResolvedValue(
      Array.from({ length: 5 }, () => ({ completedAt: homQua })),
    );

    const res = await service.getReviewQuizStatus(1);
    expect(res.lessons_completed).toBe(0);
    expect(res.is_unlocked).toBe(false);
    expect(res.lessons_remaining).toBe(5);
  });

  it('chưa học bài nào -> 0/5, không lỗi', async () => {
    prisma.lessonProgress.findMany.mockResolvedValue([]);
    const res = await service.getReviewQuizStatus(1);
    expect(res.lessons_completed).toBe(0);
    expect(res.is_unlocked).toBe(false);
  });
});

// ---------- BE3 ----------
/** Đối số `userDailyXpLog.upsert()` — xem src/common/xp/daily-xp-log.ts. */
type DailyXpUpsertArg = {
  where: { userId_logDate: { userId: number; logDate: Date } };
  update: { xpEarned: { increment: number } };
  create: { userId: number; logDate: Date; xpEarned: number };
};

/** Chỉ những bảng/hàm mà completeMission() gọi tới. */
type MissionPrismaMock = {
  mission: { findUnique: AsyncMock; updateMany: AsyncMock };
  user: { findUnique: AsyncMock; update: AsyncMock };
  userDailyXpLog: { upsert: AsyncMock<[DailyXpUpsertArg]> };
  $transaction: AsyncMock<[(tx: MissionPrismaMock) => Promise<unknown>]>;
};

describe('completeMission — nhật ký XP ghi bằng một câu upsert (BE3)', () => {
  let service: StatsService;
  let prisma: MissionPrismaMock;

  beforeEach(async () => {
    prisma = {
      mission: {
        findUnique: asyncMock().mockResolvedValue({
          isActive: true,
          correctCondition: null,
          xpReward: 30,
        }),
        updateMany: asyncMock().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: asyncMock().mockResolvedValue({
          streak: 0,
          lastStudyDate: null,
        }),
        update: asyncMock().mockResolvedValue({}),
      },
      userDailyXpLog: {
        upsert: asyncMock<[DailyXpUpsertArg]>().mockResolvedValue({}),
      },
      $transaction: jest.fn<
        Promise<unknown>,
        [(tx: MissionPrismaMock) => Promise<unknown>]
      >((cb) => cb(prisma)),
    };

    const mod = await Test.createTestingModule({
      providers: [
        StatsService,
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
      ],
    }).compile();
    service = mod.get(StatsService);
  });

  it('nhận thưởng -> upsert đúng (user, ngày) với XP của nhiệm vụ', async () => {
    await service.completeMission(5, { course_id: 'python' });

    expect(prisma.userDailyXpLog.upsert).toHaveBeenCalledTimes(1);
    const arg = prisma.userDailyXpLog.upsert.mock.calls[0][0];
    const logDate = arg.where.userId_logDate.logDate;
    expect(arg).toEqual({
      where: { userId_logDate: { userId: 5, logDate } },
      update: { xpEarned: { increment: 30 } },
      create: { userId: 5, logDate, xpEarned: 30 },
    });
  });

  it('thua tranh chấp (nhiệm vụ đã bị nhận) -> KHÔNG ghi nhật ký XP', async () => {
    prisma.mission.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.completeMission(5, { course_id: 'python' }),
    ).rejects.toThrow('Không tìm thấy nhiệm vụ đang hoạt động');
    expect(prisma.userDailyXpLog.upsert).not.toHaveBeenCalled();
  });
});
