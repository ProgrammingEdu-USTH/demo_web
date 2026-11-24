import {
  HttpException,
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AllExceptionsFilter } from 'src/common/filters/all-exceptions/all-exceptions.filter';
import { CustomThrottlerGuard } from 'src/common/guards/throttler/custom-throttler.guard';
import { PythonRunnerAccessGuard } from './python-runner-access.guard';
import { PythonRunnerController } from './python-runner.controller';
import { PythonRunnerService } from './python-runner.service';
import { QUEUE_BUSY_MESSAGE } from './sandbox/run-queue';

const THROTTLE_MESSAGE =
  'Bạn chạy quá nhiều lần, đợi khoảng 1 phút rồi thử lại';
const OK_RESULT = {
  stdout: '2\n',
  stderr: '',
  exitCode: 0,
  timedOut: false,
  outputTruncated: false,
  durationMs: 10,
  queuedMs: 0,
};

/**
 * Dựng app Nest thật gồm controller + guard throttle + bộ lọc lỗi của gateway, chỉ
 * giả PythonRunnerService. Mỗi lần dựng có bộ đếm throttle riêng (storage mới).
 */
async function makeApp(
  run: jest.Mock,
  trace: jest.Mock = jest.fn(),
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ThrottlerModule.forRoot({
        throttlers: [{ name: 'ip_hour', ttl: 60_000, limit: 1000 }],
      }),
    ],
    controllers: [PythonRunnerController],
    providers: [
      PythonRunnerAccessGuard,
      {
        provide: ConfigService,
        useValue: {
          get: (k: string) => (k === 'PY_RUNNER_PUBLIC' ? true : undefined),
        },
      },
      { provide: PythonRunnerService, useValue: { run, trace } },
      { provide: APP_GUARD, useClass: CustomThrottlerGuard },
      { provide: APP_FILTER, useClass: AllExceptionsFilter },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

const post = (app: INestApplication) =>
  request(app.getHttpServer() as Parameters<typeof request>[0])
    .post('/python/run')
    .send({ code: 'print(1)' });

describe('POST /python/run — hai kiểu 429 cho hai thông điệp khác nhau', () => {
  it('vượt 10 lần/phút (throttle) → "Bạn chạy quá nhiều lần, đợi khoảng 1 phút…"', async () => {
    const app = await makeApp(jest.fn().mockResolvedValue(OK_RESULT));
    try {
      for (let i = 0; i < 10; i++) {
        await post(app).expect(200);
      }
      const res = await post(app).expect(429);
      const body = res.body as { error: { status: number; message: string } };
      expect(body.error.status).toBe(429);
      expect(body.error.message).toBe(THROTTLE_MESSAGE);
    } finally {
      await app.close();
    }
  });

  it('hàng đợi đầy / chờ quá hạn → "Máy chủ đang quá tải, thử lại sau"', async () => {
    const app = await makeApp(
      jest
        .fn()
        .mockRejectedValue(
          new HttpException(QUEUE_BUSY_MESSAGE, HttpStatus.TOO_MANY_REQUESTS),
        ),
    );
    try {
      const res = await post(app).expect(429);
      const body = res.body as { error: { status: number; message: string } };
      expect(body.error.status).toBe(429);
      expect(body.error.message).toBe('Máy chủ đang quá tải, thử lại sau');
    } finally {
      await app.close();
    }
  });

  it('hai câu KHÁC NHAU (không ai bị nói nhầm là "bấm quá nhiều" khi thật ra máy quá tải)', () => {
    expect(THROTTLE_MESSAGE).not.toBe(QUEUE_BUSY_MESSAGE);
  });
});

describe('POST /python/run — client ngắt kết nối', () => {
  it('ngắt khi đang chờ/chạy → service nhận AbortSignal và nó chuyển sang aborted', async () => {
    let captured!: AbortSignal;
    const run = jest.fn();
    const gotSignal = new Promise<void>((resolve) => {
      run.mockImplementation((_code: string, signal: AbortSignal) => {
        captured = signal;
        resolve();
        return new Promise(() => {}); // không bao giờ xong, như một vòng lặp vô hạn
      });
    });
    const app = await makeApp(run);
    try {
      const req = post(app);
      req.end(() => {});
      await gotSignal;
      expect(captured.aborted).toBe(false);

      req.abort(); // người dùng đóng/tải lại tab
      await new Promise((r) => setTimeout(r, 200));
      expect(captured.aborted).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('trả lời bình thường thì KHÔNG bị coi là ngắt kết nối', async () => {
    let captured!: AbortSignal;
    const run = jest.fn((_code: string, signal: AbortSignal) => {
      captured = signal;
      return Promise.resolve(OK_RESULT);
    });
    const app = await makeApp(run);
    try {
      await post(app).expect(200);
      await new Promise((r) => setTimeout(r, 100));
      expect(captured.aborted).toBe(false);
    } finally {
      await app.close();
    }
  });
});

/**
 * POST /python/trace — "xem từng bước" trong `/ide`.
 *
 * Hai điều phải chốt bằng test, vì cả hai đều âm thầm nếu sai:
 *  1. BỘ ĐẾM THROTTLE RIÊNG. Hai route cùng đè tier `ip_hour`; nếu key của
 *     CustomThrottlerGuard không có tên handler thì bấm Chạy 10 lần là nút "xem
 *     từng bước" cũng chết theo, và ngược lại. Gỡ `route` khỏi generateKey →
 *     ca dưới trượt.
 *  2. Ngắt kết nối phải tới được service (container bị giết, nhả chỗ trong hàng
 *     đợi) — ghi vết chạy lâu hơn chạy thường nên chuyện này hay xảy ra hơn.
 */
describe('POST /python/trace', () => {
  const TRACE_OK = {
    trace: {
      v: 1,
      steps: [],
      stdout: '',
      stderr: '',
      stdoutTruncated: false,
      stderrTruncated: false,
      stopReason: 'done',
      error: null,
      stats: { steps: 0, events: 0, elapsedMs: 1, valuesTruncated: 0 },
      limits: { maxSteps: 1000 },
    },
    run: {
      exitCode: 0,
      timedOut: false,
      outputTruncated: false,
      durationMs: 500,
      queuedMs: 0,
    },
  };

  const postTrace = (app: INestApplication) =>
    request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/python/trace')
      .send({ code: 'print(1)' });

  it('trả về tài liệu vết kèm số đo của lượt chạy thật', async () => {
    const trace = jest.fn().mockResolvedValue(TRACE_OK);
    const app = await makeApp(jest.fn(), trace);
    try {
      const res = await postTrace(app).expect(200);
      const body = res.body as typeof TRACE_OK;
      expect(body.trace.stopReason).toBe('done');
      expect(body.run.durationMs).toBe(500);
      expect(trace).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it('mã rỗng → 400 (không tốn một lượt chạy container)', async () => {
    const trace = jest.fn();
    const app = await makeApp(jest.fn(), trace);
    try {
      await request(app.getHttpServer() as Parameters<typeof request>[0])
        .post('/python/trace')
        .send({ code: '' })
        .expect(400);
      expect(trace).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('bộ đếm throttle TÁCH RIÊNG khỏi /python/run', async () => {
    const app = await makeApp(
      jest.fn().mockResolvedValue(OK_RESULT),
      jest.fn().mockResolvedValue(TRACE_OK),
    );
    try {
      // Dùng hết quota của /run (10 lượt/phút) rồi kiểm /trace vẫn mở.
      for (let i = 0; i < 10; i++) await post(app).expect(200);
      await post(app).expect(429);
      await postTrace(app).expect(200);
    } finally {
      await app.close();
    }
  });
});
