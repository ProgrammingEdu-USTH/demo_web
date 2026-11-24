import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthService } from 'src/auth/auth.service';
import { OAUTH_STATE_ERROR } from 'src/auth/oauth-state';
import { FacebookStrategy } from './facebook.strategy';
import { GoogleStrategy } from './google.strategy';
import {
  FacebookCallbackGuard,
  GoogleCallbackGuard,
  type OAuthErrorRequest,
} from './oauth-callback.guard';

/**
 * Hai nửa của việc chống login CSRF ở tầng khai báo:
 *   1. Strategy PHẢI cắm state store — không có thì passport-oauth2 dùng
 *      NullStore, tức callback nhận mọi `?code=` y như hiện trạng cũ.
 *   2. Guard callback phải chuyển được lý do từ chối (`fail(info, 403)`) thành
 *      req.oauthError để controller redirect kèm thông báo.
 */

const CONFIG = {
  getOrThrow: (key: string) => {
    const values: Record<string, string> = {
      'oauth.google.clientId': 'google-client-id',
      'oauth.google.clientSecret': 'google-client-secret',
      'oauth.google.callbackUrl': 'http://localhost:5000/auth/google/callback',
      'oauth.facebook.clientId': 'fb-client-id',
      'oauth.facebook.clientSecret': 'fb-client-secret',
      'oauth.facebook.callbackUrl':
        'http://localhost:5000/auth/facebook/callback',
      'jwt.accessSecret': 'secret-du-32-ky-tu-cho-hmac-oauth-state-test',
    };
    const value = values[key];
    if (!value) throw new Error(`thiếu config ${key}`);
    return value;
  },
} as unknown as ConfigService;

const AUTH = {} as unknown as AuthService;

describe('Strategy OAuth phải bật tham số state', () => {
  it.each([
    ['google', () => new GoogleStrategy(CONFIG, AUTH)],
    ['facebook', () => new FacebookStrategy(CONFIG, AUTH)],
  ])('%s: có state store, không phải NullStore', (_name, build) => {
    const store = (build() as unknown as { _stateStore: any })._stateStore;

    // NullStore.store có 2 tham số và luôn trả state rỗng -> state không bao
    // giờ được sinh/kiểm. Store của app có 3/4 tham số (arity passport dùng
    // để chọn overload có `meta`).
    expect(store).toBeDefined();
    expect(store.constructor?.name).not.toBe('NullStore');
    expect(store.store.length).toBe(3);
    expect(store.verify.length).toBe(4);
  });

  it('google và facebook ký state bằng nhãn provider riêng', () => {
    const google = (new GoogleStrategy(CONFIG, AUTH) as any)._stateStore;
    const facebook = (new FacebookStrategy(CONFIG, AUTH) as any)._stateStore;

    const res = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as any;

    let googleState = '';
    google.store({ headers: {}, res }, {}, (_e: unknown, s: string) => {
      googleState = s;
    });
    const nonce = res.cookie.mock.calls[0][1];

    // Đem state của google sang luồng facebook (cùng nonce) -> phải bị từ chối.
    const req = {
      headers: { cookie: `pe_oauth_state_facebook=${nonce}` },
      res: { cookie: jest.fn(), clearCookie: jest.fn() },
    };
    const calls: unknown[][] = [];
    facebook.verify(req, googleState, {}, (...args: unknown[]) =>
      calls.push(args),
    );
    expect(calls[0][1]).toBe(false);
  });
});

describe('OAuthCallbackGuard — chuyển lý do từ chối về frontend', () => {
  function contextFor(req: Request): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  }

  it.each([
    ['google', () => new GoogleCallbackGuard()],
    ['facebook', () => new FacebookCallbackGuard()],
  ])(
    '%s: state sai -> passport fail(info) được ghi vào req.oauthError',
    (_name, build) => {
      const req = { headers: {} } as OAuthErrorRequest;

      // Đúng những gì passport-oauth2 truyền khi state store trả ok=false.
      const user = build().handleRequest(
        null,
        false,
        { message: OAUTH_STATE_ERROR },
        contextFor(req),
      );

      expect(user).toBeUndefined();
      expect(req.oauthError).toBe(OAUTH_STATE_ERROR);
    },
  );

  it('info dạng chuỗi cũng được nhận', () => {
    const req = { headers: {} } as OAuthErrorRequest;
    new GoogleCallbackGuard().handleRequest(
      null,
      false,
      'state khong hop le',
      contextFor(req),
    );
    expect(req.oauthError).toBe('state khong hop le');
  });

  it('lỗi từ done(err) vẫn được giữ nguyên như trước', () => {
    const req = { headers: {} } as OAuthErrorRequest;
    new GoogleCallbackGuard().handleRequest(
      new Error('Email này đã liên kết tài khoản khác'),
      false,
      undefined,
      contextFor(req),
    );
    expect(req.oauthError).toBe('Email này đã liên kết tài khoản khác');
  });

  it('đăng nhập thành công -> trả user, không gắn thông báo lỗi', () => {
    const req = { headers: {} } as OAuthErrorRequest;
    const me = { id: 1 };
    const user = new GoogleCallbackGuard().handleRequest(
      null,
      me,
      { message: 'ghi chu vo hai' },
      contextFor(req),
    );
    expect(user).toBe(me);
    expect(req.oauthError).toBeUndefined();
  });
});
