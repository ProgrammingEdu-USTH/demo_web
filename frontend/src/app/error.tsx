'use client';

import Link from 'next/link';

import { Button, Container, ErrorState, buttonVariants } from '@/components/ui';

// Lỗi không bắt được trong trang: cho thử lại tại chỗ hoặc về trang chủ. Không in chi tiết lỗi ra người học.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="ui-scope min-h-dvh bg-bg font-sans text-fg">
      <Container size="prose">
        <ErrorState
          title="Có lỗi xảy ra"
          description="Trang không tải được. Hãy thử lại; nếu vẫn lỗi, quay về trang chủ."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/dashboard" className={buttonVariants({ variant: 'secondary' })}>
                Về trang chủ
              </Link>
              <Button variant="primary" onClick={() => reset()}>
                Thử lại
              </Button>
            </div>
          }
        />
      </Container>
    </main>
  );
}
