/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Prisma giả trong test */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MAX_SNIPPETS_PER_USER, PlaygroundService } from './playground.service';
import type { SnippetDto } from './dto/snippet.dto';

const dto: SnippetDto = { title: 'a', language: 'python', code: 'print(1)' };

function make() {
  const db = {
    findMany: jest.fn().mockResolvedValue([{ id: 1 }]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue({ id: 2 }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    findFirstOrThrow: jest.fn().mockResolvedValue({ id: 3 }),
  };
  const svc = new PlaygroundService({ playgroundSnippet: db } as never);
  return { db, svc };
}

describe('PlaygroundService', () => {
  it('list chỉ lấy của chính người dùng, mới nhất trước', async () => {
    const { db, svc } = make();
    await svc.list(7);
    expect(db.findMany.mock.calls[0][0]).toMatchObject({
      where: { userId: 7 },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('create gắn userId và trả snippet', async () => {
    const { db, svc } = make();
    await expect(svc.create(7, dto)).resolves.toEqual({
      ok: true,
      snippet: { id: 2 },
    });
    expect(db.create.mock.calls[0][0].data.userId).toBe(7);
  });

  it('create từ chối khi đủ 50 đoạn', async () => {
    const { db, svc } = make();
    db.count.mockResolvedValue(MAX_SNIPPETS_PER_USER);
    await expect(svc.create(7, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(db.create).not.toHaveBeenCalled();
  });

  it('từ chối code > 100KB theo byte UTF-8', async () => {
    const { svc } = make();
    // 40000 ký tự "ế" = 120000 byte nhưng chỉ 40000 ký tự
    const big = { ...dto, code: 'ế'.repeat(40000) };
    await expect(svc.create(7, big)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.update(7, 1, big)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('update lọc theo userId; 404 nếu không phải của mình', async () => {
    const { db, svc } = make();
    await svc.update(7, 3, dto);
    expect(db.updateMany.mock.calls[0][0].where).toEqual({ id: 3, userId: 7 });
    db.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.update(8, 3, dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('remove lọc theo userId; 404 nếu không có', async () => {
    const { db, svc } = make();
    await expect(svc.remove(7, 3)).resolves.toEqual({ ok: true });
    expect(db.deleteMany.mock.calls[0][0].where).toEqual({ id: 3, userId: 7 });
    db.deleteMany.mockResolvedValue({ count: 0 });
    await expect(svc.remove(8, 3)).rejects.toBeInstanceOf(NotFoundException);
  });
});
