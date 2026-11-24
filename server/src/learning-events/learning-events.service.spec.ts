import type { PrismaService } from 'src/prisma/prisma.service';
import { PHIEN_BAN_DONG_Y } from './learning-event-consent';
import { LearningEventsService } from './learning-events.service';

/**
 * Khuôn mock theo AGENTS.md (PrismaMock + asyncMock): kiểu thật ở phần ĐỐI SỐ
 * vì `mock.calls` là bằng chứng — đếm số vòng DB của một lô, và đọc lại
 * `where.userId` để chứng minh không ai đọc được đồng ý của người khác.
 */
type AsyncMock<A extends unknown[] = unknown[]> = jest.Mock<
  Promise<unknown>,
  A
>;
const asyncMock = <A extends unknown[] = unknown[]>(): AsyncMock<A> =>
  jest.fn<Promise<unknown>, A>();

type TimDongY = {
  where: { userId: number };
  orderBy: unknown;
  select: unknown;
};
type TaoDongY = { data: { userId: number; granted: boolean; version: string } };
type TaoNhieu = {
  data: {
    eventId: string;
    userId: number;
    kind: string;
    clientSentAt: Date | null;
  }[];
  skipDuplicates: boolean;
};

type PrismaMock = {
  learningEventConsent: {
    findFirst: AsyncMock<[TimDongY]>;
    create: AsyncMock<[TaoDongY]>;
  };
  learningEvent: { createMany: AsyncMock<[TaoNhieu]> };
};

const USER = 7;
const BAY_GIO = new Date('2026-11-18T10:00:00Z');
const suKien = (eid: string) => ({
  eid,
  kind: 'X-Lesson.Heartbeat',
  courseId: 'python_advanced',
  lessonNo: 3,
  screenKey: 's1-theory',
  payload: { env: 'browser' },
  clientAt: '2026-11-18T09:59:58.000Z',
});
const LO = [
  suKien('3f1c2a4e-9b7d-4c1a-8e2f-5a6b7c8d9e0f'),
  suKien('a1c2e3f4-1111-4222-9333-444455556666'),
];
const SENT_AT = '2026-11-18T09:59:59.000Z';

describe('LearningEventsService', () => {
  let prisma: PrismaMock;
  let service: LearningEventsService;

  beforeEach(() => {
    prisma = {
      learningEventConsent: { findFirst: asyncMock(), create: asyncMock() },
      learningEvent: { createMany: asyncMock() },
    };
    prisma.learningEventConsent.create.mockResolvedValue({});
    prisma.learningEvent.createMany.mockResolvedValue({ count: 2 });
    service = new LearningEventsService(prisma as unknown as PrismaService);
  });

  const dongY = (granted: boolean, version = PHIEN_BAN_DONG_Y) =>
    prisma.learningEventConsent.findFirst.mockResolvedValue({
      granted,
      version,
    });

  describe('GET consent', () => {
    it('chưa có hàng nào: { granted:false, shouldAsk:true } và chỉ đọc hàng của CHÍNH người đó', async () => {
      prisma.learningEventConsent.findFirst.mockResolvedValue(null);
      const tt = await service.layDongY(USER);
      expect(tt).toEqual({
        granted: false,
        shouldAsk: true,
        version: PHIEN_BAN_DONG_Y,
      });
      expect(
        prisma.learningEventConsent.findFirst.mock.calls[0][0].where,
      ).toEqual({
        userId: USER,
      });
    });
  });

  describe('POST consent', () => {
    it('ghi THÊM một hàng kể cả khi rút lại (append-only), kèm phiên bản bản mô tả', async () => {
      const tt = await service.ghiQuyetDinh(USER, false);
      expect(prisma.learningEventConsent.create).toHaveBeenCalledWith({
        data: { userId: USER, granted: false, version: PHIEN_BAN_DONG_Y },
      });
      expect(tt).toEqual({
        granted: false,
        shouldAsk: false,
        version: PHIEN_BAN_DONG_Y,
      });
    });
  });

  describe('POST events', () => {
    it('đã đồng ý: ghi bằng createMany + skipDuplicates, đổi eid → eventId, sentAt → clientSentAt', async () => {
      dongY(true);
      const kq = await service.ghiLo(USER, LO, SENT_AT, BAY_GIO);
      expect(kq).toEqual({
        ok: true,
        consent: true,
        accepted: 2,
        duplicates: 0,
        dropped: 0,
      });
      const goi = prisma.learningEvent.createMany.mock.calls[0][0];
      expect(goi.skipDuplicates).toBe(true);
      expect(goi.data.map((d) => d.eventId)).toEqual(LO.map((e) => e.eid));
      expect(goi.data.every((d) => d.userId === USER)).toBe(true);
      expect(goi.data[0].clientSentAt?.toISOString()).toBe(SENT_AT);
    });

    it('CHƯA đồng ý: trả 2xx nhưng KHÔNG ghi một hàng nào', async () => {
      prisma.learningEventConsent.findFirst.mockResolvedValue(null);
      const kq = await service.ghiLo(USER, LO, SENT_AT, BAY_GIO);
      expect(kq.consent).toBe(false);
      expect(kq.accepted).toBe(0);
      expect(prisma.learningEvent.createMany).not.toHaveBeenCalled();
    });

    it('đồng ý một bản mô tả CŨ thì không được ghi', async () => {
      dongY(true, 'ban-cu');
      await service.ghiLo(USER, LO, SENT_AT, BAY_GIO);
      expect(prisma.learningEvent.createMany).not.toHaveBeenCalled();
    });

    it('khi đã có cache: một lô chỉ tốn MỘT vòng DB (createMany), không đọc lại đồng ý', async () => {
      dongY(true);
      await service.ghiLo(USER, LO, SENT_AT, BAY_GIO);
      await service.ghiLo(USER, LO, SENT_AT, BAY_GIO);
      await service.ghiLo(USER, LO, SENT_AT, BAY_GIO);
      expect(prisma.learningEventConsent.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.learningEvent.createMany).toHaveBeenCalledTimes(3);
    });

    it('RÚT LẠI có hiệu lực NGAY ở lô kế tiếp — không chờ hết 60 giây của cache', async () => {
      dongY(true);
      await service.ghiLo(USER, LO, SENT_AT, BAY_GIO); // cache: đã đồng ý
      expect(prisma.learningEvent.createMany).toHaveBeenCalledTimes(1);

      await service.ghiQuyetDinh(USER, false);
      dongY(false); // DB giờ có hàng rút lại mới nhất

      const kq = await service.ghiLo(USER, LO, SENT_AT, BAY_GIO);
      expect(kq.consent).toBe(false);
      expect(prisma.learningEvent.createMany).toHaveBeenCalledTimes(1);
    });

    it('rút lại GIỮA lúc đang đọc đồng ý: bản đọc cũ KHÔNG được ghi đè vào cache', async () => {
      // Lần đọc bắt đầu khi DB còn "đã đồng ý", nhưng trả về SAU khi người học rút lại.
      let traVe: (v: unknown) => void = () => undefined;
      prisma.learningEventConsent.findFirst.mockReturnValueOnce(
        new Promise((r) => {
          traVe = r;
        }),
      );
      const dangDoc = service.layDongY(USER);
      await service.ghiQuyetDinh(USER, false);
      traVe({ granted: true, version: PHIEN_BAN_DONG_Y });
      await dangDoc;

      dongY(false);
      const kq = await service.ghiLo(USER, LO, SENT_AT, BAY_GIO);
      expect(kq.consent).toBe(false);
      expect(prisma.learningEvent.createMany).not.toHaveBeenCalled();
    });

    it('cache theo NGƯỜI: đồng ý của người A không cho phép ghi của người B', async () => {
      dongY(true);
      await service.ghiLo(USER, LO, SENT_AT, BAY_GIO);
      prisma.learningEventConsent.findFirst.mockResolvedValue(null);
      const kq = await service.ghiLo(USER + 1, LO, SENT_AT, BAY_GIO);
      expect(kq.consent).toBe(false);
      expect(
        prisma.learningEventConsent.findFirst.mock.calls[1][0].where,
      ).toEqual({
        userId: USER + 1,
      });
    });

    it('client gửi lại lô (eid đã có trong DB): đếm vào duplicates, không lỗi', async () => {
      dongY(true);
      prisma.learningEvent.createMany.mockResolvedValue({ count: 0 });
      const kq = await service.ghiLo(USER, LO, SENT_AT, BAY_GIO);
      expect(kq).toMatchObject({ accepted: 0, duplicates: 2 });
    });

    it('DB lỗi khi ghi: vẫn trả về bình thường — ghi sự kiện không được làm hỏng việc học', async () => {
      dongY(true);
      prisma.learningEvent.createMany.mockRejectedValue(
        new Error('connection reset'),
      );
      const log = jest
        .spyOn(
          (service as unknown as { logger: { error: (m: string) => void } })
            .logger,
          'error',
        )
        .mockImplementation(() => undefined);
      await expect(
        service.ghiLo(USER, LO, SENT_AT, BAY_GIO),
      ).resolves.toMatchObject({
        ok: true,
        accepted: 0,
      });
      // Log CHỈ mang thông điệp lỗi, không mang dữ liệu hành vi của người học.
      expect(log.mock.calls[0][0]).not.toContain('s1-theory');
    });

    it('lô không còn sự kiện hợp lệ nào: không tốn vòng DB nào', async () => {
      const kq = await service.ghiLo(
        USER,
        [{ kind: 'Run.Test' }],
        SENT_AT,
        BAY_GIO,
      );
      expect(kq.dropped).toBe(1);
      expect(prisma.learningEventConsent.findFirst).not.toHaveBeenCalled();
      expect(prisma.learningEvent.createMany).not.toHaveBeenCalled();
    });
  });
});
