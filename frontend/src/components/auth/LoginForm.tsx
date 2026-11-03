'use client';

import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';

import { Button, Field, IconButton, Input } from '@/components/ui';

import { AuthSuccess, FormError } from './AuthShell';
import { OAuthButtons, parseApiError, saveSession } from './auth-utils';

// Chỉ nhận path nội bộ ("/..." nhưng không "//...") để chống open redirect.
function safeNext(): string | null {
  const n = new URLSearchParams(window.location.search).get('next');
  // Từ chối mọi dấu gạch ngược: trình duyệt coi "/\evil.com" như "//evil.com".
  return n && n.charAt(0) === '/' && n.charAt(1) !== '/' && !n.includes('\\') ? n : null;
}

// initialError: lỗi OAuth từ ?error= do trang (server) đọc và truyền xuống.
export default function LoginForm({ initialError = null }: { initialError?: string | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    const next = safeNext();
    // Phiên cũ có token nhưng chưa có cookie pe_has_session → proxy đá về đây dù token còn hạn:
    // ghi lại cookie rồi trả về trang cũ (giữ nguyên hành vi login.inline.js).
    if (next) {
      let access: string | null = null;
      try { access = localStorage.getItem('pe_access'); } catch { /* private mode */ }
      if (access) {
        document.cookie = 'pe_has_session=1; path=/; max-age=28800; SameSite=Lax';
        window.location.replace(next);
        return;
      }
    }
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFields({});
    setError(null);
    const mail = email.trim();
    if (!mail || !password) {
      setError('Vui lòng nhập email hoặc số điện thoại và mật khẩu.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/backend/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: mail, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const p = parseApiError(data, 'Sai email/số điện thoại hoặc mật khẩu.');
        setFields(p.fields);
        setError(p.message);
        return;
      }
      saveSession(data);
      setDone(true);
      const next = safeNext() || '/dashboard?streak=1';
      setTimeout(() => { window.location.href = next; }, 1200);
    } catch {
      setError('Đăng nhập thất bại, vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  // Backend chưa có endpoint quên mật khẩu — báo thật, không giả vờ đã gửi email.
  function forgot() {
    setError(
      email.trim()
        ? 'Tính năng khôi phục mật khẩu đang được phát triển. Vui lòng liên hệ hỗ trợ để được trợ giúp.'
        : 'Vui lòng nhập email để khôi phục mật khẩu.',
    );
  }

  if (done) return <AuthSuccess title="Đăng nhập thành công!" description="Đang chuyển bạn vào trang học…" />;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormError message={error} />
      <Field label="Email hoặc số điện thoại" error={fields.email}>
        <Input
          type="text"
          autoComplete="username"
          leadingIcon={<Mail />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Mật khẩu" error={fields.password}>
        <div className="relative">
          <Input
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            leadingIcon={<Lock />}
            className="pr-12"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <IconButton
            label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            icon={show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            size="sm"
            className="absolute right-0 top-1/2 size-11 sm:size-11 -translate-y-1/2"
            onClick={() => setShow((s) => !s)}
          />
        </div>
      </Field>
      <div className="-mt-2 text-right">
        <Button variant="link" className="min-h-11" onClick={forgot}>Quên mật khẩu?</Button>
      </div>
      <Button type="submit" variant="primary" size="lg" block loading={busy}>
        {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </Button>
      <OAuthButtons />
      <p className="text-center text-sm text-fg-muted">
        Chưa có tài khoản?{' '}
        <Link href="/register" className="ui-focus-ring inline-flex min-h-11 items-center rounded-smfont-semibold text-primary underline-offset-2 hover:underline">
          Đăng ký miễn phí
        </Link>
      </p>
    </form>
  );
}
