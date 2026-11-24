import { envValidationSchema } from './env.validation';

/**
 * Vì sao có file này: Joi chạy với `allowUnknown: true`, nên một biến KHÔNG
 * khai trong schema vẫn qua được validate — nhưng giữ nguyên dạng CHUỖI. Mà
 * `config.get<number>('X')` chỉ là ép kiểu lúc biên dịch, không đổi giá trị lúc
 * chạy. Nên quên khai một biến số là lỗi IM LẶNG: code cộng chuỗi với số.
 *
 * Sự cố thật ngày 13/10/2026: PY_RUN_QUEUE_TIMEOUT_MS chưa khai, đặt "30000"
 * trên Render → RemoteExecutor tính "30000" + 10000 + 10000 = chuỗi
 * "300001000010000" → AbortSignal.timeout(<chuỗi>) ném TypeError ngay trong
 * try → catch trả 503 "Bộ chạy Python đang tắt". Runner vẫn khoẻ, fetch chưa
 * từng được gọi, và triệu chứng trỏ sai sang "lệch khoá / tường lửa chặn".
 *
 * Các ca dưới đây bắt đúng lớp lỗi đó: gỡ dòng khai của bất kỳ biến số nào ra
 * khỏi env.validation.ts thì ca tương ứng trượt.
 */
const BAT_BUOC = {
  DATABASE_URL: 'postgresql://u:p@host/db',
  DIRECT_URL: 'postgresql://u:p@host/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  FRONTEND_URL: 'https://programmingedu.io.vn',
  ALLOWED_ORIGINS: 'https://programmingedu.io.vn',
};

// Joi.object() không mang kiểu đầu ra nên validate() trả `value: any`; đổi
// sang `unknown` ở đúng một chỗ này để các ca bên dưới phải ép kiểu tường minh
// thay vì destructure từ `any`.
const validate = (extra: Record<string, string>) => {
  const r = envValidationSchema.validate(
    { ...BAT_BUOC, ...extra },
    { allowUnknown: true, abortEarly: false },
  );
  return { error: r.error, value: r.value as unknown };
};

describe('envValidationSchema — biến số phải ra SỐ, không phải chuỗi', () => {
  // Đặt qua dashboard (Render/Vercel) thì mọi giá trị đều là chuỗi.
  // Giá trị mẫu nằm trong khoảng hợp lệ của từng biến (mỗi biến một trần khác
  // nhau: đồng thời ≤ 16, hàng đợi ≤ 500, thời gian tính bằng mili giây).
  const SO: ReadonlyArray<readonly [string, string]> = [
    ['PY_RUN_TIMEOUT_MS', '12000'],
    ['PY_RUN_QUEUE_TIMEOUT_MS', '30000'],
    ['PY_RUN_MAX_CONCURRENT', '4'],
    ['PY_RUN_QUEUE_MAX', '50'],
  ];

  it.each(SO)('%s nhập dạng chuỗi được ép về number', (key, mau) => {
    const { error, value } = validate({ [key]: mau });
    expect(error).toBeUndefined();
    expect(typeof (value as Record<string, unknown>)[key]).toBe('number');
  });

  it.each(SO)('%s không đặt thì có mặc định dạng number', (key) => {
    const { error, value } = validate({});
    expect(error).toBeUndefined();
    expect(typeof (value as Record<string, unknown>)[key]).toBe('number');
  });

  it('cộng ba mốc thời gian ra SỐ, không nối chuỗi', () => {
    const { value } = validate({
      PY_RUN_QUEUE_TIMEOUT_MS: '30000',
      PY_RUN_TIMEOUT_MS: '10000',
    });
    const v = value as Record<string, number>;
    // Chính phép tính của RemoteExecutor: queue + run + 10s dự phòng.
    expect(v.PY_RUN_QUEUE_TIMEOUT_MS + v.PY_RUN_TIMEOUT_MS + 10_000).toBe(
      50_000,
    );
  });

  it('PY_RUNNER_MODE chỉ nhận local/remote — chặn lỗi viết hoa im lặng', () => {
    expect(validate({ PY_RUNNER_MODE: 'remote' }).error).toBeUndefined();
    expect(validate({ PY_RUNNER_MODE: 'Remote' }).error).toBeDefined();
  });

  it('RUNNER_SECRET quá ngắn bị chặn ngay lúc khởi động', () => {
    // Runner từ chối khoá ngắn; backend phải từ chối cùng lúc, không để lệch
    // nhau rồi mới lộ ra bằng một chuỗi 401 lúc chạy.
    expect(validate({ RUNNER_SECRET: 'ngan' }).error).toBeDefined();
    expect(validate({ RUNNER_SECRET: 'x'.repeat(32) }).error).toBeUndefined();
  });

  it('RUNNER_SECRET dùng CÙNG ngưỡng 32 với runner — 31 ký tự bị chặn', () => {
    // Ngưỡng cũ là 16: khoá 16–31 ký tự qua được backend trong khi runner
    // (runner/src/config.ts) từ chối khởi động với chính khoá đó. Ca biên này
    // là ca duy nhất phân biệt min(16) với min(32).
    expect(validate({ RUNNER_SECRET: 'x'.repeat(31) }).error).toBeDefined();
    expect(validate({ RUNNER_SECRET: 'x'.repeat(16) }).error).toBeDefined();
  });
});

/**
 * THROTTLE_* và TRUST_PROXY_HOPS được đọc thẳng từ process.env (phần lớn trong
 * decorator @Throttle, chạy lúc nạp class), nên Joi không đổi được giá trị code
 * nhìn thấy — việc của Joi là CHẶN KHỞI ĐỘNG khi giá trị sai. Các ca dưới đây
 * kiểm đúng việc đó: trước bản sửa, mọi giá trị sau đều qua validate êm và gây
 * lỗi im lặng lúc chạy (Number('') = 0 → mọi lượt bị 429; NaN → không bao giờ
 * chặn; TRUST_PROXY_HOPS NaN → trust proxy tắt).
 */
describe('envValidationSchema — THROTTLE_* và TRUST_PROXY_HOPS', () => {
  const THROTTLE: ReadonlyArray<readonly [string, number]> = [
    ['THROTTLE_IP_HOUR_LIMIT', 1000],
    ['THROTTLE_IP_DAY_LIMIT', 10000],
    ['THROTTLE_LOGIN_LIMIT', 20],
    ['THROTTLE_LOGIN_TTL_SECONDS', 60],
    ['THROTTLE_REGISTER_LIMIT', 10],
    ['THROTTLE_REGISTER_TTL_SECONDS', 60],
    ['THROTTLE_GUEST_LIMIT', 120],
    ['THROTTLE_GUEST_TTL_SECONDS', 3600],
    ['THROTTLE_BADGE_LIMIT', 240],
    ['THROTTLE_FORUM_POST_LIMIT', 10],
    ['THROTTLE_FORUM_POST_TTL_SECONDS', 600],
    ['THROTTLE_FORUM_COMMENT_LIMIT', 30],
    ['THROTTLE_FORUM_COMMENT_TTL_SECONDS', 600],
    ['THROTTLE_PY_RUN_LIMIT', 10],
    ['THROTTLE_PY_RUN_TTL_SECONDS', 60],
    ['THROTTLE_PY_TRACE_LIMIT', 10],
    ['THROTTLE_PY_TRACE_TTL_SECONDS', 60],
    ['THROTTLE_SWEEP_INTERVAL_MS', 60_000],
    ['THROTTLE_MAX_KEYS', 200_000],
  ];

  it.each(THROTTLE)('%s để trống bị từ chối (không thành 0)', (key) => {
    expect(validate({ [key]: '' }).error).toBeDefined();
  });

  it.each(THROTTLE)('%s không phải số bị từ chối (không thành NaN)', (key) => {
    expect(validate({ [key]: '1o' }).error).toBeDefined();
  });

  it.each(THROTTLE)('%s = 0 bị từ chối', (key) => {
    expect(validate({ [key]: '0' }).error).toBeDefined();
  });

  it.each(THROTTLE)(
    '%s không đặt → mặc định %d, TRÙNG với `?? <số>` ở nơi dùng',
    (key, macDinh) => {
      const { error, value } = validate({});
      expect(error).toBeUndefined();
      expect((value as Record<string, unknown>)[key]).toBe(macDinh);
    },
  );

  it('giá trị đang đặt trên production vẫn qua (không chặn deploy)', () => {
    // Đo/ghi ngày 14/10/2026: header x-ratelimit-limit-ip_hour: 400 ở
    // /api/python/run; THROTTLE_IP_HOUR_LIMIT/DAY theo docs/deploy-runbook.md.
    const { error } = validate({
      THROTTLE_PY_RUN_LIMIT: '400',
      THROTTLE_IP_HOUR_LIMIT: '20000',
      THROTTLE_IP_DAY_LIMIT: '200000',
      TRUST_PROXY_HOPS: '1',
    });
    expect(error).toBeUndefined();
  });

  it.each(['0', '1', '2', '3'])('TRUST_PROXY_HOPS=%s được nhận', (v) => {
    const { error, value } = validate({ TRUST_PROXY_HOPS: v });
    expect(error).toBeUndefined();
    expect((value as Record<string, unknown>).TRUST_PROXY_HOPS).toBe(Number(v));
  });

  it.each(['', 'one', '1.5', '-1', '4', 'true'])(
    'TRUST_PROXY_HOPS=%p bị từ chối',
    (v) => {
      expect(validate({ TRUST_PROXY_HOPS: v }).error).toBeDefined();
    },
  );

  it('TRUST_PROXY_HOPS không đặt → 0, trùng `?? 0` trong api-gateway.setup.ts', () => {
    const { value } = validate({});
    expect((value as Record<string, unknown>).TRUST_PROXY_HOPS).toBe(0);
  });
});
