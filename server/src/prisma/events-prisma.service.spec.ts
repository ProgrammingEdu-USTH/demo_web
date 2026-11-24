import { EventsPrismaService } from './events-prisma.service';

// BE11: sự kiện học bị bỏ khi pool sự kiện hết, và KHÔNG ném lỗi vào request học.
describe('EventsPrismaService.tryWrite', () => {
  let svc: EventsPrismaService;
  beforeAll(() => {
    process.env.DATABASE_URL ??= 'postgres://u:p@localhost:5432/db';
    svc = new EventsPrismaService();
  });
  afterAll(() => svc.onModuleDestroy());

  it('pool hết → trả undefined, không ném', async () => {
    const op = jest
      .fn()
      .mockRejectedValue(new Error('timeout exceeded when trying to connect'));
    await expect(svc.tryWrite(op)).resolves.toBeUndefined();
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('thành công thì trả kết quả của op', async () => {
    await expect(
      svc.tryWrite(() => Promise.resolve({ count: 3 })),
    ).resolves.toEqual({ count: 3 });
  });
});
