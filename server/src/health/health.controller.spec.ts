import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('trả về ok kèm trạng thái db khi query được database', async () => {
    await expect(controller.check()).resolves.toEqual({
      status: 200,
      message: 'ok',
      db: 'up',
    });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  // Đây là thay đổi hành vi CÓ CHỦ ĐÍCH so với bản cũ (trước đây ném lỗi).
  // /health đóng vai trò liveness probe: DB chết KHÔNG có nghĩa tiến trình chết.
  // Nếu trả lỗi, trình điều phối sẽ restart service giữa lúc DB đang trục trặc
  // -> đá văng toàn bộ người đang dùng và biến sự cố tạm thời thành toàn phần.
  it('VẪN trả 200 khi database lỗi, nhưng báo rõ db=down (không làm sập liveness probe)', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('DB down'));

    await expect(controller.check()).resolves.toEqual({
      status: 200,
      message: 'ok',
      db: 'down',
    });
  });

  it('CACHE kết quả: gọi liên tiếp chỉ truy vấn database MỘT lần', async () => {
    await controller.check();
    await controller.check();
    await controller.check();

    // Không cache thì mỗi lượt kiểm tra tốn ~237ms round-trip tới Neon và
    // chiếm một connection trong pool — chính health check sẽ làm nghẽn hệ thống.
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('GỘP các lời gọi song song thành MỘT truy vấn duy nhất', async () => {
    let release: (v: unknown) => void = () => {};
    prisma.$queryRaw.mockReturnValue(
      new Promise((r) => {
        release = r;
      }),
    );

    const all = Promise.all([
      controller.check(),
      controller.check(),
      controller.check(),
    ]);
    release([{ '?column?': 1 }]);
    await all;

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  /**
   * Vì sao có nhóm ca này: ngày 14/10/2026 mật khẩu Neon không còn đúng. DB
   * chết, `/auth/guest` trả 500, mọi route nghiệp vụ hỏng — nhưng `/health`
   * vẫn trả HTTP 200 (đúng thiết kế, xem ca ở trên), nên Render vẫn báo
   * "healthy" và KHÔNG có tín hiệu tự động nào phát ra. Giám sát đọc mã HTTP,
   * không đọc body. Sự cố im lặng cho tới khi có người tự mở trang.
   *
   * `/health/ready` là chỗ trả 503 để giám sát ngoài bắt được, mà không đụng
   * tới liveness probe của Render.
   */
  describe('GET /health/ready — readiness cho giám sát ngoài', () => {
    const resGia = () => {
      const r = { status: jest.fn() } as unknown as import('express').Response & {
        status: jest.Mock;
      };
      return r;
    };

    it('DB sống: 200 và db=up', async () => {
      const res = resGia();
      await expect(controller.ready(res)).resolves.toEqual({
        status: 200,
        message: 'ready',
        db: 'up',
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    // CA BẮT LỖI CHÍNH: đổi 503 thành 200 ở health.controller.ts thì ca này trượt.
    it('DB chết: trả 503 — KHÁC /health, vốn vẫn 200', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('28P01 password authentication failed'));
      const res = resGia();
      await expect(controller.ready(res)).resolves.toEqual({
        status: 503,
        message: 'DB không với tới được',
        db: 'down',
      });
      expect(res.status).toHaveBeenCalledWith(503);
    });

    it('cùng một sự cố: /health 200 còn /health/ready 503 — đúng chỗ phân vai', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('DB down'));
      const res = resGia();
      const [live, ready] = [await controller.check(), await controller.ready(res)];
      expect(live.status).toBe(200);
      expect(ready.status).toBe(503);
    });

    // Thông điệp lỗi của Prisma/pg mang tên vai trò và tên host. Nó phải nằm
    // trong log máy chủ, không phải trong phản hồi công khai.
    it('KHÔNG trả thông điệp lỗi gốc ra ngoài', async () => {
      prisma.$queryRaw.mockRejectedValue(
        new Error('password authentication failed for user "neondb_owner"'),
      );
      const res = resGia();
      const body = JSON.stringify(await controller.ready(res));
      expect(body).not.toMatch(/neondb_owner|password|authentication/i);
    });
  });
});
