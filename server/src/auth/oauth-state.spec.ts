import type { Request, Response } from 'express';
import {
  OAUTH_STATE_ERROR,
  OAUTH_STATE_TTL_MS,
  createOAuthStateStore,
  issueOAuthState,
  oauthStateCookieName,
  verifyOAuthState,
} from './oauth-state';

/**
 * `state` của OAuth — chặn LOGIN CSRF.
 *
 * Không có `state`, /auth/google/callback nhận bất kỳ `?code=` nào: kẻ tấn công
 * lấy code của CHÍNH NÓ rồi dụ trình duyệt nạn nhân gọi vào callback, server
 * phát token cho danh tính kẻ tấn công vào phiên của nạn nhân. Các test dưới
 * đây mô phỏng đúng kịch bản đó (trình duyệt nạn nhân KHÔNG có cookie state)
 * và sẽ fail nếu bỏ tham số `state`/`store` khỏi strategy hoặc nới lỏng
 * verifyOAuthState.
 */

const SECRET = 'secret-du-32-ky-tu-cho-hmac-oauth-state-test';

type FakeRes = Response & {
  _cookies: Record<string, { value: string; options: any }>;
  _cleared: { name: string; options: any }[];
};

function fakeRes(): FakeRes {
  const cookies: Record<string, { value: string; options: any }> = {};
  const cleared: { name: string; options: any }[] = [];
  return {
    _cookies: cookies,
    _cleared: cleared,
    cookie: jest.fn((name: string, value: string, options: any) => {
      cookies[name] = { value, options };
    }),
    clearCookie: jest.fn((name: string, options: any) => {
      cleared.push({ name, options });
    }),
  } as unknown as FakeRes;
}

/** Request mang theo đúng những cookie trình duyệt sẽ gửi kèm. */
function fakeReq(cookies: Record<string, string> = {}): Request {
  const entries = Object.entries(cookies);
  return {
    headers: entries.length
      ? {
          cookie: entries
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('; '),
        }
      : {},
  } as unknown as Request;
}

/** Mô phỏng trọn một vòng: phát state ở /auth/<provider>, rồi quay lại callback. */
function roundTrip(provider = 'google') {
  const res = fakeRes();
  const state = issueOAuthState(res, provider, SECRET);
  const nonce = res._cookies[oauthStateCookieName(provider)].value;
  return { res, state, nonce, req: fakeReq({ [oauthStateCookieName(provider)]: nonce }) };
}

describe('issueOAuthState', () => {
  it('state khác nhau mỗi lần và không đoán được (nonce 32 byte ngẫu nhiên)', () => {
    const a = roundTrip();
    const b = roundTrip();
    expect(a.state).not.toBe(b.state);
    expect(a.nonce).not.toBe(b.nonce);
    // 32 byte -> 43 ký tự base64url.
    expect(a.nonce).toHaveLength(43);
  });

  it('cookie state là httpOnly, SameSite=Lax, chỉ gửi tới /auth, sống ngắn', () => {
    const { res } = roundTrip();
    const { options } = res._cookies['pe_oauth_state_google'];

    expect(options.httpOnly).toBe(true);
    // 'lax' là BẮT BUỘC: callback là điều hướng top-level cross-site từ
    // provider về đây; 'strict' sẽ không gửi cookie -> hỏng mọi lần đăng nhập.
    expect(options.sameSite).toBe('lax');
    expect(options.path).toBe('/auth');
    expect(options.maxAge).toBe(OAUTH_STATE_TTL_MS);
  });

  it('cookie KHÔNG chứa state đầy đủ — chỉ nonce, phần ký nằm ở query', () => {
    const { res, state, nonce } = roundTrip();
    expect(res._cookies['pe_oauth_state_google'].value).toBe(nonce);
    expect(state.startsWith(`${nonce}.`)).toBe(true);
    expect(state.split('.')).toHaveLength(3);
  });

  it('mỗi provider một cookie riêng -> hai luồng song song không ghi đè nhau', () => {
    const res = fakeRes();
    issueOAuthState(res, 'google', SECRET);
    issueOAuthState(res, 'facebook', SECRET);
    expect(Object.keys(res._cookies).sort()).toEqual([
      'pe_oauth_state_facebook',
      'pe_oauth_state_google',
    ]);
  });
});

describe('verifyOAuthState', () => {
  it('vòng hợp lệ -> chấp nhận', () => {
    const { req, state } = roundTrip();
    expect(verifyOAuthState(req, fakeRes(), 'google', SECRET, state)).toBe(
      true,
    );
  });

  it('KỊCH BẢN LOGIN CSRF: có code+state nhưng trình duyệt nạn nhân không có cookie -> TỪ CHỐI', () => {
    // Kẻ tấn công tự chạy /auth/google nên state nó biết, nhưng cookie
    // httpOnly chỉ nằm trong trình duyệt CỦA NÓ, không nằm ở nạn nhân.
    const { state } = roundTrip();
    const victim = fakeReq(); // không có cookie nào

    expect(verifyOAuthState(victim, fakeRes(), 'google', SECRET, state)).toBe(
      false,
    );
  });

  it('callback không kèm state (đúng hiện trạng cũ) -> TỪ CHỐI', () => {
    const { req } = roundTrip();
    for (const missing of [undefined, null, '', 0, {}]) {
      expect(verifyOAuthState(req, fakeRes(), 'google', SECRET, missing)).toBe(
        false,
      );
    }
  });

  it('state tự bịa / sai chữ ký -> TỪ CHỐI', () => {
    const { req, nonce } = roundTrip();
    const forged = `${nonce}.${Date.now() + OAUTH_STATE_TTL_MS}.chu-ky-bia`;
    expect(verifyOAuthState(req, fakeRes(), 'google', SECRET, forged)).toBe(
      false,
    );
    expect(verifyOAuthState(req, fakeRes(), 'google', SECRET, nonce)).toBe(
      false,
    );
  });

  it('sửa hạn dùng để phát lại state cũ -> TỪ CHỐI (chữ ký phủ cả exp)', () => {
    const { req, state, nonce } = roundTrip();
    const sig = state.split('.')[2];
    const extended = `${nonce}.${Date.now() + 10 * OAUTH_STATE_TTL_MS}.${sig}`;
    expect(verifyOAuthState(req, fakeRes(), 'google', SECRET, extended)).toBe(
      false,
    );
  });

  it('state hết hạn -> TỪ CHỐI', () => {
    const { req, state } = roundTrip();
    const later = Date.now() + OAUTH_STATE_TTL_MS + 1000;
    expect(
      verifyOAuthState(req, fakeRes(), 'google', SECRET, state, later),
    ).toBe(false);
  });

  it('state của provider khác -> TỪ CHỐI (nhãn provider nằm trong dữ liệu ký)', () => {
    const res = fakeRes();
    const state = issueOAuthState(res, 'google', SECRET);
    const nonce = res._cookies['pe_oauth_state_google'].value;
    // Cùng nonce, nhưng đem sang cookie/luồng facebook.
    const req = fakeReq({ pe_oauth_state_facebook: nonce });

    expect(verifyOAuthState(req, fakeRes(), 'facebook', SECRET, state)).toBe(
      false,
    );
  });

  it('ký bằng secret khác -> TỪ CHỐI', () => {
    const { req, state } = roundTrip();
    expect(
      verifyOAuthState(req, fakeRes(), 'google', 'secret-khac-hoan-toan', state),
    ).toBe(false);
  });

  it('nonce lấy từ luồng khác (cookie không khớp state) -> TỪ CHỐI', () => {
    const a = roundTrip();
    const b = roundTrip();
    // Cookie của vòng B, state của vòng A: chữ ký của A vẫn đúng nhưng nonce lệch.
    expect(verifyOAuthState(b.req, fakeRes(), 'google', SECRET, a.state)).toBe(
      false,
    );
  });

  it('state dùng MỘT LẦN: cookie bị xoá kể cả khi verify thất bại', () => {
    const ok = fakeRes();
    const { req, state } = roundTrip();
    verifyOAuthState(req, ok, 'google', SECRET, state);
    expect(ok._cleared.map((c) => c.name)).toEqual(['pe_oauth_state_google']);
    expect(ok._cleared[0].options.path).toBe('/auth');

    const failed = fakeRes();
    verifyOAuthState(fakeReq(), failed, 'google', SECRET, 'rac');
    expect(failed._cleared.map((c) => c.name)).toEqual([
      'pe_oauth_state_google',
    ]);
  });
});

describe('createOAuthStateStore (cắm vào passport-oauth2)', () => {
  it('store/verify phải đúng 3 và 4 tham số', () => {
    // passport-oauth2 (lib/strategy.js) chọn overload theo Function.length:
    // lệch arity là nó gọi sai nhánh và state KHÔNG được kiểm nữa.
    const store = createOAuthStateStore('google', SECRET);
    expect(store.store.length).toBe(3);
    expect(store.verify.length).toBe(4);
  });

  const META = {
    authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenURL: 'https://oauth2.googleapis.com/token',
    clientID: 'client-id',
  };

  it('store() trả state và đặt cookie, verify() chấp nhận đúng vòng đó', () => {
    const store = createOAuthStateStore('google', SECRET);
    const res = fakeRes();
    const req = { headers: {}, res } as unknown as Request;

    let issued: string | undefined;
    store.store(req, META, (err, state) => {
      expect(err).toBeNull();
      issued = state;
    });
    expect(issued).toBeDefined();

    const nonce = res._cookies['pe_oauth_state_google'].value;
    const callbackRes = fakeRes();
    const callbackReq = {
      ...fakeReq({ pe_oauth_state_google: nonce }),
      res: callbackRes,
    } as unknown as Request;

    const seen: unknown[] = [];
    store.verify(callbackReq, issued!, META, (...args) => seen.push(args));
    expect(seen).toEqual([[null, true]]);
  });

  it('verify() báo fail kèm message thay vì ném lỗi -> guard redirect về FE', () => {
    const store = createOAuthStateStore('google', SECRET);
    const res = fakeRes();
    const req = { headers: {}, res } as unknown as Request;

    const calls: unknown[][] = [];
    store.verify(req, 'state-khong-khop', META, (...args) => calls.push(args));

    // (err=null, ok=false, info) -> passport gọi fail(info, 403), KHÔNG error().
    expect(calls).toEqual([[null, false, { message: OAUTH_STATE_ERROR }]]);
  });

  it('không có response để đặt cookie -> báo lỗi chứ không phát state mù', () => {
    const store = createOAuthStateStore('google', SECRET);
    const calls: unknown[][] = [];
    store.store({ headers: {} } as unknown as Request, META, (...args) =>
      calls.push(args),
    );
    expect(calls[0][0]).toBeInstanceOf(Error);
    expect(calls[0][1]).toBeUndefined();
  });
});
