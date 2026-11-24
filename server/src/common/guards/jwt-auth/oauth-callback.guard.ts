import { ExecutionContext, Injectable, Type } from '@nestjs/common';
import { AuthGuard, IAuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

/** Request được gắn thêm message lỗi OAuth để controller redirect kèm thông báo. */
export type OAuthErrorRequest = Request & { oauthError?: string };

/**
 * AuthGuard mặc định NÉM exception khi strategy báo lỗi (done(err)) — nhưng ở
 * route callback OAuth, người dùng đang được TRÌNH DUYỆT điều hướng nên sẽ
 * nhìn thấy trang JSON 401 thô thay vì quay về frontend. Ví dụ: nhánh từ chối
 * auto-link trong validateOAuthLogin (chống pre-hijacking) ném
 * UnauthorizedException với message tiếng Việt cần hiển thị cho người dùng.
 *
 * Guard này nuốt lỗi, lưu message vào req.oauthError và trả user=undefined để
 * rơi đúng vào nhánh `if (!user) res.redirect(...)` sẵn có trong AuthController.
 */

/**
 * Lý do từ chối cũng có thể tới qua `info` của passport `fail(info, status)`,
 * KHÔNG chỉ qua `done(err)`.
 *
 * Cần nhánh này sau khi bật kiểm `state`: state sai/thiếu/hết hạn làm
 * passport-oauth2 gọi `fail({ message }, 403)` chứ không gọi `error()`. Không
 * đọc `info` thì người dùng chỉ nhận `?error=oauth_failed` trống trơn và không
 * biết phải bấm đăng nhập lại.
 */
function messageOf(info: unknown): string | undefined {
  if (typeof info === 'string') return info || undefined;
  if (info && typeof info === 'object') {
    const message = (info as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return undefined;
}

/**
 * Kiểu trả về là `Type<IAuthGuard>`, KHÔNG phải `Type<CanActivate>`.
 *
 * `CanActivate` chỉ khai `canActivate`, nên lớp con (GoogleCallbackGuard…) mất
 * hẳn `handleRequest` trong kiểu — và `handleRequest` mới chính là chỗ duy
 * nhất quyết định "lý do từ chối có về tới frontend hay không". Khai
 * `Type<CanActivate>` thì test gọi vào đúng cái móc đó không biên dịch được,
 * và cách duy nhất còn lại là ép `as any` — tức là test chạy trên một kiểu
 * KHÁC với kiểu Nest thực sự gọi. `IAuthGuard` (@nestjs/passport) là kiểu thật
 * mà `AuthGuard()` trả về và có sẵn `handleRequest`, nên dùng nó vừa giữ được
 * kiểm tra kiểu vừa để test gọi đúng seam mà @nestjs/passport gọi lúc chạy.
 */
function createOAuthCallbackGuard(provider: string): Type<IAuthGuard> {
  @Injectable()
  class OAuthCallbackGuard extends AuthGuard(provider) {
    handleRequest<TUser = unknown>(
      err: unknown,
      user: unknown,
      info: unknown,
      context: ExecutionContext,
    ): TUser {
      const message =
        err instanceof Error ? err.message : user ? undefined : messageOf(info);
      if (message) {
        const req = context.switchToHttp().getRequest<OAuthErrorRequest>();
        req.oauthError = message;
      }
      return (user || undefined) as TUser;
    }
  }
  return OAuthCallbackGuard;
}

export class GoogleCallbackGuard extends createOAuthCallbackGuard('google') {}
export class FacebookCallbackGuard extends createOAuthCallbackGuard(
  'facebook',
) {}
