import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Backend chỉ trả JSON và redirect (OAuth) — không bao giờ trả HTML hay script
 * cho trình duyệt render, nên CSP chặt tuyệt đối: không nạp gì, không được nhúng.
 * CSP của các TRANG nằm ở frontend/src/proxy.ts.
 */
const CONTENT_SECURITY_POLICY =
  "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

const PERMISSIONS_POLICY =
  'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), ' +
  'bluetooth=(), magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=()';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  private readonly isProduction = process.env.NODE_ENV === 'production';

  use(req: Request, res: Response, next: NextFunction) {
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    // same-site (không phải same-origin): lúc dev frontend :3000 gọi thẳng :5000.
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    // Không quảng cáo framework.
    res.removeHeader('X-Powered-By');

    if (this.isProduction) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }

    next();
  }
}
