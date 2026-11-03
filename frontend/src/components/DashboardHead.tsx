'use client';

// Khối đầu /dashboard viết bằng React + token mới: tiếp tục học · tiến độ · streak.
// Dữ liệu: GET /api/me/resume (bài kế tiếp mỗi khoá đã ghi danh, mới học gần nhất đứng đầu)
// và GET /api/stats (streak, số bài hoàn thành) — cùng nguồn với edu-dashboard.js trước đây.
import { BookOpen, CheckCircle2, Flame } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { Button, Card, EmptyState, ErrorState, PageHeader, ProgressBar, Skeleton, buttonVariants, cn } from '@/components/ui';

type ResumeItem = {
  courseId: string;
  courseName: string;
  lessonNo: number;
  lessonTitle: string;
  lessonUrl: string;
  percent: number;
};
type Stats = { streak: number; lessonsDone: number };

async function getJson(path: string): Promise<unknown> {
  const r = await apiFetch(path);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export default function DashboardHead() {
  const [resume, setResume] = useState<ResumeItem[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    // Số liệu phụ (streak) lỗi thì chỉ ẩn ô đó, không làm hỏng cả khối.
    getJson('/api/stats')
      .then((d) => {
        const s = (d ?? {}) as Record<string, number | undefined>;
        setStats({ streak: s.streak ?? s.streakDays ?? 0, lessonsDone: s.lessonsDone ?? s.certificates ?? 0 });
      })
      .catch(() => {});
    getJson('/api/me/resume')
      .then((d) => setResume(Array.isArray(d) ? (d as ResumeItem[]) : []))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  const main = resume?.[0];
  const others = resume?.slice(1, 4) ?? [];

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <PageHeader title="Tiếp tục học" description="Quay lại đúng bài bạn đang dở." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {failed ? (
          <Card><ErrorState compact title="Không tải được tiến độ học" description="Kiểm tra kết nối rồi thử lại." action={<Button variant="secondary" onClick={() => { setFailed(false); load(); }}>Thử lại</Button>} /></Card>
        ) : !resume ? (
          <Card role="status" aria-label="Đang tải tiến độ" className="flex flex-col gap-4">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-2" />
            <Skeleton className="h-11 w-40" />
          </Card>
        ) : !main ? (
          <Card>
            <EmptyState
              compact
              icon={<BookOpen aria-hidden="true" />}
              title="Bạn chưa có bài nào đang học"
              description="Chọn một khoá học để bắt đầu — tiến độ sẽ hiện ở đây."
              action={<Link href="/courses" className={buttonVariants({ variant: 'primary' })}>Xem khoá học</Link>}
            />
          </Card>
        ) : (
          <Card className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-fg-muted">{main.courseName}</p>
              <h2 className="text-xl font-semibold leading-snug sm:text-2xl">
                Bài {main.lessonNo}: {main.lessonTitle}
              </h2>
            </div>
            <ProgressBar value={main.percent} label={`Tiến độ khoá ${main.courseName}`} showValue />
            <div>
              <Link href={main.lessonUrl} className={cn(buttonVariants({ variant: 'primary' }), 'w-full sm:w-auto')}>
                Học tiếp
              </Link>
            </div>
            {others.length > 0 && (
              <div className="border-t border-border pt-4">
                <h3 className="mb-2 text-sm font-semibold text-fg-muted">Khoá khác đang học</h3>
                <ul className="flex flex-col">
                  {others.map((o) => (
                    <li key={o.courseId}>
                      <Link
                        href={o.lessonUrl}
                        className="ui-focus-ring flex min-h-11 items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{o.courseName}</span>
                          <span className="block truncate text-xs text-fg-muted">Bài {o.lessonNo}: {o.lessonTitle}</span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-fg-muted">{Math.round(o.percent)}%</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <StatTile icon={<Flame aria-hidden="true" />} tone="accent" value={stats?.streak} label="Chuỗi ngày học" />
          <StatTile icon={<CheckCircle2 aria-hidden="true" />} tone="success" value={stats?.lessonsDone} label="Bài đã hoàn thành" />
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon, tone, value, label }: { icon: React.ReactNode; tone: 'accent' | 'success'; value: number | undefined; label: string }) {
  return (
    <Card padding="sm" className="flex items-center gap-3">
      <span
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-lg [&_svg]:size-6',
          tone === 'accent' ? 'bg-accent-soft text-accent-soft-fg' : 'bg-success-soft text-success-soft-fg',
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-none">{value ?? '–'}</div>
        <div className="mt-1 text-sm text-fg-muted">{label}</div>
      </div>
    </Card>
  );
}
