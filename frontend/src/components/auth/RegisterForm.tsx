'use client';

import { Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import { Button, Field, IconButton, Input } from '@/components/ui';

import { AuthSuccess, FormError } from './AuthShell';
import { OAuthButtons, parseApiError, saveSession } from './auth-utils';

// initialError: lỗi OAuth từ ?error= do trang (server) đọc và truyền xuống.
export default function RegisterForm({ initialError = null }: { initialError?: string | null }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFields({});
    setError(null);
    const body = { name: name.trim(), email: email.trim(), phone: phone.trim(), password };
    if (!body.name || !password) return setError('Vui lòng điền họ tên và mật khẩu.');
    if (!body.email && !body.phone) return setError('Vui lòng nhập email hoặc số điện thoại.');
    setBusy(true);
    try {
      const res = await fetch('/backend/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const p = parseApiError(data, 'Đăng ký thất bại.');
        setFields(p.fields);
        setError(p.message);
        return;
      }
      // Đăng ký bằng mật khẩu luôn đi qua /questionaire trước dashboard; cờ này để edu-dashboard.js
      // nhận ra "vừa tạo tài khoản" (đọc và xoá đúng 1 lần ở đó).
      try { sessionStorage.setItem('pe_just_registered', '1'); } catch { /* private mode */ }
      saveSession(data);
      setDone(true);
      setTimeout(() => { window.location.href = '/questionaire'; }, 1200);
    } catch {
      setError('Đăng ký thất bại, vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  if (done) return <AuthSuccess title="Đăng ký thành công!" description="Chào mừng bạn đến với Programming EDU. Đang chuyển tiếp…" />;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormError message={error} />
      <Field label="Họ và tên" error={fields.name} required>
        <Input autoComplete="name" placeholder="Nguyễn Văn A" leadingIcon={<User />} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Email" error={fields.email}>
        <Input type="email" autoComplete="email" placeholder="email@example.com" leadingIcon={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Số điện thoại" error={fields.phone} hint="Cần ít nhất email hoặc số điện thoại.">
        <Input type="tel" autoComplete="tel" placeholder="0912345678" leadingIcon={<Phone />} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="Mật khẩu" error={fields.password} hint="Ít nhất 8 ký tự." required>
        <div className="relative">
          <Input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
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
      <Button type="submit" variant="primary" size="lg" block loading={busy}>
        {busy ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
      </Button>
      <OAuthButtons />
      <p className="text-center text-sm text-fg-muted">
        Đã có tài khoản?{' '}
        <Link href="/login" className="ui-focus-ring inline-flex min-h-11 items-center rounded-smfont-semibold text-primary underline-offset-2 hover:underline">
          Đăng nhập ngay
        </Link>
      </p>
    </form>
  );
}
