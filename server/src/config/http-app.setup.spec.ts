import { Controller, Get, INestApplication, Post, Res } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Gzip } from 'node:zlib';
import request from 'supertest';
import { setupHttpApp } from './http-app.setup';

// Ghi lại mọi luồng gzip mà compression tạo ra. Phải qua jest.mock chứ không
// spyOn được: thuộc tính của module lõi 'zlib' là chỉ đọc. compression gọi
// `require('zlib')` nên đi qua registry của jest và nhận bản bọc này.
const mockGzipStreams: Gzip[] = [];
jest.mock('zlib', () => {
  const actual = jest.requireActual<typeof import('zlib')>('zlib');
  return {
    ...actual,
    createGzip: (opts?: import('zlib').ZlibOptions) => {
      const s = actual.createGzip(opts);
      mockGzipStreams.push(s);
      return s;
    },
  };
});

/**
 * Vì sao có file này: `x-powered-by: Express` lộ ra mọi response trên
 * production (đo 14/10/2026) và compression 1.8.1 rò bộ nhớ zlib khi client
 * ngắt giữa chừng (GHSA-vc2v-76pw-4v95). Cả hai nằm trong main.ts — chỗ không
 * test nào chạy tới. Nay cấu hình nằm trong setupHttpApp và được dựng lại ở đây
 * trên một app Nest thật, giống python-runner.controller.spec.ts.
 */
@Controller()
class DemoController {
  @Get('ping')
  ping() {
    return { ok: true };
  }

  // Đủ lớn để vượt ngưỡng 1 KB của compression → response bị nén.
  @Get('big')
  big() {
    return { data: 'x'.repeat(8000) };
  }

  // Ghi một nửa rồi KHÔNG kết thúc: mô phỏng response dài mà client bỏ dở.
  @Get('stream')
  stream(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/plain');
    res.write('x'.repeat(64 * 1024));
  }

  @Post('echo')
  echo() {
    return { ok: true };
  }
}

async function makeApp(setup: boolean): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [DemoController],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  if (setup) setupHttpApp(app);
  await app.init();
  return app;
}

const server = (app: INestApplication) =>
  app.getHttpServer() as Parameters<typeof request>[0];

describe('setupHttpApp — không lộ X-Powered-By', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await makeApp(true);
  });
  afterAll(() => app.close());

  it('response 200 không có x-powered-by', async () => {
    const res = await request(server(app)).get('/ping').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('response lỗi do Nest tự sinh (404) cũng không có x-powered-by', async () => {
    const res = await request(server(app)).get('/khong-ton-tai').expect(404);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('đối chứng: app KHÔNG qua setupHttpApp thì Express có gắn header', async () => {
    // Ca này chứng minh hai ca trên đo được thật: nếu Express/Nest tự bỏ header
    // từ một bản nào đó, ca này trượt và ta biết hai ca trên đã thành vô nghĩa.
    const raw = await makeApp(false);
    try {
      const res = await request(server(raw)).get('/ping').expect(200);
      expect(res.headers['x-powered-by']).toBe('Express');
    } finally {
      await raw.close();
    }
  });
});

describe('setupHttpApp — nén và trần body vẫn giữ như trước khi tách khỏi main.ts', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await makeApp(true);
  });
  afterAll(() => app.close());

  it('response lớn được nén gzip', async () => {
    const res = await request(server(app))
      .get('/big')
      .set('Accept-Encoding', 'gzip')
      .expect(200);
    expect(res.headers['content-encoding']).toBe('gzip');
  });

  it('body JSON quá 1mb bị từ chối 413', async () => {
    const big = JSON.stringify({ s: 'x'.repeat(1024 * 1024 + 10) });
    await request(server(app))
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send(big)
      .expect(413);
  });
});

describe('setupHttpApp — compression huỷ luồng zlib khi client ngắt (GHSA-vc2v-76pw-4v95)', () => {
  let app: INestApplication;
  afterEach(async () => {
    await app?.close();
  });

  it('client ngắt giữa response nén → luồng gzip bị destroy, không treo lại', async () => {
    mockGzipStreams.length = 0;
    app = await makeApp(true);
    await app.listen(0, '127.0.0.1');
    const { port } = (
      app.getHttpServer() as http.Server
    ).address() as AddressInfo;

    // Chờ theo ĐIỀU KIỆN (đã nhận header → huỷ; server thấy 'close'), không
    // ngủ cố định — xem bẫy đồng hồ trong AGENTS.md.
    const serverClosed = new Promise<void>((resolve) => {
      (app.getHttpServer() as http.Server).on('request', (_req, res) =>
        res.on('close', () => setImmediate(resolve)),
      );
    });
    await new Promise<void>((resolve, reject) => {
      const req = http.get(
        {
          host: '127.0.0.1',
          port,
          path: '/stream',
          headers: { 'Accept-Encoding': 'gzip' },
        },
        (res) => {
          expect(res.headers['content-encoding']).toBe('gzip');
          req.destroy();
          resolve();
        },
      );
      req.on('error', (e: NodeJS.ErrnoException) => {
        if (e.code !== 'ECONNRESET') reject(e);
      });
    });
    await serverClosed;

    expect(mockGzipStreams).toHaveLength(1);
    // 1.8.1: luồng vẫn sống sau khi response đóng → bộ nhớ native zlib bị giữ.
    expect(mockGzipStreams[0].destroyed).toBe(true);
  });
});
