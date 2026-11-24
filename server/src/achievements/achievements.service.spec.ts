import { PrismaService } from 'src/prisma/prisma.service';
import { AchievementsService } from './achievements.service';

const asyncMock = () => jest.fn<Promise<unknown>, [unknown?]>();
const catalog = [1, 2, 3].map((id) => ({
  id,
  code: `a${id}`,
  conditionType: 'lesson_count',
  conditionValue: id,
}));

describe('BE10 trao thành tích theo lô', () => {
  const setup = () => {
    const db = {
      achievement: { findMany: asyncMock().mockResolvedValue(catalog) },
      userAchievement: {
        findMany: asyncMock().mockResolvedValue([]),
        createManyAndReturn: asyncMock().mockResolvedValue([
          { achievementId: 1 },
          { achievementId: 2 },
          { achievementId: 3 },
        ]),
      },
      lessonProgress: { count: asyncMock().mockResolvedValue(3) },
      user: {
        findUnique: asyncMock().mockResolvedValue({ xp: 100, streak: 1 }),
      },
      enrollment: { count: asyncMock().mockResolvedValue(0) },
    };
    return {
      db,
      service: new AchievementsService(db as unknown as PrismaService),
    };
  };

  it('ba thành tích đủ điều kiện chỉ ghi một lô và giữ hình dạng response', async () => {
    const { db, service } = setup();
    expect(await service.checkAndAwardAchievements(7)).toEqual(catalog);
    expect(db.userAchievement.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(db.userAchievement.createManyAndReturn).toHaveBeenCalledWith({
      data: [1, 2, 3].map((achievementId) => ({ userId: 7, achievementId })),
      skipDuplicates: true,
      select: { achievementId: true },
    });
  });

  it('request khác thắng INSERT thì chỉ trả thành tích chính request này vừa tạo', async () => {
    const { db, service } = setup();
    db.userAchievement.createManyAndReturn.mockResolvedValue([
      { achievementId: 2 },
    ]);
    expect(await service.checkAndAwardAchievements(7)).toEqual([catalog[1]]);
  });

  it('đã sở hữu mọi thành tích thì không ghi lô rỗng', async () => {
    const { db, service } = setup();
    db.userAchievement.findMany.mockResolvedValue(
      [1, 2, 3].map((achievementId) => ({ achievementId })),
    );
    expect(await service.checkAndAwardAchievements(7)).toEqual([]);
    expect(db.userAchievement.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('chưa đạt điều kiện thì không trao', async () => {
    const { db, service } = setup();
    db.lessonProgress.count.mockResolvedValue(0);
    expect(await service.checkAndAwardAchievements(7)).toEqual([]);
    expect(db.userAchievement.createManyAndReturn).not.toHaveBeenCalled();
  });
});
