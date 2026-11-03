'use client';

// Nút đầu trang chủ: khách thấy "Bắt đầu miễn phí" + "Thử code ngay"; người đã đăng nhập thấy "Vào học tiếp".
// Trang chủ là server component nên trạng thái đăng nhập đọc ở client qua cookie pe_has_session
// (cùng cờ proxy.ts dùng); snapshot server = false để không lệch hydrate.
import Link from 'next/link';
import { useSyncExternalStore } from 'react';

import { buttonVariants } from '@/components/ui';

const subscribe = () => () => {};
const hasSession = () => document.cookie.includes('pe_has_session=1');

export function useHasSession() {
  return useSyncExternalStore(subscribe, hasSession, () => false);
}

export function LandingHeaderNav() {
  const logged = useHasSession();
  return (
    // shrink-0 + nút gọn ở mobile: logo là phần co lại, hai nút luôn hiện trọn ở 390px.
    <nav aria-label="Tài khoản" className="flex shrink-0 items-center gap-1 sm:gap-2">
      {logged ? (
        <Link href="/dashboard" className={buttonVariants({ variant: 'primary' })}>Vào học tiếp</Link>
      ) : (
        <>
          <Link href="/login" className={`${buttonVariants({ variant: 'ghost' })} max-sm:min-h-11 max-sm:px-2`}>Đăng nhập</Link>
          <Link href="/register" className={`${buttonVariants({ variant: 'primary' })} max-sm:min-h-11 max-sm:px-3`}>Đăng ký</Link>
        </>
      )}
    </nav>
  );
}

export function LandingHeroCta() {
  const logged = useHasSession();
  return (
    <div className="flex flex-wrap gap-3">
      {logged ? (
        <Link href="/dashboard" className={buttonVariants({ variant: 'primary', size: 'lg' })}>Vào học tiếp</Link>
      ) : (
        <Link href="/register" className={buttonVariants({ variant: 'primary', size: 'lg' })}>Bắt đầu miễn phí</Link>
      )}
      <Link href="/playground" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>Thử code ngay</Link>
    </div>
  );
}
