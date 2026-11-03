/**
 * proxy.ts (Next 16 — tên mới của middleware.ts). Ba việc, theo thứ tự:
 *
 * 1. /backend/* → backend NestJS. Trình duyệt chỉ thấy cùng origin với
 *    frontend: URL backend (Render) không còn nằm trong HTML, bundle hay CSP,
 *    và cookie refresh httpOnly là cookie first-party (không bị Safari/Chrome
 *    chặn như cookie bên thứ ba). BACKEND_URL là biến SERVER, không phải
 *    NEXT_PUBLIC_*. Kèm PROXY_SECRET để backend từ chối request gọi thẳng, và
 *    x-pe-client-ip (Vercel ghi đè x-forwarded-for nên giá trị này tin được)
 *    để rate limit theo IP thật của người dùng.
 *
 * 2. Chặn người chưa đăng nhập TRƯỚC khi trang render (optimistic check bằng
 *    cookie cờ pe_has_session — xem pe-bridge.js; dữ liệu vẫn do API chặn 401).
 *
 * 3. CSP dùng nonce cho mọi trang: script-src chỉ nhận script mang nonce của
 *    request này + script do chúng nạp ('strict-dynamic'), không còn
 *    'unsafe-inline' hay domain CDN nào. Handler onclick="…" của JS legacy
 *    được pe-bridge.js chuyển thành listener (xem phần CSP shim ở đó).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const PROXY_SECRET = process.env.PROXY_SECRET || '';
const BACKEND_PREFIX = '/backend';

// Route mới của điều hướng 5 mục (DECISIONS #7): /community, /profile, /settings cần đăng nhập.
// /playground KHÔNG nằm đây: khách dùng được (PAGES.md), chỉ việc lưu snippet mới cần đăng nhập.
// /arena giữ như hiện tại (trang tự xử lý khi chưa đăng nhập).
const PROTECTED = [
  '/dashboard', '/courses', '/lesson', '/practice', '/admin', '/questionaire',
  '/community', '/profile', '/settings',
];

function proxyBackend(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const target = new URL(pathname.slice(BACKEND_PREFIX.length) + search, BACKEND_URL);
  const headers = new Headers(request.headers);
  // IP thật của người dùng: Vercel tự đặt x-real-ip / x-forwarded-for và ghi đè
  // giá trị client gửi lên, nên không giả được khi chạy trên Vercel.
  const clientIp =
    request.headers.get('x-real-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (clientIp) headers.set('x-pe-client-ip', clientIp);
  if (PROXY_SECRET) headers.set('x-pe-proxy-secret', PROXY_SECRET);
  return NextResponse.rewrite(target, { request: { headers } });
}

function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  return [
    "default-src 'self'",
    // 'unsafe-eval' chỉ ở dev: React dùng eval để dựng lại stack lỗi.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Style nội tuyến (style="…" của JS legacy, <style> của Mermaid) vẫn cần.
    "style-src 'self' 'unsafe-inline'",
    // Avatar OAuth (Google/Facebook) là URL https bất kỳ.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === BACKEND_PREFIX || pathname.startsWith(BACKEND_PREFIX + '/')) {
    return proxyBackend(request);
  }

  if (
    PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/')) &&
    !request.cookies.has('pe_has_session')
  ) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Mọi trang + /backend/*; bỏ file tĩnh (đã có header riêng ở next.config.ts).
      source:
        '/((?!_next/static|_next/image|static/|favicon.ico|robots.txt|sitemap.xml|\\.well-known/).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
