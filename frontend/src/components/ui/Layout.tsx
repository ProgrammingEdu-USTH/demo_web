import type { ComponentProps, ReactNode } from 'react';

import { cn } from './cn';

/*
 * Khối bố cục trang. Mọi trang trong vỏ mới: <Container> → <PageHeader> → (Tabs) → nội dung.
 */

/** Khung nội dung: rộng tối đa 1200px, lề 16px mobile / 24px tablet / 32px desktop. */
export function Container({
  className,
  size = 'page',
  ...props
}: ComponentProps<'div'> & { size?: 'page' | 'prose' | 'full' }) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6 lg:px-8',
        size === 'page' && 'max-w-page',
        size === 'prose' && 'max-w-3xl',
        className,
      )}
      {...props}
    />
  );
}

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Dòng nhỏ phía trên tiêu đề: breadcrumb hoặc link "← Quay lại". */
  eyebrow?: ReactNode;
  /** Nút hành động bên phải (desktop) / dưới tiêu đề (mobile). Tối đa MỘT nút primary. */
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
};

/** Đầu trang: một <h1> duy nhất của trang nằm ở đây. */
export function PageHeader({ title, description, eyebrow, actions, className, children }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4 pb-4 pt-6 sm:flex-row sm:items-end sm:justify-between sm:pb-6 sm:pt-8', className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow ? <div className="text-sm text-fg-muted">{eyebrow}</div> : null}
        <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {description ? <p className="max-w-prose text-base text-fg-muted">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Mục trong trang: tiêu đề h2 + (link "Xem tất cả") + nội dung. */
export function Section({
  title,
  action,
  className,
  children,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('flex flex-col gap-3 sm:gap-4', className)}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
