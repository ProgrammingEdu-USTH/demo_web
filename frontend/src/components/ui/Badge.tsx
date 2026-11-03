import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from './cn';

/**
 * Nhãn trạng thái nhỏ. Màu dành cho TRẠNG THÁI HỌC (đúng/sai/đang làm/xong);
 * `accent` (hổ phách) chỉ cho XP/streak/thành tích. Luôn có chữ — kèm icon nếu
 * được — để không truyền nghĩa chỉ bằng màu.
 */
export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-semibold [&_svg]:size-3.5',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-2 text-fg-muted',
        primary: 'bg-primary-soft text-primary-soft-fg',
        success: 'bg-success-soft text-success-soft-fg',
        danger: 'bg-danger-soft text-danger-soft-fg',
        warning: 'bg-warning-soft text-warning-soft-fg',
        info: 'bg-info-soft text-info-soft-fg',
        accent: 'bg-accent-soft text-accent-soft-fg',
        outline: 'border border-solid border-border bg-transparent text-fg-muted',
      },
      pill: { true: 'rounded-full px-2.5' },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, pill, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, pill }), className)} {...props} />;
}
