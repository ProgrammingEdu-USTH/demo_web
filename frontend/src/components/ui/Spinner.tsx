import { Loader2 } from 'lucide-react';

import { cn } from './cn';

/** Vòng quay tải. aria-hidden vì nơi dùng (Button, trang) tự báo trạng thái bằng chữ/aria-busy. */
export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      aria-hidden="true"
      className={cn('size-4 shrink-0 motion-safe:animate-spin', className)}
    />
  );
}
