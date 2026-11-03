import { cn } from './cn';

export type ProgressBarProps = {
  /** 0..max */
  value: number;
  max?: number;
  /** Tên cho trình đọc màn hình, vd "Tiến độ khoá Python". */
  label: string;
  /** Hiện "40%" bên phải thanh. */
  showValue?: boolean;
  tone?: 'primary' | 'success' | 'accent';
  size?: 'sm' | 'md';
  className?: string;
};

/**
 * Dùng thẻ <progress> gốc thay cho div + style={{width}}: không cần CSS nội tuyến
 * (CSP đang bỏ 'unsafe-inline') và trình đọc màn hình hiểu sẵn giá trị.
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  tone = 'primary',
  size = 'md',
  className,
}: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), max);
  const pct = max > 0 ? Math.round((clamped / max) * 100) : 0;
  const fill = {
    primary: '[&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary',
    success: '[&::-webkit-progress-value]:bg-success [&::-moz-progress-bar]:bg-success',
    accent: '[&::-webkit-progress-value]:bg-accent [&::-moz-progress-bar]:bg-accent',
  }[tone];
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <progress
        value={clamped}
        max={max}
        aria-label={label}
        className={cn(
          'block w-full appearance-none overflow-hidden rounded-full border-0 bg-surface-3',
          size === 'sm' ? 'h-1.5' : 'h-2',
          '[&::-webkit-progress-bar]:bg-surface-3 [&::-webkit-progress-value]:rounded-full',
          '[&::-webkit-progress-value]:transition-[width] [&::-webkit-progress-value]:duration-base',
          '[&::-moz-progress-bar]:rounded-full',
          fill,
        )}
      >
        {pct}%
      </progress>
      {showValue ? (
        <span aria-hidden="true" className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-fg-muted">
          {pct}%
        </span>
      ) : null}
    </div>
  );
}
