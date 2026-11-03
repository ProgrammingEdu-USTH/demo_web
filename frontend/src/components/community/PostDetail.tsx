'use client';

// Chi tiết bài + bình luận + ô trả lời (mở trong Sheet từ danh sách diễn đàn).
// API: GET/POST /api/posts/:id/comments, POST /api/posts|comments/:id/react, DELETE /api/posts/:id.
import { MessageCircle, ThumbsUp, Trash2 } from 'lucide-react';
import { useState } from 'react';

import RichText from '@/components/community/RichText';
import { Avatar, Badge, Button, EmptyState, ErrorState, Field, Sheet, Skeleton, Textarea, cn, useToast } from '@/components/ui';
import { ApiError, fetchJson, sendJson, timeAgo, useRemote } from '@/lib/fetch-json';

export type Author = { id: number; name: string | null; avatar?: string | null };
export type Post = {
  id: number;
  title: string | null;
  content: string | null;
  category: string | null;
  createdAt: string;
  author: Author;
  reactions: Record<string, number>;
  my_reaction: string | null;
  comment_count: number;
};
type Comment = {
  id: number;
  content: string | null;
  createdAt: string;
  author: Author;
  reactions: Record<string, number>;
  my_reaction: string | null;
  replies?: Comment[];
};

export const CATEGORY_LABEL: Record<string, string> = { question: 'Câu hỏi', share: 'Chia sẻ', discuss: 'Thảo luận', help: 'Cần giúp', 'hoi-dap': 'Hỏi đáp', 'chia-se': 'Chia sẻ' }; // hai khoá cuối là dữ liệu cũ từ bản Django
export const nameOf = (a: Author) => a.name || 'Học viên ẩn danh';
export const likes = (r: Record<string, number>) => r.like ?? 0;

function LikeButton({ count, mine, onClick, label }: { count: number; mine: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={mine}
      aria-label={label}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold transition-colors hover:bg-surface-2',
        mine ? 'text-primary' : 'text-fg-muted',
      )}
    >
      <ThumbsUp aria-hidden="true" className="size-4" />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

function CommentItem({ c, onLike, nested }: { c: Comment; onLike: (id: number) => void; nested?: boolean }) {
  return (
    <li className={cn('flex gap-3', nested && 'ml-8 mt-3')}>
      <Avatar name={nameOf(c.author)} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold">{nameOf(c.author)}</span>
          <span className="text-xs text-fg-muted">{timeAgo(c.createdAt)}</span>
        </div>
        <RichText text={c.content ?? ''} />
        <LikeButton count={likes(c.reactions)} mine={c.my_reaction === 'like'} onClick={() => onLike(c.id)} label="Thích bình luận" />
        {c.replies?.length ? (
          <ul className="list-none p-0">
            {c.replies.map((r) => (
              <CommentItem key={r.id} c={r} nested onLike={onLike} />
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

export default function PostDetail({
  post,
  meId,
  onClose,
  onChanged,
  onDeleted,
}: {
  post: Post | null;
  meId: number | null;
  onClose: () => void;
  onChanged: (p: Post) => void;
  onDeleted: (id: number) => void;
}) {
  return (
    <Sheet open={post !== null} onOpenChange={(o) => { if (!o) onClose(); }} title={post?.title || 'Bài viết'}>
      {post ? <Body key={post.id} post={post} meId={meId} onChanged={onChanged} onDeleted={onDeleted} onClose={onClose} /> : null}
    </Sheet>
  );
}

function Body({ post, meId, onChanged, onDeleted, onClose }: { post: Post; meId: number | null; onChanged: (p: Post) => void; onDeleted: (id: number) => void; onClose: () => void }) {
  const { toast } = useToast();
  const [version, setVersion] = useState(0);
  const [res, reload] = useRemote(() => fetchJson<{ comments: Comment[] }>(`/api/posts/${post.id}/comments`), version);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  async function likePost() {
    try {
      const d = await sendJson<{ reactions?: Record<string, number>; my_reaction?: string | null }>(`/api/posts/${post.id}/react`, 'POST', { reaction: 'like' });
      onChanged({ ...post, reactions: d.reactions ?? post.reactions, my_reaction: d.my_reaction ?? null });
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : 'Không thả được lượt thích', variant: 'danger' });
    }
  }
  async function likeComment(id: number) {
    try {
      await sendJson(`/api/comments/${id}/react`, 'POST', { reaction: 'like' });
      setVersion((v) => v + 1);
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : 'Không thả được lượt thích', variant: 'danger' });
    }
  }
  async function send() {
    if (!text.trim()) { setErr('Hãy nhập nội dung trả lời.'); return; }
    setBusy(true); setErr('');
    try {
      await sendJson(`/api/posts/${post.id}/comments`, 'POST', { content: text.trim() });
      setText('');
      setVersion((v) => v + 1);
      onChanged({ ...post, comment_count: post.comment_count + 1 });
      toast({ title: 'Đã gửi trả lời', variant: 'success' });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Không gửi được, thử lại nhé.'); // giữ nguyên nội dung đã gõ
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await sendJson(`/api/posts/${post.id}`, 'DELETE');
      toast({ title: 'Đã xoá bài viết', variant: 'success' });
      onDeleted(post.id);
      onClose();
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : 'Không xoá được bài', variant: 'danger' });
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Avatar name={nameOf(post.author)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{nameOf(post.author)}</p>
          <p className="text-xs text-fg-muted">{timeAgo(post.createdAt)}</p>
        </div>
        {post.category ? <Badge variant="primary">{CATEGORY_LABEL[post.category] ?? post.category}</Badge> : null}
      </div>
      <RichText text={post.content ?? ''} />
      <div className="flex items-center gap-1 border-y border-solid border-border py-1">
        <LikeButton count={likes(post.reactions)} mine={post.my_reaction === 'like'} onClick={likePost} label="Thích bài viết" />
        <span className="inline-flex items-center gap-1.5 px-2.5 text-sm text-fg-muted"><MessageCircle aria-hidden="true" className="size-4" />{post.comment_count}</span>
        {meId === post.author.id ? (
          <span className="ml-auto">
            {confirmDel ? (
              <span className="inline-flex items-center gap-2 text-sm">
                Xoá bài này?
                <Button size="sm" variant="danger" className="min-h-11" loading={busy} onClick={remove}>Xoá</Button>
                <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setConfirmDel(false)}>Giữ lại</Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setConfirmDel(true)}><Trash2 aria-hidden="true" />Xoá bài</Button>
            )}
          </span>
        ) : null}
      </div>

      <section aria-label="Bình luận">
        {res.state === 'loading' ? (
          <div role="status" aria-label="Đang tải bình luận" className="flex flex-col gap-3"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        ) : res.state === 'error' ? (
          <ErrorState compact title="Không tải được bình luận" action={<Button variant="secondary" onClick={reload}>Thử lại</Button>} />
        ) : res.data.comments.length === 0 ? (
          <EmptyState compact title="Chưa có trả lời nào" description="Hãy là người đầu tiên giúp bạn ấy." />
        ) : (
          <ul className="flex list-none flex-col gap-4 p-0">
            {res.data.comments.map((c) => <CommentItem key={c.id} c={c} onLike={likeComment} />)}
          </ul>
        )}
      </section>

      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex flex-col gap-3" noValidate>
        <Field label="Trả lời" error={err}>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={10000} placeholder="Viết câu trả lời… (dùng ``` để chèn khối code)" />
        </Field>
        <Button type="submit" variant="primary" loading={busy} className="self-end">Gửi</Button>
      </form>
    </div>
  );
}
