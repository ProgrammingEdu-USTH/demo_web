'use client';

import { Button } from '@/components/ui';

// Backend NestJS (/auth/google|facebook) redirect về /auth/callback#access=…&refresh=…
function oauthStart(provider: 'google' | 'facebook') {
  const origin = (window as unknown as { __PE_API_ORIGIN?: string }).__PE_API_ORIGIN || '';
  window.location.href = `${origin}/auth/${provider}`;
}

type ApiErr = { errors?: Record<string, string>; error?: string | { message?: string; fields?: Record<string, string> } };

/** Bóc lỗi từ phản hồi NestJS ({error:{message,fields}}) hoặc định dạng Django cũ ({errors}). */
export function parseApiError(data: ApiErr, fallback: string): { fields: Record<string, string>; message: string } {
  const fields = data.errors || (typeof data.error === 'object' ? data.error?.fields : undefined) || {};
  let message = fallback;
  if (typeof data.error === 'string') message = data.error;
  else if (data.error?.message) message = data.error.message;
  else if (Object.keys(fields).length) message = 'Dữ liệu chưa hợp lệ.';
  return { fields, message };
}

export function OAuthButtons() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs text-fg-muted">
        <span className="h-px flex-1 bg-border" />
        hoặc tiếp tục với
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => oauthStart('google')}>Google</Button>
        <Button variant="secondary" onClick={() => oauthStart('facebook')}>Facebook</Button>
      </div>
    </div>
  );
}

// Sau đăng nhập/đăng ký thành công: lưu access token + cờ phiên như pe-bridge.js từng làm
// (proxy.ts dựa vào cookie pe_has_session; apiFetch đọc pe_access). Backend đi qua proxy
// cùng origin /backend nên cookie refresh httpOnly vẫn là first-party.
export function saveSession(data: unknown): void {
  const access = (data as { access?: unknown } | null)?.access;
  if (typeof access !== 'string' || !access) return;
  try { localStorage.setItem('pe_access', access); } catch { /* private mode */ }
  document.cookie = 'pe_has_session=1; path=/; max-age=28800; SameSite=Lax';
}
