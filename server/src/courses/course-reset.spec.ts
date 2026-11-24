import { ForbiddenException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import { CoursesService } from './courses.service';

const asyncMock = <A extends unknown[] = unknown[]>() =>
  jest.fn<Promise<unknown>, A>();

describe('BE8 reset khoá', () => {
  const make = () => {
    const tx = {
      $queryRaw: asyncMock<[Prisma.Sql]>().mockResolvedValue([{ user_id: 7 }]),
      $executeRaw: asyncMock<[Prisma.Sql]>().mockResolvedValue(2),
      lessonProgress: {
        deleteMany: asyncMock().mockResolvedValue({ count: 2 }),
      },
      enrollment: { update: asyncMock().mockResolvedValue({}) },
    };
    const db = {
      $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    return {
      tx,
      db,
      service: new CoursesService(db as unknown as PrismaService),
    };
  };

  it('lưu lịch sử trước khi xoá, reset đúng người/khoá trong một transaction', async () => {
    const { tx, db, service } = make();
    const result = await service.reset(7, 'python');
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0][0].values).toEqual([7, 'python']);
    const sql = tx.$executeRaw.mock.calls[0][0];
    expect(sql.text).toContain('INSERT INTO lesson_progress_archive');
    expect(sql.values).toEqual([expect.any(Date), 7, 'python']);
    expect(tx.lessonProgress.deleteMany).toHaveBeenCalledWith({
      where: { userId: 7, courseId: 'python' },
    });
    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: 7, courseId: 'python' } },
      data: {
        completedLessons: 0,
        progress: 0,
        resetAt: expect.any(Date) as Date,
      },
    });
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.lessonProgress.deleteMany.mock.invocationCallOrder[0],
    );
    expect(result).toEqual({
      ok: true,
      completedLessons: 0,
      progress: 0,
      reset_at: expect.any(String) as string,
    });
  });

  it('không có ghi danh của chính người gọi thì từ chối trước khi ghi', async () => {
    const { tx, service } = make();
    tx.$queryRaw.mockResolvedValue([]);
    await expect(service.reset(8, 'python')).rejects.toThrow(
      ForbiddenException,
    );
    expect(tx.$queryRaw.mock.calls[0][0].values).toEqual([8, 'python']);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.lessonProgress.deleteMany).not.toHaveBeenCalled();
  });

  it('archive lỗi thì không xoá tiến độ; lỗi thoát transaction để DB rollback', async () => {
    const { tx, service } = make();
    tx.$executeRaw.mockRejectedValue(new Error('archive failed'));
    await expect(service.reset(7, 'python')).rejects.toThrow('archive failed');
    expect(tx.lessonProgress.deleteMany).not.toHaveBeenCalled();
    expect(tx.enrollment.update).not.toHaveBeenCalled();
  });

  it('update ghi danh lỗi phải thoát transaction, không trả thành công giả', async () => {
    const { tx, service } = make();
    tx.enrollment.update.mockRejectedValue(new Error('update failed'));
    await expect(service.reset(7, 'python')).rejects.toThrow('update failed');
  });
});
