import type { Metadata } from 'next';

import { AuthShell } from '@/components/auth/AuthShell';
import { OAUTH_ERRORS } from '@/components/auth/oauth-errors';
import RegisterForm from '@/components/auth/RegisterForm';

export const metadata: Metadata = { title: 'Đăng ký — Programming EDU' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell title="Tạo tài khoản" subtitle="Miễn phí, chỉ mất một phút để bắt đầu.">
      <RegisterForm initialError={(error && OAUTH_ERRORS[error]) || null} />
    </AuthShell>
  );
}
