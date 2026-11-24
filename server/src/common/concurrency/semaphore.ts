import { ServiceUnavailableException } from '@nestjs/common';

/**
 * Vách ngăn (bulkhead) giới hạn số tác vụ nặng chạy CÙNG LÚC trong một tiến trình.
 *
 * Vì sao: transaction hoàn thành bài giữ một connection của pool ~1–2,6 s (11–16 vòng tới
 * Neon). Cả lớp 100 người bấm cùng lúc thì pool 50 cạn, và mọi route ĐỌC (mở bài, danh sách
 * ghi danh, đăng nhập) phải xếp hàng sau chúng dù chỉ cần 1 truy vấn nhỏ. Hàng chờ ở ĐÂY
 * (trong bộ nhớ, rẻ) thay cho hàng chờ ở pool (giữ socket, tranh với route đọc).
 *
 * `max <= 0` = không giới hạn (tắt vách ngăn). Chờ quá `maxWaitMs` thì ném 503 thay vì để người
 * dùng treo vô hạn.
 */
export class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(
    private readonly max: number,
    private readonly maxWaitMs = 10_000,
  ) {}

  get running(): number {
    return this.active;
  }

  get queued(): number {
    return this.waiters.length;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.max <= 0) return fn();
    if (this.active >= this.max) await this.wait();
    else this.active++;
    try {
      return await fn();
    } finally {
      // Trao thẳng chỗ cho người chờ đầu hàng (giữ nguyên `active`), không thì trả chỗ.
      const next = this.waiters.shift();
      if (next) next();
      else this.active--;
    }
  }

  private wait(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = this.waiters.indexOf(grant);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(
          new ServiceUnavailableException(
            'Hệ thống đang quá tải, vui lòng thử lại sau ít phút',
          ),
        );
      }, this.maxWaitMs);
      const grant = () => {
        clearTimeout(timer);
        resolve();
      };
      this.waiters.push(grant);
    });
  }
}
