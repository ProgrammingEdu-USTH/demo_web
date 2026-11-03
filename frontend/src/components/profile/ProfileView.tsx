'use client';

// /profile: Tổng quan · Kỹ năng · Thành tích, viết bằng React + token (thay #page-profile, #page-skills legacy).
// API: /api/user, /api/stats, /api/arena/me, /api/enrolled, /api/stats/xp-by-course, /api/skills, /api/achievements.
// Mỗi khối tự tải/lỗi độc lập (useRemote) để một API hỏng không làm trắng cả trang.
import { Flame, Lock } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useState, type ReactNode } from 'react';

import {
  Avatar, Badge, Button, Card, Dialog, EmptyState, ErrorState, ProgressBar, Skeleton, TabNav, TabNavLink, buttonVariants, cn,
} from '@/components/ui';
import { fetchJson, useRemote } from '@/lib/fetch-json';

type User = { id?: number; name?: string | null; email?: string | null; createdAt?: string | null; created_at?: string | null };
type Stats = { xp?: number; streak?: number };
type Enrolled = { id: string; title: string; progress?: number; status?: string };
type Skill = { courseId: string; skill: string; total: number; completed: number; progress: number };
type Ach = { id: number; name: string; description: string | null; icon: string | null; unlocked: boolean; progress: number; current: number; target: number };

const fmt = (n: number) => n.toLocaleString('vi-VN');

function Stat({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2 text-center sm:text-left">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="m-0 flex items-center justify-center gap-1 font-mono text-lg font-semibold tabular-nums sm:justify-start">{icon}{value}</dd>
    </div>
  );
}

/* ───────── Đầu hồ sơ ───────── */
function Head() {
  const [u, reloadU] = useRemote(() => fetchJson<User>('/api/user'));
  // Số liệu phụ: lỗi thì chỉ hiện "—", không chặn tên/avatar.
  const [stats] = useRemote(() => fetchJson<Stats>('/api/stats'));
  const [arena] = useRemote(() => fetchJson<{ rating?: number; wins?: number; losses?: number; draws?: number }>('/api/arena/me'));
  const [enr] = useRemote(() => fetchJson<{ enrolled?: Enrolled[] }>('/api/enrolled'));

  if (u.state === 'loading') {
    return <Card role="status" aria-label="Đang tải hồ sơ" className="flex flex-col items-center gap-4 sm:flex-row"><Skeleton className="size-24 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64" /></div></Card>;
  }
  if (u.state === 'error') {
    return <Card><ErrorState compact title="Không tải được hồ sơ" action={<Button variant="secondary" onClick={reloadU}>Thử lại</Button>} /></Card>;
  }
  const name = u.data.name || 'Học viên';
  const joined = u.data.createdAt ?? u.data.created_at;
  const s = stats.state === 'ok' ? stats.data : null;
  const rating = arena.state === 'ok' && (arena.data.wins ?? 0) + (arena.data.losses ?? 0) + (arena.data.draws ?? 0) > 0 ? arena.data.rating : null;
  const done = enr.state === 'ok' ? (enr.data.enrolled ?? []).filter((e) => (e.progress ?? 0) >= 100).length : null;

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <Avatar name={name} size="xl" />
        <div className="min-w-0 flex-1">
          <h1 className="m-0 break-words text-2xl font-bold">{name}</h1>
          {u.data.email ? <p className="m-0 break-all text-sm text-fg-muted">{u.data.email}</p> : null}
          {joined ? <p className="m-0 text-xs text-fg-muted">Tham gia {new Date(joined).toLocaleDateString('vi-VN')}</p> : null}
        </div>
        <Link href="/settings" className={buttonVariants({ variant: 'secondary' })}>Sửa hồ sơ</Link>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Tổng XP" value={s?.xp != null ? fmt(s.xp) : '—'} />
        <Stat label="Streak" value={s?.streak != null ? s.streak : '—'} icon={<Flame aria-hidden="true" className="size-4 text-warning" />} />
        <Stat label="ELO" value={rating ?? '—'} />
        <Stat label="Khoá đã xong" value={done ?? '—'} />
      </dl>
      {rating == null && arena.state === 'ok' ? (
        <p className="m-0 text-sm text-fg-muted">Bạn chưa đấu trận nào. <Link href="/arena" className="font-semibold text-primary underline">Thử Đấu trường</Link></p>
      ) : null}
    </Card>
  );
}

/* ───────── Tổng quan ───────── */
function Overview() {
  const [enr, reload] = useRemote(() => fetchJson<{ enrolled?: Enrolled[] }>('/api/enrolled'));
  const [xp, reloadXp] = useRemote(() => fetchJson<{ xp_by_course?: { courseId: string; xp: number }[] }>('/api/stats/xp-by-course'));
  const titles = new Map((enr.state === 'ok' ? enr.data.enrolled ?? [] : []).map((e) => [e.id, e.title]));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-labelledby="learning-h">
        <h2 id="learning-h" className="mb-3 text-lg font-semibold">Đang học</h2>
        {enr.state === 'loading' ? (
          <div role="status" aria-label="Đang tải khoá học" className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        ) : enr.state === 'error' ? (
          <Card><ErrorState compact title="Không tải được khoá học" action={<Button variant="secondary" onClick={reload}>Thử lại</Button>} /></Card>
        ) : (enr.data.enrolled ?? []).length === 0 ? (
          <Card><EmptyState compact title="Chưa ghi danh khoá nào" action={<Link href="/courses" className={buttonVariants({ variant: 'primary' })}>Chọn khoá học</Link>} /></Card>
        ) : (
          <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {(enr.data.enrolled ?? []).map((c) => (
              <li key={c.id}>
                <Card className="flex h-full flex-col gap-3">
                  <h3 className="m-0 line-clamp-2 text-base font-semibold">{c.title}</h3>
                  <ProgressBar label={`Tiến độ ${c.title}`} value={c.progress ?? 0} max={100} showValue />
                  <Link href={`/courses/${c.id}`} className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'mt-auto self-start')}>
                    {(c.progress ?? 0) >= 100 ? 'Ôn lại' : 'Học tiếp'}
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="xp-h">
        <h2 id="xp-h" className="mb-3 text-lg font-semibold">XP theo khoá</h2>
        <Card>
          {xp.state === 'loading' ? (
            <div role="status" aria-label="Đang tải XP" className="space-y-3"><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
          ) : xp.state === 'error' ? (
            <ErrorState compact title="Không tải được XP" action={<Button variant="secondary" onClick={reloadXp}>Thử lại</Button>} />
          ) : !(xp.data.xp_by_course ?? []).length ? (
            <EmptyState compact title="Chưa có XP" description="Hoàn thành một bài học để bắt đầu tích XP." />
          ) : (
            (() => {
              const rows = xp.data.xp_by_course ?? [];
              const max = Math.max(...rows.map((r) => r.xp), 1);
              return (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {rows.map((r) => (
                    <li key={r.courseId} className="flex flex-col gap-1">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="truncate">{titles.get(r.courseId) ?? r.courseId}</span>
                        <span className="shrink-0 whitespace-nowrap font-mono font-semibold tabular-nums">{fmt(r.xp)} XP</span>
                      </div>
                      <ProgressBar label={`XP khoá ${titles.get(r.courseId) ?? r.courseId}`} value={r.xp} max={max} tone="accent" size="sm" />
                    </li>
                  ))}
                </ul>
              );
            })()
          )}
        </Card>
      </section>
    </div>
  );
}

/* ───────── Kỹ năng ───────── */
function Skills() {
  const [res, reload] = useRemote(() => fetchJson<{ skills?: Skill[] }>('/api/skills'));
  const [enr] = useRemote(() => fetchJson<{ enrolled?: Enrolled[] }>('/api/enrolled'));
  if (res.state === 'loading') return <div role="status" aria-label="Đang tải kỹ năng" className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>;
  if (res.state === 'error') return <Card><ErrorState compact title="Không tải được kỹ năng" action={<Button variant="secondary" onClick={reload}>Thử lại</Button>} /></Card>;
  const skills = res.data.skills ?? [];
  if (!skills.length) return <Card><EmptyState compact title="Chưa có kỹ năng nào" description="Kỹ năng xuất hiện khi bạn học các bài có chủ đề." /></Card>;
  const titles = new Map((enr.state === 'ok' ? enr.data.enrolled ?? [] : []).map((e) => [e.id, e.title]));
  const groups = new Map<string, Skill[]>();
  skills.forEach((k) => groups.set(k.courseId, [...(groups.get(k.courseId) ?? []), k]));
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {[...groups].map(([cid, list]) => (
        <Card key={cid}>
          <h2 className="mb-3 text-base font-semibold">{titles.get(cid) ?? cid}</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {list.map((k) => (
              <li key={k.skill} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{k.skill}</span>
                <span className="font-mono text-xs tabular-nums text-fg-muted">{k.completed}/{k.total}</span>
                {k.progress >= 100 ? <Badge variant="success">Đã nắm</Badge> : k.progress > 0 ? <Badge variant="primary">Đang học</Badge> : <Badge variant="outline">Chưa mở</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

/* ───────── Thành tích ───────── */
function Achievements() {
  const [res, reload] = useRemote(() => fetchJson<{ achievements?: Ach[] }>('/api/achievements'));
  const [pick, setPick] = useState<Ach | null>(null);
  if (res.state === 'loading') return <div role="status" aria-label="Đang tải thành tích" className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (res.state === 'error') return <Card><ErrorState compact title="Không tải được thành tích" action={<Button variant="secondary" onClick={reload}>Thử lại</Button>} /></Card>;
  const list = res.data.achievements ?? [];
  if (!list.length) return <Card><EmptyState compact title="Chưa có huy hiệu nào" description="Hoàn thành bài đầu tiên để nhận huy hiệu." /></Card>;
  const got = list.filter((a) => a.unlocked).length;
  return (
    <>
      <p className="mb-3 text-sm text-fg-muted">Đã đạt <strong className="tabular-nums">{got}</strong>/{list.length} huy hiệu</p>
      <ul className="m-0 grid list-none grid-cols-3 gap-3 p-0 sm:grid-cols-4 lg:grid-cols-6">
        {list.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => setPick(a)} className="flex h-full w-full flex-col items-center gap-1.5 rounded-lg border border-solid border-border bg-surface p-3 text-center transition-colors hover:bg-surface-2">
              <span aria-hidden="true" className={cn('text-3xl', !a.unlocked && 'opacity-50 grayscale')}>{a.icon || '🏅'}</span>
              <span className={cn('line-clamp-2 text-xs font-semibold', !a.unlocked && 'opacity-70')}>{a.name}</span>
              {a.unlocked ? <Badge variant="success">Đã đạt</Badge> : <Badge variant="outline"><Lock aria-hidden="true" />Chưa đạt</Badge>}
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={pick !== null} onOpenChange={(o) => { if (!o) setPick(null); }} size="sm" title={pick?.name ?? ''} description={pick?.description ?? undefined}>
        {pick ? (
          <div className="flex flex-col gap-2">
            <ProgressBar label={`Tiến độ huy hiệu ${pick.name}`} value={pick.progress} max={100} showValue tone={pick.unlocked ? 'success' : 'primary'} />
            <p className="m-0 text-sm text-fg-muted">{pick.unlocked ? 'Bạn đã đạt huy hiệu này.' : `Hiện ${fmt(pick.current)}/${fmt(pick.target)} để đạt.`}</p>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

function Inner() {
  const pathname = usePathname();
  const tab = useSearchParams().get('tab');
  const cur = tab === 'skills' || tab === 'achievements' ? tab : 'overview';
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        <Head />
        <TabNav label="Mục hồ sơ">
          <TabNavLink href={pathname} active={cur === 'overview'}>Tổng quan</TabNavLink>
          <TabNavLink href={`${pathname}?tab=skills`} active={cur === 'skills'}>Kỹ năng</TabNavLink>
          <TabNavLink href={`${pathname}?tab=achievements`} active={cur === 'achievements'}>Thành tích</TabNavLink>
        </TabNav>
        {cur === 'overview' ? <Overview /> : cur === 'skills' ? <Skills /> : <Achievements />}
      </div>
    </div>
  );
}

export default function ProfileView() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
