import {
  QUEUE_BUSY_MESSAGE,
  QueueAbortedError,
  QueueRejectedError,
  RunQueue,
} from './run-queue';

/** Một "bài" giả: chạy tới khi test gọi finish()/fail(). */
function makeTask(name: string, log: string[]) {
  let finish!: (v?: string) => void;
  let fail!: (e: Error) => void;
  const done = new Promise<string>((resolve, reject) => {
    finish = (v = name) => resolve(v);
    fail = reject;
  });
  return {
    finish: (v?: string) => finish(v),
    fail: (e: Error) => fail(e),
    run: () => {
      log.push(`start:${name}`);
      return done;
    },
  };
}

const flush = () => Promise.resolve().then(() => Promise.resolve());

describe('RunQueue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const make = (
    over: Partial<ConstructorParameters<typeof RunQueue>[0]> = {},
  ) =>
    new RunQueue({ slots: 1, queueMax: 100, queueTimeoutMs: 30_000, ...over });

  it('còn chỗ thì chạy NGAY, queuedMs = 0', async () => {
    const q = make({ slots: 2 });
    const log: string[] = [];
    const t = makeTask('a', log);
    const p = q.run(() => t.run());
    await flush();
    expect(log).toEqual(['start:a']);
    t.finish();
    await expect(p).resolves.toEqual({ value: 'a', queuedMs: 0 });
  });

  it('hết chỗ thì xếp hàng và chạy theo đúng thứ tự đến (FIFO)', async () => {
    const q = make({ slots: 1 });
    const log: string[] = [];
    const tasks = ['a', 'b', 'c', 'd'].map((n) => makeTask(n, log));
    const runs = tasks.map((t) => q.run(() => t.run()));
    await flush();
    expect(log).toEqual(['start:a']); // chỉ một bài chạy, ba bài chờ
    expect(q.stats()).toMatchObject({ running: 1, queued: 3 });

    for (const t of tasks) {
      t.finish();
      await flush();
    }
    await Promise.all(runs);
    expect(log).toEqual(['start:a', 'start:b', 'start:c', 'start:d']);
  });

  it('không bao giờ chạy quá `slots` bài cùng lúc', async () => {
    const q = make({ slots: 2 });
    const log: string[] = [];
    const tasks = ['a', 'b', 'c', 'd', 'e'].map((n) => makeTask(n, log));
    const runs = tasks.map((t) => q.run(() => t.run()));
    await flush();
    expect(log).toEqual(['start:a', 'start:b']);
    expect(q.stats().running).toBe(2);

    tasks[0].finish();
    await flush();
    expect(log).toEqual(['start:a', 'start:b', 'start:c']);
    expect(q.stats().running).toBe(2);

    tasks.slice(1).forEach((t) => t.finish());
    await flush();
    tasks.slice(2).forEach((t) => t.finish());
    await Promise.all(runs);
  });

  it('người đến SAU không chen ngang người đang chờ khi vừa có chỗ trống', async () => {
    const q = make({ slots: 1 });
    const log: string[] = [];
    const a = makeTask('a', log);
    const b = makeTask('b', log);
    const c = makeTask('c', log);
    const ra = q.run(() => a.run());
    const rb = q.run(() => b.run());
    await flush();
    a.finish();
    // `a` xong → chỗ trống được trao cho `b` ngay; `c` đến liền sau phải xếp sau `b`
    const rc = q.run(() => c.run());
    await flush();
    expect(log).toEqual(['start:a', 'start:b']);
    b.finish();
    await flush();
    c.finish();
    await Promise.all([ra, rb, rc]);
    expect(log).toEqual(['start:a', 'start:b', 'start:c']);
  });

  it('đo queuedMs = thời gian chờ trong hàng', async () => {
    const q = make({ slots: 1 });
    const log: string[] = [];
    const a = makeTask('a', log);
    const b = makeTask('b', log);
    const ra = q.run(() => a.run());
    const rb = q.run(() => b.run());
    await flush();
    jest.advanceTimersByTime(1500);
    a.finish();
    await ra;
    await flush();
    b.finish();
    await expect(rb).resolves.toMatchObject({ value: 'b', queuedMs: 1500 });
  });

  it('hàng đầy → QueueRejectedError(FULL) ngay, thông điệp "Máy chủ đang quá tải"', async () => {
    const q = make({ slots: 1, queueMax: 2 });
    const log: string[] = [];
    const tasks = ['a', 'b', 'c'].map((n) => makeTask(n, log));
    const runs = tasks.map((t) => q.run(() => t.run())); // 1 chạy + 2 chờ = đầy
    await flush();

    const rejected = q.run(() => makeTask('d', log).run());
    await expect(rejected).rejects.toBeInstanceOf(QueueRejectedError);
    await expect(rejected).rejects.toMatchObject({
      reason: 'FULL',
      message: QUEUE_BUSY_MESSAGE,
    });
    expect(log).not.toContain('start:d');
    expect(q.stats().queued).toBe(2); // bài bị từ chối không chiếm chỗ trong hàng

    tasks.forEach((t) => t.finish());
    await flush();
    tasks.forEach((t) => t.finish());
    await flush();
    await Promise.all(runs);
  });

  it('queueMax = 0: hết chỗ là từ chối ngay, không xếp hàng', async () => {
    const q = make({ slots: 1, queueMax: 0 });
    const a = makeTask('a', []);
    const ra = q.run(() => a.run());
    await flush();
    await expect(q.run(() => Promise.resolve('b'))).rejects.toMatchObject({
      reason: 'FULL',
    });
    a.finish();
    await ra;
  });

  it('chờ quá queueTimeoutMs → rút khỏi hàng, QueueRejectedError(TIMEOUT), bài không chạy', async () => {
    const q = make({ slots: 1, queueTimeoutMs: 5000 });
    const log: string[] = [];
    const a = makeTask('a', log);
    const b = makeTask('b', log);
    const ra = q.run(() => a.run());
    const rb = q.run(() => b.run());
    const settled = rb.catch((e: unknown) => e);
    await flush();

    jest.advanceTimersByTime(4999);
    await flush();
    expect(q.stats().queued).toBe(1); // chưa tới hạn

    jest.advanceTimersByTime(1);
    const error = await settled;
    expect(error).toBeInstanceOf(QueueRejectedError);
    expect(error).toMatchObject({
      reason: 'TIMEOUT',
      message: QUEUE_BUSY_MESSAGE,
    });
    expect(q.stats().queued).toBe(0);

    a.finish(); // chỗ trống ra: bài đã hết hạn KHÔNG được chạy muộn
    await ra;
    await flush();
    expect(log).toEqual(['start:a']);
  });

  it('bài tới lượt đúng lúc thì huỷ đồng hồ chờ (không bị TIMEOUT oan sau đó)', async () => {
    const q = make({ slots: 1, queueTimeoutMs: 5000 });
    const log: string[] = [];
    const a = makeTask('a', log);
    const b = makeTask('b', log);
    const ra = q.run(() => a.run());
    const rb = q.run(() => b.run());
    await flush();
    jest.advanceTimersByTime(1000);
    a.finish();
    await ra;
    await flush();
    expect(log).toEqual(['start:a', 'start:b']);
    jest.advanceTimersByTime(60_000); // quá hạn chờ từ lâu nhưng b đã chạy
    b.finish();
    await expect(rb).resolves.toMatchObject({ value: 'b' });
  });

  describe('huỷ (client ngắt kết nối)', () => {
    it('đang CHỜ → rút khỏi hàng, QueueAbortedError, bài KHÔNG chạy', async () => {
      const q = make({ slots: 1 });
      const log: string[] = [];
      const a = makeTask('a', log);
      const b = makeTask('b', log);
      const c = makeTask('c', log);
      const ra = q.run(() => a.run());
      const client = new AbortController();
      const rb = q.run(() => b.run(), client.signal);
      const rc = q.run(() => c.run());
      const settledB = rb.catch((e: unknown) => e);
      await flush();
      expect(q.stats().queued).toBe(2);

      client.abort();
      expect(await settledB).toBeInstanceOf(QueueAbortedError);
      expect(q.stats().queued).toBe(1);

      a.finish();
      await ra;
      await flush();
      // `c` (đến sau `b`) lên thay; `b` không bao giờ chạy
      expect(log).toEqual(['start:a', 'start:c']);
      c.finish();
      await rc;
    });

    it('đã huỷ từ trước khi gọi → từ chối ngay, không chiếm chỗ, không chạy', async () => {
      const q = make();
      const client = new AbortController();
      client.abort();
      const task = jest.fn(() => Promise.resolve('x'));
      await expect(q.run(task, client.signal)).rejects.toBeInstanceOf(
        QueueAbortedError,
      );
      expect(task).not.toHaveBeenCalled();
      expect(q.stats().running).toBe(0);
    });

    it('đang CHẠY → signal được chuyển cho bài để nó tự dừng (giết container)', async () => {
      const q = make();
      const client = new AbortController();
      let seen: AbortSignal | undefined;
      let finish!: () => void;
      const run = q.run((signal) => {
        seen = signal;
        return new Promise<string>((resolve) => {
          finish = () => resolve('đã dừng');
        });
      }, client.signal);
      await flush();

      expect(seen).toBe(client.signal);
      expect(seen!.aborted).toBe(false);
      client.abort();
      expect(seen!.aborted).toBe(true);
      finish();
      await expect(run).resolves.toMatchObject({ value: 'đã dừng' });
    });

    it('huỷ dọn sạch listener (không rò khi dùng lại một signal)', async () => {
      const q = make({ slots: 1 });
      const a = makeTask('a', []);
      const b = makeTask('b', []);
      const client = new AbortController();
      const add = jest.spyOn(client.signal, 'addEventListener');
      const remove = jest.spyOn(client.signal, 'removeEventListener');
      const ra = q.run(() => a.run());
      const rb = q.run(() => b.run(), client.signal);
      await flush();
      expect(add).toHaveBeenCalledTimes(1);
      a.finish();
      await ra;
      await flush();
      expect(remove).toHaveBeenCalledTimes(1); // tới lượt thì gỡ listener chờ
      b.finish();
      await rb;
    });
  });

  describe('nhả chỗ', () => {
    it('khi bài LỖI (ném lỗi): lỗi được trả đúng và chỗ được nhả cho người sau', async () => {
      const q = make({ slots: 1 });
      const log: string[] = [];
      const a = makeTask('a', log);
      const b = makeTask('b', log);
      const ra = q.run(() => a.run());
      const rb = q.run(() => b.run());
      const failed = ra.catch((e: unknown) => e);
      await flush();

      a.fail(new Error('docker lỗi'));
      expect(await failed).toMatchObject({ message: 'docker lỗi' });
      await flush();
      expect(log).toEqual(['start:a', 'start:b']);
      b.finish();
      await rb;
      expect(q.stats().running).toBe(0);
    });

    it('khi bài HẾT GIỜ (kết thúc với timedOut) và khi bị kill: chỗ vẫn được nhả', async () => {
      const q = make({ slots: 1 });
      const results = [
        { timedOut: true, exitCode: null },
        { timedOut: false, exitCode: 137 }, // bị kill / hết RAM
        { timedOut: false, exitCode: 0 },
      ];
      for (const r of results) {
        await expect(q.run(() => Promise.resolve(r))).resolves.toMatchObject({
          value: r,
        });
        expect(q.stats().running).toBe(0);
      }
    });

    it('lỗi liên tiếp không làm kẹt hàng: chạy nối tiếp nhiều bài lỗi rồi bài tốt', async () => {
      const q = make({ slots: 1 });
      const bad = Array.from({ length: 5 }, () =>
        q.run(() => Promise.reject(new Error('x'))).catch(() => 'lỗi'),
      );
      const good = q.run(() => Promise.resolve('tốt'));
      await expect(Promise.all(bad)).resolves.toEqual(Array(5).fill('lỗi'));
      await expect(good).resolves.toMatchObject({ value: 'tốt' });
      expect(q.stats()).toMatchObject({ running: 0, queued: 0 });
    });
  });

  it('stats() phản ánh cấu hình và trạng thái', async () => {
    const q = make({ slots: 3, queueMax: 7 });
    expect(q.stats()).toEqual({ slots: 3, running: 0, queued: 0, queueMax: 7 });
    const a = makeTask('a', []);
    const ra = q.run(() => a.run());
    await flush();
    expect(q.stats().running).toBe(1);
    a.finish();
    await ra;
  });
});
