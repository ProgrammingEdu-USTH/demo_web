'use client';

// /community: Diễn đàn + Xếp hạng XP, viết bằng React + token (thay #page-forum, #page-leader của SPA legacy).
// API: GET/POST /api/posts, /api/posts/:id/*, GET /api/leaderboard, GET /api/user (để biết bài nào là của mình).
// Backend KHÔNG có "khoá học" cho bài viết — chỉ có category (discuss|question|share|help) nên bộ lọc là "Chủ đề".
import { MessageCircle, Plus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import PostDetail, { CATEGORY_LABEL, likes, nameOf, type Post } from '@/components/community/PostDetail';
import {
  Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, PageHeader, Select, Sheet, Skeleton, Tab, TabList, TabNav, TabNavLink, Tabs,
  Textarea, buttonVariants, cn, useToast,
} from '@/components/ui';
import { ApiError, fetchJson, sendJson, timeAgo, useRemote } from '@/lib/fetch-json';

type Filter = 'new' | 'hot' | 'mine';
type PostsRes = { posts: Post[]; total: number; page: number; page_size: number };
type LbEntry = { rank: number; name: string; value: number; is_me?: boolean };
type Lb = { entries?: LbEntry[]; me?: LbEntry | null };

const fmt = (n: number) => n.toLocaleString('vi-VN');
const excerpt = (s: string | null) => (s ?? '').replace(/```[\s\S]*?```/g, ' [code] ').replace(/\s+/g, ' ').trim();

/* ───────── Đặt câu hỏi ───────── */
function NewPost({ open, onClose, onCreated, lesson }: { open: boolean; onClose: () => void; onCreated: () => void; lesson: string }) {
  const { toast } = useToast();
  // Mở từ bài học (?new=1&lesson=…): điền sẵn tên bài vào tiêu đề để người hỏi khỏi gõ lại.
  const [title, setTitle] = useState(lesson ? `Bài ${lesson}: ` : '');
  const [category, setCategory] = useState('question');
  const [content, setContent] = useState('');
  const [errs, setErrs] = useState<{ title?: string; content?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    const e: typeof errs = {};
    if (!title.trim()) e.title = 'Hãy nhập tiêu đề ngắn gọn.';
    if (!content.trim()) e.content = 'Hãy mô tả câu hỏi của bạn.';
    setErrs(e);
    if (e.title || e.content) return;
    setBusy(true);
    try {
      await sendJson('/api/posts', 'POST', { title: title.trim(), content: content.trim(), category });
      toast({ title: 'Đã đăng câu hỏi', variant: 'success' });
      onCreated();
      setTitle(''); setContent('');
      onClose();
    } catch (err) {
      setErrs({ form: err instanceof ApiError ? err.message : 'Không đăng được, thử lại nhé.' }); // giữ nội dung đã gõ
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }} title="Đặt câu hỏi" description="Mô tả rõ chỗ bạn kẹt, kèm đoạn code nếu có.">
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="flex flex-col gap-4" noValidate>
        <Field label="Tiêu đề" required error={errs.title}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} autoComplete="off" />
        </Field>
        <Field label="Chủ đề">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Nội dung" required hint="Dùng ``` bao quanh đoạn code để hiển thị đúng định dạng." error={errs.content}>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={7} maxLength={10000} />
        </Field>
        {errs.form ? <p role="alert" className="text-sm text-danger-soft-fg">{errs.form}</p> : null}
        <Button type="submit" variant="primary" block loading={busy}>Đăng</Button>
      </form>
    </Sheet>
  );
}

/* ───────── Thẻ bài ───────── */
function PostCard({ p, onOpen }: { p: Post; onOpen: () => void }) {
  return (
    <Card interactive padding="md" className="p-0">
      <button type="button" onClick={onOpen} className="flex w-full flex-col gap-2 rounded-lg p-4 text-left">
        <h3 className="line-clamp-2 text-base font-semibold text-fg">{p.title || excerpt(p.content).slice(0, 80) || 'Bài viết'}</h3>
        <p className="line-clamp-2 text-sm text-fg-muted">{excerpt(p.content)}</p>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-fg-muted">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-fg"><Avatar name={nameOf(p.author)} size="sm" />{nameOf(p.author)}</span>
          {p.category ? <Badge variant="primary">{CATEGORY_LABEL[p.category] ?? p.category}</Badge> : null}
          <span className="inline-flex items-center gap-1"><MessageCircle aria-hidden="true" className="size-3.5" /><span className="tabular-nums">{p.comment_count}</span> trả lời</span>
          {likes(p.reactions) > 0 ? <span className="tabular-nums">{likes(p.reactions)} thích</span> : null}
          <span>{timeAgo(p.createdAt)}</span>
        </span>
      </button>
    </Card>
  );
}

/* ───────── Diễn đàn ───────── */
function Forum({ meId, refresh, onAsk }: { meId: number | null; refresh: number; onAsk: () => void }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [filter, setFilter] = useState<Filter>('new');
  const [cat, setCat] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<'loading' | 'error' | 'ok'>('loading');
  const [more, setMore] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  // Đổi bộ lọc → tải lại từ trang 1. "Nhiều trả lời" không có sort riêng ở backend nên sắp theo comment_count trong trang đã tải.
  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams({ page: '1' });
    if (cat) qs.set('category', cat);
    if (filter === 'mine') qs.set('mine', '1');
    fetchJson<PostsRes>(`/api/posts?${qs}`).then(
      (d) => { if (!alive) return; setPosts(() => d.posts); setTotal(d.total); setPage(1); setState('ok'); },
      () => { if (alive) setState('error'); },
    );
    return () => { alive = false; };
  }, [filter, cat, tick, refresh]);

  async function loadMore() {
    setMore(true);
    try {
      const qs = new URLSearchParams({ page: String(page + 1) });
      if (cat) qs.set('category', cat);
      if (filter === 'mine') qs.set('mine', '1');
      const d = await fetchJson<PostsRes>(`/api/posts?${qs}`);
      setPosts((cur) => [...(cur ?? []), ...d.posts]);
      setPage(page + 1);
    } catch { /* nút vẫn còn để bấm lại */ } finally { setMore(false); }
  }

  const shown = useMemo(() => {
    const list = posts ?? [];
    return filter === 'hot' ? [...list].sort((a, b) => b.comment_count - a.comment_count) : list;
  }, [posts, filter]);
  const open = shown.find((p) => p.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(v) => { setState('loading'); setFilter(v as Filter); }}>
          <TabList label="Lọc bài viết">
            <Tab value="new">Mới nhất</Tab>
            <Tab value="hot">Nhiều trả lời</Tab>
            <Tab value="mine">Của tôi</Tab>
          </TabList>
        </Tabs>
        <Select aria-label="Lọc theo chủ đề" value={cat} onChange={(e) => { setState('loading'); setCat(e.target.value); }} className="sm:w-48">
          <option value="">Mọi chủ đề</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>

      {state === 'loading' ? (
        <div role="status" aria-label="Đang tải bài viết" className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : state === 'error' ? (
        <ErrorState title="Không tải được diễn đàn" description="Kiểm tra kết nối rồi thử lại." action={<Button variant="secondary" onClick={() => { setState('loading'); setTick((t) => t + 1); }}>Thử lại</Button>} />
      ) : shown.length === 0 ? (
        <EmptyState
          title={filter === 'mine' ? 'Bạn chưa đăng bài nào' : 'Chưa có câu hỏi nào'}
          description={filter === 'mine' ? undefined : 'Hỏi khi kẹt, chia sẻ khi xong.'}
          action={<Button variant="primary" onClick={onAsk}>{filter === 'mine' ? 'Đặt câu hỏi' : 'Đặt câu hỏi đầu tiên'}</Button>}
        />
      ) : (
        <>
          <ul className="flex list-none flex-col gap-3 p-0">
            {shown.map((p) => <li key={p.id}><PostCard p={p} onOpen={() => setOpenId(p.id)} /></li>)}
          </ul>
          {(posts?.length ?? 0) < total ? (
            <Button variant="secondary" loading={more} onClick={loadMore} className="self-center">Xem thêm</Button>
          ) : null}
        </>
      )}

      <PostDetail
        post={open}
        meId={meId}
        onClose={() => setOpenId(null)}
        onChanged={(np) => setPosts((cur) => (cur ?? []).map((p) => (p.id === np.id ? np : p)))}
        onDeleted={(id) => { setPosts((cur) => (cur ?? []).filter((p) => p.id !== id)); setTotal((t) => Math.max(0, t - 1)); }}
      />
    </div>
  );
}

/* ───────── Xếp hạng ───────── */
function Rank({ weekly }: { weekly?: boolean }) {
  const type = weekly ? 'weekly' : 'xp';
  const [res, reload] = useRemote(() => fetchJson<Lb>(`/api/leaderboard?type=${type}`));
  if (res.state === 'loading') return <div role="status" aria-label="Đang tải xếp hạng" className="flex flex-col gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>;
  if (res.state === 'error') return <ErrorState compact title="Không tải được xếp hạng" action={<Button variant="secondary" onClick={reload}>Thử lại</Button>} />;
  const entries = (weekly ? res.data.entries?.slice(0, 5) : res.data.entries) ?? [];
  if (!entries.length) return <EmptyState compact title="Chưa có xếp hạng" description="Hoàn thành bài học để lên bảng." />;
  const me = res.data.me;
  const meInList = entries.some((e) => e.is_me);
  const row = (e: LbEntry) => (
    <li key={`${e.rank}-${e.name}`} className={cn('flex items-center gap-3 rounded-md px-3 py-2', e.is_me && 'bg-primary/10')}>
      <span className="w-7 text-center font-mono text-sm font-semibold tabular-nums text-fg-muted">{e.rank}</span>
      <Avatar name={e.name} size="sm" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.name}{e.is_me ? ' (bạn)' : ''}</span>
      <span className="font-mono text-sm font-semibold tabular-nums">{fmt(e.value)} XP</span>
    </li>
  );
  return (
    <ol className="m-0 flex list-none flex-col gap-1 p-0">
      {entries.map(row)}
      {/* Ngoài top thì ghim dòng của mình xuống cuối để vẫn thấy vị trí. */}
      {!weekly && me && !meInList ? <><li aria-hidden="true" className="px-3 text-center text-fg-muted">…</li>{row({ ...me, is_me: true })}</> : null}
    </ol>
  );
}

function Inner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const tab = sp.get('tab') === 'rank' ? 'rank' : 'forum';
  const [meId, setMeId] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [asking, setAsking] = useState(sp.get('new') === '1');
  const lesson = sp.get('lesson') ?? '';

  useEffect(() => {
    fetchJson<{ id?: number }>('/api/user').then((u) => setMeId(u.id ?? null), () => {});
  }, []);

  const closeAsk = useCallback(() => {
    setAsking(false);
    if (sp.get('new')) router.replace(pathname); // bỏ ?new=1 để F5 không bật lại hộp thoại
  }, [router, pathname, sp]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Cộng đồng"
        description="Hỏi khi kẹt, chia sẻ khi xong."
        actions={<Button variant="primary" onClick={() => setAsking(true)} className="max-sm:w-full"><Plus aria-hidden="true" />Đặt câu hỏi</Button>}
      />
      <TabNav label="Mục cộng đồng" className="mb-4">
        <TabNavLink href={pathname} active={tab === 'forum'}>Diễn đàn</TabNavLink>
        <TabNavLink href={`${pathname}?tab=rank`} active={tab === 'rank'}>Xếp hạng</TabNavLink>
      </TabNav>

      {tab === 'forum' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Forum meId={meId} refresh={refresh} onAsk={() => setAsking(true)} />
          <aside aria-label="Top XP tuần" className="order-last lg:sticky lg:top-4 lg:self-start">
            <Card>
              <h2 className="mb-3 text-base font-semibold">Top XP tuần</h2>
              <Rank weekly />
              <Link href="/community?tab=rank" className={cn(buttonVariants({ variant: 'link' }), 'mt-3 min-h-11')}>Xem xếp hạng →</Link>
            </Card>
          </aside>
        </div>
      ) : (
        <Card>
          <p className="mb-3 text-sm text-fg-muted">
            XP học tập — xem ELO ở <Link href="/arena/leaderboard" className="inline-flex min-h-11 items-center font-semibold text-primary underline">Đấu trường →</Link>
          </p>
          <Rank />
        </Card>
      )}

      <NewPost open={asking} onClose={closeAsk} lesson={lesson} onCreated={() => { setRefresh((r) => r + 1); if (tab !== 'forum') router.replace(pathname); }} />
    </div>
  );
}

export default function CommunityView() {
  return (
    // useSearchParams cần Suspense để trang vẫn prerender được.
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
