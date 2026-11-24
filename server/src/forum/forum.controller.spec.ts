import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { AllExceptionsFilter } from 'src/common/filters/all-exceptions/all-exceptions.filter';
import { CustomThrottlerGuard } from 'src/common/guards/throttler/custom-throttler.guard';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';

/**
 * Hạn mức riêng của diễn đàn, kiểm bằng app Nest THẬT (controller + guard
 * throttle + bộ lọc lỗi của gateway) — cùng khuôn với
 * python-runner.controller.spec.ts. Chỉ giả ForumService.
 *
 * Người dùng gắn qua header `x-user` (thay cho JwtAuthGuard) để kiểm luôn rằng
 * quota tính theo TÀI KHOẢN: CustomThrottlerGuard đọc `req.user.sub`.
 */
async function makeApp(): Promise<INestApplication> {
  const ok = jest.fn().mockResolvedValue({ ok: true });
  const moduleRef = await Test.createTestingModule({
    imports: [
      ThrottlerModule.forRoot({
        throttlers: [{ name: 'ip_hour', ttl: 60_000, limit: 1000 }],
      }),
    ],
    controllers: [ForumController],
    providers: [
      {
        provide: ForumService,
        useValue: { createPost: ok, createComment: ok, listPosts: ok },
      },
      { provide: APP_GUARD, useClass: CustomThrottlerGuard },
      { provide: APP_FILTER, useClass: AllExceptionsFilter },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { user?: unknown }).user = {
      sub: Number(req.headers['x-user'] ?? 7),
      role: 'user',
    };
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

const http = (app: INestApplication) =>
  request(app.getHttpServer() as Parameters<typeof request>[0]);
const dangBai = (app: INestApplication, user = 7) =>
  http(app).post('/posts').set('x-user', String(user)).send({ content: 'hi' });
const binhLuan = (app: INestApplication, user = 7) =>
  http(app)
    .post('/posts/1/comments')
    .set('x-user', String(user))
    .send({ content: 'hi' });

/** Gọi `n` lượt TUẦN TỰ (song song thì thứ tự đếm của throttler không chắc). */
async function goi(n: number, f: () => request.Test, status: number) {
  for (let i = 0; i < n; i++) await f().expect(status);
}

type LoiBody = { error: { status: number; message: string } };

describe('ForumController — hạn mức riêng cho việc ghi', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await makeApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('tạo bài: 10 lượt đầu qua, lượt 11 nhận 429 kèm câu tiếng Việt', async () => {
    await goi(10, () => dangBai(app), 200);
    const res = await dangBai(app).expect(429);
    const body = res.body as LoiBody;
    expect(body.error.status).toBe(429);
    expect(body.error.message).toBe(
      'Bạn đăng bài hơi nhanh, đợi vài phút rồi thử lại',
    );
  });

  it('bình luận: 30 lượt đầu qua, lượt 31 nhận 429', async () => {
    await goi(30, () => binhLuan(app), 200);
    const res = await binhLuan(app).expect(429);
    expect((res.body as LoiBody).error.message).toBe(
      'Bạn bình luận hơi nhanh, đợi vài phút rồi thử lại',
    );
  });

  it('quota tạo bài và bình luận TÁCH nhau; đọc danh sách không bị chặn', async () => {
    await goi(10, () => dangBai(app), 200);
    await dangBai(app).expect(429);
    await binhLuan(app).expect(200);
    await http(app).get('/posts').expect(200);
  });

  it('quota tính theo TÀI KHOẢN: người khác (cùng IP) vẫn đăng được', async () => {
    await goi(10, () => dangBai(app, 7), 200);
    await dangBai(app, 7).expect(429);
    await dangBai(app, 8).expect(200);
  });
});
