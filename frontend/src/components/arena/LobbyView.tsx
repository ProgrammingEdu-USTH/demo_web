'use client';

import { Copy, Play } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  Badge, Button, Card, CardDescription, CardTitle, ErrorState, Field, Input, PromptMark, Select, Skeleton, buttonVariants, useToast,
} from '@/components/ui';
import { ArenaApiError, arenaApi, describeArenaError } from '@/lib/arena-api';
import type { HistoryItem, Match } from '@/lib/arena-api';
import { DIFFICULTY_LABEL, formatDelta, formatDuration, formatElapsed, formatRelative } from '@/lib/arena-utils';
import ArenaShell, { useArenaCurrent } from './ArenaShell';
import { messageOf, useLoad } from './useLoad';
import { useMatchPoll } from './useMatchPoll';

type Busy = 'queue' | 'create' | 'join' | null;

export const OUTCOME: Record<HistoryItem['outcome'], { label: string; variant: 'success' | 'danger' | 'neutral' }> = {
  win: { label: 'Thắng', variant: 'success' },
  loss: { label: 'Thua', variant: 'danger' },
  draw: { label: 'Hoà', variant: 'neutral' },
};

export default function LobbyView() {
  return (
    <ArenaShell pageTitle="Sảnh" current="/arena">
      <Lobby />
    </ArenaShell>
  );
}

function Lobby() {
  const router = useRouter();
  const { reloadCurrent } = useArenaCurrent();
  const profile = useLoad(() => arenaApi.me());
  const problems = useLoad(() => arenaApi.problems());
  const recent = useLoad(() => arenaApi.history(3));
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [problemId, setProblemId] = useState('');
  const [code, setCode] = useState('');
  // Trận đang chờ đối thủ do chính sảnh này vừa tạo (ghép ngẫu nhiên hoặc phòng riêng).
  const [waiting, setWaiting] = useState<Match | null>(null);

  async function act(kind: Exclude<Busy, null>, fn: () => Promise<Match>) {
    if (busy) return; // chặn bấm đúp
    setBusy(kind);
    setError(null);
    setJoinError(null);
    try {
      const m = await fn();
      if (m.status === 'waiting') setWaiting(m);
      else router.push(`/arena/match/${m.id}`);
    } catch (e) {
      const conflict = e instanceof ArenaApiError && (e.status === 409 || e.code === 'ALREADY_IN_MATCH');
      const text = conflict ? describeArenaError(e) : messageOf(e);
      if (kind === 'join') setJoinError(text);
      else setError(text);
      // 409: đã có trận khác → làm mới banner "Vào trận" ở đầu trang.
      if (conflict) reloadCurrent();
    } finally {
      setBusy(null);
    }
  }

  const p = profile.data;
  const played = p ? p.wins + p.losses + p.draws : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-6">
        {error ? (
          <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-soft-fg">{error}</p>
        ) : null}

        {waiting ? (
          <WaitingCard
            initial={waiting}
            onDone={() => {
              setWaiting(null);
              reloadCurrent();
            }}
          />
        ) : (
          <>
            <Card elevated>
              <CardTitle as="h2">Tìm trận</CardTitle>
              <CardDescription className="mt-1">Ghép với một người đang chờ; đề được chọn ngẫu nhiên.</CardDescription>
              <Button
                variant="primary"
                size="lg"
                className="mt-4 w-full sm:w-auto"
                loading={busy === 'queue'}
                disabled={busy !== null}
                onClick={() => act('queue', async () => (await arenaApi.queue()).match)}
              >
                <Play aria-hidden="true" className="size-4" />
                Tìm trận
              </Button>
            </Card>

            <Card>
              <CardTitle as="h2">Phòng riêng</CardTitle>
              <CardDescription className="mt-1">Tạo phòng rồi gửi mã cho bạn bè, hoặc nhập mã để vào phòng của họ.</CardDescription>
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <Field label="Đề bài">
                    <Select value={problemId} onChange={(e) => setProblemId(e.target.value)}>
                      <option value="">Ngẫu nhiên</option>
                      {(problems.data ?? []).map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          {pr.title} · {DIFFICULTY_LABEL[pr.difficulty] ?? pr.difficulty} · {formatDuration(pr.durationSec)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button
                    variant="secondary"
                    loading={busy === 'create'}
                    disabled={busy !== null}
                    onClick={() => act('create', async () => (await arenaApi.createRoom(problemId || undefined)).match)}
                  >
                    Tạo phòng
                  </Button>
                </div>
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const c = code.trim();
                    if (c) void act('join', async () => (await arenaApi.joinRoom(c)).match);
                  }}
                >
                  <Field label="Mã phòng" hint="4–8 ký tự chữ và số" error={joinError}>
                    <Input
                      value={code}
                      maxLength={8}
                      autoComplete="off"
                      spellCheck={false}
                      className="font-mono uppercase tracking-widest"
                      onChange={(e) => {
                        setCode(e.target.value.replace(/[^A-Za-z0-9]/g, ''));
                        setJoinError(null);
                      }}
                    />
                  </Field>
                  <Button type="submit" variant="secondary" loading={busy === 'join'} disabled={busy !== null || code.trim().length < 4}>
                    Vào phòng
                  </Button>
                </form>
              </div>
            </Card>
          </>
        )}
      </div>

      <aside className="flex min-w-0 flex-col gap-4" aria-label="Hồ sơ Đấu trường">
        <Card padding="sm">
          <h2 className="text-sm font-semibold text-fg-muted">Hồ sơ của bạn</h2>
          {profile.error ? (
            <ErrorState compact title="Không tải được hồ sơ" description={profile.error} action={<Button size="sm" onClick={() => void profile.reload()}>Thử lại</Button>} />
          ) : !p ? (
            <div className="mt-2 flex flex-col gap-2" role="status" aria-label="Đang tải hồ sơ">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : played === 0 ? (
            <div className="mt-2 flex flex-col gap-1">
              <p className="text-base font-semibold text-fg">Chưa có trận nào — ELO khởi điểm {p.rating}</p>
              <p className="text-sm text-fg-muted">
                Muốn làm quen trước? <Link href="/arena/problems" className="font-semibold text-primary underline-offset-4 hover:underline">Luyện thử trong Kho đề</Link>.
              </p>
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-3xl font-bold tabular-nums text-fg">{p.rating}</span>
                <span className="text-sm text-fg-muted">ELO{p.rank ? ` · hạng #${p.rank}` : ''}</span>
              </div>
              <p className="text-sm tabular-nums text-fg-muted">
                {p.wins} thắng · {p.losses} thua · {p.draws} hoà
              </p>
            </div>
          )}
        </Card>

        <Card padding="sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-fg-muted">Trận gần đây</h2>
            <Link href="/arena/history" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">Lịch sử</Link>
          </div>
          {recent.loading ? (
            <Skeleton className="mt-3 h-12 w-full" />
          ) : recent.error || !recent.data || recent.data.items.length === 0 ? (
            <p className="mt-2 text-sm text-fg-muted">{recent.error ? 'Không tải được lịch sử.' : 'Chưa có trận nào.'}</p>
          ) : (
            <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
              {recent.data.items.map((h) => (
                <li key={h.id}>
                  <Link href={`/arena/match/${h.id}`} className="ui-focus-ring flex min-h-11 items-center gap-2 rounded-md px-1 text-sm text-fg no-underline hover:bg-surface-2">
                    <Badge variant={OUTCOME[h.outcome].variant}>{OUTCOME[h.outcome].label}</Badge>
                    <span className="min-w-0 flex-1 truncate">{h.problemTitle}</span>
                    <span className="font-mono tabular-nums text-fg-muted" title={formatRelative(h.finishedAt)}>{formatDelta(h.ratingDelta)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Link href="/arena/problems" className={buttonVariants({ variant: 'soft' })}>Luyện trước trong Kho đề</Link>
      </aside>
    </div>
  );
}

/** Đang chờ đối thủ ngay trong sảnh: ghép ngẫu nhiên (đếm giờ) hoặc phòng riêng (hiện mã). Có đối thủ → vào trận. */
function WaitingCard({ initial, onDone }: { initial: Match; onDone: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const { match: live, apply, error } = useMatchPoll(initial.id);
  const match = live ?? initial;
  const [sec, setSec] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (match.status === 'active' || match.status === 'finished') router.push(`/arena/match/${match.id}`);
    else if (match.status === 'cancelled') onDone();
  }, [match.status, match.id, router, onDone]);

  async function cancel() {
    if (cancelling) return;
    setCancelling(true);
    setMsg(null);
    try {
      const env = await arenaApi.cancel(match.id);
      apply(env.match, env.serverTime);
      onDone();
    } catch (e) {
      setMsg(messageOf(e));
      setCancelling(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(match.code);
      toast({ title: 'Đã sao chép mã phòng', variant: 'success' });
    } catch {
      toast({ title: 'Không sao chép được', description: 'Hãy chép mã bằng tay.', variant: 'danger' });
    }
  }

  return (
    <Card elevated className="flex flex-col items-center gap-4 py-8 text-center">
      {match.isPublic ? (
        <>
          <PromptMark className="text-4xl" />
          <p role="status" className="text-lg font-semibold text-fg">
            Đang tìm đối thủ… <span className="font-mono tabular-nums">{formatElapsed(sec)}</span>
          </p>
          <p className="text-sm text-fg-muted">Trang sẽ tự chuyển vào trận khi ghép được.</p>
        </>
      ) : (
        <>
          <p className="text-sm text-fg-muted">Gửi mã này cho bạn bè để vào phòng:</p>
          <div
            className="rounded-lg bg-surface-2 px-6 py-3 font-mono text-4xl font-bold tracking-[0.3em] text-fg"
            aria-label={`Mã phòng ${match.code.split('').join(' ')}`}
          >
            {match.code}
          </div>
          <Button variant="secondary" onClick={copy}>
            <Copy aria-hidden="true" className="size-4" />
            Sao chép mã
          </Button>
          <p role="status" className="text-sm text-fg-muted">Chờ bạn vào… (phòng hết hạn sau 10 phút)</p>
        </>
      )}
      {error ? <p role="alert" className="text-sm text-danger-soft-fg">{error}</p> : null}
      {msg ? <p role="alert" className="text-sm text-danger-soft-fg">{msg}</p> : null}
      <Button variant="secondary" loading={cancelling} onClick={cancel}>
        {match.isPublic ? 'Huỷ' : 'Huỷ phòng'}
      </Button>
    </Card>
  );
}
