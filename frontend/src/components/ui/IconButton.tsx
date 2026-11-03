import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from './cn';
import { Spinner } from './Spinner';

export const iconButtonVariants = cva(
  [
    'ui-focus-ring inline-flex shrink-0 items-center justify-center rounded-md border border-solid',
    'transition-colors duration-fast ease-out',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:size-5',
  ],
  {
    variants: {
      variant: {
        ghost: 'border-transparent bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg',
        secondary: 'border-border bg-surface text-fg hover:bg-surface-2',
        primary: 'border-transparent bg-primary text-primary-fg hover:bg-primary-hover',
      },
      // Vuông 44px trên mobile (vùng chạm), 36/40px trên desktop.
      size: {
        sm: 'size-11 sm:size-8 [&_svg]:size-4',
        md: 'size-11 sm:size-10',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  },
);

export type IconButtonProps = Omit<ComponentProps<'button'>, 'children'> &
  VariantProps<typeof iconButtonVariants> & {
    /** BẮT BUỘC: nút chỉ có icon thì trình đọc màn hình cần tên (aria-label + title). */
    label: string;
    icon: ReactNode;
    loading?: boolean;
  };

export function IconButton({
  className,
  variant,
  size,
  label,
  icon,
  loading = false,
  disabled,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon}
    </button>
  );
}
