import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { LocalExecutor } from './local-executor';
import { ClientClosedRequestException } from './python-executor';
import { QUEUE_BUSY_MESSAGE } from './sandbox/run-queue';

jest.mock('node:child_process', () => ({ execFile: jest.fn() }));

type Callback = (
  error: (Error & Record<string, unknown>) | null,
  stdout: string,
  stderr: string,
) => void;
type Call = { cmd: string; args: string[]; cb: Callback };

const execMock = execFile as unknown as jest.Mock;

/** Giá trị cấu hình mặc định như env.validation.ts. */
function makeService(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    PY_SANDBOX_IMAGE: 'py-sandbox',
    PY_RUN_TIMEOUT_MS: 10_000,
    PY_RUN_MAX_CONCURRENT: 2,
    PY_RUN_QUEUE_MAX: 100,
    PY_RUN_QUEUE_TIMEOUT_MS: 30_000,
    PY_RUN_MEMORY: '1g',
    ...overrides,
  };
  const config = { get: (k: string) => values[k] } as unknown as ConfigService;
  return new LocalExecutor(config);
}

function err(props: Record<string, unknown>) {
  return Object.assign(new Error('Command failed'), props);
}

/** Thư mục tạm mà service đã mount, đọc ngược từ đối số `--mount`. */
function mountedDir(args: string[]): string {
  const mount = args[args.indexOf('--mount') + 1];
  return /source=(.*),target=\/code/.exec(mount)![1];
}

/**
 * execFile giả: mỗi lời gọi được GHI LẠI, test tự quyết lúc nào trả lời bằng
 * `answer`. `docker kill` luôn trả lời ngay.
 */
function installExec(onRun: (call: Call) => void) {
  const calls: Call[] = [];
  execMock.mockImplementation(
    (cmd: string, args: string[], _opts: unknown, cb: Callback) => {
      const call = { cmd, args, cb };
      calls.push(call);
      if (args[0] === 'kill') cb(null, '', '');
      else onRun(call);
    },
  );
  return calls;
}

describe('LocalExecutor', () => {
  beforeEach(() => execMock.mockReset());

  it('chạy thành công: trả stdout, exitCode 0 và dựng lệnh docker đúng cờ', async () => {
    const calls = installExec((c) => c.cb(null, '2\n', ''));
    const result = await makeService().run('print(1+1)');

    expect(result).toMatchObject({
      stdout: '2\n',
      stderr: '',
      exitCode: 0,
      timedOut: false,
      outputTruncated: false,
    });
    expect(typeof result.durationMs).toBe('number');

    // chỉ một lời gọi, không có docker kill
    expect(calls).toHaveLength(1);
    const { cmd, args } = calls[0];
    expect(cmd).toBe('docker');
    // mảng đối số, không qua shell; mỗi cờ là một phần tử riêng
    expect(args.slice(0, 2)).toEqual(['run', '--rm']);
    expect(args).toEqual(
      expect.arrayContaining([
        '--cpus=1',
        '--memory=1g',
        '--memory-swap=1g',
        '--pids-limit=128',
        '--network=none',
        '--read-only',
        '--tmpfs',
        '/tmp:size=64m',
      ]),
    );
    // cứng hoá: bỏ mọi capability + cấm tự nâng quyền (mỗi cờ đi kèm đúng giá trị của nó)
    expect(args[args.indexOf('--cap-drop') + 1]).toBe('ALL');
    expect(args[args.indexOf('--security-opt') + 1]).toBe('no-new-privileges');
    expect(args[args.indexOf('--name') + 1]).toMatch(/^pyrun-[0-9a-f-]{36}$/);
    // mount bằng --mount ... readonly, không dùng -v
    expect(args).not.toContain('-v');
    expect(args[args.indexOf('--mount') + 1]).toMatch(
      /^type=bind,source=.+,target=\/code,readonly$/,
    );
    expect(args.slice(-3)).toEqual(['py-sandbox', 'python', '/code/main.py']);
    // mã người dùng không bao giờ nằm trên dòng lệnh
    expect(args.join(' ')).not.toContain('print(1+1)');
  });

  it('timeout: gọi docker kill đúng tên container và báo timedOut', async () => {
    const calls = installExec((c) =>
      c.cb(err({ killed: true, signal: 'SIGKILL', code: null }), '', ''),
    );
    const result = await makeService().run('while True: pass');

    expect(result.timedOut).toBe(true);
    expect(result.outputTruncated).toBe(false);
    expect(result.exitCode).toBeNull();

    const name = calls[0].args[calls[0].args.indexOf('--name') + 1];
    const kill = calls.find((c) => c.args[0] === 'kill');
    expect(kill).toBeDefined();
    expect(kill!.cmd).toBe('docker');
    expect(kill!.args).toEqual(['kill', name]);
  });

  it('timeout đọc từ cấu hình và truyền cho execFile', async () => {
    installExec((c) => c.cb(null, '', ''));
    await makeService({ PY_RUN_TIMEOUT_MS: 3000 }).run('pass');
    const calls = execMock.mock.calls as unknown[][];
    const opts = calls[0][2] as Record<string, unknown>;
    expect(opts).toMatchObject({ timeout: 3000, maxBuffer: 1024 * 1024 });
  });

  it('tràn maxBuffer: báo outputTruncated (không phải timedOut) và docker kill', async () => {
    const calls = installExec((c) =>
      c.cb(
        err({
          killed: true,
          signal: 'SIGKILL',
          code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
        }),
        'x'.repeat(1024),
        '',
      ),
    );
    const result = await makeService().run('while True: print("x")');

    expect(result.outputTruncated).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.stdout).toHaveLength(1024);
    expect(calls.some((c) => c.args[0] === 'kill')).toBe(true);
  });

  it('thoát 137 (hết RAM): trả nguyên exitCode, KHÔNG gọi docker kill', async () => {
    const calls = installExec((c) =>
      c.cb(err({ code: 137, killed: false }), '', 'Killed'),
    );
    const result = await makeService().run('x = b"x" * 2**31');

    expect(result).toMatchObject({
      exitCode: 137,
      timedOut: false,
      outputTruncated: false,
    });
    expect(calls.some((c) => c.args[0] === 'kill')).toBe(false);
  });

  it('thư mục tạm LUÔN bị xoá: khi chạy xong, khi timeout và khi lỗi hạ tầng', async () => {
    const dirs: string[] = [];
    const record = (c: Call) => {
      const dir = mountedDir(c.args);
      // trong lúc chạy thì file main.py phải có thật
      expect(existsSync(`${dir}/main.py`)).toBe(true);
      dirs.push(dir);
    };

    installExec((c) => {
      record(c);
      c.cb(null, 'ok', '');
    });
    await makeService().run('print("ok")');

    installExec((c) => {
      record(c);
      c.cb(err({ killed: true, signal: 'SIGKILL' }), '', '');
    });
    await makeService().run('while True: pass');

    installExec((c) => {
      record(c);
      c.cb(err({ code: 'ENOENT' }), '', '');
    });
    await expect(makeService().run('pass')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(dirs).toHaveLength(3);
    for (const dir of dirs) expect(existsSync(dir)).toBe(false);
  });

  describe('hàng đợi', () => {
    // Nhường vòng lặp sự kiện một nhịp, dùng cho các khẳng định PHỦ ĐỊNH
    // ("chưa spawn", "không chạy muộn") — chỗ đó không có mốc nào để chờ.
    const settle = () => new Promise((r) => setTimeout(r, 50));

    /**
     * Chờ TỚI KHI executor đã spawn đủ `n` container, thay vì ngủ cố định 50ms.
     *
     * Vì sao: trước khi gọi execFile, executor còn mkdtemp + writeFile (I/O
     * thật), nên "đã spawn chưa" là việc của đĩa chứ không phải của đồng hồ.
     * 50ms đủ khi chạy riêng file này nhưng KHÔNG đủ khi chạy cả bộ (`npx jest
     * --ci` mở 11 worker, ts-jest biên dịch nguội): đo được 2–4 ca trượt mỗi
     * lần chạy sau khi xoá cache, với hai triệu chứng "Received length: 0" và
     * "Exceeded timeout of 5000 ms" — test đọc `pending[0]` khi mảng còn rỗng
     * nên lời hứa không bao giờ được trả lời.
     *
     * Tệ hơn cả trượt oan: test đi tiếp khi bài cũ chưa tới execFile làm lời
     * gọi muộn rơi vào mock của test SAU, lệch bộ đếm của nó (ca "chỗ được nhả
     * khi bài LỖI hạ tầng" trượt vì n đã bị +1 từ ca trước).
     */
    const spawned = async (pending: Call[], n: number) => {
      const deadline = Date.now() + 5_000;
      while (pending.length < n) {
        if (Date.now() > deadline) {
          throw new Error(
            `chờ quá lâu: mong ${n} docker run, có ${pending.length}`,
          );
        }
        await new Promise((r) => setTimeout(r, 5));
      }
    };

    /** Chờ tới khi executor đã gọi `docker kill` (cũng là I/O, không theo đồng hồ). */
    const killed = async (calls: Call[]) => {
      const deadline = Date.now() + 5_000;
      while (!calls.some((c) => c.args[0] === 'kill')) {
        if (Date.now() > deadline)
          throw new Error('chờ quá lâu: không thấy docker kill');
        await new Promise((r) => setTimeout(r, 5));
      }
    };

    it('hết chỗ thì XẾP HÀNG (không 429), chạy khi có chỗ và báo queuedMs', async () => {
      const pending: Call[] = [];
      installExec((c) => pending.push(c));
      const service = makeService({ PY_RUN_MAX_CONCURRENT: 1 });

      const first = service.run('while True: pass');
      await spawned(pending, 1);
      expect(pending).toHaveLength(1);

      const second = service.run('print(2)');
      await settle();
      // lượt hai ĐANG CHỜ: chưa spawn container, cũng chưa bị từ chối
      expect(pending).toHaveLength(1);

      pending[0].cb(null, '', '');
      const firstResult = await first;
      expect(firstResult.queuedMs).toBeLessThan(40); // vào chạy ngay

      await spawned(pending, 2);
      expect(pending).toHaveLength(2); // nhả chỗ → lượt hai được chạy
      pending[1].cb(null, '2\n', '');
      const secondResult = await second;
      expect(secondResult.stdout).toBe('2\n');
      expect(secondResult.queuedMs).toBeGreaterThanOrEqual(40); // đã chờ lượt một
    });

    it('hàng đầy → 429 "Máy chủ đang quá tải" ngay, không spawn thêm', async () => {
      const pending: Call[] = [];
      installExec((c) => pending.push(c));
      const service = makeService({
        PY_RUN_MAX_CONCURRENT: 1,
        PY_RUN_QUEUE_MAX: 1,
      });

      const running = service.run('while True: pass');
      await spawned(pending, 1);
      const waiting = service.run('print(2)'); // chiếm chỗ duy nhất trong hàng
      await settle();

      const rejected = await service.run('print(3)').catch((e: unknown) => e);
      expect(rejected).toBeInstanceOf(HttpException);
      expect((rejected as HttpException).getStatus()).toBe(429);
      expect((rejected as HttpException).message).toBe(QUEUE_BUSY_MESSAGE);
      expect(pending).toHaveLength(1);

      pending[0].cb(null, '', '');
      await running;
      await spawned(pending, 2);
      pending[1].cb(null, '', '');
      await waiting;
    });

    it('chờ quá PY_RUN_QUEUE_TIMEOUT_MS → rút khỏi hàng, 429 cùng thông điệp', async () => {
      const pending: Call[] = [];
      installExec((c) => pending.push(c));
      const service = makeService({
        PY_RUN_MAX_CONCURRENT: 1,
        PY_RUN_QUEUE_TIMEOUT_MS: 100,
      });

      const running = service.run('while True: pass');
      await spawned(pending, 1);
      const timedOut = await service.run('print(2)').catch((e: unknown) => e);

      expect((timedOut as HttpException).getStatus()).toBe(429);
      expect((timedOut as HttpException).message).toBe(QUEUE_BUSY_MESSAGE);
      pending[0].cb(null, '', '');
      await running;
      await settle();
      // bài hết hạn không được chạy "muộn" khi chỗ trống ra
      expect(pending).toHaveLength(1);
    });

    it('client ngắt khi bài đang CHỜ → rút khỏi hàng, bài không bao giờ chạy', async () => {
      const pending: Call[] = [];
      installExec((c) => pending.push(c));
      const service = makeService({ PY_RUN_MAX_CONCURRENT: 1 });

      const running = service.run('while True: pass');
      await spawned(pending, 1);
      const client = new AbortController();
      const abandoned = service
        .run('print("không được chạy")', client.signal)
        .catch((e: unknown) => e);
      await settle();
      client.abort();
      expect(await abandoned).toBeInstanceOf(ClientClosedRequestException);

      pending[0].cb(null, '', '');
      await running;
      await settle();
      expect(pending).toHaveLength(1); // chỉ bài đầu từng được chạy

      // chỗ không bị rò: lượt sau chạy được ngay
      installExec((c) => c.cb(null, '3\n', ''));
      await expect(service.run('print(3)')).resolves.toMatchObject({
        stdout: '3\n',
      });
    });

    it('client ngắt khi bài đang CHẠY → docker kill đúng container để nhả chỗ ngay', async () => {
      const pending: Call[] = [];
      const calls = installExec((c) => pending.push(c));
      const service = makeService({ PY_RUN_MAX_CONCURRENT: 1 });

      const client = new AbortController();
      const run = service
        .run('while True: pass', client.signal)
        .catch((e: unknown) => e);
      await spawned(pending, 1);
      const name = pending[0].args[pending[0].args.indexOf('--name') + 1];
      expect(calls.some((c) => c.args[0] === 'kill')).toBe(false);

      client.abort();
      await killed(calls);
      const kill = calls.find((c) => c.args[0] === 'kill');
      expect(kill).toBeDefined();
      expect(kill!.args).toEqual(['kill', name]);

      // docker run kết thúc sau khi bị kill (137): chỗ được nhả cho người sau
      pending[0].cb(err({ code: 137 }), '', '');
      await run;
      installExec((c) => c.cb(null, '4\n', ''));
      await expect(service.run('print(4)')).resolves.toMatchObject({
        stdout: '4\n',
      });
    });

    it('huỷ khi vừa tới lượt (trước khi spawn) → không tạo container', async () => {
      installExec((c) => c.cb(null, '', ''));
      const client = new AbortController();
      client.abort();
      await expect(
        makeService().run('print(1)', client.signal),
      ).rejects.toBeInstanceOf(ClientClosedRequestException);
      expect(execMock).not.toHaveBeenCalled();
    });

    it('chỗ được nhả khi bài LỖI hạ tầng hoặc HẾT GIỜ — không kẹt hàng', async () => {
      let n = 0;
      installExec((c) => {
        n++;
        if (n === 1)
          c.cb(err({ code: 'ENOENT' }), '', ''); // lỗi hạ tầng
        else if (n === 2)
          c.cb(err({ killed: true, signal: 'SIGKILL' }), '', ''); // hết giờ
        else c.cb(null, 'ok\n', '');
      });
      const service = makeService({ PY_RUN_MAX_CONCURRENT: 1 });

      await expect(service.run('x')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect((await service.run('y')).timedOut).toBe(true);
      await expect(service.run('z')).resolves.toMatchObject({ stdout: 'ok\n' });
    });
  });

  it('PY_RUN_MEMORY cấu hình RAM cho cả --memory và --memory-swap', async () => {
    const calls = installExec((c) => c.cb(null, '', ''));
    await makeService({ PY_RUN_MEMORY: '1.5g' }).run('pass');
    const { args } = calls[0];
    expect(args).toContain('--memory=1536m');
    expect(args).toContain('--memory-swap=1536m');
    expect(args).toContain('--cpus=1'); // CPU không đổi theo RAM
    expect(args[args.indexOf('--cap-drop') + 1]).toBe('ALL'); // cờ cứng hoá còn nguyên
  });

  it('từ chối mã quá 20 KB (đếm BYTE) trước khi đụng tới docker', async () => {
    installExec((c) => c.cb(null, '', ''));
    // 7000 ký tự × 3 byte = 21000 byte > 20480, dù chỉ 7000 ký tự
    await expect(makeService().run('ệ'.repeat(7000))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(execMock).not.toHaveBeenCalled();
  });
});
