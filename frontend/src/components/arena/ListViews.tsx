'use client';

// Kho đề, Lịch sử, Xếp hạng — ba tab danh sách của Arena.
import { Clock } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import {
  Avatar, Badge, Button, Card, CardTitle, EmptyState, ErrorState, LoadingRegion, Skeleton, Tab, TabList, Tabs, buttonVariants, cn,
} from '@/components/ui';
import { arenaApi } from '@/lib/arena-api';
import type { HistoryItem, RankEntry } from '@/lib/arena-api';
import {
  DIFFICULTY_LABEL,
  END_REASON_LABEL,
  formatDateTime,
  formatDelta,
  formatDuration,
  formatRelative,
} from '@/lib/arena-utils';
import ArenaShell from './ArenaShell';
import { OUTCOME } from './LobbyView';
import { messageOf, useLoad } from './useLoad';

const deltaClass = (n: number) => (n > 0 ? 'text-success-soft-fg' : n < 0 ? 'text-danger-soft-fg' : 'text-fg-muted');

// ───────────────────────── Kho đề ─────────────────────────

export function ProblemsView() {
  const { data, error, loading, reload } = useLoad(() => arenaApi.problems());
  const [level, setLevel] = useState('all');
  const list = (data ?? []).filter((p) => level === 'all' || p.difficulty === level);

  return (
    <ArenaShell pageTitle="Kho đề" current="/arena/problems">
      <Tabs value={level} onValueChange={setLevel}>
        <TabList label="Lọc theo độ khó">
          <Tab value="all">Tất cả</Tab>
          <Tab value="easy">Dễ</Tab>
          <Tab value="medium">Trung bình</Tab>
        </TabList>
      </Tabs>
      <div className="mt-4">
        {error ? (
          <ErrorState title="Không tải được kho đề" description={error} action={<Button onClick={() => void reload()}>Thử lại</Button>} />
        ) : loading ? (
          <LoadingRegion label="Đang tải kho đề…" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </LoadingRegion>
        ) : list.length === 0 ? (
          <EmptyState title="Kho đề đang được bổ sung" description="Chưa có đề nào ở mức độ này. Hãy quay lại sau nhé." />
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <li key={p.id}>
                <Card padding="sm" className="flex h-full flex-col gap-3">
                  <CardTitle>{p.title}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={p.difficulty === 'easy' ? 'success' : 'warning'}>{DIFFICULTY_LABEL[p.difficulty] ?? p.difficulty}</Badge>
                    <span className="inline-flex items-center gap-1 text-sm text-fg-muted">
                      <Clock aria-hidden="true" className="size-4" />
                      {formatDuration(p.durationSec)}
                    </span>
                  </div>
                  <Link
                    href={`/playground?problem=${encodeURIComponent(p.id)}`}
                    className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'mt-auto min-h-11 self-start')}
                  >
                    Luyện thử
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ArenaShell>
  );
}

// ───────────────────────── Lịch sử ─────────────────────────

export function HistoryView() {
  const first = useLoad(() => arenaApi.history(20));
  const [more, setMore] = useState<HistoryItem[]>([]);
  const [next, setNext] = useState<number | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const items = [...(first.data?.items ?? []), ...more];
  const nextBefore = next === undefined ? (first.data?.nextBefore ?? null) : next;

  async function loadMore() {
    if (loadingMore || !nextBefore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const r = await arenaApi.history(20, nextBefore);
      setMore((prev) => [...prev, ...r.items]);
      setNext(r.nextBefore);
    } catch (e) {
      setMoreError(messageOf(e));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <ArenaShell pageTitle="Lịch sử" current="/arena/history">
      {first.error ? (
        <ErrorState title="Không tải được lịch sử" description={first.error} action={<Button onClick={() => void first.reload()}>Thử lại</Button>} />
      ) : first.loading ? (
        <LoadingRegion label="Đang tải lịch sử…" className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </LoadingRegion>
      ) : items.length === 0 ? (
        <EmptyState
          title="Chưa có trận nào"
          description="Các trận đã kết thúc của bạn sẽ hiện ở đây."
          action={<Link href="/arena" className={buttonVariants({ variant: 'primary' })}>Tìm trận đầu tiên</Link>}
        />
      ) : (
        <>
          {/* Mobile: thẻ dòng */}
          <ul className="m-0 flex list-none flex-col gap-2 p-0 md:hidden">
            {items.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/arena/match/${h.id}`}
                  className="ui-focus-ring flex items-center gap-3 rounded-lg border border-solid border-border bg-surface p-3 text-fg no-underline hover:bg-surface-2/40"
                >
                  <Badge variant={OUTCOME[h.outcome].variant}>{OUTCOME[h.outcome].label}</Badge>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{h.problemTitle}</span>
                    <span className="truncate text-xs text-fg-muted">vs {h.opponentName} · {formatRelative(h.finishedAt)}</span>
                  </span>
                  <span className={cn('font-mono text-sm font-semibold tabular-nums', deltaClass(h.ratingDelta))}>
                    {h.ratingDelta < 0 ? `−${Math.abs(h.ratingDelta)}` : formatDelta(h.ratingDelta)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop ≥768: bảng */}
          <div className="max-md:hidden overflow-x-auto rounded-lg border border-solid border-border bg-surface">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-surface-2 text-fg-muted">
                <tr>
                  {['Kết quả', 'Đề', 'Đối thủ', 'ELO', 'XP', 'Lý do kết thúc', 'Thời gian'].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2.5 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((h) => (
                  <tr key={h.id} className="border-0 border-t border-solid border-border hover:bg-surface-2/40">
                    <td className="px-4 py-2.5"><Badge variant={OUTCOME[h.outcome].variant}>{OUTCOME[h.outcome].label}</Badge></td>
                    <td className="px-4 py-2.5">
                      <Link href={`/arena/match/${h.id}`} className="font-semibold text-fg underline-offset-4 hover:underline">{h.problemTitle}</Link>
                    </td>
                    <td className="px-4 py-2.5">{h.opponentName}</td>
                    <td className={cn('px-4 py-2.5 font-mono tabular-nums', deltaClass(h.ratingDelta))}>
                      {h.ratingDelta < 0 ? `−${Math.abs(h.ratingDelta)}` : formatDelta(h.ratingDelta)}
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums">{h.xp > 0 ? `+${h.xp}` : h.xp}</td>
                    <td className="px-4 py-2.5">{h.endReason ? END_REASON_LABEL[h.endReason] : '—'}</td>
                    <td className="px-4 py-2.5 text-fg-muted">{formatDateTime(h.finishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {moreError ? <p role="alert" className="mt-3 text-sm text-danger-soft-fg">{moreError}</p> : null}
          {nextBefore ? (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" loading={loadingMore} onClick={loadMore}>Xem thêm</Button>
            </div>
          ) : null}
        </>
      )}
    </ArenaShell>
  );
}

// ───────────────────────── Xếp hạng ─────────────────────────

function RankRow({ e }: { e: RankEntry }) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 border-0 border-t border-solid border-border px-3 py-2.5 first:border-t-0 sm:px-4',
        e.is_me && 'bg-primary/10',
      )}
      aria-current={e.is_me ? 'true' : undefined}
    >
      <span className="w-10 shrink-0">
        {e.rank <= 3 ? <Badge variant="accent">#{e.rank}</Badge> : <span className="font-mono text-sm tabular-nums text-fg-muted">#{e.rank}</span>}
      </span>
      <Avatar name={e.name} src={e.avatar && /^(https?:)?\/\/|^\//.test(e.avatar) ? e.avatar : undefined} size="sm" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
        {e.name}
        {e.is_me ? <span className="ml-1.5 font-normal text-fg-muted">(bạn)</span> : null}
      </span>
      <span className="max-sm:hidden shrink-0 text-xs tabular-nums text-fg-muted" title="Thắng · Thua · Hoà">
        {e.wins}T · {e.losses}B · {e.draws}H
      </span>
      <span className="w-14 shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-fg">{e.value}</span>
    </li>
  );
}

export function LeaderboardView() {
  const { data, error, loading, reload } = useLoad(() => arenaApi.leaderboard());
  const entries = data?.entries ?? [];
  const me = data?.me ?? null;
  const meInList = entries.some((e) => e.is_me);

  return (
    <ArenaShell pageTitle="Xếp hạng" current="/arena/leaderboard">
      <p className="mb-3 text-sm text-fg-muted">
        ELO đấu trường — khác XP học tập.{' '}
        <Link href="/community?tab=rank" className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">Xem xếp hạng XP</Link>
      </p>
      {error ? (
        <ErrorState title="Không tải được bảng xếp hạng" description={error} action={<Button onClick={() => void reload()}>Thử lại</Button>} />
      ) : loading ? (
        <LoadingRegion label="Đang tải bảng xếp hạng…" className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-md" />
          ))}
        </LoadingRegion>
      ) : entries.length === 0 ? (
        <EmptyState
          title="Chưa có ai trên bảng xếp hạng"
          description="Bảng chỉ tính người đã đấu ít nhất một trận."
          action={<Link href="/arena" className={buttonVariants({ variant: 'primary' })}>Tìm trận</Link>}
        />
      ) : (
        <ol className="m-0 list-none overflow-hidden rounded-lg border border-solid border-border bg-surface p-0" aria-label="Bảng xếp hạng ELO">
          {entries.map((e) => (
            <RankRow key={e.id} e={e} />
          ))}
          {me && !meInList ? (
            <>
              <li aria-hidden="true" className="border-0 border-t border-solid border-border py-1 text-center text-fg-muted">⋯</li>
              <RankRow e={me} />
            </>
          ) : null}
        </ol>
      )}
    </ArenaShell>
  );
}
