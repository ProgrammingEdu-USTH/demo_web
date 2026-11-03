import { ProxyAuthMiddleware } from './proxy-auth.middleware';

type Req = { path: string; headers: Record<string, string>; clientIp?: string };

function run(secret: string, req: Req) {
  process.env.PROXY_SECRET = secret;
  const mw = new ProxyAuthMiddleware();
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  mw.use(req as never, res as never, next);
  return { res, next };
}

describe('ProxyAuthMiddleware', () => {
  const SECRET = 'x'.repeat(40);
  afterEach(() => delete process.env.PROXY_SECRET);

  it('không đặt PROXY_SECRET (dev): cho qua, không tin x-pe-client-ip', () => {
    const req: Req = {
      path: '/api/user',
      headers: { 'x-pe-client-ip': '1.2.3.4' },
    };
    const { next } = run('', req);
    expect(next).toHaveBeenCalled();
    expect(req.clientIp).toBeUndefined();
  });

  it('gọi thẳng backend (thiếu secret) → 403', () => {
    const { res, next } = run(SECRET, { path: '/auth/login', headers: {} });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('secret sai → 403', () => {
    const { res } = run(SECRET, {
      path: '/api/user',
      headers: { 'x-pe-proxy-secret': 'y'.repeat(40) },
    });
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('đi qua proxy: cho qua và lấy IP thật từ x-pe-client-ip', () => {
    const req: Req = {
      path: '/api/user',
      headers: { 'x-pe-proxy-secret': SECRET, 'x-pe-client-ip': '203.0.113.7' },
    };
    const { next } = run(SECRET, req);
    expect(next).toHaveBeenCalled();
    expect(req.clientIp).toBe('203.0.113.7');
  });

  it('/health luôn mở cho trình theo dõi của Render', () => {
    const { next } = run(SECRET, { path: '/health', headers: {} });
    expect(next).toHaveBeenCalled();
  });
});
