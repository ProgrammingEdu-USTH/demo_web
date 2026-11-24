/**
 * Hàng đợi chạy mã: tối đa `slots` bài chạy cùng lúc, phần vượt xếp hàng FIFO
 * (ai đến trước chạy trước) thay vì bị từ chối ngay.
 *
 * Dùng chung cho backend (LocalExecutor) và runner nên hai chế độ hành xử giống
 * hệt nhau; chỉ dùng Node thuần (không Nest). Hàng đợi nằm trong BỘ NHỚ của một
 * tiến trình: chạy nhiều tiến trình/instance thì mỗi cái có hàng riêng — vì vậy
 * runner phải chạy đúng một tiến trình (pm2 instances: 1).
 *
 * Ba lối ra khỏi hàng ngoài việc tới lượt:
 *   - hàng đã đầy lúc vào            → QueueRejectedError('FULL')
 *   - chờ quá `queueTimeoutMs`        → QueueRejectedError('TIMEOUT')
 *   - người gọi huỷ (AbortSignal)     → QueueAbortedError, bài KHÔNG chạy
 * Chỗ chạy luôn được nhả trong `finally`, dù bài lỗi, hết giờ hay bị kill.
 */

/** Thông điệp cho cả hai kiểu bị từ chối: người dùng không cần biết là đầy hay hết hạn chờ. */
export const QUEUE_BUSY_MESSAGE = 'Máy chủ đang quá tải, thử lại sau';

export class QueueRejectedError extends Error {
  constructor(readonly reason: 'FULL' | 'TIMEOUT') {
    super(QUEUE_BUSY_MESSAGE);
    this.name = 'QueueRejectedError';
  }
}

/** Người gọi đã bỏ đi (ngắt kết nối) khi bài còn đang chờ. */
export class QueueAbortedError extends Error {
  constructor() {
    super('Yêu cầu đã bị huỷ khi đang chờ trong hàng đợi');
    this.name = 'QueueAbortedError';
  }
}

export interface RunQueueOptions {
  /** Số bài chạy đồng thời tối đa. */
  slots: number;
  /** Số bài tối đa được XẾP HÀNG (không tính bài đang chạy). 0 = không cho xếp hàng. */
  queueMax: number;
  /** Chờ quá lâu chưa tới lượt thì rút khỏi hàng và bị từ chối. */
  queueTimeoutMs: number;
}

export interface QueueStats {
  slots: number;
  running: number;
  queued: number;
  queueMax: number;
}

interface Waiter {
  grant: () => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  onAbort: () => void;
}

export class RunQueue {
  private running = 0;
  private readonly waiting: Waiter[] = [];

  constructor(private readonly options: RunQueueOptions) {}

  stats(): QueueStats {
    return {
      slots: this.options.slots,
      running: this.running,
      queued: this.waiting.length,
      queueMax: this.options.queueMax,
    };
  }

  /**
   * Xếp hàng rồi chạy `task`. `queuedMs` là thời gian chờ TRƯỚC khi task bắt
   * đầu (0 nếu chạy ngay). `signal` được chuyển tiếp cho task để nó dừng việc
   * đang chạy khi người gọi bỏ đi.
   */
  async run<T>(
    task: (signal: AbortSignal | undefined) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<{ value: T; queuedMs: number }> {
    if (signal?.aborted) throw new QueueAbortedError();

    const queuedAt = Date.now();
    // `waiting.length === 0`: có người đang chờ thì người đến sau KHÔNG được
    // chen ngang dù vừa có một chỗ trống (giữ đúng FIFO).
    if (this.running < this.options.slots && this.waiting.length === 0) {
      this.running++;
    } else {
      if (this.waiting.length >= this.options.queueMax) {
        throw new QueueRejectedError('FULL');
      }
      await this.enqueue(signal);
    }
    const queuedMs = Date.now() - queuedAt;

    try {
      return { value: await task(signal), queuedMs };
    } finally {
      this.running--;
      this.dispatch();
    }
  }

  /** Chờ tới lượt. Khi resolve, chỗ chạy ĐÃ được tính cho bài này (xem dispatch). */
  private enqueue(signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        grant: resolve,
        reject,
        signal,
        timer: setTimeout(() => {
          this.remove(waiter);
          reject(new QueueRejectedError('TIMEOUT'));
        }, this.options.queueTimeoutMs),
        onAbort: () => {
          this.remove(waiter);
          reject(new QueueAbortedError());
        },
      };
      signal?.addEventListener('abort', waiter.onAbort, { once: true });
      this.waiting.push(waiter);
    });
  }

  private remove(waiter: Waiter): void {
    clearTimeout(waiter.timer);
    waiter.signal?.removeEventListener('abort', waiter.onAbort);
    const i = this.waiting.indexOf(waiter);
    if (i >= 0) this.waiting.splice(i, 1);
  }

  /**
   * Trao chỗ trống cho người chờ lâu nhất. Tăng `running` NGAY ở đây (không đợi
   * bài chờ tỉnh dậy) để hai lần dispatch liên tiếp không cùng trao một chỗ.
   */
  private dispatch(): void {
    while (this.running < this.options.slots && this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      clearTimeout(next.timer);
      next.signal?.removeEventListener('abort', next.onAbort);
      this.running++;
      next.grant();
    }
  }
}
