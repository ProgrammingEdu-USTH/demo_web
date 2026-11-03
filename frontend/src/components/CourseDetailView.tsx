'use client';

// Chi tiết khoá học (/courses/[courseId]) — đích của mọi thẻ khoá học. Vỏ AppShell + token mới,
// thay bản legacy (Sidebar/HeaderBar cũ, course_detail.js, review_quiz.js, style nội tuyến).
// DỮ LIỆU giữ nguyên: /api/courses + /api/enrolled + /api/stats + /api/user, rồi tính trạng thái
// done/current/locked ĐÚNG logic main.py course_detail() (curricula.json xuất nguyên văn từ CURRICULA).
// Chức năng giữ: đăng ký / huỷ đăng ký, tiếp tục học, vào từng bài, quiz ôn tập của khoá (≥5 bài),
// bài demo Studio (chỉ admin), chatbot nổi.
// 3 khoá CSDL (db_design, db_design_tc, db_design_nc) dùng CHUNG trang này: nội dung (tổng quan, bài, thành tựu…)
// lấy từ lib/db-course-meta.json (chuyển từ COURSE_PAGE_META của course_db_design.js cũ), bài mở bằng ?lesson=N 1-based.
import {
  Award, BookOpen, Check, ChevronDown, ChevronLeft, Clock, Flame, Infinity as InfinityIcon, Lock,
  MonitorSmartphone, Play, RotateCcw, Star, Trophy,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import AppShell from '@/components/AppShell';
import Chatbot from '@/components/Chatbot';
import LegacyScripts from '@/components/LegacyScripts';
import PageStyles from '@/components/PageStyles';
import ReviewQuizDialog from '@/components/ReviewQuizDialog';
import {
  Alert, Badge, Button, buttonVariants, Card, CardTitle, Container, Dialog, EmptyState, ErrorState, PageHeader,
  ProgressBar, Skeleton, cn, useToast,
} from '@/components/ui';
import { apiFetch, asList, findEnrollment } from '@/lib/api';
import CURRICULA_JSON from '@/lib/curricula.json';
import DB_META_JSON from '@/lib/db-course-meta.json';
import { ApiError, sendJson, useRemote } from '@/lib/fetch-json';

type Curriculum = {
  requirements?: string[];
  skills?: string[];
  instructor?: string;
  modules?: { title: string; lessons: string[] }[];
};
const CURRICULA = CURRICULA_JSON.CURRICULA as Record<string, Curriculum>;
const LESSON_URLS = CURRICULA_JSON.LESSON_URLS as Record<string, string>;

type DbMeta = {
  heroTitle: string; heroSubtitle: string; moduleNames: Record<string, string>; lessonBase: string; overview: string;
  outcomes: string[]; requirements: { text: string; status: string }[];
  sagaRefs: { href: string; text: string }[]; achievements: { m: number; title: string; desc: string }[];
  lessons: { n: number; m: number; t: string; min?: number; boss?: boolean }[];
};
const DB_META = DB_META_JSON as unknown as Record<string, DbMeta>;

/**
 * Chuỗi nội dung tĩnh của khoá CSDL có vài thẻ <strong>/<em>/<code>/<br>. Tự tách thành phần tử React thay vì
 * dangerouslySetInnerHTML — dữ liệu là hằng của repo nhưng không có lý do để mở cửa chèn HTML.
 */
function Inline({ html }: { html: string }) {
  const parts = html.split(/(<strong>.*?<\/strong>|<em>.*?<\/em>|<code>.*?<\/code>|<br\s*\/?>)/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = /^<(strong|em|code)>(.*)<\/\1>$/.exec(p);
        if (m) {
          const Tag = m[1] as 'strong' | 'em' | 'code';
          return <Tag key={i} className={Tag === 'code' ? 'rounded-sm bg-surface-2 px-1 font-mono text-sm' : undefined}>{m[2]}</Tag>;
        }
        return /^<br/.test(p) ? <br key={i} /> : <span key={i}>{p.replace(/<[^>]+>/g, '')}</span>;
      })}
    </>
  );
}

/** Dòng "Yêu cầu" trong khoá CSDL: `lock` = điều kiện nên có (🔒), còn lại là lời khuyên. */
function reqIcon(status: string) {
  return status === 'lock' ? <Lock className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" /> : <Check className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />;
}

type Course = {
  id: string; title: string; subtitle?: string; description?: string; tag?: string; level?: string | null;
  duration?: string; lessons?: number; rating?: number; image?: string;
};
type Enrollment = {
  progress?: number; completedLessons?: number; completedLessonNumbers?: number[]; timeSpent?: string;
};
type Loaded = { course: Course | null; enrollment: Enrollment | null; streak: number; isAdmin: boolean };

type LessonRow = { title: string; status: 'done' | 'current' | 'locked'; index: number };
type ModuleRow = { title: string; lessons: LessonRow[]; done: number; hasCurrent: boolean };

// Ảnh khoá: ưu tiên bản `<id>-card.webp` (đã cắt ngang) như thẻ ở danh sách.
function artUrl(image: string) {
  const url = '/' + image.replace(/^\/+/, '');
  return /^\/static\/images\/[A-Za-z0-9_]+\.webp$/.test(url) ? url.replace(/\.webp$/, '-card.webp') : url;
}

const RATE_LABELS: Record<number, string> = {
  1: 'Rất tệ', 2: 'Không tốt', 3: 'Bình thường', 4: 'Tốt', 5: 'Xuất sắc!',
};

/**
 * Ô chấm sao — chỉ ở phía người dùng (backend chưa có API lưu đánh giá, đúng như bản cũ).
 * Gắn key={courseId} ở nơi dùng để đổi khoá thì điểm khoá trước không dính sang.
 */
function StarRating() {
  const [rating, setRating] = useState(0);
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Đánh giá của bạn" className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`${i} sao`}
            aria-pressed={rating === i}
            onClick={() => setRating(i)}
            className="ui-focus-ring inline-flex size-11 items-center justify-center rounded-md text-fg-muted hover:text-warning"
          >
            <Star className={cn('size-6', rating >= i && 'fill-warning text-warning')} aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="text-sm text-fg-muted" aria-live="polite">{rating ? `${rating} sao · ${RATE_LABELS[rating]}` : 'Chạm vào sao để chấm điểm'}</p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Đang tải khoá học" className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-4">
        <Skeleton className="aspect-[5/2] w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

function CourseDetail({ courseId }: { courseId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);

  const [res, reload] = useRemote<Loaded>(async () => {
    // apiFetch: proxy /backend + Bearer + refresh; backend trả dạng BỌC ({ok, courses:[…]}) → asList.
    const [coursesRes, enrolledRes, statsRes, userRes] = await Promise.all([
      apiFetch('/api/courses'), apiFetch('/api/enrolled'), apiFetch('/api/stats'), apiFetch('/api/user'),
    ]);
    if (coursesRes.status === 401) {
      // Chưa đăng nhập (hết phiên) → về trang đăng nhập rồi quay lại đây.
      router.replace(`/login?next=${encodeURIComponent(`/courses/${courseId}`)}`);
      throw new Error('401');
    }
    if (!coursesRes.ok) throw new Error(String(coursesRes.status));
    const json = (r: Response) => (r.ok ? r.json().catch(() => ({})) : Promise.resolve({}));
    const [courses, enrolled, stats, user] = await Promise.all([
      coursesRes.json(), json(enrolledRes), json(statsRes), json(userRes),
    ]);
    const found = asList<Course>(courses, 'courses').find((c) => c.id === courseId) ?? null;
    // Khoá CSDL có thể chưa có trong /api/courses — nội dung tiêu đề/bài luôn lấy từ meta.
    const db = DB_META[courseId];
    const course: Course | null = db
      ? {
          ...found, id: courseId, title: db.heroTitle, subtitle: db.heroSubtitle, tag: 'DATABASE', lessons: db.lessons.length,
          duration: `~${Math.round(db.lessons.reduce((t, l) => t + (l.min || 0), 0) / 60)} giờ`, image: `static/images/${courseId}.webp`,
        }
      : found;
    const enrollment = course ? (findEnrollment(asList(enrolled, 'enrolled'), courseId) as Enrollment | null) : null;
    // /api/stats trả `streak` (không phải `streakDays`).
    return { course, enrollment, streak: (stats as { streak?: number }).streak ?? 0, isAdmin: (user as { role?: string }).role === 'admin' };
  }, version);

  const data = res.state === 'ok' ? res.data : null;
  const course = data?.course ?? null;

  // Tên khoá cho tab trình duyệt: <title> trong JSX bị metadata layout gốc đè, nên đặt thẳng document.title.
  useEffect(() => {
    if (course) document.title = `${course.title} – Programming EDU`;
  }, [course]);

  // Cuộn tới bài đang học khi dữ liệu về lần đầu.
  const ready = course !== null;
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => document.getElementById('current-lesson')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500);
    return () => clearTimeout(t);
  }, [ready]);

  async function toggleEnroll(enroll: boolean) {
    setBusy(true);
    try {
      await sendJson(`/api/courses/${courseId}/enroll`, enroll ? 'POST' : 'DELETE');
      toast({ title: enroll ? 'Đã đăng ký khoá học' : 'Đã huỷ đăng ký', variant: 'success' });
      setConfirmOpen(false);
      setVersion((v) => v + 1); // tải lại âm thầm: cập nhật nút + tiến độ
    } catch (e) {
      toast({ title: enroll ? 'Không đăng ký được' : 'Không huỷ được', description: e instanceof ApiError ? e.message : undefined, variant: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  let content: React.ReactNode;
  if (res.state === 'loading') {
    content = <DetailSkeleton />;
  } else if (res.state === 'error') {
    content = <ErrorState title="Không tải được khoá học" description="Kiểm tra kết nối rồi thử lại." action={<Button variant="secondary" onClick={reload}>Thử lại</Button>} />;
  } else if (!course) {
    content = (
      <EmptyState
        title="Không tìm thấy khoá học"
        description="Khoá học này không tồn tại hoặc đã bị gỡ."
        action={<Link href="/courses" className={buttonVariants({ variant: 'primary' })}>Về danh sách khoá học</Link>}
      />
    );
  } else {
    const enrollment = data!.enrollment;
    const db = DB_META[courseId];
    const curriculum = CURRICULA[courseId] || {};
    const totalLessons = course.lessons || 0;
    const completed = enrollment?.completedLessons || 0;
    const progress = enrollment?.progress || 0;
    const lessonUrl = db?.lessonBase ?? LESSON_URLS[courseId] ?? `/lesson/${courseId}`;
    // Trang bài CSDL đọc ?lesson=N theo 1-based, các trang còn lại theo chỉ số 0-based.
    const lessonQ = (index: number) => `${lessonUrl}?lesson=${db ? index + 1 : index}`;
    const completedNumbers = Array.isArray(enrollment?.completedLessonNumbers) ? enrollment.completedLessonNumbers : null;
    const nextLesson = completedNumbers
      ? Array.from({ length: totalLessons }, (_, i) => i + 1).find((n) => !completedNumbers.includes(n))
      : completed + 1;

    // Port vòng tính status của main.py course_detail()
    let flat = 0;
    const baseModules: { title: string; lessons: string[] }[] = db
      ? Object.keys(db.moduleNames).map((k) => ({
          title: `Module ${k}: ${db.moduleNames[k]}`,
          lessons: db.lessons.filter((l) => String(l.m) === k).map((l) => l.t),
        }))
      : curriculum.modules || [];
    const modules: ModuleRow[] = baseModules.map((m) => {
      const lessons: LessonRow[] = m.lessons.map((title) => {
        const status: LessonRow['status'] = (completedNumbers ? completedNumbers.includes(flat + 1) : flat < completed)
          ? 'done' : flat + 1 === nextLesson ? 'current' : 'locked';
        return { title, status, index: flat++ };
      });
      return { title: m.title, lessons, done: lessons.filter((l) => l.status === 'done').length, hasCurrent: lessons.some((l) => l.status === 'current') };
    });
    const current = modules.flatMap((m) => m.lessons).find((l) => l.status === 'current');
    // Bài kế tiếp; học xong hết (không còn bài "current") thì mở lại từ bài đầu.
    const continueHref = lessonQ(current ? current.index : 0);
    const outcomes = db ? [] : curriculum.skills || [];
    // Thành tựu khoá CSDL mở khi xong cả module (bài n của meta = phần tử thứ n-1 khi trải phẳng các module).
    const flatLessons = modules.flatMap((mm) => mm.lessons);
    const moduleDone = (m: number) => {
      const nums = db!.lessons.filter((l) => l.m === m).map((l) => l.n);
      return nums.length > 0 && nums.every((n) => flatLessons[n - 1]?.status === 'done');
    };
    // Link bài là <a> thường (tải lại toàn trang) như bản cũ: trang bài học tự nạp JS riêng, không kế thừa trạng thái trang này.
    const continueBtn = (
      <a href={continueHref} className={buttonVariants({ variant: 'primary', size: 'lg' })}>
        <Play aria-hidden="true" /> {current ? 'Tiếp tục học' : 'Học lại từ đầu'}
      </a>
    );

    // Ôn tập: sang /practice với khoá này chọn sẵn (PracticeView đọc ?course=).
    const reviewBtn = (
      <Link href={`/practice?course=${encodeURIComponent(courseId)}`} className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
        <RotateCcw aria-hidden="true" /> Ôn tập
      </Link>
    );

    content = (
      <>
        <PageHeader
          eyebrow={
            <Link href="/courses" className="ui-focus-ring -ml-1 inline-flex min-h-11 items-center gap-1 rounded-md px-1 font-semibold text-primary hover:underline sm:min-h-0">
              <ChevronLeft className="size-4" aria-hidden="true" /> Tất cả khoá học
            </Link>
          }
          title={course.title}
          description={course.subtitle}
          actions={enrollment ? <>{continueBtn}{reviewBtn}</> : undefined}
        >
          <p className="flex flex-wrap items-center gap-2 pt-1">
            {course.tag ? <Badge variant="neutral">{course.tag}</Badge> : null}
            {course.level ? <Badge variant="primary">{course.level}</Badge> : null}
            {course.rating ? (
              <span className="inline-flex items-center gap-1 text-sm font-semibold">
                <Star className="size-4 fill-warning text-warning" aria-hidden="true" /> {course.rating}
                <span className="sr-only"> trên 5 sao</span>
              </span>
            ) : null}
          </p>
        </PageHeader>

        <div className="grid gap-6 pb-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            {course.image ? (
              <div className="relative aspect-[5/2] w-full overflow-hidden rounded-lg border border-solid border-border bg-surface-2">
                <Image src={artUrl(course.image)} alt={`Ảnh khoá ${course.title}`} fill priority sizes="(min-width:1024px) 60vw, 100vw" className="object-cover" unoptimized={!/^\/?static\//.test(course.image)} />
              </div>
            ) : null}

            <Card role="region" aria-labelledby="cd-content">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <CardTitle as="h2" id="cd-content">Nội dung khoá học</CardTitle>
                <p className="text-sm text-fg-muted">{modules.length} module · {totalLessons} bài học</p>
              </div>
              {modules.length === 0 ? (
                <EmptyState compact title="Khoá học chưa có bài" description="Nội dung đang được cập nhật, bạn quay lại sau nhé." />
              ) : (
                <div className="flex flex-col gap-2">
                  {modules.map((m, mi) => (
                    <details key={mi} open={m.hasCurrent || mi === 0} className="group rounded-md border border-solid border-border">
                      <summary className="ui-focus-ring flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
                        <ChevronDown className="size-4 shrink-0 text-fg-muted transition-transform duration-fast group-open:rotate-180" aria-hidden="true" />
                        <span className="min-w-0 flex-1 text-base font-semibold">{m.title}</span>
                        <span className="shrink-0 text-sm text-fg-muted">
                          {enrollment && m.done > 0 ? `${m.done}/${m.lessons.length} ` : ''}{m.lessons.length} bài
                        </span>
                      </summary>
                      <ul className="flex flex-col border-t border-border">
                        {m.lessons.map((l) => {
                          const row = (
                            <>
                              <span
                                className={cn(
                                  'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                                  l.status === 'done' && 'bg-success text-success-fg',
                                  l.status === 'current' && 'bg-primary text-primary-fg',
                                  l.status === 'locked' && 'bg-surface-2 text-fg-muted',
                                )}
                              >
                                {l.status === 'done' ? <Check className="size-4" aria-hidden="true" /> : l.index + 1}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-base">{l.title}</span>
                                <span className="block text-sm text-fg-muted">Bài {l.index + 1}</span>
                              </span>
                              {l.status === 'done' ? <span className="sr-only">Đã hoàn thành</span> : null}
                              {l.status === 'current' ? <Badge variant="primary">Tiếp tục</Badge> : null}
                              {l.status === 'locked' ? <><Lock className="size-4 shrink-0 text-fg-muted" aria-hidden="true" /><span className="sr-only">Chưa mở</span></> : null}
                            </>
                          );
                          return (
                            <li key={l.index} id={l.status === 'current' ? 'current-lesson' : undefined} className="border-b border-border last:border-b-0">
                              {l.status === 'locked' ? (
                                <div className="flex min-h-11 items-center gap-3 px-3 py-2.5 opacity-80">{row}</div>
                              ) : (
                                <a href={lessonQ(l.index)} className="ui-focus-ring flex min-h-11 items-center gap-3 px-3 py-2.5 text-fg no-underline hover:bg-surface-2">{row}</a>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  ))}
                </div>
              )}
            </Card>

            <Card role="region" aria-labelledby="cd-overview">
              <CardTitle as="h2" id="cd-overview" className="mb-2">Tổng quan khoá học</CardTitle>
              {db ? (
                <div className="flex flex-col gap-3 text-base text-fg-muted">
                  <p><Inline html={db.overview} /></p>
                  <p className="font-semibold text-fg">Sau khoá học, bạn sẽ làm được:</p>
                  <ul className="flex flex-col gap-2">
                    {db.outcomes.map((o, i) => <li key={i} className="rounded-md bg-surface-2 p-3 text-fg"><Inline html={o} /></li>)}
                  </ul>
                  {db.sagaRefs.map((r) => (
                    <p key={r.href} className="text-sm">
                      <Link href={r.href} className="ui-focus-ring rounded-sm font-semibold text-primary hover:underline"><Inline html={r.text} /></Link>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-base text-fg-muted">{course.description}</p>
              )}
            </Card>

            {db ? (
              <Card role="region" aria-labelledby="cd-req">
                <CardTitle as="h2" id="cd-req" className="mb-2">Yêu cầu</CardTitle>
                <ul className="flex flex-col gap-2 text-base text-fg-muted">
                  {db.requirements.map((r, i) => <li key={i} className="flex items-start gap-2">{reqIcon(r.status)}<span>{r.text}</span></li>)}
                </ul>
              </Card>
            ) : null}

            {db ? (
              <Card role="region" aria-labelledby="cd-ach">
                <CardTitle as="h2" id="cd-ach" className="mb-3">Thành tựu</CardTitle>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {db.achievements.map((a, i) => {
                    const got = !!enrollment && moduleDone(a.m);
                    return (
                      <li key={i} className={cn('flex items-start gap-3 rounded-md border border-solid p-3', got ? 'border-success bg-success-soft' : 'border-border')}>
                        {got ? <Trophy className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" /> : <Lock className="mt-0.5 size-5 shrink-0 text-fg-muted" aria-hidden="true" />}
                        <span className="min-w-0">
                          <span className="block text-base font-semibold">{a.title}</span>
                          <span className="block text-sm text-fg-muted">{a.desc}</span>
                          <span className="sr-only">{got ? 'Đã đạt' : 'Chưa đạt'}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ) : null}

            {!db && (curriculum.requirements || []).length > 0 ? (
              <Card role="region" aria-labelledby="cd-req">
                <CardTitle as="h2" id="cd-req" className="mb-2">Yêu cầu</CardTitle>
                <ul className="list-disc space-y-1 pl-5 text-base text-fg-muted">
                  {curriculum.requirements!.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </Card>
            ) : null}

            <Card role="region" aria-labelledby="cd-rate">
              <CardTitle as="h2" id="cd-rate" className="mb-2">Đánh giá của học viên</CardTitle>
              <p className="mb-3 flex items-center gap-2 text-base">
                <Star className="size-5 fill-warning text-warning" aria-hidden="true" />
                <b>{course.rating ?? '—'}</b> <span className="text-fg-muted">Đánh giá trung bình</span>
              </p>
              <StarRating key={courseId} />
              <Alert variant="info" className="mt-3">Tính năng lưu đánh giá đang được phát triển. Hãy quay lại sau!</Alert>
            </Card>

            <Card role="region" aria-labelledby="cd-quiz">
              <CardTitle as="h2" id="cd-quiz" className="mb-2">Quiz ôn tập</CardTitle>
              {enrollment && completed >= 5 ? (
                <>
                  <p className="mb-3 text-base text-fg-muted">Ôn lại kiến thức đã học bằng 5–10 câu ngẫu nhiên từ các bài bạn đã hoàn thành.</p>
                  <Button variant="primary" onClick={() => setQuizOpen(true)}>Bắt đầu ôn tập</Button>
                </>
              ) : (
                <p className="flex items-center gap-2 text-base text-fg-muted">
                  <Lock className="size-4 shrink-0" aria-hidden="true" /> Hoàn thành ít nhất 5 bài học để mở khoá quiz ôn tập.
                </p>
              )}
            </Card>
          </div>

          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6">
            <Card className="flex flex-col gap-4">
              <div>
                <p className="text-2xl font-bold">Miễn phí</p>
                <p className="text-sm text-fg-muted">Hoàn toàn không mất phí</p>
              </div>
              {enrollment ? (
                <>
                  <ProgressBar value={progress} label="Tiến độ khoá học" showValue />
                  <dl className="grid grid-cols-2 gap-3 text-center">
                    {[
                      { v: completed, l: 'Bài đã học' },
                      { v: Math.max(0, totalLessons - completed), l: 'Còn lại' },
                      { v: enrollment.timeSpent || '0h', l: 'Đã học' },
                      { v: data!.streak, l: 'Streak', icon: true },
                    ].map((s) => (
                      <div key={s.l} className="rounded-md bg-surface-2 p-3">
                        <dd className="flex items-center justify-center gap-1 text-xl font-bold">
                          {s.icon ? <Flame className="size-5 text-warning" aria-hidden="true" /> : null}{s.v}
                        </dd>
                        <dt className="text-sm text-fg-muted">{s.l}</dt>
                      </div>
                    ))}
                  </dl>
                  {continueBtn}
                  <Button variant="ghost" disabled={busy} onClick={() => setConfirmOpen(true)}>Huỷ đăng ký</Button>
                </>
              ) : (
                <Button variant="primary" size="lg" loading={busy} onClick={() => toggleEnroll(true)}>
                  {busy ? 'Đang xử lý…' : 'Đăng ký ngay – Miễn phí'}
                </Button>
              )}
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Khoá học bao gồm</p>
                <ul className="flex flex-col gap-2 text-sm [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-muted">
                  <li className="flex items-center gap-2"><BookOpen aria-hidden="true" /> {totalLessons} bài học</li>
                  {course.duration ? <li className="flex items-center gap-2"><Clock aria-hidden="true" /> {course.duration}</li> : null}
                  <li className="flex items-center gap-2"><InfinityIcon aria-hidden="true" /> Truy cập vĩnh viễn</li>
                  <li className="flex items-center gap-2"><Award aria-hidden="true" /> Chứng chỉ hoàn thành</li>
                  <li className="flex items-center gap-2"><MonitorSmartphone aria-hidden="true" /> Học trên mọi thiết bị</li>
                </ul>
              </div>
            </Card>

            {outcomes.length > 0 ? (
              <Card role="region" aria-labelledby="cd-outcomes">
                <CardTitle as="h2" id="cd-outcomes" className="mb-3">Bạn sẽ học được</CardTitle>
                <ul className="flex flex-col gap-2 text-sm">
                  {outcomes.map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </aside>
        </div>

        <Dialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          size="sm"
          title="Huỷ đăng ký khoá học?"
          description="Bạn có chắc muốn huỷ đăng ký khoá học này?"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Giữ lại</Button>
              <Button variant="danger" loading={busy} onClick={() => toggleEnroll(false)}>Huỷ đăng ký</Button>
            </>
          }
        >
          {null}
        </Dialog>
        <ReviewQuizDialog open={quizOpen} onOpenChange={setQuizOpen} mode="course" courseId={courseId} />
      </>
    );
  }

  return (
    <Container>
      {content}
    </Container>
  );
}

export default function CourseDetailView({ courseId }: { courseId: string }) {
  return (
    <AppShell>
      {/* key: đổi khoá bằng client-side routing thì dựng lại từ đầu, không giữ dữ liệu khoá cũ. */}
      <CourseDetail key={courseId} courseId={courseId} />
      <PageStyles hrefs={["/static/css/chatbot.css"]} />
      <link rel="stylesheet" href="/static/vendor/fontawesome/css/all.min.css" />
      <Chatbot />
      <LegacyScripts srcs={['/static/js/chatbot.js']} />
    </AppShell>
  );
}
