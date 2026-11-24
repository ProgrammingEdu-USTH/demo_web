import type { CookieOptions, Request, Response } from 'express';

/**
 * Refresh token sống trong cookie httpOnly thay vì localStorage: JS trên trang
 * (kể cả script bị chèn qua XSS) không đọc được, nên một lỗ XSS không còn đủ
 * để mang phiên 8 giờ của người dùng đi nơi khác.
 *
 * path=/auth: trình duyệt chỉ gửi cookie tới /auth/refresh và /auth/logout,
 * không đính kèm vào mọi request /api/*.
 */
export const REFRESH_COOKIE = 'pe_refresh';
const COOKIE_PATH = '/auth';

type SameSite = 'lax' | 'strict' | 'none';

function sameSite(): SameSite {
  const v = process.env.REFRESH_COOKIE_SAMESITE?.toLowerCase();
  return v === 'strict' || v === 'none' ? v : 'lax';
}

function baseOptions(): CookieOptions {
  const site = sameSite();
  return {
    httpOnly: true,
    // SameSite=None bắt buộc đi kèm Secure, trình duyệt từ chối nếu thiếu.
    secure: process.env.NODE_ENV === 'production' || site === 'none',
    sameSite: site,
    path: COOKIE_PATH,
  };
}

export function setRefreshCookie(
  res: Response,
  token: string,
  maxAgeMs: number,
): void {
  res.cookie(REFRESH_COOKIE, token, { ...baseOptions(), maxAge: maxAgeMs });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, baseOptions());
}

/**
 * Đọc một cookie từ header thô — app không nạp cookie-parser.
 *
 * Dùng chung cho refresh token và state của OAuth (oauth-state.ts) để chỉ có
 * MỘT cách parse cookie trong hệ thống: thêm middleware hay đổi cách decode
 * thì sửa đúng một chỗ.
 */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      const value = decodeURIComponent(part.slice(eq + 1).trim());
      return value || undefined;
    }
  }
  return undefined;
}

/** Đọc cookie không cần cookie-parser — chỉ cần đúng một cookie này. */
export function readRefreshCookie(req: Request): string | undefined {
  return readCookie(req, REFRESH_COOKIE);
}
