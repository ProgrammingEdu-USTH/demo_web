'use client';

import { ArrowRight, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Badge, CardDescription, CardTitle, cardVariants, EmptyState, LoadingRegion, Skeleton } from '@/components/ui';

type Course = { id?: string; slug?: string; title?: string; name?: string; description?: string; level?: string; duration?: string };

type State = { kind: 'loading' } | { kind: 'ready'; courses: Course[]; hours: number } | { kind: 'empty' };

// Một lần tải dùng chung cho cả số liệu hero lẫn lưới khoá học (tránh gọi API hai lần).
let cache: Promise<Course[]> | null = null;
function loadCourses(): Promise<Course[]> {
  cache ??= fetch('/backend/api/public/courses')
    .then((r) => (r.ok ? r.json() : null))
    // Endpoint công khai (không cần JWT) trả { ok, courses: [...] } chỉ gồm khoá đã xuất bản.
    .then((res) => (Array.isArray(res) ? res : res?.courses || []) as Course[])
    .catch(() => []);
  return cache;
}

function useCourses(): State {
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    let alive = true;
    loadCourses().then((courses) => {
      if (!alive) return;
      if (!courses.length) return setState({ kind: 'empty' });
      let hours = 0;
      courses.forEach((c) => {
        const m = (c.duration || '').match(/(\d+)/);
        if (m) hours += parseInt(m[1], 10);
      });
      setState({ kind: 'ready', courses, hours });
    });
    return () => { alive = false; };
  }, []);
  return state;
}

/** Số khoá/giờ học ở hero; chưa có khoá nào (hoặc API lỗi) rơi về số cũ của trang: 5+ / 225+. */
export function LandingStats() {
  const s = useCourses();
  const courses = s.kind === 'ready' ? `${s.courses.length}+` : s.kind === 'empty' ? '5+' : '—';
  const hours = s.kind === 'ready' ? `${s.hours > 0 ? s.hours : 225}+` : s.kind === 'empty' ? '225+' : '—';
  return (
    <>
      <Stat value={courses} label="Khoá học" />
      <Stat value={hours} label="Giờ học" />
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <dt className="order-2 text-sm text-fg-muted">{label}</dt>
      <dd className="order-1 text-2xl font-bold text-fg">{value}</dd>
    </div>
  );
}

/** Khoá học nổi bật: API công khai; rỗng/lỗi → lời mời đăng ký thay vì lưới. */
export default function LandingCourses() {
  const state = useCourses();

  if (state.kind === 'loading') {
    return (
      <LoadingRegion label="Đang tải khoá học…" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}
      </LoadingRegion>
    );
  }
  if (state.kind === 'empty') {
    return (
      <EmptyState
        icon={<BookOpen aria-hidden="true" />}
        title="Khoá học đang được cập nhật"
        description="Đăng ký tài khoản miễn phí để được báo khi có khoá mới."
        action={<Link href="/register" className="font-semibold text-primary hover:underline">Đăng ký miễn phí</Link>}
      />
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {state.courses.slice(0, 4).map((c, i) => (
        <Link key={c.id ?? c.slug ?? i} href={`/courses/${c.id || c.slug || 'python'}`} className={cardVariants({ interactive: true, padding: 'sm' })}>
          <div className="flex h-full flex-col gap-2">
            <CardTitle as="h3">{c.title || c.name || 'Khoá học'}</CardTitle>
            {c.description ? <CardDescription className="line-clamp-3">{c.description}</CardDescription> : null}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {c.level ? <Badge>{c.level}</Badge> : null}
              {c.duration ? <span className="text-xs text-fg-muted">{c.duration.replace(/^\s*~\s*/, 'khoảng ')}</span> : null}
              <ArrowRight aria-hidden="true" className="ml-auto size-4 text-primary" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
