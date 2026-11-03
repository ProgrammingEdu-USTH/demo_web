'use client';

import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { cn } from './cn';

/*
 * Thông báo nổi ngắn ("Đã lưu", "Nộp bài thất bại"). Gắn <ToastProvider> MỘT lần ở
 * layout gốc; mọi nơi gọi `const { toast } = useToast()`.
 * Vùng aria-live luôn có sẵn trong DOM (rỗng) — trình đọc màn hình chỉ đọc nội dung
 * chèn vào vùng ĐÃ tồn tại, tạo vùng cùng lúc với nội dung thì bị bỏ qua.
 * Toast không dành cho thông tin bắt buộc phải đọc: lỗi form hiện tại chỗ (Field error).
 */

export type ToastVariant = 'neutral' | 'success' | 'danger' | 'info';

export type ToastOptions = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** ms; mặc định 5000, lỗi 8000 (cần thời gian đọc). 0 = không tự tắt. */
  duration?: number;
};

type ToastItem = ToastOptions & { id: number };

type ToastApi = { toast: (opts: ToastOptions) => number; dismiss: (id: number) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast cần <ToastProvider> ở layout gốc');
  return ctx;
}

const icons: Record<ToastVariant, ReactNode> = {
  neutral: null,
  success: <CheckCircle2 aria-hidden="true" className="text-success" />,
  danger: <AlertTriangle aria-hidden="true" className="text-danger" />,
  info: <Info aria-hidden="true" className="text-info" />,
};

function ToastCard({ item, dismiss }: { item: ToastItem; dismiss: (id: number) => void }) {
  const { id, title, description, variant = 'neutral' } = item;
  // dismiss ổn định (useCallback ở Provider) → bộ đếm giờ không bị đặt lại mỗi lần render.
  const onDismiss = useCallback(() => dismiss(id), [dismiss, id]);
  const duration = item.duration ?? (variant === 'danger' ? 8000 : 5000);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useCallback(() => {
    if (duration > 0) timer.current = setTimeout(onDismiss, duration);
  }, [duration, onDismiss]);
  const stop = () => clearTimeout(timer.current);

  useEffect(() => {
    start();
    return () => clearTimeout(timer.current);
  }, [start]);

  return (
    <li
      // Dừng đếm giờ khi trỏ chuột / focus vào để người dùng kịp đọc (WCAG 2.2.1).
      onMouseEnter={stop}
      onMouseLeave={start}
      onFocus={stop}
      onBlur={start}
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-md border border-solid border-border bg-surface p-3 pr-2 shadow-lg',
        'motion-safe:animate-pop-in [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0',
        variant === 'danger' && 'border-danger/40',
      )}
    >
      {icons[variant]}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-fg">{title}</p>
        {description ? <p className="mt-0.5 text-sm text-fg-muted">{description}</p> : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Đóng thông báo"
        className="ui-focus-ring -my-1 inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback((opts: ToastOptions) => {
    const id = nextId.current++;
    // Giữ tối đa 3 cái — nhiều hơn thì che nội dung trên mobile.
    setItems((list) => [...list.slice(-2), { ...opts, id }]);
    return id;
  }, []);
  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  const regionCls =
    'ui-scope pointer-events-none fixed inset-x-0 z-[70] mx-auto flex w-full max-w-sm flex-col gap-2 px-4 ' +
    // Mobile: nằm trên bottom-nav; desktop: góc dưới phải.
    'bottom-[calc(theme(spacing.bottomnav)+0.75rem)] sm:bottom-4 sm:left-auto sm:right-4 sm:mx-0 sm:px-0';

  const polite = items.filter((t) => t.variant !== 'danger');
  const urgent = items.filter((t) => t.variant === 'danger');

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={regionCls}>
        <ol role="alert" aria-live="assertive" className="flex flex-col gap-2">
          {urgent.map((t) => (
            <ToastCard key={t.id} item={t} dismiss={dismiss} />
          ))}
        </ol>
        <ol role="status" aria-live="polite" className="flex flex-col gap-2">
          {polite.map((t) => (
            <ToastCard key={t.id} item={t} dismiss={dismiss} />
          ))}
        </ol>
      </div>
    </ToastContext.Provider>
  );
}
