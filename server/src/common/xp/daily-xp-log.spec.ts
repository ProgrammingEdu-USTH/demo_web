import { addDailyXp } from './daily-xp-log';

/**
 * Canh hình dạng câu upsert. Prisma chỉ dịch upsert thành MỘT câu
 * `INSERT … ON CONFLICT DO UPDATE` khi `where` chỉ có đúng một unique và giá
 * trị của nó khớp với `create`; lệch một trong hai là Prisma lặng lẽ quay về
 * "SELECT rồi INSERT/UPDATE" — đúng hai vòng và đúng cuộc đua mà BE3 bỏ đi.
 */
describe('addDailyXp (BE3)', () => {
  it('upsert theo unique userId_logDate, create mang ĐÚNG cặp khoá của where', async () => {
    const upsert = jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({});
    const logDate = new Date(Date.UTC(2026, 10, 11));

    await addDailyXp(
      { userDailyXpLog: { upsert } } as unknown as Parameters<
        typeof addDailyXp
      >[0],
      3,
      logDate,
      40,
    );

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toEqual({
      where: { userId_logDate: { userId: 3, logDate } },
      update: { xpEarned: { increment: 40 } },
      create: { userId: 3, logDate, xpEarned: 40 },
    });
  });
});
