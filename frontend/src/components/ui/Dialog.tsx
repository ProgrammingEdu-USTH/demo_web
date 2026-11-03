'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

import { cn } from './cn';
import { IconButton } from './IconButton';

/*
 * Hộp thoại + ngăn trượt (Sheet) dựng trên thẻ <dialog> gốc với showModal():
 * trình duyệt tự lo lớp trên cùng (không cần portal/z-index), làm phần còn lại
 * của trang "inert" (Tab không lọt ra ngoài), Esc để đóng, trả focus về nút đã mở.
 * Nhờ vậy không cần thêm Radix (DECISIONS mục 4).
 */

type BaseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Nút cuối hộp (Huỷ / Xác nhận). Đặt nút chính ở CUỐI hàng. */
  footer?: ReactNode;
  /** Bấm nền mờ có đóng không. Tắt cho form dài để khỏi mất dữ liệu đang gõ. */
  dismissible?: boolean;
  className?: string;
  children?: ReactNode;
};

function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  // Khoá cuộn trang nền khi mở (trên iOS nền vẫn cuộn theo nếu không khoá).
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add('overflow-hidden');
    return () => root.classList.remove('overflow-hidden');
  }, [open]);

  return ref;
}

function Shell({
  open,
  onOpenChange,
  title,
  description,
  footer,
  dismissible = true,
  className,
  children,
  panelClass,
  handle = false,
}: BaseProps & { panelClass: string; handle?: boolean }) {
  const ref = useModal(open);
  const titleId = useId();
  const descId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      // Sự kiện close bắn cả khi Esc lẫn khi gọi close() → đồng bộ state ngoài.
      onClose={() => onOpenChange(false)}
      onCancel={(e) => {
        if (!dismissible) e.preventDefault();
      }}
      onClick={(e) => {
        // Panel bên trong phủ kín <dialog>, nên target === dialog chỉ khi bấm vào nền mờ.
        if (dismissible && e.target === e.currentTarget) onOpenChange(false);
      }}
      className={cn(
        'ui-scope border-0 bg-transparent p-0 text-fg backdrop:bg-overlay/50',
        'max-h-none max-w-none',
        panelClass,
        className,
      )}
    >
      <div className="flex h-full max-h-[inherit] flex-col bg-surface">
        {handle ? (
          <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong/50 sm:hidden" />
        ) : null}
        <div className="flex items-start gap-3 px-5 pb-2 pt-4 sm:px-6 sm:pt-5">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={titleId} className="text-lg font-semibold text-fg">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="text-sm text-fg-muted">
                {description}
              </p>
            ) : null}
          </div>
          {/* Vùng bấm 44px cả desktop (WCAG 2.5.5, review/report-24): giữ icon 16px của size sm,
              đè sm:size-8 bằng sm:size-11; lề âm lớn hơn để icon vẫn thẳng mép tiêu đề. */}
          <IconButton
            label="Đóng"
            size="sm"
            icon={<X />}
            onClick={() => onOpenChange(false)}
            className="-mr-3 -mt-2 sm:size-11"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2 sm:px-6">{children}</div>
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-0 border-t border-solid border-border px-5 py-3 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        ) : (
          <div className="h-4 shrink-0" />
        )}
      </div>
    </dialog>
  );
}

export type DialogProps = BaseProps & { size?: 'sm' | 'md' | 'lg' };

/** Hộp thoại giữa màn hình: xác nhận, form ngắn. Nội dung dài thì cuộn bên trong. */
export function Dialog({ size = 'md', ...props }: DialogProps) {
  return (
    <Shell
      {...props}
      panelClass={cn(
        'm-auto w-[calc(100%-2rem)] max-h-[85dvh] overflow-hidden rounded-lg border border-solid border-border shadow-lg',
        'open:motion-safe:animate-pop-in',
        size === 'sm' && 'sm:w-full sm:max-w-sm',
        size === 'md' && 'sm:w-full sm:max-w-lg',
        size === 'lg' && 'sm:w-full sm:max-w-2xl',
      )}
    />
  );
}

export type SheetProps = BaseProps & {
  /**
   * auto  : mobile trượt từ dưới lên (dễ với ngón cái), từ 640px thành ngăn phải.
   * bottom/right/left: cố định. `left` dùng cho menu điều hướng mobile.
   */
  side?: 'auto' | 'bottom' | 'right' | 'left';
};

const bottomCls = 'mx-0 mb-0 mt-auto w-full max-h-[85dvh] overflow-hidden rounded-t-lg open:motion-safe:animate-slide-up';
const sideCls = 'my-0 h-dvh max-h-none w-[min(24rem,calc(100vw-3rem))] overflow-hidden';

export function Sheet({ side = 'auto', ...props }: SheetProps) {
  const panelClass = {
    bottom: bottomCls,
    right: cn(sideCls, 'ml-auto mr-0 open:motion-safe:animate-slide-left'),
    left: cn(sideCls, 'ml-0 mr-auto open:motion-safe:animate-slide-right'),
    auto: cn(
      bottomCls,
      'sm:my-0 sm:ml-auto sm:mr-0 sm:h-dvh sm:max-h-none sm:w-96 sm:rounded-none sm:open:motion-safe:animate-slide-left',
    ),
  }[side];
  return <Shell {...props} panelClass={cn('shadow-lg', panelClass)} handle={side === 'bottom' || side === 'auto'} />;
}
