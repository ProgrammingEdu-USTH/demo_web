// Trang chủ (khách). Viết lại bằng token + components/ui; không còn nạp CSS/JS legacy.
// Giữ: số liệu hero + lưới khoá học từ /api/courses (xem LandingCourses), nút đăng nhập/đăng ký.
// Bỏ: lời chứng thực và con số "94.000 học viên" — chưa có dữ liệu thật để chứng minh.
import { Bot, Code2, Database, Globe, Layers, Smartphone, Users, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import LandingCourses, { LandingStats } from '@/components/auth/LandingCourses';
import { LandingHeaderNav, LandingHeroCta } from '@/components/auth/LandingCta';
import { buttonVariants, Container, PromptMark, Section, SkipLink } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Programming EDU — Học lập trình hiện đại',
};

const FEATURES = [
  { icon: Zap, title: 'Từ căn bản đến chuyên sâu', text: 'Chuỗi bài học rõ ràng, dễ hiểu, cập nhật theo xu hướng công nghệ.' },
  { icon: Layers, title: 'Thực hành cùng dự án', text: 'Mỗi module có bài tập thực tế để bạn xây portfolio ngay khi học.' },
  { icon: Users, title: 'Giáo viên hướng dẫn', text: 'Đội ngũ mentor hỗ trợ khi bạn gặp khó khăn.' },
  { icon: Smartphone, title: 'Học mọi lúc, mọi nơi', text: 'Học online linh hoạt trên cả máy tính lẫn điện thoại.' },
];

const OUTCOMES = [
  { icon: Globe, title: 'Web development', text: 'Giao diện responsive, JavaScript tương tác và kết nối backend.' },
  { icon: Bot, title: 'AI & Machine Learning', text: 'Mô hình cơ bản, xử lý dữ liệu và triển khai ứng dụng thông minh.' },
  { icon: Database, title: 'Backend + Database', text: 'Xây server, quản lý dữ liệu và tạo API an toàn.' },
];

const STEPS = ['Lý thuyết', 'Trắc nghiệm', 'Kéo thả', 'Tự viết code'];

export default function LandingPage() {
  return (
    <div className="ui-scope min-h-dvh bg-bg font-sans text-fg">
      <SkipLink />
      <header className="border-b border-border">
        <Container className="flex h-topbar items-center justify-between">
          <Link href="/" className="ui-focus-ring inline-flex min-h-11 min-w-0 items-center gap-2 whitespace-nowrap rounded-sm text-base font-bold tracking-tight sm:text-lg">
            <PromptMark />
            Programming EDU
          </Link>
          <LandingHeaderNav />
        </Container>
      </header>

      <main id="main-content" tabIndex={-1}>
        <Container className="flex flex-col gap-6 py-12 sm:py-16 lg:py-24">
          <p className="text-sm font-semibold text-primary">Nền tảng học lập trình cho người Việt</p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl sm:leading-tight">
            Học lập trình theo cách <span className="text-primary">hiện đại</span>
          </h1>
          <p className="max-w-prose text-lg text-fg-muted">
            Từ HTML/CSS đến AI và Backend — nắm vững kỹ năng lập trình với lộ trình thiết kế bởi chuyên gia, viết code ngay trong trình duyệt.
          </p>
          <LandingHeroCta />
          <dl className="flex flex-wrap gap-x-10 gap-y-4 pt-4">
            <LandingStats />
            <div className="flex flex-col">
              <dt className="order-2 text-sm text-fg-muted">Miễn phí</dt>
              <dd className="order-1 text-2xl font-bold text-fg">100%</dd>
            </div>
          </dl>
        </Container>

        <div className="border-y border-border bg-surface-2/50">
          <Container className="flex flex-col gap-8 py-12 sm:gap-10">
            <Section title="Học theo lộ trình thực chiến">
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {FEATURES.map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
                    <Icon aria-hidden="true" className="size-6 text-primary" />
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="text-sm text-fg-muted">{text}</p>
                  </li>
                ))}
              </ul>
            </Section>
          </Container>
        </div>

        <Container className="flex flex-col gap-8 py-12 sm:gap-10">
          <Section title="Khoá học nổi bật">
            <LandingCourses />
          </Section>

          <Section title="Mỗi bài học gồm 4 bước">
            <ol className="grid gap-4 sm:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
                  <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary-soft-fg">{i + 1}</span>
                  <span className="font-semibold">{s}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Sau khoá học bạn làm được gì?">
            <ul className="grid gap-4 sm:grid-cols-3">
              {OUTCOMES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
                  <span className="flex items-center gap-2 font-semibold">
                    <Icon aria-hidden="true" className="size-5 text-primary" />
                    {title}
                  </span>
                  <p className="text-sm text-fg-muted">{text}</p>
                </li>
              ))}
            </ul>
          </Section>
        </Container>

        <div className="border-t border-border bg-primary-soft">
          <Container className="flex flex-col items-start gap-4 py-12">
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-primary-soft-fg">
              <Code2 aria-hidden="true" className="size-6" />
              Bắt đầu hành trình lập trình hôm nay
            </h2>
            <p className="max-w-prose text-primary-soft-fg">
              Đăng ký miễn phí và khám phá lộ trình phù hợp với mục tiêu của bạn.
            </p>
            <Link href="/register" className={buttonVariants({ variant: 'primary', size: 'lg' })}>Tham gia miễn phí</Link>
          </Container>
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-fg-muted">
        © 2026 Programming EDU
      </footer>
    </div>
  );
}
