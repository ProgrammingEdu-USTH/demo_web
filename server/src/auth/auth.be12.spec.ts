import {
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { AuthService } from './auth.service';
import { LoginAttemptLimiter } from './login-attempt-limiter';
import { WerkzeugScryptHasher } from 'src/common/security/werkzeug-scrypt-hasher';

// BE12: không trùng sđt, đăng ký trùng → 409, upgrade giữ user_id (tiến độ), khoá đoán mật khẩu.

type Row = {
  id: number;
  email: string;
  phone: string | null;
  password: string;
  name: string;
  oauthProvider: string | null;
  questionnaireCompleted: boolean;
  role: string;
};

type W = {
  id?: number;
  email?: string;
  phone?: string;
  password?: string;
  OR?: W[];
};

function setup(rows: Row[]) {
  const prisma = {
    user: {
      findMany: jest.fn(({ where }: { where: W }) =>
        Promise.resolve(
          rows.filter((r) =>
            (where.OR ?? []).some(
              (c: W) =>
                (c.email && r.email === c.email) ||
                (c.phone && r.phone === c.phone),
            ),
          ),
        ),
      ),
      findUnique: jest.fn(({ where }: { where: W }) =>
        Promise.resolve(
          rows.find(
            (r) =>
              (where.id && r.id === where.id) ||
              (where.email && r.email === where.email) ||
              (where.phone && r.phone === where.phone),
          ) ?? null,
        ),
      ),
      findUniqueOrThrow: jest.fn(({ where }: { where: W }) =>
        Promise.resolve(rows.find((r) => r.id === where.id)),
      ),
      updateMany: jest.fn(
        ({ where, data }: { where: W; data: Partial<Row> }) => {
          const r = rows.find(
            (x) =>
              x.id === where.id &&
              x.password === where.password &&
              x.email === where.email,
          );
          if (r) Object.assign(r, data);
          return Promise.resolve({ count: r ? 1 : 0 });
        },
      ),
      create: jest.fn(),
    },
  };
  const refresh = {
    issue: jest.fn(() => Promise.resolve('rt')),
    revoke: jest.fn(() => Promise.resolve()),
  };
  const cache = { invalidate: jest.fn() };
  const jwt = { signAsync: jest.fn(() => Promise.resolve('at')) };
  const svc = new AuthService(
    prisma as never,
    jwt as never,
    refresh as never,
    cache as never,
  );
  return { svc, prisma, refresh, cache };
}

const guest = (): Row => ({
  id: 7,
  email: 'guest_x@guest.local',
  phone: null,
  password: '',
  name: 'Khách',
  oauthProvider: null,
  questionnaireCompleted: true,
  role: 'Học viên',
});
const real = (): Row => ({
  id: 9,
  email: 'a@b.com',
  phone: '0912345678',
  password: 'scrypt:x',
  name: 'A',
  oauthProvider: null,
  questionnaireCompleted: true,
  role: 'Học viên',
});
const dto = (o: object) =>
  ({ name: 'Nhan', password: 'matkhau123', ...o }) as never;

describe('register — 409', () => {
  it('trùng sđt → 409 nói đúng trường', async () => {
    const { svc } = setup([real()]);
    await expect(svc.register(dto({ phone: '0912345678' }))).rejects.toThrow(
      /Số điện thoại/,
    );
    await expect(
      svc.register(dto({ phone: '0912345678' })),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('hai request đồng thời: unique index ném P2002 (phone) → 409, không phải 500', async () => {
    const { svc, prisma } = setup([]);
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('x', {
        code: 'P2002',
        clientVersion: '7',
        meta: { target: ['phone'] },
      }),
    );
    await expect(
      svc.register(dto({ phone: '0987654321' })),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('upgrade', () => {
  it('giữ nguyên user_id (nên giữ tiến độ/xp), đổi email+hash+tên, thu hồi phiên cũ', async () => {
    const rows = [guest()];
    const { svc, prisma, refresh, cache } = setup(rows);
    const out = await svc.upgrade(7, dto({ email: 'New@Mail.com' }), 'old-rt');
    expect(out).toMatchObject({ upgraded: true, access: 'at', refresh: 'rt' });
    expect(rows[0]).toMatchObject({
      id: 7,
      email: 'new@mail.com',
      name: 'Nhan',
    });
    expect(rows[0].password).toMatch(/^scrypt:/);
    expect(prisma.user.create).not.toHaveBeenCalled(); // không tạo user mới
    expect(refresh.revoke).toHaveBeenCalledWith('old-rt');
    expect(cache.invalidate).toHaveBeenCalledWith(7);
  });

  it('tài khoản KHÔNG phải khách bị từ chối, dữ liệu không đổi', async () => {
    const rows = [real()];
    const { svc } = setup(rows);
    await expect(
      svc.upgrade(9, dto({ email: 'z@z.com' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(rows[0].email).toBe('a@b.com');
  });

  it('trùng sđt với tài khoản có sẵn → 409, KHÔNG gộp, khách còn nguyên', async () => {
    const rows = [guest(), real()];
    const { svc } = setup(rows);
    await expect(
      svc.upgrade(7, dto({ phone: '0912345678' })),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(rows[0].email).toBe('guest_x@guest.local');
  });

  it('hai upgrade đồng thời: lần sau thấy hàng đã đổi → 403', async () => {
    const rows = [guest()];
    const { svc, prisma } = setup(rows);
    // Cả hai đã đọc được "khách" trước khi ai đó ghi: ép updateMany của lần 2 trượt điều kiện.
    await svc.upgrade(7, dto({ email: 'one@x.com' }));
    prisma.user.findUnique.mockResolvedValueOnce(guest());
    await expect(
      svc.upgrade(7, dto({ email: 'two@x.com' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(rows[0].email).toBe('one@x.com');
  });
});

describe('login', () => {
  it('chọn MỘT định danh: email ưu tiên, tra bằng khoá unique, không OR', async () => {
    const { svc, prisma } = setup([]);
    await expect(
      svc.login({
        email: 'A@B.com',
        phone: '0912345678',
        password: 'x',
      }),
    ).rejects.toThrow();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'a@b.com' },
    });
  });

  it('5 lần sai → lần 6 bị 429 và KHÔNG chạm DB', async () => {
    const { svc, prisma } = setup([]);
    for (let i = 0; i < 5; i++)
      await expect(
        svc.login({ email: 'v@x.com', password: 'sai' }),
      ).rejects.toThrow();
    prisma.user.findUnique.mockClear();
    const e = await svc
      .login({ email: 'v@x.com', password: 'sai' })
      .catch((x: HttpException) => x);
    expect(e).toBeInstanceOf(HttpException);
    expect((e as HttpException).getStatus()).toBe(429);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('đăng nhập đúng xoá bộ đếm', async () => {
    const u = {
      ...real(),
      password: await WerkzeugScryptHasher.encode('dung12345'),
    };
    const { svc } = setup([u]);
    for (let i = 0; i < 4; i++)
      await expect(
        svc.login({ email: 'a@b.com', password: 'sai' }),
      ).rejects.toThrow();
    await expect(
      svc.login({ email: 'a@b.com', password: 'dung12345' }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      svc.login({ email: 'a@b.com', password: 'sai' }),
    ).rejects.not.toMatchObject({ status: 429 });
  });
});

describe('LoginAttemptLimiter', () => {
  it('hết cửa sổ 15 phút thì được thử lại', () => {
    let t = 0;
    const l = new LoginAttemptLimiter(5, 900_000, () => t);
    for (let i = 0; i < 5; i++) l.recordFailure('k');
    expect(l.lockedForSeconds('k')).toBe(900);
    t = 900_001;
    expect(l.lockedForSeconds('k')).toBe(0);
  });
});
