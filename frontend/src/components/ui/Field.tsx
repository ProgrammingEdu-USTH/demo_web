'use client';

import { AlertCircle, ChevronDown } from 'lucide-react';
import { createContext, useContext, useId, type ComponentProps, type ReactNode } from 'react';

import { cn } from './cn';

/*
 * Ô nhập liệu. <Field> lo nhãn + gợi ý + lỗi và tự nối id/aria cho control bên
 * trong qua context — trang không phải tự viết htmlFor/aria-describedby, nên
 * khó quên (lỗi a11y hay gặp nhất của form).
 */

type FieldCtx = { id: string; describedBy?: string; invalid: boolean; required: boolean };
const FieldContext = createContext<FieldCtx | null>(null);

export type FieldProps = {
  label: ReactNode;
  /** Gợi ý dưới ô (định dạng, giới hạn…). */
  hint?: ReactNode;
  /** Có lỗi → viền đỏ + aria-invalid + thông báo kèm icon (không chỉ dựa vào màu). */
  error?: ReactNode;
  required?: boolean;
  /** Ẩn nhãn khỏi mắt nhưng trình đọc màn hình vẫn đọc (ô tìm kiếm có icon). */
  hideLabel?: boolean;
  className?: string;
  children: ReactNode;
};

export function Field({ label, hint, error, required = false, hideLabel, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error), required }}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label htmlFor={id} className={cn('text-sm font-semibold text-fg', hideLabel && 'sr-only')}>
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {children}
        {error ? (
          <p id={errorId} className="flex items-start gap-1.5 text-sm text-danger-soft-fg">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
        {hint ? (
          <p id={hintId} className="text-xs text-fg-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

type A11yProps = {
  id?: string;
  required?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: ComponentProps<'input'>['aria-invalid'];
};

/** Props truyền tay thắng giá trị từ <Field> — dùng được cả khi không bọc Field. */
function useFieldProps(props: A11yProps) {
  const ctx = useContext(FieldContext);
  return {
    id: props.id ?? ctx?.id,
    'aria-describedby': props['aria-describedby'] ?? ctx?.describedBy,
    'aria-invalid': props['aria-invalid'] ?? (ctx?.invalid || undefined),
    required: props.required ?? (ctx?.required || undefined),
  };
}

// Mobile: cao 44px + chữ 16px (dưới 16px iOS Safari tự phóng to trang khi focus).
const controlBase = [
  'w-full rounded-sm border border-solid border-border-strong/60 bg-surface text-base text-fg sm:text-sm',
  'placeholder:text-fg-muted/80',
  'transition-colors duration-fast ease-out hover:border-border-strong',
  'outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30',
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/30',
].join(' ');

export type InputProps = ComponentProps<'input'> & {
  /** Icon bên trái (vd <Search/>), chỉ trang trí. */
  leadingIcon?: ReactNode;
};

export function Input({ className, leadingIcon, ...props }: InputProps) {
  const field = useFieldProps(props);
  const input = (
    <input
      {...props}
      {...field}
      className={cn(controlBase, 'h-11 px-3 sm:h-10', Boolean(leadingIcon) && 'pl-10', className)}
    />
  );
  if (!leadingIcon) return input;
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-muted [&_svg]:size-4"
      >
        {leadingIcon}
      </span>
      {input}
    </div>
  );
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<'textarea'>) {
  const field = useFieldProps(props);
  return (
    <textarea
      rows={rows}
      {...props}
      {...field}
      className={cn(controlBase, 'min-h-24 resize-y px-3 py-2.5 leading-relaxed', className)}
    />
  );
}

/** <select> gốc của trình duyệt: bàn phím, trình đọc màn hình, bánh xe chọn trên mobile đều có sẵn. */
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  const field = useFieldProps(props);
  return (
    <div className="relative">
      <select
        {...props}
        {...field}
        className={cn(controlBase, 'h-11 appearance-none pl-3 pr-10 sm:h-10', className)}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
      />
    </div>
  );
}
