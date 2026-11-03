import { Injectable, NestMiddleware } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export const PROXY_SECRET_HEADER = 'x-pe-proxy-secret';
export const CLIENT_IP_HEADER = 'x-pe-client-ip';

/** /health cho trình theo dõi của Render gọi thẳng, không qua proxy. */
const OPEN_PATHS = new Set(['/health']);

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Backend chỉ nhận request đi qua proxy /backend của frontend (frontend/src/proxy.ts).
 *
 * Khi PROXY_SECRET được đặt: request thiếu hoặc sai header x-pe-proxy-secret
 * bị 403 — gọi thẳng vào URL Render không còn tác dụng, và header
 * x-pe-client-ip (IP thật proxy chuyển sang) mới đáng tin để rate limit theo IP.
 * Không đặt PROXY_SECRET (dev chạy tách) thì bỏ qua kiểm tra, dùng req.ip.
 */
@Injectable()
export class ProxyAuthMiddleware implements NestMiddleware {
  private readonly secret = process.env.PROXY_SECRET || '';

  use(req: Request, res: Response, next: NextFunction) {
    if (!this.secret) return next();
    if (OPEN_PATHS.has(req.path)) return next();

    const given = req.headers[PROXY_SECRET_HEADER];
    if (typeof given !== 'string' || !sameSecret(given, this.secret)) {
      res.status(403).json({
        error: { status: 403, message: 'Forbidden' },
      });
      return;
    }

    const ip = req.headers[CLIENT_IP_HEADER];
    if (typeof ip === 'string' && ip.trim()) {
      (req as Request & { clientIp?: string }).clientIp = ip.trim();
    }
    next();
  }
}
