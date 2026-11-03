import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from './cn';
import { Spinner } from './Spinner';

/**
 * Kiểu nút dùng chung. Xuất riêng `buttonVariants` để <Link> trông như nút
 * (`<Link className={buttonVariants({ variant: 'secondary' })}>`) — điều hướng
 * phải là thẻ <a> thật, không phải <button onClick={router.push}>.
 * Mỗi màn hình chỉ MỘT nút `primary`; còn lại secondary/ghost.
 */
export const buttonVariants = cva(
  [
    'ui-focus-ring inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap',
    'rounded-md border border-solid font-semibold no-underline',
    'transition-colors duration-fast ease-out motion-safe:active:scale-[0.98]',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        primary: 'border-transparent bg-primary text-primary-fg shadow-xs hover:bg-primary-hover',
        secondary: 'border-border bg-surface text-fg shadow-xs hover:border-border-strong hover:bg-surface-2',
        ghost: 'border-transparent bg-transparent text-fg hover:bg-surface-2',
        soft: 'border-transparent bg-primary-soft text-primary-soft-fg hover:bg-primary/15',
        danger: 'border-transparent bg-danger text-danger-fg shadow-xs hover:bg-danger-hover',
        link: 'h-auto border-transparent bg-transparent px-0 text-primary underline-offset-4 hover:underline',
      },
      // Mobile luôn cao ≥ 44px (vùng chạm); từ sm (≥640px) dùng cỡ gọn hơn.
      size: {
        sm: 'h-11 px-3 text-sm sm:h-8',
        md: 'h-11 px-4 text-sm sm:h-10',
        lg: 'h-12 px-6 text-base',
      },
      block: { true: 'w-full' },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0 sm:h-auto' }],
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Đang xử lý: hiện vòng quay, khoá nút, báo aria-busy cho trình đọc màn hình. */
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  block,
  loading = false,
  disabled,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      // Mặc định type="button" để nút trong <form> không vô tình submit.
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
