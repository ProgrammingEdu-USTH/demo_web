import { Logger } from '@nestjs/common';
import { PrismaNeon } from '@prisma/adapter-neon';

interface PoolLike {
  waitingCount: number;
  totalCount: number;
  idleCount: number;
}

/**
 * Theo dõi hàng chờ connection của một pool. Adapter không đo thời gian chờ, nhưng pool của `pg`
 * lộ `waitingCount` (số request đang xếp hàng): lấy mẫu mỗi giây, hàng chờ khác 0 ở ≥ 2 mẫu liền
 * nhau nghĩa là có người đã chờ > 1 s (đây là SUY RA từ mẫu, không phải số đo từng request).
 */
export class PoolWaitMonitor {
  private maxWaiting = 0;
  private streak = 0;

  constructor(
    private readonly name: string,
    private readonly logger: Pick<Logger, 'log' | 'warn'>,
  ) {}

  sample(p: PoolLike): void {
    this.maxWaiting = Math.max(this.maxWaiting, p.waitingCount);
    this.streak = p.waitingCount > 0 ? this.streak + 1 : 0;
    // Chỉ cảnh báo ở mẫu thứ 2 của mỗi đợt, không lặp mỗi giây.
    if (this.streak === 2) {
      this.logger.warn(
        `Pool ${this.name}: hàng chờ connection > 1 s (đang chờ ${p.waitingCount}, tổng ${p.totalCount}, rảnh ${p.idleCount})`,
      );
    }
  }

  flush(p: PoolLike): void {
    this.logger.log(
      `Pool ${this.name}: 60 s qua hàng chờ tối đa ${this.maxWaiting}; hiện tổng ${p.totalCount}, rảnh ${p.idleCount}, chờ ${p.waitingCount}`,
    );
    this.maxWaiting = 0;
  }
}

/** PrismaNeon + lấy được pool bên dưới để đo. Trả kèm hàm `stop` cho onModuleDestroy. */
export function createMonitoredNeon(
  name: string,
  config: ConstructorParameters<typeof PrismaNeon>[0],
): { adapter: PrismaNeon; stop: () => void } {
  const logger = new Logger(`Pool:${name}`);
  const monitor = new PoolWaitMonitor(name, logger);
  const timers: NodeJS.Timeout[] = [];

  class MonitoredNeon extends PrismaNeon {
    async connect() {
      const adapter = await super.connect();
      const pool = adapter.underlyingDriver() as unknown as PoolLike;
      timers.push(
        setInterval(() => monitor.sample(pool), 1_000),
        setInterval(() => monitor.flush(pool), 60_000),
      );
      timers.forEach((t) => t.unref());
      return adapter;
    }
  }

  return {
    adapter: new MonitoredNeon(config),
    stop: () => timers.splice(0).forEach(clearInterval),
  };
}
