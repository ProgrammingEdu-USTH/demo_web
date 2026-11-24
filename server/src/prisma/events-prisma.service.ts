import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from 'src/generated/prisma';
import { createMonitoredNeon } from './neon-pool';

/**
 * Client RIÊNG cho việc ghi `learning_events` (BE11).
 *
 * Vì sao tách: sự kiện học là "cố gắng hết sức". Chung một pool 50 thì một đợt gửi lô sự kiện
 * (cả lớp rời trang cùng lúc) chiếm connection của hoàn thành bài/XP — việc không được mất.
 * Pool riêng nhỏ (EVENTS_POOL_MAX, mặc định 5) + chờ connection ngắn (EVENTS_CONNECT_TIMEOUT_MS,
 * mặc định 2,5 s): hết thì BỎ lô, không xếp hàng, và không bao giờ lấy connection của pool chính.
 * Đổi lại cổng DB thấy thêm tối đa 5 connection từ mỗi bản backend.
 *
 * Cách dùng ở route ghi sự kiện: `const n = await events.tryWrite(db => db.learningEvent.createMany(...))`
 * rồi trả 202 dù n === undefined. KHÔNG dùng client này cho việc nào phải thành công.
 */
@Injectable()
export class EventsPrismaService
  extends PrismaClient
  implements OnModuleDestroy
{
  private readonly log = new Logger(EventsPrismaService.name);
  private readonly stopMonitor: () => void;
  private dropped = 0;
  private lastError = '';
  private reportTimer?: NodeJS.Timeout;

  constructor() {
    const { adapter, stop } = createMonitoredNeon('events', {
      connectionString: process.env.DATABASE_URL!,
      connectionTimeoutMillis: Number(
        process.env.EVENTS_CONNECT_TIMEOUT_MS ?? 2_500,
      ),
      idleTimeoutMillis: 30_000,
      max: Number(process.env.EVENTS_POOL_MAX ?? 5),
    });
    super({ adapter });
    this.stopMonitor = stop;
    // Đếm lô bỏ: log mỗi 60 s và chỉ khi có, để không ồn lúc yên.
    this.reportTimer = setInterval(() => {
      if (this.dropped > 0) {
        this.log.warn(
          `60 s qua đã bỏ ${this.dropped} lô sự kiện (lỗi cuối: ${this.lastError})`,
        );
        this.dropped = 0;
      }
    }, 60_000);
    this.reportTimer.unref();
  }

  /** Chạy `op`; mọi lỗi → bỏ, đếm, trả `undefined`. KHÔNG BAO GIỜ ném ra request học. */
  async tryWrite<T>(
    op: (db: PrismaClient) => Promise<T>,
  ): Promise<T | undefined> {
    try {
      return await op(this);
    } catch (e) {
      this.dropped++;
      // Giữ lỗi cuối để một lỗi LẬP TRÌNH (không phải hết pool) không bị nuốt âm thầm.
      this.lastError = e instanceof Error ? e.message.slice(0, 200) : String(e);
      return undefined;
    }
  }

  async onModuleDestroy() {
    this.stopMonitor();
    if (this.reportTimer) clearInterval(this.reportTimer);
    await this.$disconnect();
  }
}
