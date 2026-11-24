import { ServiceUnavailableException } from '@nestjs/common';
import { Semaphore } from './semaphore';

const gate = () => {
  let release!: () => void;
  const p = new Promise<void>((r) => (release = r));
  return { p, release };
};
const tick = () => new Promise((r) => setImmediate(r));

describe('Semaphore', () => {
  it('không bao giờ chạy quá max tác vụ cùng lúc và chạy hết theo thứ tự đến', async () => {
    const s = new Semaphore(2);
    let now = 0;
    let peak = 0;
    const order: number[] = [];
    const gates = Array.from({ length: 5 }, gate);
    const jobs = gates.map((g, i) =>
      s.run(async () => {
        now++;
        peak = Math.max(peak, now);
        order.push(i);
        await g.p;
        now--;
      }),
    );
    await tick();
    expect(s.running).toBe(2);
    expect(s.queued).toBe(3);
    gates.forEach((g) => g.release());
    await Promise.all(jobs);
    expect(peak).toBe(2);
    expect(order).toEqual([0, 1, 2, 3, 4]);
    expect(s.running).toBe(0);
  });

  it('trả chỗ khi tác vụ ném lỗi (không rò chỗ)', async () => {
    const s = new Semaphore(1);
    await expect(s.run(() => Promise.reject(new Error('x')))).rejects.toThrow(
      'x',
    );
    await expect(s.run(() => Promise.resolve(7))).resolves.toBe(7);
    expect(s.running).toBe(0);
  });

  it('max <= 0 là tắt vách ngăn', async () => {
    const s = new Semaphore(0);
    const gates = Array.from({ length: 4 }, gate);
    const jobs = gates.map((g) => s.run(() => g.p));
    await tick();
    expect(s.queued).toBe(0);
    gates.forEach((g) => g.release());
    await Promise.all(jobs);
  });

  it('chờ quá maxWaitMs thì ném 503 và không làm kẹt hàng', async () => {
    jest.useFakeTimers();
    try {
      const s = new Semaphore(1, 1000);
      const g = gate();
      const first = s.run(() => g.p);
      const second = s.run(() => Promise.resolve('không bao giờ chạy'));
      const caught = second.catch((e: unknown) => e);
      await jest.advanceTimersByTimeAsync(1001);
      expect(await caught).toBeInstanceOf(ServiceUnavailableException);
      expect(s.queued).toBe(0);
      g.release();
      await first;
      await expect(s.run(() => Promise.resolve('ok'))).resolves.toBe('ok');
    } finally {
      jest.useRealTimers();
    }
  });
});
