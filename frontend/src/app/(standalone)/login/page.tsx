import type { Metadata } from 'next';

import { AuthShell } from '@/components/auth/AuthShell';
import { OAUTH_ERRORS } from '@/components/auth/oauth-errors';
import LoginForm from '@/components/auth/LoginForm';

export const metadata: Metadata = { title: 'Đăng nhập — Programming EDU' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell title="Chào mừng trở lại" subtitle="Đăng nhập để tiếp tục hành trình lập trình của bạn.">
      <LoginForm initialError={(error && OAUTH_ERRORS[error]) || null} />
    </AuthShell>
  );
}
