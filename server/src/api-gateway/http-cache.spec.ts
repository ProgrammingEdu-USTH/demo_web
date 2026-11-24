import { Test } from '@nestjs/testing';
import { APP_INTERCEPTOR } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { LessonsController } from 'src/lessons/lessons.controller';
import { LessonsService } from 'src/lessons/lessons.service';
import { CoursesController } from 'src/courses/courses.controller';
import { CoursesService } from 'src/courses/courses.service';
import { StreakService } from 'src/common/streak/streak.service';
import { AchievementsService } from 'src/achievements/achievements.service';
import { setupHttpApp } from 'src/config/http-app.setup';
import { CorsMiddleware } from 'src/common/middleware/cors/cors.middleware';
import { HttpCacheInterceptor } from './http-cache';

const mock = () => jest.fn<Promise<unknown>, [unknown?]>();
// Fixture đúng hình dạng giáo trình thật: options là object, lời giải ở step_4.
const bundle = JSON.parse(
  readFileSync(
    join(process.cwd(), 'scripts/pe-v4/out-advanced/lessons/001-P01.json'),
    'utf8',
  ),
) as {
  content_json: { step_4: { solutionCode: string; gate?: boolean } };
};
const PATH = '/api/courses/python/lessons/1/content';
const server = (app: INestApplication) => app.getHttpServer() as Server;

describe('BE13 cache HTTP qua controller và service thật', () => {
  let app: NestExpressApplication;
  let completed: boolean;
  let allowed: boolean;
  const lesson = {
    id: 1,
    title: 'Bài 1',
    subtitle: '',
    module: 'M1',
    sortOrder: 1,
    xpReward: 50,
    updatedAt: new Date('2026-11-21T00:00:00Z'),
    contentHash: null,
    contentJson: structuredClone(bundle.content_json),
  };
  const course = {
    id: 'python',
    title: 'Python',
    level: 'advanced',
    rating: 0,
    lessonCount: 1,
    xp_reward: 50,
    isPublished: true,
    language: 'python',
    accentColor: null,
    contentMeta: {},
  };
  let db: {
    $queryRaw: ReturnType<typeof mock>;
    enrollment: {
      findUnique: ReturnType<typeof mock>;
      findMany: ReturnType<typeof mock>;
    };
    user: { findUnique: ReturnType<typeof mock> };
    lesson: { findFirst: ReturnType<typeof mock> };
    lessonProgress: { findFirst: ReturnType<typeof mock> };
    course: { findMany: ReturnType<typeof mock> };
  };

  beforeEach(async () => {
    completed = false;
    allowed = true;
    lesson.updatedAt = new Date('2026-11-21T00:00:00Z');
    lesson.title = 'Bài 1';
    lesson.contentJson = structuredClone(bundle.content_json);
    lesson.contentJson.step_4.gate = true;
    course.title = 'Python';
    db = {
      $queryRaw: mock().mockResolvedValue([]),
      enrollment: {
        findUnique: mock().mockImplementation(() =>
          Promise.resolve(allowed ? { userId: 7 } : null),
        ),
        findMany: mock().mockResolvedValue([{ courseId: 'python' }]),
      },
      user: { findUnique: mock().mockResolvedValue({ role: 'student' }) },
      lesson: {
        findFirst: mock().mockImplementation(() =>
          Promise.resolve({ ...lesson }),
        ),
      },
      lessonProgress: {
        findFirst: mock().mockImplementation(() =>
          Promise.resolve(completed ? { lessonId: 1 } : null),
        ),
      },
      course: {
        findMany: mock().mockImplementation(() =>
          Promise.resolve([{ ...course }]),
        ),
      },
    };
    const courses = new CoursesService(db as unknown as PrismaService);
    const lessons = new LessonsService(
      db as unknown as PrismaService,
      {} as StreakService,
      {} as AchievementsService,
      courses,
    );
    const module = await Test.createTestingModule({
      controllers: [LessonsController, CoursesController],
      providers: [
        { provide: LessonsService, useValue: lessons },
        { provide: CoursesService, useValue: courses },
        { provide: APP_INTERCEPTOR, useClass: HttpCacheInterceptor },
      ],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    setupHttpApp(app);
    app.setGlobalPrefix('api');
    const cors = new CorsMiddleware({
      get: () => ['http://localhost:3000'],
    } as unknown as ConfigService);
    app.use(cors.use.bind(cors));
    app.use(
      (
        req: Request & { user?: { sub: number } },
        res: Response,
        next: NextFunction,
      ) => {
        if (!req.headers.authorization) {
          res.status(401).end();
          return;
        }
        req.user = {
          sub: req.headers.authorization === 'Bearer other' ? 8 : 7,
        };
        next();
      },
    );
    await app.init();
  });
  afterEach(async () => app.close());
  const get = (path = PATH, auth = 'Bearer student') =>
    request(server(app)).get(path).set('Authorization', auth);
  const tagOf = async () => {
    const response = await get().expect(200);
    expect(response.headers.etag).toMatch(/^W\/"[0-9a-f]{64}"$/);
    return String(response.headers.etag);
  };

  it('lần đầu 200, lần sau 304 body rỗng; metadata không lọt vào body', async () => {
    const first = await get().expect(200);
    expect(first.headers['cache-control']).toBe('private, no-cache');
    expect(first.headers.vary).toContain('Authorization');
    expect(first.text).not.toContain('updatedAt');
    expect(first.text).not.toContain('contentHash');
    expect(first.text).not.toContain(bundle.content_json.step_4.solutionCode);
    const second = await get()
      .set('If-None-Match', String(first.headers.etag))
      .expect(304);
    expect(second.text).toBe('');
  });
  it('weak/strong ETag trong danh sách và wildcard đều revalidate được', async () => {
    const tag = await tagOf();
    await get()
      .set('If-None-Match', `"other", ${tag.replace(/^W\//, '')}`)
      .expect(304);
    await get().set('If-None-Match', '*').expect(304);
    await get().set('If-None-Match', 'invalid').expect(200);
    await get().set('If-None-Match', 'invalid*').expect(200);
  });
  it('sửa nội dung cập nhật updatedAt thì hash NULL vẫn đổi ETag', async () => {
    const tag = await tagOf();
    lesson.contentJson.step_4.solutionCode = 'new solution';
    lesson.updatedAt = new Date('2026-11-21T00:00:01Z');
    const changed = await get().set('If-None-Match', tag).expect(200);
    expect(changed.headers.etag).not.toBe(tag);
  });
  it('sửa tiêu đề cũng đổi ETag', async () => {
    const tag = await tagOf();
    lesson.title = 'Tiêu đề mới';
    expect(
      (await get().set('If-None-Match', tag).expect(200)).headers.etag,
    ).not.toBe(tag);
  });
  it('hoàn thành mở lời giải, reset ẩn lại và không dùng ETag của bản đã mở', async () => {
    const locked = await tagOf();
    completed = true;
    const open = await get().set('If-None-Match', locked).expect(200);
    expect(open.text).toContain('solutionCode');
    completed = false;
    const reset = await get()
      .set('If-None-Match', String(open.headers.etag))
      .expect(200);
    expect(reset.text).not.toContain('solutionCode');
  });
  it('admin chuyển về học viên không dùng chung ETag hoặc lời giải', async () => {
    db.user.findUnique.mockResolvedValue({ role: 'admin' });
    const admin = await get().expect(200);
    expect(admin.text).toContain('solutionCode');
    db.user.findUnique.mockResolvedValue({ role: 'student' });
    const student = await get()
      .set('If-None-Match', String(admin.headers.etag))
      .expect(200);
    expect(student.text).not.toContain('solutionCode');
  });
  it('hai tài khoản không dùng chung ETag', async () => {
    const tag = await tagOf();
    expect(
      (await get(PATH, 'Bearer other').set('If-None-Match', tag).expect(200))
        .headers.etag,
    ).not.toBe(tag);
  });
  it('mất ghi danh vẫn trả 403 dù có ETag, mất phiên trả 401', async () => {
    const tag = await tagOf();
    allowed = false;
    await get().set('If-None-Match', tag).expect(403);
    await request(server(app)).get(PATH).set('If-None-Match', tag).expect(401);
  });
  it('catalog thuần 304, không có enrolled; sửa metadata khoá thì 200', async () => {
    const first = await get('/api/courses/catalog').expect(200);
    expect(first.text).not.toContain('enrolled');
    await get('/api/courses/catalog')
      .set('If-None-Match', String(first.headers.etag))
      .expect(304);
    course.title = 'Python mới';
    await get('/api/courses/catalog')
      .set('If-None-Match', String(first.headers.etag))
      .expect(200);
  });
  it('danh mục có ghi danh không được Express tự tạo ETag', async () => {
    const first = await get('/api/courses').expect(200);
    expect(first.headers['cache-control']).toBe('no-store');
    expect(first.headers.etag).toBeUndefined();
    await get('/api/courses').set('If-None-Match', '*').expect(200);
  });
  it('route tiến độ enrolled không cache, kể cả conditional request', async () => {
    const response = await get('/api/enrolled')
      .set('If-None-Match', '*')
      .expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers.etag).toBeUndefined();
  });
  it('thiếu updatedAt đáng tin thì không cấp ETag', async () => {
    db.lesson.findFirst.mockResolvedValue({ ...lesson, updatedAt: null });
    const response = await get().set('If-None-Match', '*').expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers.etag).toBeUndefined();
  });
  it('CORS expose ETag và chấp nhận If-None-Match trong preflight', async () => {
    const first = await get()
      .set('Origin', 'http://localhost:3000')
      .expect(200);
    expect(first.headers['access-control-expose-headers']).toContain('ETag');
    const preflight = await request(server(app))
      .options(PATH)
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,if-none-match')
      .expect(204);
    expect(preflight.headers['access-control-allow-headers']).toContain(
      'if-none-match',
    );
  });
});
