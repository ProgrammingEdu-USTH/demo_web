/** Tham số mang bí mật hoặc thông tin cá nhân — giá trị phải bị che trước khi ghi log. */
const SENSITIVE_PARAMS = [
  'refresh',
  'access',
  'token',
  'password',
  'code',
  'secret',
  'email',
  'phone',
];

/**
 * Giữ nguyên path, che giá trị của các query param nhạy cảm.
 * Ví dụ: /auth/logout?refresh=abc123 -> /auth/logout?refresh=[REDACTED]
 *
 * Dùng cho MỌI dòng log có URL — không chỉ bộ ghi log request: hai bộ lọc lỗi từng ghi
 * `request.url` thô nên một lỗi 5xx trên /auth/logout?refresh=… ghi nguyên refresh token.
 */
export function redactQuery(originalUrl: string | undefined): string {
  if (!originalUrl) return '';
  const idx = originalUrl.indexOf('?');
  if (idx === -1) return originalUrl;

  const path = originalUrl.slice(0, idx);
  const params = new URLSearchParams(originalUrl.slice(idx + 1));

  for (const key of params.keys()) {
    if (SENSITIVE_PARAMS.includes(key.toLowerCase())) {
      params.set(key, '[REDACTED]');
    }
  }

  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
