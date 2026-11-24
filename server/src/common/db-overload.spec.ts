import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, Observable } from 'rxjs';
import { AllExceptionsFilter } from './filters/all-exceptions/all-exceptions.filter';
import { RetryReadInterceptor } from './interceptors/retry-read/retry-read.interceptor';
import { PoolWaitMonitor } from 'src/prisma/neon-pool';

// BE11: DB bận → 503 nhanh có Retry-After; GET thử lại 1 lần khi socket bị cắt; sự kiện học
// không bao giờ ném lỗi vào request.

function runFilter(err: Error) {
  const res = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ method: 'GET', url: '/x', requestId: 'r' }),
    }),
  };
  new AllExceptionsFilter().catch(err, host as never);
  return res;
}

describe('AllExceptionsFilter — lỗi DB', () => {
  it('hết pool → 503 + Retry-After: 3 + câu nói đúng nguyên nhân', () => {
    const res = runFilter(new Error('timeout exceeded when trying to connect'));
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '3');
  });

  it('"Connection terminated" không còn bị báo là quá tải', () => {
    const res = runFilter(new Error('Connection terminated unexpectedly'));
    const body = (res.json.mock.calls[0] as [{ error: { message: string } }])[0]
      .error.message;
    expect(res.status).toHaveBeenCalledWith(503);
    expect(body).toContain('bị ngắt');
    expect(body).not.toContain('nhiều người dùng');
  });
});

describe('RetryReadInterceptor', () => {
  const ctx = (method: string) =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ method, url: '/a?b=1' }) }),
    }) as unknown as ExecutionContext;
  const dropped = () => new Error('Connection terminated unexpectedly');

  function handler(failTimes: number, err: Error = dropped()) {
    let calls = 0;
    // defer-like: mỗi lần subscribe tính là một lần chạy handler
    const next: CallHandler = {
      handle: () =>
        new Observable<string>((s) => {
          calls++;
          if (calls <= failTimes) s.error(err);
          else {
            s.next('ok');
            s.complete();
          }
        }),
    };
    return { next, calls: () => calls };
  }

  it('GET gặp Connection terminated → chạy lại 1 lần rồi thành công', async () => {
    const h = handler(1);
    await expect(
      lastValueFrom(new RetryReadInterceptor().intercept(ctx('GET'), h.next)),
    ).resolves.toBe('ok');
    expect(h.calls()).toBe(2);
  });

  it('GET lỗi 2 lần liền → chỉ thử 1 lần rồi ném lỗi', async () => {
    const h = handler(5);
    await expect(
      lastValueFrom(new RetryReadInterceptor().intercept(ctx('GET'), h.next)),
    ).rejects.toThrow('Connection terminated');
    expect(h.calls()).toBe(2);
  });

  it('POST KHÔNG được chạy lại (có thể đã commit một phần)', async () => {
    const h = handler(1);
    await expect(
      lastValueFrom(new RetryReadInterceptor().intercept(ctx('POST'), h.next)),
    ).rejects.toThrow();
    expect(h.calls()).toBe(1);
  });

  it('pool timeout KHÔNG thử lại (chỉ xếp hàng thêm)', async () => {
    const h = handler(1, new Error('timeout exceeded when trying to connect'));
    await expect(
      lastValueFrom(new RetryReadInterceptor().intercept(ctx('GET'), h.next)),
    ).rejects.toThrow();
    expect(h.calls()).toBe(1);
  });
});

describe('PoolWaitMonitor', () => {
  const pool = (waiting: number) => ({
    waitingCount: waiting,
    totalCount: 5,
    idleCount: 0,
  });

  it('cảnh báo một lần khi hàng chờ kéo dài ≥ 2 mẫu, không lặp mỗi giây', () => {
    const log = { log: jest.fn(), warn: jest.fn() };
    const m = new PoolWaitMonitor('main', log);
    [1, 1, 1, 1].forEach((w) => m.sample(pool(w)));
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it('hàng chờ thoáng qua (1 mẫu) không cảnh báo', () => {
    const log = { log: jest.fn(), warn: jest.fn() };
    const m = new PoolWaitMonitor('main', log);
    [1, 0, 1, 0].forEach((w) => m.sample(pool(w)));
    expect(log.warn).not.toHaveBeenCalled();
  });
});
