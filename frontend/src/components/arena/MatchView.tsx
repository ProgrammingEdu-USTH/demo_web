'use client';

// Màn của một trận: chờ đối thủ → phòng thi → kết quả. Trạng thái do server quyết định (poll).
// Mã nguồn người chơi chỉ nằm trong state/localStorage (arena-draft-<id>); không log, không gửi đi đâu ngoài server chấm.
// Chế độ tập trung: AppShell không dựng sidebar cho /arena/match/*, trang tự có thanh trên gọn.
import { ArrowLeft, Check, Clock, Copy, Play, Square, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Badge, Button, Card, Dialog, ErrorState, IconButton, MAIN_CONTENT_ID, ProgressBar, SkipLink, Skeleton, Tab, TabList, Tabs, buttonVariants, cn, useToast,
} from '@/components/ui';
import { ArenaApiError, arenaApi } from '@/lib/arena-api';
import type { Match, Submission } from '@/lib/arena-api';
import {
  DIFFICULTY_LABEL,
  END_REASON_LABEL,
  clearDraft,
  formatClock,
  formatDelta,
  loadDraft,
  saveDraft,
  secondsLeft,
  showJson,
} from '@/lib/arena-utils';
import { ArenaFocusFrame } from './ArenaShell';
import { useArenaRunner } from './useArenaRunner';
import { messageOf } from './useLoad';
import { useMatchPoll } from './useMatchPoll';

// CodeMirror dùng chung với Playground; nạp muộn, chỉ ở trình duyệt.
const CodeEditor = dynamic(() => import('@/components/playground/CodeEditor'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

const SUBMIT_GAP_SEC = 10;
type Pane = 'problem' | 'code' | 'result';

export default function MatchView({ matchId }: { matchId: number }) {
  const { match, offset, error, notFound, apply, refresh } = useMatchPoll(matchId);

  if (notFound) {
    return (
      <ArenaFocusFrame pageTitle="Không tìm thấy trận">
        <ErrorState
          title="Không tìm thấy trận"
          description="Trận này không tồn tại hoặc bạn không phải người chơi."
          action={<Link href="/arena" className={buttonVariants({ variant: 'primary' })}>Về sảnh</Link>}
        />
      </ArenaFocusFrame>
    );
  }

  if (!match) {
    return (
      <ArenaFocusFrame pageTitle="Đang tải trận…">
        {error ? (
          <ErrorState title="Không tải được trận" description={error} action={<Link href="/arena" className={buttonVariants()}>Về sảnh</Link>} />
        ) : (
          <p role="status" className="text-fg-muted">Đang tải trận…</p>
        )}
      </ArenaFocusFrame>
    );
  }

  if (match.status === 'waiting') return <WaitingRoom match={match} apply={apply} error={error} />;
  if (match.status === 'cancelled') {
    return (
      <ArenaFocusFrame pageTitle="Trận đã huỷ">
        <ErrorState
          title="Trận đã huỷ"
          description="Phòng đã bị huỷ hoặc hết hạn chờ. Không có thay đổi điểm."
          action={<Link href="/arena" className={buttonVariants({ variant: 'primary' })}>Về sảnh</Link>}
        />
      </ArenaFocusFrame>
    );
  }
  if (match.status === 'finished') return <ResultScreen match={match} />;
  return <ActiveRoom match={match} offset={offset} error={error} apply={apply} refresh={refresh} />;
}

// ───────────────────────── Chờ đối thủ ─────────────────────────

function WaitingRoom({ match, apply, error }: { match: Match; apply: (m: Match, t?: string) => void; error: string | null }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function cancel() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const env = await arenaApi.cancel(match.id);
      apply(env.match, env.serverTime);
    } catch (e) {
      setMsg(messageOf(e));
      setBusy(false);
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
    <ArenaFocusFrame pageTitle="Đang chờ đối thủ">
      <Card elevated className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <h1 className="text-xl font-bold text-fg">Đang chờ đối thủ</h1>
        {match.isPublic ? (
          <p role="status" className="text-sm text-fg-muted">Đang tìm đối thủ cho bạn… Trang sẽ tự chuyển khi ghép được trận.</p>
        ) : (
          <>
            <p className="text-sm text-fg-muted">Gửi mã này cho bạn bè để vào phòng:</p>
            <div className="rounded-lg bg-surface-2 px-6 py-3 font-mono text-4xl font-bold tracking-[0.3em]" aria-label={`Mã phòng ${match.code.split('').join(' ')}`}>
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
        <div className="flex gap-2">
          <Link href="/arena" className={buttonVariants({ variant: 'ghost' })}>Về sảnh</Link>
          <Button variant="secondary" loading={busy} onClick={cancel}>{match.isPublic ? 'Huỷ' : 'Huỷ phòng'}</Button>
        </div>
      </Card>
    </ArenaFocusFrame>
  );
}

// ───────────────────────── Phòng thi ─────────────────────────

function ActiveRoom({
  match,
  offset,
  error,
  apply,
  refresh,
}: {
  match: Match;
  offset: number;
  error: string | null;
  apply: (m: Match, t?: string) => void;
  refresh: () => Promise<void>;
}) {
  const router = useRouter();
  const problem = match.problem;
  const [code, setCode] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [subs, setSubs] = useState<Submission[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [forfeiting, setForfeiting] = useState(false);
  const [pane, setPane] = useState<Pane>('problem');
  const submitLock = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const runner = useArenaRunner();

  // Nháp: lấy từ localStorage, không có thì mã khởi đầu của đề.
  const starter = problem?.starterCode;
  useEffect(() => {
    if (code !== null || starter === undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCode(loadDraft(match.id) ?? starter);
  }, [code, starter, match.id]);
  useEffect(() => {
    if (code !== null) saveDraft(match.id, code);
  }, [code, match.id]);

  // Danh sách lần nộp của tôi (sau khi tải lại trang).
  useEffect(() => {
    let alive = true;
    arenaApi.submissions(match.id).then((s) => { if (alive) setSubs((prev) => (prev.length ? prev : s)); }).catch(() => {});
    return () => { alive = false; };
  }, [match.id]);

  // Đồng hồ: tick 500 ms theo giờ máy + offset server.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const left = secondsLeft(match.deadlineAt, offset, now);

  // Về 0 mà trận còn active → hỏi server ngay để chốt (poll sẽ tiếp tục sau đó).
  const expiredRef = useRef(false);
  useEffect(() => {
    if (left === 0 && !expiredRef.current) {
      expiredRef.current = true;
      void refresh();
    }
    if (left > 0) expiredRef.current = false;
  }, [left, refresh]);

  // Huỷ yêu cầu nộp đang bay khi rời trang.
  useEffect(() => () => abortRef.current?.abort(), []);

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const submit = useCallback(async () => {
    if (submitLock.current || code === null) return; // chặn double-submit
    submitLock.current = true;
    setSubmitting(true);
    setSubmitMsg(null);
    setPane((p) => (p === 'problem' ? p : 'result')); // xem kết quả ngay trên mobile
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const r = await arenaApi.submit(match.id, code, ctrl.signal);
      apply(r.match, r.serverTime);
      setSubs((prev) => [r.submission, ...prev.filter((s) => s.id !== r.submission.id)]);
      setCooldownUntil(Date.now() + SUBMIT_GAP_SEC * 1000);
    } catch (e) {
      setSubmitMsg(messageOf(e));
      if (e instanceof ArenaApiError) {
        if (e.status === 409 || e.code === 'MATCH_NOT_ACTIVE') void refresh();
        if (e.status === 0) {
          // Timeout phía client: server có thể vẫn đã chấm → tải lại danh sách + trạng thái trận.
          arenaApi.submissions(match.id).then((l) => setSubs(l)).catch(() => {});
          void refresh();
          setCooldownUntil(Date.now() + 10_000);
        } else if (e.retryAfter) setCooldownUntil(Date.now() + e.retryAfter * 1000);
        else if (e.code === 'SUBMIT_TOO_FAST') setCooldownUntil(Date.now() + SUBMIT_GAP_SEC * 1000);
      }
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }, [code, match.id, apply, refresh]);

  async function forfeit() {
    if (forfeiting) return;
    setForfeiting(true);
    try {
      const env = await arenaApi.forfeit(match.id);
      apply(env.match, env.serverTime);
    } catch (e) {
      setSubmitMsg(messageOf(e));
      if (e instanceof ArenaApiError && (e.status === 409 || e.code === 'MATCH_NOT_ACTIVE')) void refresh();
      setLeaveOpen(false);
      setForfeiting(false);
    }
  }

  if (!problem) {
    return (
      <ArenaFocusFrame pageTitle="Phòng thi">
        <p role="status" className="text-fg-muted">Đang tải đề…</p>
      </ArenaFocusFrame>
    );
  }

  const total = problem.testCount;
  const opp = match.opponent;
  // Báo cho trình đọc màn hình chỉ ở mốc 1 phút / 10 giây, không đọc lại mỗi giây.
  const liveMsg = left === 0 ? 'Hết giờ, đang chốt kết quả' : left <= 10 ? 'Còn dưới 10 giây' : left <= 60 ? 'Còn dưới 1 phút' : '';
  const canSubmit = !submitting && code !== null && cooldownLeft === 0 && left > 0;

  const panel = (p: Pane) => cn('min-h-0 min-w-0 flex-col', pane === p ? 'flex' : 'max-lg:hidden lg:flex');

  return (
    <div className="ui-scope flex h-dvh flex-col bg-bg text-fg">
      <SkipLink />
      <title>{`${problem.title} · Đấu trường · Programming EDU`}</title>
      {/* Thanh trên */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-0 border-b border-solid border-border bg-surface px-3 py-2 sm:px-4">
        <IconButton label="Rời trận" icon={<ArrowLeft />} size="sm" onClick={() => setLeaveOpen(true)} />
        <div className="min-w-0 max-lg:hidden">
          <h1 className="m-0 truncate text-base font-semibold leading-tight">{problem.title}</h1>
          <p className="m-0 text-xs text-fg-muted">{DIFFICULTY_LABEL[problem.difficulty] ?? problem.difficulty} · {total} test</p>
        </div>
        <div
          className={cn('flex items-center gap-1.5 font-mono text-lg font-bold tabular-nums', left <= 60 ? 'text-danger' : 'text-fg')}
          role="timer"
          aria-label="Thời gian còn lại"
        >
          <Clock aria-hidden="true" className="size-4" />
          {formatClock(left)}
        </div>
        <span className="sr-only" role="status" aria-live="polite">{liveMsg}</span>

        {/* Tiến độ: desktop có thanh, mobile gọn "3/5 vs 2/5" */}
        <div className="flex items-center gap-4 text-xs text-fg-muted lg:ml-2">
          <span className="tabular-nums lg:hidden" aria-label={`Bạn ${match.myBestPassed} trên ${total}, đối thủ ${opp?.bestPassed ?? 0} trên ${total}`}>
            {match.myBestPassed}/{total} vs {opp?.bestPassed ?? 0}/{total}
          </span>
          <div className="flex items-center gap-2 max-lg:hidden">
            <span className="shrink-0">Bạn {match.myBestPassed}/{total}</span>
            <ProgressBar label="Test bạn đã đạt" value={match.myBestPassed} max={total} size="sm" className="w-24" />
          </div>
          {opp ? (
            <div className="flex items-center gap-2 max-lg:hidden">
              <span className="max-w-32 shrink-0 truncate">{opp.name} {opp.bestPassed}/{total}</span>
              <ProgressBar label={`Test ${opp.name} đã đạt`} value={opp.bestPassed} max={total} size="sm" tone="accent" className="w-24" />
            </div>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="primary" size="sm" loading={submitting} disabled={!canSubmit} onClick={submit}>
            {cooldownLeft > 0 ? `Nộp lại sau ${cooldownLeft}s` : 'Nộp bài'}
          </Button>
        </div>
      </header>

      {error ? (
        <p role="alert" className="m-0 shrink-0 bg-warning-soft px-4 py-1.5 text-sm text-warning-soft-fg">{error} (đang thử kết nối lại)</p>
      ) : null}

      {/* Mobile: Đề · Code · Kết quả */}
      <Tabs value={pane} onValueChange={(v) => setPane(v as Pane)} className="shrink-0 px-4 lg:hidden">
        <TabList label="Các phần của trận" className="mx-0 px-0">
          <Tab value="problem">Đề</Tab>
          <Tab value="code">Code</Tab>
          <Tab value="result">Kết quả</Tab>
        </TabList>
      </Tabs>

      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="grid min-h-0 flex-1 outline-none lg:grid-cols-[380px_minmax(0,1fr)_320px]">
        {/* Đề */}
        <section aria-label="Đề bài" className={cn(panel('problem'), 'overflow-y-auto border-0 border-solid border-border p-4 lg:border-r')}>
          <h2 className="m-0 text-lg font-semibold lg:hidden">{problem.title}</h2>
          <p className="mb-2 mt-1 text-xs text-fg-muted lg:hidden">{DIFFICULTY_LABEL[problem.difficulty] ?? problem.difficulty} · {total} test</p>
          <pre className="m-0 overflow-x-auto rounded-md bg-surface-2 p-3 font-mono text-sm">{problem.signature}</pre>
          <pre className="my-4 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{problem.statement}</pre>
          <h3 className="m-0 mb-2 text-sm font-semibold">Ví dụ</h3>
          <div className="flex flex-col gap-2">
            {problem.examples.map((ex, i) => (
              <div key={i} className="overflow-x-auto rounded-md bg-surface-2 px-3 py-2 font-mono text-xs">
                solve({ex.args.map(showJson).join(', ')}) → {showJson(ex.expected)}
              </div>
            ))}
          </div>
        </section>

        {/* Editor */}
        <section aria-label="Soạn code" className={cn(panel('code'), 'border-0 border-solid border-border lg:border-r')}>
          <div className="flex shrink-0 items-center gap-2 border-0 border-b border-solid border-border px-3 py-2">
            <span className="text-sm font-semibold text-fg-muted">Python</span>
            <div className="ml-auto flex items-center gap-2">
              {runner.running ? (
                <Button size="sm" variant="danger" onClick={runner.stop}>
                  <Square aria-hidden="true" className="size-4" />
                  Dừng
                </Button>
              ) : (
                <Button size="sm" variant="secondary" disabled={code === null || submitting} onClick={() => code !== null && runner.run(code, problem.examples)}>
                  <Play aria-hidden="true" className="size-4" />
                  Chạy thử
                </Button>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <CodeEditor
              value={code ?? ''}
              language="python"
              docKey={`arena-${match.id}`}
              label="Mã Python của bạn"
              onChange={setCode}
              onRun={() => code !== null && !runner.running && runner.run(code, problem.examples)}
            />
          </div>
          <p className="m-0 shrink-0 px-3 py-1.5 text-xs text-fg-muted">Chạy thử chỉ kiểm tra ví dụ công khai; điểm chính thức do máy chủ chấm cả test ẩn.</p>
        </section>

        {/* Kết quả */}
        <section aria-label="Kết quả test" className={cn(panel('result'), 'gap-4 overflow-y-auto p-4')}>
          <div>
            <h2 className="m-0 mb-2 text-sm font-semibold">Chạy thử</h2>
            {runner.running ? (
              <p role="status" className="text-sm text-fg-muted">Đang chạy…</p>
            ) : runner.output ? (
              <div className="flex flex-col gap-2">
                {runner.output.lines.length > 0 ? (
                  <pre className="m-0 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-surface-2 p-2 font-mono text-xs">
                    {runner.output.lines.map((l, i) => (
                      <span key={i} className={cn('block', l.tone === 'err' && 'text-danger-soft-fg', l.tone === 'ok' && 'text-success-soft-fg', l.tone === 'muted' && 'text-fg-muted')}>
                        {l.text}
                      </span>
                    ))}
                  </pre>
                ) : null}
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {problem.examples.map((ex, i) => {
                    const r = runner.output?.results[i];
                    if (!r) return null;
                    return (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        {r.passed ? <Check aria-label="Đạt" className="mt-0.5 size-4 shrink-0 text-success" /> : <X aria-label="Chưa đạt" className="mt-0.5 size-4 shrink-0 text-danger" />}
                        <span className="min-w-0 break-words font-mono">
                          solve({ex.args.map(showJson).join(', ')})
                          {!r.passed ? <span className="block text-fg-muted">{r.error ? r.error : `nhận ${r.got ?? '?'} · cần ${showJson(ex.expected)}`}</span> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-fg-muted">Bấm “Chạy thử” để kiểm tra các ví dụ công khai.</p>
            )}
          </div>

          <div>
            <h2 className="m-0 mb-1 text-sm font-semibold">Các lần nộp của tôi</h2>
            <p role="status" aria-live="polite" className="m-0 mb-2 text-xs text-fg-muted">
              Đã nộp {match.mySubmissionCount}/10 · tốt nhất {match.myBestPassed}/{total} test
            </p>
            {submitMsg ? <p role="alert" className="mb-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-fg">{submitMsg}</p> : null}
            {submitting ? <p role="status" className="mb-2 text-sm text-fg-muted">Đang chấm… (tối đa 35 giây)</p> : null}
            {subs.length === 0 ? <p className="text-sm text-fg-muted">Chưa có lần nộp nào.</p> : (
              <div className="flex flex-col gap-2">{subs.map((s) => <SubmissionCard key={s.id} s={s} />)}</div>
            )}
          </div>
        </section>
      </main>

      <Dialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Rời phòng thi?"
        description="Nếu chỉ rời trang, trận vẫn tiếp tục và đồng hồ vẫn chạy — bạn có thể vào lại từ banner ở Đấu trường. Đầu hàng sẽ tính là thua."
        footer={
          <>
            <Button variant="danger" loading={forfeiting} onClick={forfeit}>Đầu hàng</Button>
            <Button variant="secondary" onClick={() => router.push('/arena')}>Về sảnh</Button>
            <Button variant="primary" onClick={() => setLeaveOpen(false)}>Tiếp tục thi</Button>
          </>
        }
      />
    </div>
  );
}

function SubmissionCard({ s }: { s: Submission }) {
  const label = s.status === 'graded' ? `${s.passed}/${s.total} test đạt` : s.status === 'rejected' ? 'Bị từ chối' : 'Lỗi khi chạy';
  const variant = s.status === 'graded' && s.passed === s.total ? 'success' : s.status === 'graded' ? 'warning' : 'danger';
  return (
    <div className="rounded-md border border-solid border-border p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={variant}>{label}</Badge>
        <span className="text-fg-muted tabular-nums">{new Date(s.createdAt).toLocaleTimeString('vi-VN', { hour12: false })}</span>
      </div>
      {s.message ? <p className="m-0 mt-1.5 break-words font-mono">{s.message}</p> : null}
      {s.status === 'graded' ? (
        <>
          <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
            {s.publicResults.map((r) => (
              <li key={r.index} className="flex items-start gap-1.5">
                {r.passed ? <Check aria-label="Đạt" className="size-3.5 shrink-0 text-success" /> : <X aria-label="Chưa đạt" className="size-3.5 shrink-0 text-danger" />}
                <span className="min-w-0 break-words font-mono">Ví dụ {r.index + 1}{!r.passed ? `: ${r.error ? r.error : `nhận ${r.got ?? '?'}`}` : ''}</span>
              </li>
            ))}
          </ul>
          <p className="m-0 mt-1.5 text-fg-muted">Test ẩn: {s.hiddenPassed}/{s.hiddenTotal}</p>
        </>
      ) : null}
    </div>
  );
}

// ───────────────────────── Kết quả ─────────────────────────

function ResultScreen({ match }: { match: Match }) {
  const router = useRouter();
  const r = match.result;
  const [open, setOpen] = useState(true);
  const [rematching, setRematching] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    clearDraft(match.id); // trận xong: xoá bản nháp mã
  }, [match.id]);

  const outcome = !r ? 'draw' : r.isDraw ? 'draw' : r.winnerId === match.me.id ? 'win' : 'loss';
  const text = { win: 'Thắng!', loss: 'Thua', draw: 'Hoà' }[outcome];
  const total = match.problem?.testCount;

  async function rematch() {
    if (rematching) return;
    setRematching(true);
    setMsg(null);
    try {
      const q = await arenaApi.queue();
      router.push(`/arena/match/${q.match.id}`);
    } catch (e) {
      setMsg(messageOf(e));
      setRematching(false);
    }
  }

  const stat = (label: string, value: string) => (
    <div className="rounded-md bg-surface-2 px-3 py-2">
      <div className="font-mono text-xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-fg-muted">{label}</div>
    </div>
  );

  return (
    <ArenaFocusFrame pageTitle="Kết quả trận">
      <Card elevated className="flex w-full max-w-md flex-col items-center gap-3 text-center">
        <h1 className="text-xl font-bold">Trận đã kết thúc</h1>
        <p className="text-sm text-fg-muted">{match.problem?.title ?? ''}</p>
        <Button variant="primary" onClick={() => setOpen(true)}>Xem kết quả</Button>
        <Link href="/arena" className={buttonVariants({ variant: 'ghost' })}>Về sảnh</Link>
      </Card>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        dismissible={false}
        size="sm"
        title={text}
        description={`${r?.endReason ? END_REASON_LABEL[r.endReason] : ''}${match.problem ? ` · ${match.problem.title}` : ''}`}
        footer={
          <>
            <Link href="/arena" className={buttonVariants({ variant: 'secondary' })}>Về sảnh</Link>
            <Button variant="primary" loading={rematching} onClick={rematch}>Đấu lại</Button>
          </>
        }
      >
        {r ? (
          <div className="grid grid-cols-2 gap-2 pb-2">
            {stat(`ELO của bạn (hiện ${match.me.rating})`, formatDelta(r.myRatingDelta))}
            {stat('XP', `+${r.myXp}`)}
            {stat('Test đạt của bạn', `${r.myBestPassed}${total ? `/${total}` : ''}`)}
            {stat(`Test đạt của ${match.opponent?.name ?? 'đối thủ'}`, `${r.opponentBestPassed}${total ? `/${total}` : ''}`)}
          </div>
        ) : null}
        {/* Backend cố ý không tính điểm khi đầu hàng (arena-scoring.ts) — giải thích để người học không tưởng lỗi. */}
        {r && r.endReason === 'forfeit' && r.myRatingDelta === 0 && r.opponentRatingDelta === 0 ? (
          <p className="pb-2 text-sm text-fg-muted">Trận không tính điểm: đầu hàng thì cả hai bên giữ nguyên ELO.</p>
        ) : null}
        {msg ? <p role="alert" className="pb-2 text-sm text-danger-soft-fg">{msg}</p> : null}
      </Dialog>
    </ArenaFocusFrame>
  );
}
