import { SearchX } from 'lucide-react';
import Link from 'next/link';

import { Container, EmptyState, buttonVariants } from '@/components/ui';

// Trang 404 chung. Tự bọc `ui-scope` vì nằm ngoài mọi layout nhóm (preflight tắt nên cần reset riêng).
export default function NotFound() {
  return (
    <main className="ui-scope min-h-dvh bg-bg font-sans text-fg">
      <Container size="prose">
        <EmptyState
          icon={<SearchX className="size-10 text-fg-muted" aria-hidden="true" />}
          title="Không tìm thấy trang này"
          description="Đường dẫn có thể đã sai hoặc trang đã được chuyển đi. Quay về trang chủ để học tiếp nhé."
          action={
            <Link href="/dashboard" className={buttonVariants({ variant: 'primary' })}>
              Về trang chủ
            </Link>
          }
        />
      </Container>
    </main>
  );
}
