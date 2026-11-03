import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from './cn';

/**
 * Thẻ = một "ô" của sổ tay: nền surface, viền mảnh, bóng rất nhẹ.
 * Cả thẻ bấm được: bọc bằng <Link className={cardVariants({ interactive: true })}>
 * — hover chỉ đổi viền/nền thay vì nhấc thẻ (đỡ giật trên máy yếu).
 */
export const cardVariants = cva('block rounded-lg border border-solid border-border bg-surface text-fg', {
  variants: {
    padding: { none: '', sm: 'p-4', md: 'p-4 sm:p-6' },
    elevated: { true: 'shadow-sm', false: '' },
    interactive: {
      true: 'ui-focus-ring transition-colors duration-fast ease-out hover:border-border-strong hover:bg-surface-2/40',
    },
  },
  defaultVariants: { padding: 'md', elevated: true },
});

export type CardProps = ComponentProps<'div'> & VariantProps<typeof cardVariants>;

export function Card({ className, padding, elevated, interactive, ...props }: CardProps) {
  return <div className={cn(cardVariants({ padding, elevated, interactive }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mb-3 flex flex-col gap-1', className)} {...props} />;
}

/** Mặc định <h3>; đổi bằng `as` cho đúng cấp tiêu đề của trang (không nhảy cấp). */
export function CardTitle({
  className,
  as: Tag = 'h3',
  ...props
}: ComponentProps<'h3'> & { as?: 'h2' | 'h3' | 'h4' }) {
  return <Tag className={cn('text-lg font-semibold leading-snug text-fg', className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-fg-muted', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mt-4 flex flex-wrap items-center gap-2', className)} {...props} />;
}
