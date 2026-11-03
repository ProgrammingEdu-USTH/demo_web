'use client';

// Danh sách khoá học (/courses) bằng React + token, thay cho renderCourses() trong main.js.
// Giữ nguyên chức năng bản cũ: GET /api/courses-enrolled, tìm kiếm (kể cả mẹo "c"/"c++"),
// lọc Tất cả/Đang học/Chưa đăng ký, cấp độ, ngôn ngữ (chọn nhiều), sắp xếp; bấm thẻ → /courses/<id>.
import { BookOpen, Search, SearchX } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';

import { Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, ProgressBar, Select, Skeleton, cn } from '@/components/ui';
import { fetchJson, useRemote } from '@/lib/fetch-json';

type Course = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  tag?: string;
  level?: string | null;
  duration?: string;
  lessons?: number;
  totalLessons?: number;
  rating?: number;
  image?: string;
  enrolled?: boolean;
  progress?: number;
};
type Enrolled = { id?: string; courseId?: string; progress?: number };
type Payload = { courses?: Course[]; enrolled?: Enrolled[] };

type Enroll = 'all' | 'enrolled' | 'not-enrolled';
type Sort = 'newest' | 'popular' | 'duration';

const LEVELS = ['Cơ bản', 'Trung cấp', 'Nâng cao'] as const;
const LANGS = ['Python', 'JS', 'Java', 'SQL'] as const;
// Từ khoá nhận diện từng ngôn ngữ trong tiêu đề/phụ đề/tag (luật cũ của main.js).
const LANG_KEYS: Record<string, string[]> = { Python: ['python'], JS: ['js', 'javascript'], Java: ['java'], SQL: ['sql'] };
const LEVEL_RE: Record<string, RegExp> = {
  'Cơ bản': /(cơ bản|phù hợp người mới)/i,
  'Trung cấp': /trung cấp/i,
  'Nâng cao': /nâng cao/i,
};

const low = (s?: string | null) => (s ?? '').toLowerCase();

function matchSearch(c: Course, q: string) {
  if (!q) return true;
  if (q === 'c' || q === 'c++') {
    // "c" khớp mọi chữ c nên chỉ tìm đúng nhóm khoá C / C++.
    return [c.title, c.subtitle, c.description, c.tag].some((f) => low(f).includes('c / c++') || low(f).includes('c++'));
  }
  return [c.title, c.subtitle, c.description, c.tag].some((f) => low(f).includes(q));
}

const hours = (d?: string) => parseInt((d ?? '').replace(/[^\d]/g, ''), 10) || 999;

// Ảnh thẻ: có sẵn bản cắt ngang `<id>-card.webp` cho ảnh theo quy ước; ảnh quản trị tự đặt dùng nguyên.
function artUrl(image: string) {
  const url = '/' + image.replace(/^\/+/, '');
  return /^\/static\/images\/[A-Za-z0-9_]+\.webp$/.test(url) ? url.replace(/\.webp$/, '-card.webp') : url;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'ui-focus-ring inline-flex min-h-11 items-center rounded-full border border-solid px-4 text-sm font-semibold transition-colors duration-fast sm:min-h-9 sm:px-3',
        active ? 'border-transparent bg-primary text-primary-fg' : 'border-border bg-surface text-fg hover:border-border-strong hover:bg-surface-2',
      )}
    >
      {children}
    </button>
  );
}

function CourseCard({ c }: { c: Course }) {
  const pct = Math.max(0, Math.min(100, Math.round(c.progress ?? 0)));
  const lessons = c.lessons ?? c.totalLessons;
  const meta = [lessons != null ? `${lessons} bài` : null, c.level, c.duration].filter(Boolean).join(' · ');
  return (
    <Link href={`/courses/${c.id}`} className="ui-focus-ring group flex h-full flex-col overflow-hidden rounded-lg border border-solid border-border bg-surface text-fg shadow-sm transition-colors duration-fast hover:border-border-strong">
      <div className="relative aspect-[5/2] w-full bg-surface-2">
        {c.image ? (
          <Image src={artUrl(c.image)} alt="" fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover" unoptimized={!/^\/?static\//.test(c.image)} />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-fg-muted [&_svg]:size-10" aria-hidden="true"><BookOpen /></span>
        )}
        {c.enrolled && <Badge variant="success" className="absolute left-3 top-3">Đang học</Badge>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {c.tag && <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{c.tag}</p>}
        <h2 className="text-lg font-semibold leading-snug group-hover:underline">{c.title}</h2>
        {c.description && <p className="line-clamp-2 text-sm text-fg-muted">{c.description}</p>}
        {meta && <p className="mt-auto pt-1 text-sm text-fg-muted">{meta}</p>}
        {c.enrolled ? (
          <ProgressBar value={pct} label={`Tiến độ khoá ${c.title}`} showValue size="sm" />
        ) : (
          <span className="text-sm font-semibold text-fg underline-offset-2 group-hover:underline">Xem khoá học</span>
        )}
      </div>
    </Link>
  );
}

function GridSkeleton() {
  return (
    <div role="status" aria-label="Đang tải khoá học" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Card key={i} padding="none" className="overflow-hidden">
          <Skeleton className="aspect-[5/2] w-full rounded-none" />
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function CoursesList() {
  const [res, reload] = useRemote(async () => {
    const d = await fetchJson<Payload>('/api/courses-enrolled');
    // Danh sách khoá không kèm tiến độ (mapCourse) → ghép từ /enrolled theo id.
    const prog = new Map<string, number>();
    (d.enrolled ?? []).forEach((e) => {
      const k = e.id ?? e.courseId;
      if (k != null) prog.set(k, e.progress ?? 0);
    });
    return (d.courses ?? []).map((c) => (prog.has(c.id) ? { ...c, enrolled: true, progress: c.progress ?? prog.get(c.id) } : c));
  });
  const [search, setSearch] = useState('');
  const [enroll, setEnroll] = useState<Enroll>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [level, setLevel] = useState<string>('all');
  const [langs, setLangs] = useState<string[]>([]);

  const all = useMemo(() => (res.state === 'ok' ? res.data : []), [res]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = all.filter((c) => {
      if (!matchSearch(c, q)) return false;
      if (enroll === 'enrolled' && !c.enrolled) return false;
      if (enroll === 'not-enrolled' && c.enrolled) return false;
      if (level !== 'all' && !LEVEL_RE[level]?.test(c.level ?? '')) return false;
      if (langs.length && !langs.some((l) => LANG_KEYS[l].some((k) => [c.title, c.subtitle, c.tag].some((f) => low(f).includes(k))))) return false;
      return true;
    });
    // "Phổ biến": số học viên backend đang trả '0' cho mọi khoá nên dùng điểm đánh giá thay thế.
    if (sort === 'newest') list.sort((a, b) => b.id.localeCompare(a.id));
    else if (sort === 'popular') list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else list.sort((a, b) => hours(a.duration) - hours(b.duration));
    return list;
  }, [all, search, enroll, sort, level, langs]);

  const filtering = search.trim() !== '' || enroll !== 'all' || level !== 'all' || langs.length > 0;
  const clear = () => { setSearch(''); setEnroll('all'); setLevel('all'); setLangs([]); };
  const toggleLang = (l: string) => setLangs((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  return (
    <div className="px-4 pb-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Khoá học"
        description={res.state === 'ok' ? `${all.length} khoá học có sẵn` : 'Chọn khoá học và bắt đầu từ bài đầu tiên.'}
      />

      {res.state === 'error' ? (
        <Card>
          <ErrorState title="Không tải được danh sách khoá học" description="Kiểm tra kết nối rồi thử lại." action={<Button variant="secondary" onClick={reload}>Thử lại</Button>} />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
              <Input
                type="search"
                aria-label="Tìm khoá học"
                placeholder="Tìm khoá học, ngôn ngữ, chủ đề…"
                autoComplete="off"
                leadingIcon={<Search />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select aria-label="Sắp xếp khoá học" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="newest">Mới nhất</option>
                <option value="popular">Phổ biến nhất</option>
                <option value="duration">Ngắn nhất</option>
              </Select>
            </div>
            <div role="group" aria-label="Trạng thái đăng ký" className="flex flex-wrap gap-2">
              <Chip active={enroll === 'all'} onClick={() => setEnroll('all')}>Tất cả</Chip>
              <Chip active={enroll === 'enrolled'} onClick={() => setEnroll('enrolled')}>Đang học</Chip>
              <Chip active={enroll === 'not-enrolled'} onClick={() => setEnroll('not-enrolled')}>Chưa đăng ký</Chip>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
              <div role="group" aria-label="Cấp độ" className="flex flex-wrap items-center gap-2">
                <span className="w-full text-sm font-semibold text-fg-muted sm:w-auto">Cấp độ</span>
                {LEVELS.map((l) => (
                  <Chip key={l} active={level === l} onClick={() => setLevel(level === l ? 'all' : l)}>{l}</Chip>
                ))}
              </div>
              <div role="group" aria-label="Ngôn ngữ" className="flex flex-wrap items-center gap-2">
                <span className="w-full text-sm font-semibold text-fg-muted sm:w-auto">Ngôn ngữ</span>
                {LANGS.map((l) => (
                  <Chip key={l} active={langs.includes(l)} onClick={() => toggleLang(l)}>{l}</Chip>
                ))}
              </div>
            </div>
          </div>

          {res.state === 'loading' ? (
            <GridSkeleton />
          ) : all.length === 0 ? (
            <Card><EmptyState icon={<BookOpen aria-hidden="true" />} title="Chưa có khoá học nào" description="Khoá học mới sẽ xuất hiện ở đây." /></Card>
          ) : shown.length === 0 ? (
            <Card>
              <EmptyState
                icon={<SearchX aria-hidden="true" />}
                title="Không tìm thấy khoá học phù hợp"
                description="Thử bỏ bớt bộ lọc hoặc đổi từ khoá."
                action={filtering ? <Button variant="secondary" onClick={clear}>Xoá bộ lọc</Button> : undefined}
              />
            </Card>
          ) : (
            <>
              <p className="sr-only" role="status">{shown.length} khoá học</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((c) => <CourseCard key={c.id} c={c} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
