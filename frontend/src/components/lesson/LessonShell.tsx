'use client';

// Vỏ bài học CHUNG cho mọi kiểu bài (python*, java, htmlcss, cpp /interface, db_*, /card/*) theo
// design/pages/lesson.md: thanh trên h-12 · mục lục (cột 280px desktop / Sheet trái mobile) · nội dung ·
// thanh Trước/Sau (cố định đáy trên mobile). Ruột bài (StudioLesson, chấm bài, engine legacy) là `children`
// và KHÔNG bị đổi hành vi — vỏ chỉ thêm điều hướng, trạng thái, và đặt biến --lesson-shell-h để các khung
// toàn màn hình của ruột bài (LessonChrome, .h-screen legacy) trừ đi chiều cao thanh trên.
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Circle, CircleDot, ListTree, Lock, MoreHorizontal, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Chatbot from '@/components/Chatbot';
import LegacyScripts from '@/components/LegacyScripts';
import { LessonChromeExtrasContext } from '@/components/lesson-chrome/LessonChrome';
import PageStyles from '@/components/PageStyles';
import {
  Button, Card, Container, EmptyState, ErrorState, IconButton, Input, LoadingRegion, ProgressBar, Sheet, Skeleton,
  SkipLink, cn, iconButtonVariants,
} from '@/components/ui';
import { apiFetch, asList, findEnrollment } from '@/lib/api';
import {
  COURSE_NAMES, courseLessons, isLinkableCourse, lessonHref, progressFrom, type Progress,
} from '@/lib/lesson-course';

export type LessonShellState =
  | { kind: 'loading' }
  | { kind: 'error'; message?: string; onRetry?: () => void }
  | { kind: 'missing' };

export type LessonShellProps = {
  courseId: string;
  /** Chỉ số 0-based trong khoá. Bỏ trống với bài lẻ (nhiệm vụ Java/HTML, card). */
  lessonIndex?: number;
  /** Tiêu đề thanh trên; mặc định "Bài N · tên bài" lấy từ curricula. */
  title?: string;
  /**
   * prose: cột 68ch cho bài đọc · wide: cột rộng cho bài 2 cột · fill: ruột bài tự quản toàn bộ vùng
   * (editor lớn, engine legacy) — mục lục desktop mặc định thu.
   */
  layout?: 'prose' | 'wide' | 'fill';
  /** none: ruột bài đã có nút tiếp theo riêng (Studio, engine legacy). */
  nav?: 'auto' | 'none';
  /** Bài lẻ: nút "Sau" tuỳ biến (card → bài kế). */
  next?: { href: string; label: string };
  state?: LessonShellState;
  /** Chatbot legacy: false nếu ruột bài tự nạp. */
  chatbot?: boolean;
  children: React.ReactNode;
};

const TOC_KEY = 'pe-lesson-toc-open';

export default function LessonShell({
  courseId, lessonIndex, title, layout = 'prose', nav = 'auto', next, state, chatbot = true, children,
}: LessonShellProps) {
  const lessons = useMemo(() => courseLessons(courseId), [courseId]);
  const linkable = isLinkableCourse(courseId) && lessons.length > 0 && lessonIndex !== undefined;
  const courseName = COURSE_NAMES[courseId] ?? 'Khoá học';
  const total = lessons.length;
  const current = lessonIndex !== undefined ? lessons[lessonIndex] : undefined;
  const outOfRange = linkable && lessonIndex !== undefined && lessonIndex >= total;
  const heading = title ?? (current ? `Bài ${lessonIndex! + 1} · ${current.title}` : courseName);

  const [progress, setProgress] = useState<Progress>({ known: false, done: new Set(), next: 1 });
  const [stats, setStats] = useState<{ streak?: number; xp?: number } | null>(null);
  const [tocOpen, setTocOpen] = useState(layout === 'prose' || layout === 'wide');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);

  // Nhớ lựa chọn thu/mở mục lục desktop; đọc trong effect để SSR và client khớp nhau.
  useEffect(() => {
    try {
      const v = localStorage.getItem(TOC_KEY);
      if (v !== null) setTocOpen(v === '1'); // eslint-disable-line react-hooks/set-state-in-effect
    } catch { /* chế độ riêng tư */ }
  }, []);

  // Tiến độ khoá (đánh dấu ✓/khoá trong mục lục) + streak/XP. Lỗi mạng: mục lục vẫn dùng được, chỉ không có dấu.
  useEffect(() => {
    let alive = true;
    if (isLinkableCourse(courseId) && total > 0) {
      apiFetch('/api/enrolled')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive || !d) return;
          setProgress(progressFrom(findEnrollment(asList(d, 'enrolled'), courseId), total));
        })
        .catch(() => {});
    }
    apiFetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (alive && s) setStats({ streak: Number(s.streak) || 0, xp: typeof s.xp === 'number' ? s.xp : undefined });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [courseId, total]);

  const toggleToc = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setTocOpen((o) => {
        try { localStorage.setItem(TOC_KEY, o ? '0' : '1'); } catch { /* bỏ qua */ }
        return !o;
      });
    } else {
      setSheetOpen(true);
    }
  };

  const openMenu = () => {
    setDark(document.body.classList.contains('dark'));
    setMenuOpen(true);
  };
  // Cùng cách main.js toggleTheme() / AppShell.
  const toggleTheme = useCallback(() => {
    const nextDark = !document.body.classList.contains('dark');
    document.body.classList.toggle('dark', nextDark);
    document.body.classList.toggle('light', !nextDark);
    try { localStorage.setItem('theme', nextDark ? 'dark' : 'light'); } catch { /* bỏ qua */ }
    setDark(nextDark);
  }, []);
  const openAssistant = () => {
    setMenuOpen(false);
    document.getElementById('chatbot-toggle')?.click();
  };

  const prev = linkable && lessonIndex! > 0 ? lessons[lessonIndex! - 1] : null;
  const nextLesson = linkable && lessonIndex! < total - 1 ? lessons[lessonIndex! + 1] : null;
  const isLast = linkable && lessonIndex === total - 1;
  const showNav = nav === 'auto' && !state && !outOfRange && (linkable || next);
  const courseDone = isLast && progress.known && progress.done.size >= total;

  const toc = (
    <LessonToc
      courseId={courseId}
      lessons={lessons}
      currentIndex={linkable ? lessonIndex : undefined}
      progress={progress}
      onNavigate={() => setSheetOpen(false)}
    />
  );

  let body: React.ReactNode = children;
  if (state?.kind === 'loading') body = <LessonLoading />;
  else if (state?.kind === 'error') {
    body = (
      <ErrorState
        title={current ? `Không tải được bài ${lessonIndex! + 1}` : 'Không tải được bài học'}
        description={state.message ?? 'Kiểm tra kết nối mạng rồi thử lại. Tiến độ của bạn không bị mất.'}
        action={
          <>
            {state.onRetry && <Button variant="primary" onClick={state.onRetry}>Thử lại</Button>}
            <Link href={`/courses/${courseId}`} className="ui-focus-ring rounded-md px-3 py-2 text-sm font-semibold text-primary no-underline hover:underline">Về khoá học</Link>
          </>
        }
      />
    );
  } else if (state?.kind === 'missing' || outOfRange) {
    body = (
      <EmptyState
        title="Không có bài này"
        description="Số bài trong đường dẫn nằm ngoài khoá học."
        action={<Link href={lessonHref(courseId, 0)} className="ui-focus-ring rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-fg no-underline hover:bg-primary-hover">Về bài đầu tiên</Link>}
      />
    );
  }
  const stateShown = Boolean(state) || outOfRange;
  const fill = layout === 'fill' && !stateShown;

  return (
    <LessonChromeExtrasContext.Provider value={fill ? { xp: stats?.xp, onMenu: openMenu } : null}>
    <div className={cn('ui-scope flex min-h-dvh flex-col bg-bg font-sans text-fg', fill ? '[--lesson-shell-h:0px]' : '[--lesson-shell-h:3rem]')}>
      <SkipLink />
      {chatbot && <PageStyles hrefs={['/static/vendor/fontawesome/css/all.min.css', '/static/css/chatbot.css']} />}

      {/* fill: LessonChrome là thanh duy nhất (đã nhận XP + ⋯ qua context) → header vỏ chỉ còn h1 cho trình đọc màn hình */}
      <header className={cn(fill ? 'sr-only' : 'sticky top-0 z-40 flex h-12 shrink-0 items-center gap-1 border-0 border-b border-solid border-border bg-surface px-2 sm:gap-2 sm:px-4')}>
        <Link
          href={`/courses/${courseId}`}
          aria-label={`Về khoá ${courseName}`}
          title={`Về khoá ${courseName}`}
          className={cn(iconButtonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline sm:size-11', fill && 'hidden')}
        >
          <ArrowLeft aria-hidden="true" />
        </Link>
        {linkable && (
          <IconButton
            label="Mục lục"
            size="sm"
            icon={<ListTree aria-hidden="true" />}
            aria-expanded={tocOpen}
            onClick={toggleToc}
            className="max-sm:order-last max-sm:ml-auto sm:size-11"
          />
        )}
        {/* Layout fill: LessonChrome đã hiện tên bài + chuỗi ngày + nút thoát → ở đây chỉ giữ h1 cho trình đọc màn hình */}
        <h1 className={cn('min-w-0 flex-1 truncate text-sm font-semibold sm:text-base', fill && 'sr-only')}>{heading}</h1>
        {linkable && (
          <div className="flex w-40 shrink-0 items-center gap-2 max-sm:hidden">
            <ProgressBar
              value={progress.known ? progress.done.size : lessonIndex! + 1}
              max={total}
              label={`Tiến độ khoá ${courseName}`}
              size="sm"
              className="flex-1"
            />
            <span className="whitespace-nowrap text-xs tabular-nums text-fg-muted">
              {progress.known ? progress.done.size : lessonIndex! + 1}/{total}
            </span>
          </div>
        )}
        {stats && (
          <span className="ml-auto flex items-center gap-3 whitespace-nowrap text-xs font-semibold text-fg-muted">
            {!fill && <span title="Chuỗi ngày học" className="max-sm:hidden">🔥 {stats.streak ?? 0}</span>}
            {stats.xp !== undefined && <span>{stats.xp} XP</span>}
          </span>
        )}
        <IconButton label="Thêm tuỳ chọn" size="sm" icon={<MoreHorizontal aria-hidden="true" />} onClick={openMenu} className="max-sm:order-last sm:size-11" />
      </header>
      {linkable && !fill && (
        <div className="sm:hidden">
          <ProgressBar
            value={progress.known ? progress.done.size : lessonIndex! + 1}
            max={total}
            label={`Tiến độ khoá ${courseName}: ${lessonIndex! + 1}/${total}`}
            size="sm"
            className="h-1 rounded-none"
          />
        </div>
      )}

      <div className={cn('flex min-h-0 flex-1', tocOpen && linkable && 'lg:grid lg:grid-cols-[280px_minmax(0,1fr)]')}>
        {tocOpen && linkable && (
          <aside
            aria-label="Mục lục khoá học"
            className="sticky top-12 block max-lg:hidden h-[calc(100dvh-3rem)] overflow-y-auto border-0 border-r border-solid border-border bg-surface"
          >
            {toc}
          </aside>
        )}

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
          {fill ? (
            children
          ) : (
            <Container size={layout === 'prose' ? 'prose' : 'page'} className="py-6">
              {body}
              {courseDone && (
                <Card className="mt-6 space-y-3 p-5 text-center">
                  <p className="text-lg font-semibold">🎉 Bạn đã hoàn thành khoá {courseName}!</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Link href={`/practice?course=${courseId}`} className="ui-focus-ring rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-fg no-underline hover:bg-primary-hover">Ôn tập khoá</Link>
                    <Link href={`/courses/${courseId}`} className="ui-focus-ring rounded-md border border-solid border-border px-4 py-2 text-sm font-semibold text-fg no-underline hover:bg-surface-2">Về khoá học</Link>
                  </div>
                </Card>
              )}
              {showNav && (
                <>
                  <LessonNav
                    prev={prev ? { href: lessonHref(courseId, prev.index), label: `Bài ${prev.index + 1}: ${prev.title}` } : null}
                    next={
                      nextLesson
                        ? { href: lessonHref(courseId, nextLesson.index), label: `Bài ${nextLesson.index + 1}: ${nextLesson.title}` }
                        : next ?? { href: `/courses/${courseId}`, label: 'Về khoá học' }
                    }
                    unfinished={linkable && progress.known && !progress.done.has(lessonIndex!)}
                  />
                  <div aria-hidden="true" className="h-[calc(3.5rem+env(safe-area-inset-bottom))] sm:hidden" />
                </>
              )}
            </Container>
          )}
        </main>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen} side="left" title="Mục lục" description={courseName}>
        {toc}
      </Sheet>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title="Tuỳ chọn bài học" description={heading}>
        <ul className="m-0 flex list-none flex-col gap-1 p-0 py-2">
          <li>
            <button type="button" onClick={toggleTheme} className={menuItemCls}>
              {dark ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
              {dark ? 'Giao diện sáng' : 'Giao diện tối'}
            </button>
          </li>
          {fill && linkable && (
            <li>
              <button type="button" onClick={() => { setMenuOpen(false); toggleToc(); }} className={menuItemCls}>
                <ListTree className="size-5" aria-hidden="true" />
                Mục lục
              </button>
            </li>
          )}
          {chatbot && (
            <li>
              <button type="button" onClick={openAssistant} className={menuItemCls}>
                <i className="fa-solid fa-robot w-5 text-center" aria-hidden="true" />
                Trợ lý AI
              </button>
            </li>
          )}
          <li>
            <Link
              href={`/community?new=1&lesson=${encodeURIComponent(`${courseId}:${lessonIndex ?? ''}`)}`}
              onClick={() => setMenuOpen(false)}
              className={cn(menuItemCls, 'no-underline')}
            >
              <i className="fa-regular fa-comments w-5 text-center" aria-hidden="true" />
              Hỏi cộng đồng
            </Link>
          </li>
          <li>
            <Link
              href={`/community?new=1&type=bug&lesson=${encodeURIComponent(`${courseId}:${lessonIndex ?? ''}`)}`}
              onClick={() => setMenuOpen(false)}
              className={cn(menuItemCls, 'no-underline')}
            >
              <i className="fa-solid fa-bug w-5 text-center" aria-hidden="true" />
              Báo lỗi bài
            </Link>
          </li>
        </ul>
      </Sheet>

      {chatbot && (
        <>
          <Chatbot />
          <LegacyScripts srcs={['/static/js/chatbot.js']} />
        </>
      )}
    </div>
    </LessonChromeExtrasContext.Provider>
  );
}

const menuItemCls =
  'ui-focus-ring flex min-h-11 w-full items-center gap-3 rounded-md border-0 bg-transparent px-3 text-left text-sm font-semibold text-fg hover:bg-surface-2';

/** Trạng thái đang tải: khung bài hiện ngay, ruột bài chờ dữ liệu. */
export function LessonLoading() {
  return (
    <LoadingRegion label="Đang tải bài học…" className="space-y-4">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-40 w-full" />
    </LoadingRegion>
  );
}

function LessonNav({
  prev, next, unfinished,
}: {
  prev: { href: string; label: string } | null;
  next: { href: string; label: string };
  unfinished: boolean;
}) {
  return (
    <nav
      aria-label="Chuyển bài"
      className={cn(
        'mt-8 border-0 border-t border-solid border-border pt-4',
        'max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:mt-0 max-sm:bg-surface max-sm:px-3 max-sm:pb-[env(safe-area-inset-bottom)] max-sm:pt-0',
      )}
    >
      <div className="flex items-center justify-between gap-3 max-sm:h-14">
        {prev ? (
          <>
            <Link href={prev.href} aria-label={prev.label} title={prev.label} className={cn(iconButtonVariants({ variant: 'secondary', size: 'md' }), 'no-underline sm:hidden')}>
              <ChevronLeft aria-hidden="true" />
            </Link>
            <Link href={prev.href} className="ui-focus-ring hidden min-h-10 max-w-[45%] items-center gap-1 truncate rounded-md border border-solid border-border bg-surface px-4 text-sm font-semibold text-fg no-underline hover:bg-surface-2 sm:inline-flex">
              <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{prev.label}</span>
            </Link>
          </>
        ) : (
          <span aria-hidden="true" />
        )}
        <Link href={next.href} className="ui-focus-ring inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-primary px-4 text-sm font-semibold text-primary-fg no-underline hover:bg-primary-hover sm:min-h-10 sm:flex-none sm:max-w-[45%]">
          <span className="truncate">{next.label}</span>
          <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        </Link>
      </div>
      {unfinished && <p className="m-0 mt-2 text-xs text-fg-muted max-sm:hidden">Bài này chưa tính hoàn thành.</p>}
    </nav>
  );
}

function LessonToc({
  courseId, lessons, currentIndex, progress, onNavigate,
}: {
  courseId: string;
  lessons: ReturnType<typeof courseLessons>;
  currentIndex?: number;
  progress: Progress;
  onNavigate: () => void;
}) {
  const [q, setQ] = useState('');
  const linkable = isLinkableCourse(courseId);
  const currentRef = useRef<HTMLElement | null>(null);
  // Cuộn tới bài hiện tại khi mục lục xuất hiện (mở Sheet / tải trang).
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  const needle = q.trim().toLowerCase();
  const shown = needle ? lessons.filter((l) => l.title.toLowerCase().includes(needle)) : lessons;
  const modules = shown.reduce<{ title: string; items: typeof lessons }[]>((acc, l) => {
    const last = acc[acc.length - 1];
    if (last && last.title === l.module) last.items.push(l);
    else acc.push({ title: l.module, items: [l] });
    return acc;
  }, []);

  return (
    <div className="flex flex-col gap-3 p-3">
      {lessons.length > 15 && (
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lọc bài học…" aria-label="Lọc bài học" />
      )}
      {modules.length === 0 && <p className="m-0 px-2 text-sm text-fg-muted">Không có bài nào khớp.</p>}
      {modules.map((m) => (
        <section key={m.title} aria-label={m.title}>
          <h2 className="m-0 mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">{m.title}</h2>
          <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
            {m.items.map((l) => {
              const isCurrent = l.index === currentIndex;
              const done = progress.done.has(l.index);
              // Khoá: chỉ khi biết tiến độ và bài nằm sau bài kế tiếp (đúng logic trang khoá học).
              const locked = progress.known && !done && l.index + 1 > progress.next;
              const icon = locked ? (
                <Lock className="size-4 text-fg-subtle" aria-hidden="true" />
              ) : done ? (
                <Check className="size-4 text-success" aria-hidden="true" />
              ) : isCurrent ? (
                <CircleDot className="size-4 text-primary" aria-hidden="true" />
              ) : (
                <Circle className="size-4 text-fg-subtle" aria-hidden="true" />
              );
              const cls = cn(
                'flex min-h-11 items-center gap-2 rounded-md px-2 text-sm no-underline sm:min-h-9',
                isCurrent ? 'bg-primary/10 font-semibold text-fg' : 'text-fg-muted',
                locked ? 'cursor-not-allowed opacity-60' : 'hover:bg-surface-2 hover:text-fg',
              );
              const inner = (
                <>
                  {icon}
                  <span className="w-5 shrink-0 text-xs tabular-nums">{l.index + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{l.title}</span>
                </>
              );
              return (
                <li key={l.index}>
                  {linkable && !locked ? (
                    <Link
                      href={lessonHref(courseId, l.index)}
                      aria-current={isCurrent ? 'page' : undefined}
                      onClick={onNavigate}
                      ref={isCurrent ? (el) => { currentRef.current = el; } : undefined}
                      className={cn(cls, 'ui-focus-ring')}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <span aria-disabled={locked || !linkable} aria-current={isCurrent ? 'page' : undefined} className={cn(cls, !linkable && 'cursor-default')}>
                      {inner}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
