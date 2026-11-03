'use client';

// Hai ngăn trượt của trang Lộ trình: chi tiết một chặng, và "Khám phá lộ trình" (ghim/mở).
import { BookOpen, Check, ExternalLink, FileText, GraduationCap, Plus, Search, SearchX, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';

import { Badge, Button, EmptyState, Input, ProgressBar, Sheet, buttonVariants, cn } from '@/components/ui';
import { ROADMAP_LIST, type RoadmapResource } from '@/lib/roadmap-data';
import {
  STATUS_LABEL, countCourses, detailByLabel,
  type EnrolledCourse, type Stage, type Status,
} from '@/lib/roadmap-state';
import { ROADMAP_DATA } from '@/lib/roadmap-data';

const RES_ICON: Record<RoadmapResource['type'], { icon: ReactNode; label: string }> = {
  article: { icon: <FileText />, label: 'Bài viết' },
  video: { icon: <PlayCircle />, label: 'Video' },
  course: { icon: <GraduationCap />, label: 'Khóa học' },
  docs: { icon: <BookOpen />, label: 'Tài liệu' },
};

export const STATUS_BADGE: Record<Status, 'success' | 'primary' | 'neutral'> = { done: 'success', active: 'primary', locked: 'neutral' };

/* ───────────────────────── Chi tiết chặng ───────────────────────── */

type StageSheetProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stage: Stage | null;
  index: number;
  total: number;
  status: Status;
  enrolled: EnrolledCourse[];
  onSetStatus: (s: Status) => void;
};

export function StageSheet({ open, onOpenChange, stage, index, total, status, enrolled, onSetStatus }: StageSheetProps) {
  const fallback = stage ? detailByLabel(stage.title) : null;
  const courseId = stage ? (stage.course ?? fallback?.course_id ?? null) : null;
  const res = stage ? (stage.res.length ? stage.res : (fallback?.resources ?? [])) : [];
  const course = courseId ? enrolled.find((c) => c.id === courseId) : undefined;
  const pct = Math.min(100, Math.max(0, Math.round(course?.progress ?? 0)));
  const doneLessons = course?.completedLessons ?? 0;
  const totalLessons = course?.totalLessons ?? course?.lessons ?? 0;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={stage?.title ?? ''}
      description={stage ? `Chặng ${index + 1}/${total}` : undefined}
    >
      {stage && (
        <div className="flex flex-col gap-5 py-2">
          {/* Chặng gắn khoá học thì trạng thái tự đồng bộ từ tiến độ thật, không cho đánh dấu tay. */}
          {stage.course ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
              <Badge variant={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</Badge>
              Tự đồng bộ từ tiến độ khóa học trên nền tảng
            </div>
          ) : (
            <div role="group" aria-label="Trạng thái học của chặng" className="grid grid-cols-3 gap-2">
              {(['locked', 'active', 'done'] as const).map((s) => (
                <Button key={s} size="sm" variant={status === s ? 'primary' : 'secondary'} aria-pressed={status === s} onClick={() => onSetStatus(s)}>
                  {STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
          )}

          <p className="whitespace-pre-line text-sm text-fg">
            {stage.text || stage.desc || fallback?.desc || `Chặng này chưa có mô tả chi tiết. Hãy tìm hiểu thêm về "${stage.title}" qua tài liệu chính thức.`}
          </p>

          {stage.topics.length > 0 && (
            <section aria-labelledby="rm-topics">
              <h3 id="rm-topics" className="mb-2 text-sm font-semibold text-fg">Nội dung cần nắm</h3>
              <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-fg-muted">
                {stage.topics.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </section>
          )}

          {res.length > 0 && (
            <section aria-labelledby="rm-res">
              <h3 id="rm-res" className="mb-2 text-sm font-semibold text-fg">Tài nguyên</h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {res.map((r) => {
                  const cfg = RES_ICON[r.type] ?? RES_ICON.article;
                  const external = !r.course_id && r.url;
                  const inner = (
                    <>
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-fg [&_svg]:size-4" aria-hidden="true">{cfg.icon}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold text-fg">{r.title}</span>
                        <span className="truncate text-xs text-fg-muted">{cfg.label} · {r.source}</span>
                      </span>
                      {external && <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />}
                    </>
                  );
                  const cls = 'ui-focus-ring flex min-h-11 items-center gap-3 rounded-md border border-solid border-border bg-surface p-2 no-underline hover:border-border-strong hover:bg-surface-2';
                  return (
                    <li key={r.title}>
                      {r.course_id ? (
                        <Link href={`/courses/${r.course_id}`} className={cls}>{inner}</Link>
                      ) : r.url ? (
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className={cls}>{inner}<span className="sr-only"> (mở tab mới)</span></a>
                      ) : (
                        <div className={cls}>{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {courseId && (
            <section aria-label="Khóa học trên nền tảng" className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface-2 p-3">
              {course ? (
                <>
                  <p className="m-0 text-sm font-semibold text-fg">{course.title ?? 'Khóa học'}</p>
                  <ProgressBar value={pct} label={`Tiến độ khóa ${course.title ?? courseId}`} showValue size="sm" tone={pct >= 100 ? 'success' : 'primary'} />
                  <p className="m-0 text-xs text-fg-muted">{doneLessons}/{totalLessons} bài · {course.timeSpent ?? '0h'}</p>
                </>
              ) : (
                <p className="m-0 text-sm text-fg-muted">Bạn chưa đăng ký khóa học này.</p>
              )}
              <Link href={`/courses/${courseId}`} className={cn(buttonVariants({ variant: 'primary' }), 'self-start')}>
                <GraduationCap aria-hidden="true" className="size-4" />
                {!course ? 'Học ngay' : pct >= 100 ? 'Xem lại khóa học' : 'Tiếp tục học'}
              </Link>
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}

/* ───────────────────────── Khám phá lộ trình ───────────────────────── */

type BrowseProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pinned: string[];
  onOpenRoadmap: (id: string) => void;
  onTogglePin: (id: string) => void;
};

export function BrowseSheet({ open, onOpenChange, pinned, onOpenRoadmap, onTogglePin }: BrowseProps) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const needle = q.toLowerCase().trim();
    const map = new Map<string, typeof ROADMAP_LIST>();
    for (const r of ROADMAP_LIST) {
      // Khớp cả tên nhóm: gõ "bảo mật" phải ra Cyber Security dù mô tả không chứa đúng cụm đó.
      if (needle && !`${r.name} ${r.desc} ${r.group}`.toLowerCase().includes(needle)) continue;
      map.set(r.group, [...(map.get(r.group) ?? []), r]);
    }
    return [...map.entries()];
  }, [q]);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Khám phá lộ trình"
      description={`${ROADMAP_LIST.length} lộ trình nghề nghiệp · mở để xem, dấu + để ghim lên thanh tab`}
    >
      <div className="flex flex-col gap-4 py-2">
        <Input type="search" aria-label="Tìm lộ trình" placeholder="Tìm lộ trình… (frontend, dữ liệu, bảo mật…)" autoComplete="off" leadingIcon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} />
        {groups.length === 0 ? (
          <EmptyState compact icon={<SearchX aria-hidden="true" />} title="Không tìm thấy lộ trình phù hợp" description="Thử từ khoá khác." />
        ) : (
          groups.map(([group, list]) => (
            <section key={group} aria-label={group} className="flex flex-col gap-2">
              <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-fg-muted">{group}</h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {list.map((r) => {
                  const isPinned = pinned.includes(r.id);
                  const nCourses = countCourses(r.id);
                  return (
                    <li key={r.id} className="flex items-stretch gap-2 rounded-lg border border-solid border-border bg-surface">
                      <button
                        type="button"
                        onClick={() => onOpenRoadmap(r.id)}
                        className="ui-focus-ring flex min-h-14 min-w-0 flex-1 flex-col gap-1 rounded-lg border-0 bg-transparent p-3 text-left text-fg hover:bg-surface-2"
                      >
                        <span className="text-sm font-semibold"><span aria-hidden="true">{r.emoji}</span> {r.name}</span>
                        <span className="line-clamp-2 text-xs text-fg-muted">{r.desc}</span>
                        <span className="flex flex-wrap gap-1">
                          <Badge variant="outline">{(ROADMAP_DATA[r.id] ?? []).length} chặng</Badge>
                          {nCourses > 0 && <Badge variant="info">{nCourses} khóa học</Badge>}
                        </span>
                      </button>
                      <Button
                        size="sm"
                        variant={isPinned ? 'soft' : 'ghost'}
                        aria-pressed={isPinned}
                        aria-label={`${isPinned ? 'Bỏ ghim' : 'Ghim'} ${r.name}`}
                        onClick={() => onTogglePin(r.id)}
                        className="m-1 w-11 self-start px-0"
                      >
                        {isPinned ? <Check aria-hidden="true" className="size-4" /> : <Plus aria-hidden="true" className="size-4" />}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </Sheet>
  );
}
