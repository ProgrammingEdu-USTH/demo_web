'use client';

// Các khối còn lại của /dashboard viết bằng React + token: Ôn tập hôm nay · Hôm nay bạn đã học ·
// Bảng xếp hạng (top 3) · số liệu nhanh. Thay cho edu-dashboard.js (cùng API, cùng luật hiển thị).
// Đề ôn mở bằng ReviewQuizDialog (ui/Dialog) — không còn phụ thuộc JS legacy.
import { Award, BookOpen, Brain, CalendarCheck, Medal, Trophy, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import ReviewQuizDialog, { type QuizMode } from '@/components/ReviewQuizDialog';
import { Badge, Button, Card, CardTitle, Dialog, EmptyState, ErrorState, Skeleton, buttonVariants, cn } from '@/components/ui';
import { fetchJson, useRemote } from '@/lib/fetch-json';

/* eslint-disable @typescript-eslint/no-explicit-any */
type ReviewStatus = {
  is_unlocked: boolean;
  done_today: boolean;
  lessons_completed?: number;
  lessons_required?: number;
  lessons_remaining?: number;
};
type TodayData = {
  count: number;
  questions_available?: number;
  min_questions?: number;
  can_quiz?: boolean;
  lessons?: { id: string | number; title: string; course_title: string }[];
};
type LbEntry = { rank?: number; name: string; value?: number; isMe?: boolean; is_me?: boolean };
type Lb = { entries?: LbEntry[]; me?: LbEntry | null; unit?: string };

const fmt = (n: number) => n.toLocaleString('vi-VN');

function SectionTitle({ icon, children, id }: { icon: ReactNode; children: ReactNode; id: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg [&_svg]:size-5" aria-hidden="true">{icon}</span>
      <CardTitle as="h2" id={id}>{children}</CardTitle>
    </div>
  );
}

function CardSkeleton({ label }: { label: string }) {
  return (
    <Card role="status" aria-label={label} className="flex flex-col gap-3">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-11 w-40" />
    </Card>
  );
}

function CardError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <Card>
      <ErrorState compact title={title} description="Kiểm tra kết nối rồi thử lại." action={<Button variant="secondary" onClick={onRetry}>Thử lại</Button>} />
    </Card>
  );
}

/* ── Ôn tập hôm nay ───────────────────────────────────────── */
function ReviewCard({ version, onOpen }: { version: number; onOpen: () => void }) {
  const [res, reload] = useRemote(async () => {
    const [status, skills] = await Promise.all([
      fetchJson<ReviewStatus>('/api/streak/review-quiz-status'),
      // /skills lỗi thì chỉ mất con số "cần ôn", vẫn cho ôn → nuốt lỗi riêng.
      fetchJson<{ skills?: { progress?: number }[] }>('/api/skills').catch(() => null),
    ]);
    // Luật cũ của dashboard.js: progress 0 = chưa học, >= 70 = đạt, còn lại = cần ôn.
    const need = (skills?.skills ?? []).filter((s) => (s.progress ?? 0) > 0 && (s.progress ?? 0) < 70).length;
    return { status, need };
  }, version);

  if (res.state === 'loading') return <CardSkeleton label="Đang tải bài ôn tập" />;
  if (res.state === 'error') return <CardError title="Không tải được bài ôn tập" onRetry={reload} />;
  const { status, need } = res.data;

  let title = 'Ôn tập hôm nay';
  let sub: string;
  let badge: ReactNode;
  let cta: ReactNode;
  if (!status.is_unlocked) {
    const required = status.lessons_required ?? 5;
    const done = status.lessons_completed ?? 0;
    const left = status.lessons_remaining ?? Math.max(0, required - done);
    title = 'Mở khoá bài ôn tập';
    sub = `Học ${required} bài trong ngày để mở khoá · đang ${done}/${required}`;
    badge = <Badge variant="neutral">Còn {left} bài</Badge>;
    cta = <Link href="/courses" className={buttonVariants({ variant: 'primary' })}>Học một bài</Link>;
  } else if (status.done_today) {
    title = 'Đã ôn hôm nay';
    sub = 'Hẹn gặp lại vào ngày mai nhé.';
    badge = <Badge variant="success">Hoàn thành</Badge>;
    cta = <Link href="/profile?tab=skills" className={buttonVariants({ variant: 'secondary' })}>Xem kỹ năng</Link>;
  } else {
    sub = need ? `${need} kỹ năng cần ôn lại` : 'Đề hôm nay trộn câu từ các bài bạn đã học.';
    badge = need ? <Badge variant="warning">{need} kỹ năng</Badge> : <Badge variant="primary">Sẵn sàng</Badge>;
    cta = <Button variant="primary" onClick={onOpen}>Ôn ngay</Button>;
  }
  return (
    <Card aria-labelledby="dp-review">
      <SectionTitle icon={<Brain />} id="dp-review">{title}</SectionTitle>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">{badge}</div>
        <p className="text-sm text-fg-muted">{sub}</p>
        <div>{cta}</div>
      </div>
    </Card>
  );
}

/* ── Hôm nay bạn đã học ───────────────────────────────────── */
function TodayCard({ version, onOpen }: { version: number; onOpen: () => void }) {
  const [res, reload] = useRemote(() => fetchJson<TodayData>('/api/quiz/today'), version);

  if (res.state === 'loading') return <CardSkeleton label="Đang tải bài học hôm nay" />;
  if (res.state === 'error') return <CardError title="Không tải được bài đã học hôm nay" onRetry={reload} />;
  const d = res.data;
  if (!d.count) {
    return (
      <Card aria-labelledby="dp-today">
        <SectionTitle icon={<CalendarCheck />} id="dp-today">Hôm nay bạn đã học</SectionTitle>
        <EmptyState compact icon={<BookOpen aria-hidden="true" />} title="Hôm nay chưa có bài nào" description="Hoàn thành một bài để nó hiện ở đây." action={<Link href="/courses" className={buttonVariants({ variant: 'secondary' })}>Chọn bài học</Link>} />
      </Card>
    );
  }
  const MAX = 4;
  const lessons = d.lessons ?? [];
  const shown = lessons.slice(0, MAX);
  const rest = lessons.length - shown.length;
  const min = d.min_questions ?? 5;
  return (
    <Card aria-labelledby="dp-today">
      <SectionTitle icon={<CalendarCheck />} id="dp-today">Hôm nay bạn đã học</SectionTitle>
      <div className="flex flex-col gap-3">
        <p><Badge variant="success">{d.count} bài</Badge></p>
        <ul className="flex flex-col gap-1">
          {shown.map((l) => (
            <li key={l.id} className="flex flex-col py-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
              <span className="min-w-0 truncate text-sm font-semibold">{l.title}</span>
              <span className="min-w-0 truncate text-xs text-fg-muted">{l.course_title}</span>
            </li>
          ))}
          {rest > 0 && <li className="text-xs text-fg-muted">+{rest} bài nữa</li>}
        </ul>
        <p className="text-sm text-fg-muted">
          {d.can_quiz
            ? `Gộp ${d.questions_available} câu hỏi từ những bài này thành một đề.`
            : `Cần ít nhất ${min} câu hỏi mới tạo được đề · những bài này mới có ${d.questions_available ?? 0}.`}
        </p>
        <div>
          <Button variant="secondary" disabled={!d.can_quiz} onClick={onOpen}>
            {d.can_quiz ? 'Ôn lại bài hôm nay' : 'Chưa đủ câu hỏi'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ── Bảng xếp hạng (top 3) ────────────────────────────────── */
function LeaderboardCard() {
  const [res, reload] = useRemote(() => fetchJson<Lb>('/api/leaderboard?type=weekly'));
  if (res.state === 'loading') return <CardSkeleton label="Đang tải bảng xếp hạng" />;
  if (res.state === 'error') return <CardError title="Không tải được bảng xếp hạng" onRetry={reload} />;
  const entries = res.data.entries ?? [];
  const unit = res.data.unit ?? 'XP';
  // Hạng 1-3 luôn kèm con số nên không truyền nghĩa chỉ bằng màu.
  const medal = ['text-accent-soft-fg', 'text-fg-muted', 'text-warning-soft-fg'];
  return (
    <Card aria-labelledby="dp-lb">
      <SectionTitle icon={<Trophy />} id="dp-lb">Bảng xếp hạng tuần</SectionTitle>
      {entries.length === 0 ? (
        <EmptyState compact icon={<Medal aria-hidden="true" />} title="Chưa có dữ liệu xếp hạng" description="Hoàn thành bài học để lên bảng." />
      ) : (
        <ol className="flex flex-col">
          {entries.slice(0, 3).map((e, i) => {
            const mine = e.isMe || e.is_me;
            return (
              <li key={`${e.rank ?? i}-${e.name}`} className={cn('flex min-h-12 items-center gap-3 rounded-md px-2 py-2', mine && 'bg-primary-soft')}>
                <span className={cn('w-6 shrink-0 text-center text-lg font-bold', medal[i])}>{e.rank ?? i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.name}{mine ? ' (bạn)' : ''}</span>
                {e.value != null && <span className="shrink-0 text-sm text-fg-muted">{fmt(e.value)} {unit}</span>}
              </li>
            );
          })}
        </ol>
      )}
      <div className="mt-3">
        <Link href="/community?tab=rank" className={buttonVariants({ variant: 'ghost' })}>Xem bảng đầy đủ</Link>
      </div>
    </Card>
  );
}

/* ── Số liệu nhanh ────────────────────────────────────────── */
function MiniStats() {
  const [res, reload] = useRemote(async () => {
    // Chỉ /stats là bắt buộc; thành tích / kỹ năng lỗi thì hiện 0 như bản cũ.
    const [s, ach, sk] = await Promise.all([
      fetchJson<Record<string, number | undefined>>('/api/stats'),
      fetchJson<any>('/api/achievements').catch(() => null),
      fetchJson<any>('/api/skills').catch(() => null),
    ]);
    const achList = ach?.achievements ?? ach;
    const skList = sk?.skills ?? sk;
    return {
      enrolled: s.coursesEnrolled ?? s.enrolledCount ?? 0,
      achievements: Array.isArray(achList) ? achList.filter((a: any) => a.earned || a.unlocked || a.achieved).length : 0,
      skills: Array.isArray(skList) ? skList.length : 0,
      xp: s.xp ?? 0,
    };
  });
  if (res.state === 'error') return <CardError title="Không tải được số liệu" onRetry={reload} />;
  const d = res.state === 'ok' ? res.data : null;
  const items: { icon: ReactNode; label: string; value?: number }[] = [
    { icon: <BookOpen />, label: 'Khoá đang học', value: d?.enrolled },
    { icon: <Award />, label: 'Thành tích', value: d?.achievements },
    { icon: <Brain />, label: 'Kỹ năng', value: d?.skills },
    { icon: <Zap />, label: 'Điểm XP', value: d?.xp },
  ];
  return (
    <div className="grid grid-cols-2 gap-3" aria-busy={!d}>
      {items.map((it) => (
        <Card key={it.label} padding="sm" className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-muted [&_svg]:size-5" aria-hidden="true">{it.icon}</span>
          <div className="min-w-0">
            {d ? <div className="text-xl font-bold leading-none">{fmt(it.value ?? 0)}</div> : <Skeleton className="h-6 w-10" />}
            <div className="mt-1 text-xs text-fg-muted">{it.label}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ── Nhắc giữ chuỗi: mở bằng link /dashboard?streak=1 (thư nhắc học), thay popup của dashboard.js ── */
function StreakReminder() {
  const router = useRouter();
  const open = useSearchParams().get('streak') === '1';
  // Đóng = bỏ ?streak=1 khỏi URL để tải lại trang không hiện lại (hành vi cũ).
  const setOpen = (v: boolean) => { if (!v) router.replace('/dashboard'); };
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      size="sm"
      title="Đừng quên giữ chuỗi hôm nay 🔥"
      description="Bạn đang có chuỗi học liên tiếp tuyệt vời. Học một chút hôm nay để không bị gián đoạn nhé!"
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>Để sau</Button>
          <Link href="/courses" className={buttonVariants({ variant: 'primary' })}>Đi học thôi</Link>
        </>
      }
    >
      {null}
    </Dialog>
  );
}

export default function DashboardPanels() {
  // Đề ôn vừa nộp → đổi điểm kỹ năng + cờ "đã ôn hôm nay" → tải lại 2 thẻ ôn tập.
  const [version, setVersion] = useState(0);
  const [quiz, setQuiz] = useState<{ open: boolean; mode: QuizMode }>({ open: false, mode: 'review' });
  return (
    <div className="grid gap-4 px-4 pb-8 pt-4 sm:px-6 lg:grid-cols-2 lg:px-8">
      <div className="flex flex-col gap-4">
        <ReviewCard version={version} onOpen={() => setQuiz({ open: true, mode: 'review' })} />
        <TodayCard version={version} onOpen={() => setQuiz({ open: true, mode: 'today' })} />
      </div>
      <div className="flex flex-col gap-4">
        <LeaderboardCard />
        <MiniStats />
      </div>
      <StreakReminder />
      <ReviewQuizDialog open={quiz.open} mode={quiz.mode} onOpenChange={(open) => setQuiz((q) => ({ ...q, open }))} onSubmitted={() => setVersion((v) => v + 1)} />
    </div>
  );
}
