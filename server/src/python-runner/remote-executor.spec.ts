import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientClosedRequestException } from './python-executor';
import { RemoteExecutor, RUNNER_DOWN_MESSAGE } from './remote-executor';

const RESULT = {
  stdout: '2\n',
  stderr: '',
  exitCode: 0,
  timedOut: false,
  outputTruncated: false,
  durationMs: 312,
  queuedMs: 0,
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeExecutor(
  fetchImpl: jest.Mock,
  overrides: Record<string, unknown> = {},
) {
  const values: Record<string, unknown> = {
    RUNNER_URL: 'https://runner.example.com/',
    RUNNER_SECRET: 's'.repeat(32),
    PY_RUN_TIMEOUT_MS: 10_000,
    ...overrides,
  };
  const config = {
    get: (k: string) => values[k],
    getOrThrow: (k: string) => {
      if (values[k] === undefined) throw new Error(`thiếu ${k}`);
      return values[k];
    },
  } as unknown as ConfigService;
  return new RemoteExecutor(config, fetchImpl);
}

describe('RemoteExecutor', () => {
  it('POST ${RUNNER_URL}/run kèm khoá Bearer và { code }, trả nguyên RunResult', async () => {
    const fetchMock = jest.fn().mockResolvedValue(json(200, RESULT));
    const result = await makeExecutor(fetchMock).run('print(1+1)');

    expect(result).toEqual(RESULT);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // dấu / thừa ở cuối RUNNER_URL không sinh ra // trong đường dẫn
    expect(url).toBe('https://runner.example.com/run');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${'s'.repeat(32)}`,
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(init.body as string)).toEqual({ code: 'print(1+1)' });
  });

  it('timeout gửi cho fetch = PY_RUN_QUEUE_TIMEOUT_MS + PY_RUN_TIMEOUT_MS + 10 giây', async () => {
    const spy = jest.spyOn(AbortSignal, 'timeout');
    const fetchMock = jest.fn().mockResolvedValue(json(200, RESULT));
    await makeExecutor(fetchMock, {
      PY_RUN_TIMEOUT_MS: 3000,
      PY_RUN_QUEUE_TIMEOUT_MS: 20_000,
    }).run('pass');
    expect(spy).toHaveBeenCalledWith(33_000);
    spy.mockRestore();
  });

  it('không khai PY_RUN_QUEUE_TIMEOUT_MS thì dùng mặc định 30 giây (cùng mặc định với runner)', async () => {
    const spy = jest.spyOn(AbortSignal, 'timeout');
    const fetchMock = jest.fn().mockResolvedValue(json(200, RESULT));
    await makeExecutor(fetchMock).run('pass');
    expect(spy).toHaveBeenCalledWith(30_000 + 10_000 + 10_000);
    spy.mockRestore();
  });

  it('trả queuedMs của runner; runner cũ không gửi queuedMs thì coi như 0', async () => {
    const withQueue = jest
      .fn()
      .mockResolvedValue(json(200, { ...RESULT, queuedMs: 4200 }));
    expect((await makeExecutor(withQueue).run('pass')).queuedMs).toBe(4200);

    const legacy: Partial<typeof RESULT> = { ...RESULT };
    delete legacy.queuedMs;
    const old = jest.fn().mockResolvedValue(json(200, legacy));
    expect((await makeExecutor(old).run('pass')).queuedMs).toBe(0);
  });

  it('người dùng bỏ đi (signal) → huỷ request tới runner để runner rút bài / kill container', async () => {
    let received: AbortSignal | undefined;
    const fetchMock = jest.fn((_url: string, init: RequestInit) => {
      received = init.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    });
    const client = new AbortController();
    const run = makeExecutor(fetchMock as unknown as jest.Mock)
      .run('while True: pass', client.signal)
      .catch((e: unknown) => e);

    expect(received!.aborted).toBe(false);
    client.abort();
    expect(received!.aborted).toBe(true); // tín hiệu tới được fetch
    const error = await run;
    // không phải lỗi "runner tắt": người dùng đã bỏ đi. 499 (không phải 5xx) nên không bị
    // ghi log như lỗi máy chủ và không dọa ai bằng thông báo "đang tắt"
    expect(error).toBeInstanceOf(ClientClosedRequestException);
    expect((error as HttpException).getStatus()).toBe(499);
    expect((error as HttpException).message).not.toBe(RUNNER_DOWN_MESSAGE);
  });

  it('429 của runner là thông điệp hàng đợi: chuyển tiếp đúng câu "Máy chủ đang quá tải"', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        json(429, { message: 'Máy chủ đang quá tải, thử lại sau' }),
      );
    const error = await makeExecutor(fetchMock)
      .run('pass')
      .catch((e: unknown) => e);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).message).toBe(
      'Máy chủ đang quá tải, thử lại sau',
    );
  });

  it('429 từ runner được chuyển tiếp NGUYÊN TRẠNG (cùng status và thông điệp)', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        json(429, { message: 'Runner đang chạy tối đa 1 chương trình' }),
      );
    const error = await makeExecutor(fetchMock)
      .run('pass')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).message).toBe(
      'Runner đang chạy tối đa 1 chương trình',
    );
  });

  it('429 không có body vẫn ra 429 (không rơi xuống 503)', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response('', { status: 429 }));
    const error = await makeExecutor(fetchMock)
      .run('pass')
      .catch((e: unknown) => e);
    expect((error as HttpException).getStatus()).toBe(429);
  });

  it('400 / 413 từ runner → 400 với thông điệp của runner', async () => {
    for (const status of [400, 413]) {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(json(status, { message: 'Mã nguồn tối đa 20 KB' }));
      await expect(makeExecutor(fetchMock).run('x')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });

  it('runner không trả lời (lỗi mạng) → 503 với thông điệp "đang tắt"', async () => {
    const fetchMock = jest.fn().mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), {
        cause: { code: 'ECONNREFUSED' },
      }),
    );
    const error = await makeExecutor(fetchMock)
      .run('pass')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as HttpException).message).toBe(RUNNER_DOWN_MESSAGE);
    expect(RUNNER_DOWN_MESSAGE).toBe('Bộ chạy Python đang tắt, thử lại sau');
  });

  it('hết giờ chờ runner (TimeoutError) → 503', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    await expect(makeExecutor(fetchMock).run('pass')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('runner trả 401 (lệch khoá) → 503 chung chung, KHÔNG lộ 401 ra client', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(json(401, { message: 'Unauthorized' }));
    const error = await makeExecutor(fetchMock)
      .run('pass')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as HttpException).getStatus()).toBe(503);
    expect((error as HttpException).message).toBe(RUNNER_DOWN_MESSAGE);
  });

  it('runner lỗi 5xx hoặc trả 200 sai hình → 503', async () => {
    for (const res of [
      json(500, {}),
      json(200, { stdout: 'x' }),
      json(200, null),
    ]) {
      const fetchMock = jest.fn().mockResolvedValue(res);
      await expect(makeExecutor(fetchMock).run('pass')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    }
  });

  it('thiếu RUNNER_URL / RUNNER_SECRET thì nổ ngay lúc dựng, không đợi tới request đầu tiên', () => {
    expect(() => makeExecutor(jest.fn(), { RUNNER_URL: undefined })).toThrow(
      'RUNNER_URL',
    );
    expect(() => makeExecutor(jest.fn(), { RUNNER_SECRET: undefined })).toThrow(
      'RUNNER_SECRET',
    );
  });
});
