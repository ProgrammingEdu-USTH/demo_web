import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  PHIEN_BAN_DONG_Y,
  trangThaiDongY,
  type TrangThaiDongY,
} from './learning-event-consent';
import { lamSachLo, mocClient } from './learning-events.sanitize';

/**
 * Trạng thái đồng ý giữ trong bộ nhớ 60 giây (khuôn `CachedUserService`).
 *
 * Vì sao cache: `POST /events` là route có tần suất cao nhất của hệ thống (mỗi
 * người học đang mở bài đẩy một lô mỗi 10 giây hoặc mỗi 20 sự kiện), mà sự đồng
 * ý thì hầu như không đổi. Không cache thì MỖI lô tốn hai vòng tới Neon (đọc
 * đồng ý rồi `createMany`); có cache thì chỉ còn `createMany`.
 *
 * Vì sao cache KHÔNG làm chậm việc rút lại: `ghiQuyetDinh()` xoá mục của người
 * đó NGAY sau khi ghi, nên lô kế tiếp đọc lại DB. Đây là yêu cầu của cổng đồng
 * ý, không phải tối ưu: rút lại mà còn bị ghi thêm 60 giây là ghi đúng thứ
 * người ta vừa nói đừng ghi.
 *
 * Cache trong bộ nhớ của MỘT tiến trình — chạy nhiều instance thì instance khác
 * vẫn giữ bản cũ tối đa 60 giây (cùng giới hạn đã ghi cho CachedUserService).
 */
const TTL_MS = 60_000;
const MAX_ENTRIES = 10_000;

type MucCache = { tt: TrangThaiDongY; hetHan: number };

export type KetQuaGhi = {
  ok: true;
  /** Người học đã đồng ý chưa. `false` thì lô bị bỏ qua, không ghi gì. */
  consent: boolean;
  /** Số hàng THẬT SỰ chèn. */
  accepted: number;
  /** Sự kiện hợp lệ nhưng `eid` đã có trong DB (client gửi lại lô). */
  duplicates: number;
  /** Sự kiện bị bỏ vì sai hợp đồng (xem learning-events.sanitize.ts). */
  dropped: number;
};

@Injectable()
export class LearningEventsService {
  private readonly logger = new Logger(LearningEventsService.name);
  private readonly cache = new Map<number, MucCache>();
  /**
   * Tăng mỗi lần có người đổi quyết định. Một lần đọc DB bắt đầu TRƯỚC khi ai
   * đó rút lại mà kết thúc SAU thì mang trạng thái cũ; nếu cứ thế ghi vào cache
   * thì việc rút lại bị đè bởi bản "đã đồng ý" suốt 60 giây. So thế hệ trước và
   * sau lần đọc để chặn đúng cuộc đua đó.
   */
  private theHe = 0;

  constructor(private readonly prisma: PrismaService) {}

  async layDongY(userId: number): Promise<TrangThaiDongY> {
    const hit = this.cache.get(userId);
    if (hit && hit.hetHan > Date.now()) return hit.tt;

    const theHeTruoc = this.theHe;
    const moiNhat = await this.prisma.learningEventConsent.findFirst({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { granted: true, version: true },
    });
    const tt = trangThaiDongY(moiNhat);
    if (theHeTruoc === this.theHe) this.datCache(userId, tt);
    return tt;
  }

  /**
   * Ghi MỘT HÀNG MỚI cho mỗi quyết định, kể cả rút lại — bảng chỉ thêm, để
   * chứng minh được cả lúc đồng ý lẫn lúc rút lại.
   */
  async ghiQuyetDinh(
    userId: number,
    granted: boolean,
  ): Promise<TrangThaiDongY> {
    await this.prisma.learningEventConsent.create({
      data: { userId, granted, version: PHIEN_BAN_DONG_Y },
    });
    this.theHe++;
    this.cache.delete(userId);
    return trangThaiDongY({ granted, version: PHIEN_BAN_DONG_Y });
  }

  /**
   * Ghi một lô. "Cố gắng hết sức": lỗi DB KHÔNG được làm hỏng việc học — frontend
   * gửi bằng `void apiFetch(...).catch(...)` nên không ai chờ kết quả, và một 500
   * ở đây chỉ làm `apiFetch` thử những đường không cần thiết.
   */
  async ghiLo(
    userId: number,
    events: readonly unknown[],
    sentAt: string | undefined,
    bayGio: Date = new Date(),
  ): Promise<KetQuaGhi> {
    const { sach, dropped } = lamSachLo(events, bayGio);
    // Không còn gì để ghi thì khỏi tốn vòng đọc đồng ý.
    if (!sach.length) {
      return { ok: true, consent: true, accepted: 0, duplicates: 0, dropped };
    }

    // Lớp phòng thủ thứ hai: frontend đã tắt gửi khi chưa đồng ý. Trả 2xx chứ
    // không 403 — 403 không cho client thêm thông tin gì, chỉ thêm log đỏ.
    const dongY = await this.layDongY(userId);
    if (!dongY.granted) {
      return { ok: true, consent: false, accepted: 0, duplicates: 0, dropped };
    }

    const clientSentAt = mocClient(sentAt, bayGio);
    try {
      const { count } = await this.prisma.learningEvent.createMany({
        data: sach.map((sk) => ({
          eventId: sk.eventId,
          userId,
          courseId: sk.courseId,
          lessonNo: sk.lessonNo,
          screenKey: sk.screenKey,
          kind: sk.kind,
          // Cột Json nullable: `null` của JS không phải NULL của SQL với Prisma.
          payload: sk.payload ?? Prisma.DbNull,
          clientAt: sk.clientAt,
          clientSentAt,
        })),
        skipDuplicates: true,
      });
      return {
        ok: true,
        consent: true,
        accepted: count,
        duplicates: sach.length - count,
        dropped,
      };
    } catch (err) {
      // CHỈ in thông điệp lỗi — không in payload hay sự kiện: đó là dữ liệu hành
      // vi của người học, không thuộc về log.
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Ghi ${sach.length} sự kiện thất bại (user ${userId}): ${msg}`,
      );
      return { ok: true, consent: true, accepted: 0, duplicates: 0, dropped };
    }
  }

  private datCache(userId: number, tt: TrangThaiDongY): void {
    if (this.cache.size >= MAX_ENTRIES && !this.cache.has(userId)) {
      // Map giữ thứ tự chèn nên khoá đầu tiên là mục cũ nhất. Duyệt bằng
      // for-of chứ không `keys().next().value`: cái sau có kiểu `any` (lint
      // no-unsafe-assignment — chính lỗi đang có ở CachedUserService).
      for (const cuNhat of this.cache.keys()) {
        this.cache.delete(cuNhat);
        break;
      }
    }
    this.cache.set(userId, { tt, hetHan: Date.now() + TTL_MS });
  }
}
