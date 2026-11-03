import { BookOpen, CheckCircle2, Code2, Trophy } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { PromptMark, SkipLink } from '@/components/ui';

// Khung chung cho đăng nhập / đăng ký: form một cột trên mobile, thêm panel giới thiệu từ lg.
// Gốc `ui-scope` bắt buộc — preflight Tailwind đã tắt nên reset chỉ áp trong scope này.
const POINTS = [
  { icon: BookOpen, text: 'Lộ trình từ HTML/CSS đến Python, Java, SQL' },
  { icon: Code2, text: 'Viết và chạy code ngay trong trình duyệt' },
  { icon: Trophy, text: 'Chấm bài tự động, XP và bảng xếp hạng' },
];

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="ui-scope min-h-dvh bg-bg font-sans text-fg lg:grid lg:grid-cols-2">
      <SkipLink />
      <main id="main-content" tabIndex={-1} className="flex min-h-dvh flex-col justify-center px-4 py-8 sm:px-8">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
          <Link href="/" className="ui-focus-ring inline-flex min-h-11 w-fit items-center gap-2 rounded-sm text-lg font-bold tracking-tight">
            <PromptMark />
            Programming EDU
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-fg-muted">{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
      <aside className="hidden flex-col justify-center gap-6 border-l border-border bg-surface-2 px-12 py-12 lg:flex" aria-label="Giới thiệu">
        <p className="text-3xl font-bold leading-tight tracking-tight">
          Học lập trình <br />
          bằng cách <span className="text-primary">làm thật</span>.
        </p>
        <ul className="flex max-w-md flex-col gap-3">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-base text-fg-muted">
              <Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
              {text}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

/** Màn báo thành công sau khi gọi API xong, trước khi chuyển trang. */
export function AuthSuccess({ title, description }: { title: string; description: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 rounded-lg border border-success/40 bg-success-soft px-4 py-8 text-center">
      <CheckCircle2 aria-hidden="true" className="size-10 text-success-soft-fg" />
      <p className="text-lg font-bold text-success-soft-fg">{title}</p>
      <p className="text-sm text-success-soft-fg">{description}</p>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-soft-fg">
      {message}
    </p>
  );
}
