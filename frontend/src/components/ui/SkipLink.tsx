// Liên kết "Bỏ qua tới nội dung chính" (WCAG 2.4.1 — Bypass Blocks).
// Ẩn kiểu sr-only, chỉ hiện khi nhận focus bàn phím → phải là phần tử tương tác ĐẦU TIÊN của vỏ trang,
// trước sidebar/topbar, để Tab lần đầu gặp ngay nó.
// Đích mặc định là `#main-content`: thẻ <main id="main-content" tabIndex={-1}> của vỏ trang.
// tabIndex={-1} là bắt buộc — thiếu nó, Safari/Chrome chỉ cuộn tới mà không chuyển focus,
// Tab kế tiếp lại quay về đầu điều hướng (mất tác dụng bỏ qua).
// Thẻ <a> thuần (không next/link): nhảy tới anchor trong cùng trang là việc của trình duyệt, không cần router.
import { cn } from './cn';

export const MAIN_CONTENT_ID = 'main-content';

export interface SkipLinkProps {
  /** id của vùng nội dung chính (không có dấu #). Mặc định `main-content`. */
  targetId?: string;
  children?: React.ReactNode;
  className?: string;
}

export function SkipLink({ targetId = MAIN_CONTENT_ID, children = 'Bỏ qua tới nội dung chính', className }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        // Khi hiện: nổi trên mọi lớp (z-[100] > sidebar/topbar/Sheet z-50), cỡ chạm ≥44px.
        'sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:inline-flex focus:min-h-11 focus:items-center',
        'focus:rounded-md focus:border focus:border-border focus:bg-surface focus:px-4 focus:text-sm focus:font-semibold focus:text-fg focus:shadow-lg',
        'ui-focus-ring',
        className,
      )}
    >
      {children}
    </a>
  );
}
