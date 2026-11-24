import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { CookieOptions, Request, Response } from 'express';
import { readCookie } from './refresh-cookie';

/**
 * Tham số `state` cho OAuth 2.0 (RFC 6749 §10.12) — bịt lỗ LOGIN CSRF.
 *
 * Trước đây GoogleStrategy/FacebookStrategy không khai `state`, nên
 * /auth/google/callback nhận BẤT KỲ `?code=` nào gửi tới. Kịch bản khai thác
 * đã rõ: kẻ tấn công tự bấm đăng nhập Google bằng tài khoản CỦA NÓ, chặn lại ở
 * bước redirect để lấy `code` còn chưa dùng, rồi dụ nạn nhân mở
 * `https://api…/auth/google/callback?code=<code của kẻ tấn công>` (thẻ <img>,
 * link rút gọn, iframe…). Trình duyệt nạn nhân đi trọn vòng còn lại: server
 * đổi code lấy token, map ra DANH TÍNH CỦA KẺ TẤN CÔNG rồi phát access token +
 * đặt cookie refresh httpOnly cho phiên của nạn nhân. Từ đó nạn nhân đang
 * "đăng nhập" bằng tài khoản kẻ tấn công: mọi bài làm, XP, tin nhắn chatbot
 * sau đó rơi vào tài khoản kẻ tấn công đọc được. Ngược lại, nếu nạn nhân đã
 * có liên kết sẵn thì đây là đường ép ghi đè phiên (session fixation).
 *
 * CÁCH LƯU: cookie httpOnly có ký, KHÔNG lưu ở bộ nhớ process.
 *
 * App chạy sau load balancer với nhiều instance, và chính FixedWindowThrottler
 * đã được ghi nhận là điểm yếu vì giữ state trong RAM của từng process. Nếu
 * `state` cũng nằm trong RAM (hoặc dùng SessionStore mặc định của
 * passport-oauth2, vốn đòi express-session) thì request /auth/google và
 * request /auth/google/callback rơi vào HAI instance khác nhau là callback
 * hợp lệ cũng bị từ chối — hỏng đăng nhập mạng xã hội một cách ngẫu nhiên.
 *
 * Ở đây state tự mang theo mọi thứ cần để kiểm:
 *   - tham số `state` gửi cho provider = `nonce.exp.sig`
 *   - cookie chỉ giữ `nonce` (httpOnly, hết hạn 10 phút, path=/auth)
 * Kiểm ở callback: chữ ký đúng (chống tự bịa state), chưa hết hạn (chặn phát
 * lại state cũ dù trình duyệt có bỏ qua maxAge), và nonce TRÙNG cookie. Chữ ký
 * dùng JWT_ACCESS_SECRET nên mọi instance verify được state do instance khác
 * phát — không cần Redis, không cần sticky session, không thêm biến môi trường.
 *
 * Phần chống CSRF nằm ở nonce == cookie: kẻ tấn công không đọc được cookie
 * httpOnly của nạn nhân và cũng không đặt được cookie cho domain API, nên
 * không ghép nổi một cặp (state, cookie) khớp nhau trong trình duyệt nạn nhân.
 */

/** 10 phút: dài hơn thời gian bấm qua trang consent, ngắn hơn mọi mức cần thiết khác. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/** Thông báo đẩy về frontend khi state sai — không tiết lộ sai ở bước nào. */
export const OAUTH_STATE_ERROR =
  'Yêu cầu đăng nhập mạng xã hội không hợp lệ hoặc đã hết hạn, vui lòng thử lại.';

// Giống REFRESH_COOKIE: trình duyệt chỉ gửi cookie này tới /auth/*, không đính
// kèm vào mọi request /api/*.
const COOKIE_PATH = '/auth';

/**
 * Mỗi provider một cookie riêng: mở song song hai tab Google và Facebook thì
 * hai luồng không ghi đè state của nhau (SessionStore của passport dùng chung
 * một khoá nên bị đúng lỗi này).
 */
export function oauthStateCookieName(provider: string): string {
  return `pe_oauth_state_${provider}`;
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // CỐ ĐỊNH 'lax', KHÔNG đọc REFRESH_COOKIE_SAMESITE: callback là một điều
    // hướng top-level cross-site từ accounts.google.com về đây. 'lax' vẫn được
    // gửi trong trường hợp đó, còn 'strict' thì KHÔNG — cấu hình strict sẽ làm
    // mọi lần đăng nhập Google/Facebook thất bại. 'lax' cũng đã đủ: nó chỉ
    // chặn cookie ở request cross-site không phải navigation.
    sameSite: 'lax',
    path: COOKIE_PATH,
  };
}

/**
 * Gắn nhãn miền sử dụng vào dữ liệu ký (domain separation).
 *
 * Dùng chung JWT_ACCESS_SECRET với access token nhưng chuỗi được HMAC luôn mở
 * đầu bằng nhãn + tên provider, nên state của Google không thể dùng lại cho
 * callback Facebook, và không có cách nào biến một state thành một JWT hợp lệ
 * (hay ngược lại).
 */
function sign(secret: string, provider: string, payload: string): string {
  return createHmac('sha256', secret)
    .update(`pe:oauth-state:v1|${provider}|${payload}`)
    .digest('base64url');
}

/** So sánh thời gian hằng — tránh rò rỉ chữ ký/nonce qua timing. */
function equalsConstantTime(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  // timingSafeEqual ném khi khác độ dài, nên phải chặn trước. Độ dài không phải
  // thông tin bí mật ở đây (nonce và sig đều dài cố định).
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Sinh state cho MỘT yêu cầu cấp quyền và đặt cookie tương ứng.
 * Trả về giá trị để đưa vào query `state=` của URL authorize.
 */
export function issueOAuthState(
  res: Response,
  provider: string,
  secret: string,
  now: number = Date.now(),
): string {
  // 32 byte ngẫu nhiên mật mã: không đoán được, không trùng giữa các lần.
  const nonce = randomBytes(32).toString('base64url');
  const payload = `${nonce}.${now + OAUTH_STATE_TTL_MS}`;

  res.cookie(oauthStateCookieName(provider), nonce, {
    ...cookieOptions(),
    maxAge: OAUTH_STATE_TTL_MS,
  });

  return `${payload}.${sign(secret, provider, payload)}`;
}

/**
 * Kiểm state ở callback. `false` = từ chối (thiếu, sai chữ ký, hết hạn, hoặc
 * không khớp cookie) — gọi KHÔNG ĐƯỢC tiếp tục đổi code lấy token.
 *
 * Cookie bị xoá ngay bất kể kết quả: state dùng MỘT LẦN, nên một `code` bị
 * chặn lại cũng không thể phát lại lần hai.
 */
export function verifyOAuthState(
  req: Request,
  res: Response | undefined,
  provider: string,
  secret: string,
  state: unknown,
  now: number = Date.now(),
): boolean {
  const cookieName = oauthStateCookieName(provider);
  const fromCookie = readCookie(req, cookieName);
  if (res) res.clearCookie(cookieName, cookieOptions());

  // Thiếu state hoặc thiếu cookie -> TỪ CHỐI. Đây chính là trường hợp của
  // request do kẻ tấn công dựng: nó không đặt được cookie trong trình duyệt
  // nạn nhân nên nhánh này chặn.
  if (typeof state !== 'string' || !state || !fromCookie) return false;

  const parts = state.split('.');
  if (parts.length !== 3) return false;
  const [nonce, expRaw, sig] = parts;

  if (!equalsConstantTime(sig, sign(secret, provider, `${nonce}.${expRaw}`)))
    return false;

  const exp = Number(expRaw);
  if (!Number.isInteger(exp) || exp <= now) return false;

  return equalsConstantTime(nonce, fromCookie);
}

/**
 * State store cho passport-oauth2 (`store` trong options của strategy).
 *
 * Dùng cơ chế `state` SẴN CÓ của passport thay vì tự viết lại vòng OAuth:
 * passport tự chèn `state` vào URL authorize và tự gọi `verify` TRƯỚC khi đổi
 * code lấy token, nên không có đường nào lọt qua nếu quên kiểm ở controller.
 *
 * SỐ THAM SỐ LÀ PHẦN QUAN TRỌNG: passport-oauth2 (lib/strategy.js) chọn nhánh
 * gọi theo `Function.length` — `store` phải đúng 3 tham số để nhận `meta`, và
 * `verify` đúng 4 tham số. Thêm/bớt tham số (kể cả tham số mặc định) sẽ làm nó
 * gọi sai overload và state âm thầm không được kiểm.
 */
// Chữ ký khớp StateStoreStoreCallback / StateStoreVerifyCallback của
// @types/passport-oauth2 (`ok` là tham số BẮT BUỘC ở đó).
type StoreCallback = (err: Error | null, state?: string) => void;
type VerifyStoreCallback = (
  err: Error | null,
  ok: boolean,
  info?: { message: string },
) => void;
type OAuthStateMeta = {
  authorizationURL: string;
  tokenURL: string;
  clientID: string;
};

/**
 * Khai đủ cả 2 overload cho khớp `StateStore` của @types/passport-oauth2 (kiểu
 * của option `store` trong StrategyOptions). Phần hiện thực bên dưới CHỈ có
 * bản 3/4 tham số — đúng cái passport chọn theo Function.length — nên phải ép
 * kiểu một lần ở đây; cast này là chỗ duy nhất nối hai cách mô tả cùng một
 * giao diện, không phải chỗ bỏ qua kiểm tra kiểu.
 */
export type OAuthStateStore = {
  store(req: Request, callback: StoreCallback): void;
  store(req: Request, meta: OAuthStateMeta, callback: StoreCallback): void;

  verify(req: Request, state: string, callback: VerifyStoreCallback): void;
  verify(
    req: Request,
    state: string,
    meta: OAuthStateMeta,
    callback: VerifyStoreCallback,
  ): void;
};

export function createOAuthStateStore(
  provider: string,
  secret: string,
): OAuthStateStore {
  const store = {
    store(req: Request, _meta: OAuthStateMeta, callback: StoreCallback) {
      // req.res luôn có trong Express; thiếu thì thà lỗi còn hơn redirect sang
      // provider mà không đặt được cookie (callback sau đó chắc chắn bị từ chối).
      const res = req.res;
      if (!res) {
        callback(new Error('Không có response để đặt cookie state của OAuth'));
        return;
      }
      callback(null, issueOAuthState(res, provider, secret));
    },

    verify(
      req: Request,
      state: string,
      _meta: OAuthStateMeta,
      callback: VerifyStoreCallback,
    ) {
      if (!verifyOAuthState(req, req.res, provider, secret, state)) {
        // callback(null, false, info) -> passport gọi fail(info, 403) thay vì
        // error(), nên OAuthCallbackGuard nuốt được và controller redirect về
        // frontend kèm thông báo thay vì trả trang JSON 403 thô.
        callback(null, false, { message: OAUTH_STATE_ERROR });
        return;
      }
      callback(null, true);
    },
  };

  return store as unknown as OAuthStateStore;
}
