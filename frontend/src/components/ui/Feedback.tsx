import { AlertTriangle } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from './cn';

/*
 * Trạng thái đang tải / rỗng / lỗi — trang nào có dữ liệu cũng phải có đủ ba.
 */

/** Khối xám nhấp nháy giữ chỗ. Đặt kích thước bằng class (h-4 w-32…) cho giống nội dung thật để trang không nhảy. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn('rounded-sm bg-surface-3/70 motion-safe:animate-pulse', className)}
      {...props}
    />
  );
}

/** Vùng đang tải: báo một lần cho trình đọc màn hình, phần Skeleton bên trong bị ẩn. */
export function LoadingRegion({ label = 'Đang tải…', children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Motif thương hiệu: dấu nhắc lệnh với con trỏ nhấp nháy (tắt nhấp nháy khi giảm chuyển động). */
export function PromptMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('inline-flex items-center font-mono font-semibold text-primary', className)}>
      &gt;
      <span className="ml-0.5 inline-block h-[1.1em] w-[0.55em] bg-current motion-safe:animate-caret" />
    </span>
  );
}

type StateProps = {
  /** Icon lucide; bỏ trống → dấu nhắc lệnh (EmptyState) / tam giác cảnh báo (ErrorState). */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Thường là MỘT Button/Link dẫn tới việc nên làm tiếp. */
  action?: ReactNode;
  /** `compact` cho trong thẻ/bảng; mặc định cho cả vùng trang. */
  compact?: boolean;
  className?: string;
};

function StateBlock({ icon, title, description, action, compact, className, tone }: StateProps & { tone: 'empty' | 'error' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-4 py-12 sm:py-16',
        className,
      )}
    >
      <div
        className={cn(
          'mb-1 flex size-12 items-center justify-center rounded-lg text-2xl [&_svg]:size-6',
          tone === 'error' ? 'bg-danger-soft text-danger-soft-fg' : 'bg-primary-soft text-primary-soft-fg',
        )}
      >
        {icon ?? (tone === 'error' ? <AlertTriangle aria-hidden="true" /> : <PromptMark />)}
      </div>
      <h2 className={cn('font-semibold text-fg', compact ? 'text-base' : 'text-lg')}>{title}</h2>
      {description ? <p className="max-w-md text-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Không có dữ liệu: nói rõ vì sao + một hành động để có dữ liệu ("Chưa có bài nộp — Vào bài đầu tiên"). */
export function EmptyState(props: StateProps) {
  return <StateBlock {...props} tone="empty" />;
}

/** Lỗi tải: lời lẽ không đổ lỗi người dùng + nút "Thử lại" (truyền qua `action`). */
export function ErrorState(props: StateProps) {
  return <StateBlock {...props} tone="error" />;
}
