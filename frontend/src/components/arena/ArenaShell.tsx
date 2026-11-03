'use client';

// Khung chung 4 tab Arena (Sảnh · Kho đề · Lịch sử · Xếp hạng): PageHeader + banner trận dở + TabNav.
// Vỏ ngoài (sidebar, bottom-nav) do AppShell trong app/(base)/arena/layout.tsx lo.
import { Swords } from 'lucide-react';
import Link from 'next/link';
import { createContext, useContext, useEffect, useState } from 'react';

import { Card, Container, MAIN_CONTENT_ID, PageHeader, SkipLink, TabNav, TabNavLink, buttonVariants, cn } from '@/components/ui';
import { arenaApi } from '@/lib/arena-api';
import type { Match } from '@/lib/arena-api';
import { clockOffset, formatClock, secondsLeft } from '@/lib/arena-utils';
import { useLoad } from './useLoad';

const TABS: { href: string; label: string }[] = [
  { href: '/arena', label: 'Sảnh' },
  { href: '/arena/problems', label: 'Kho đề' },
  { href: '/arena/history', label: 'Lịch sử' },
  { href: '/arena/leaderboard', label: 'Xếp hạng' },
];

type CurrentState = { match: Match | null; offset: number };

// Sảnh cần biết trận dở (để báo "đã có trận") và gọi tải lại sau khi huỷ → chia sẻ qua context,
// tránh gọi /matches/current hai lần.
const CurrentContext = createContext<{ reloadCurrent: () => void } | null>(null);

export function useArenaCurrent() {
  const ctx = useContext(CurrentContext);
  return ctx ?? { reloadCurrent: () => {} };
}

function ResumeBanner({ match, offset }: { match: Match; offset: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (match.status !== 'active') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [match.status]);
  const left = secondsLeft(match.deadlineAt, offset, now);
  const text =
    match.status === 'active'
      ? `Bạn đang có trận với ${match.opponent?.name ?? 'đối thủ'} · còn ${formatClock(left)}`
      : 'Bạn có một phòng đang chờ đối thủ';
  return (
    <Card padding="sm" elevated={false} className="mb-4 flex flex-col gap-3 border-primary/30 bg-primary/10 sm:flex-row sm:items-center sm:justify-between">
      <p role="status" className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Swords aria-hidden="true" className="size-5 shrink-0 text-primary" />
        <span className="tabular-nums">{text}</span>
      </p>
      <Link href={`/arena/match/${match.id}`} className={buttonVariants({ variant: 'primary', size: 'sm' })}>
        Vào trận
      </Link>
    </Card>
  );
}

export default function ArenaShell({
  pageTitle,
  current,
  children,
}: {
  /** Chỉ dùng cho <title> của tab trình duyệt. */
  pageTitle: string;
  /** href của tab đang mở. */
  current: string;
  children: React.ReactNode;
}) {
  const cur = useLoad<CurrentState>(async () => {
    const r = await arenaApi.current();
    return { match: r.match, offset: clockOffset(r.serverTime) };
  });
  const match = cur.data?.match;
  const pending = match && (match.status === 'waiting' || match.status === 'active') ? match : null;

  return (
    <CurrentContext.Provider value={{ reloadCurrent: () => void cur.reload() }}>
      <title>{`${pageTitle} · Đấu trường · Programming EDU`}</title>
      <Container>
        <PageHeader
          title="Đấu trường"
          description="Giải cùng một đề với đối thủ — ai đúng nhiều test hơn, nhanh hơn thì thắng."
        />
        {pending ? <ResumeBanner match={pending} offset={cur.data?.offset ?? 0} /> : null}
        <TabNav label="Các mục của Đấu trường">
          {TABS.map((t) => (
            <TabNavLink key={t.href} href={t.href} active={t.href === current}>
              {t.label}
            </TabNavLink>
          ))}
        </TabNav>
        <div className="pb-10 pt-4 sm:pt-6">{children}</div>
      </Container>
    </CurrentContext.Provider>
  );
}

/** Khung tối giản cho màn tập trung (trận, lỗi trận): nội dung căn giữa, không chrome. */
export function ArenaFocusFrame({ pageTitle, className, children }: { pageTitle: string; className?: string; children: React.ReactNode }) {
  return (
    <>
      <title>{`${pageTitle} · Đấu trường · Programming EDU`}</title>
      <SkipLink />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className={cn('flex min-h-dvh items-center justify-center p-4 outline-none', className)}>{children}</main>
    </>
  );
}
