import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from './cn';

/**
 * Thông báo nội tuyến gắn với một vùng nội dung (lỗi tạo đề, cảnh báo phiên, ghi chú).
 * Khác Toast: Alert ở lại trên trang tới khi hết lý do — dùng cho lỗi form/thao tác,
 * vì người dùng cần đọc lại được (SYSTEM.md: lỗi form KHÔNG dùng toast).
 * Màu soft-* đã đạt AA cho chữ thường ở cả sáng/tối; icon kèm theo để không chỉ dựa vào màu.
 */
export const alertVariants = cva(
  'flex items-start gap-3 rounded-md border border-solid px-4 py-3 text-sm [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        info: 'border-info/30 bg-info-soft text-info-soft-fg',
        success: 'border-success/30 bg-success-soft text-success-soft-fg',
        warning: 'border-warning/30 bg-warning-soft text-warning-soft-fg',
        danger: 'border-danger/30 bg-danger-soft text-danger-soft-fg',
      },
    },
    defaultVariants: { variant: 'info' },
  },
);

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: OctagonAlert } as const;

export type AlertProps = Omit<ComponentProps<'div'>, 'title'> &
  VariantProps<typeof alertVariants> & {
    title?: ReactNode;
    /** Thay icon mặc định; `null` để ẩn icon. */
    icon?: ReactNode | null;
    /** Nút/link hành động (vd "Thử lại") — đặt dưới nội dung. */
    action?: ReactNode;
    /** Có → hiện nút đóng (X). */
    onDismiss?: () => void;
  };

export function Alert({ className, variant, title, icon, action, onDismiss, children, role, ...props }: AlertProps) {
  const v = variant ?? 'info';
  const Icon = ICONS[v];
  // danger cần đọc ngay (role=alert, assertive); các loại khác là trạng thái lịch sự (status, polite)
  // để trình đọc màn hình không cắt ngang người dùng vì một ghi chú.
  const resolvedRole = role ?? (v === 'danger' ? 'alert' : 'status');

  return (
    <div role={resolvedRole} className={cn(alertVariants({ variant: v }), className)} {...props}>
      {icon === undefined ? <Icon aria-hidden="true" /> : icon}
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="[&_a]:font-semibold [&_a]:underline">{children}</div> : null}
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Đóng thông báo"
          className="-m-1 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-0 text-current opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none [&_svg]:size-4"
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
