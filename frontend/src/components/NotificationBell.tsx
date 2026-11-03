'use client';

// Chuông thông báo của vỏ mới. Dùng lại đúng API mà edu-chrome.js (HeaderBar legacy) đang gọi:
//   GET  /api/notifications/feed            → { items: [...], unread }
//   GET  /api/notifications/badge           → { unread, latest } (poll 45s khi tab đang hiện)
//   POST /api/notifications/feed/:id/read   · POST /api/notifications/feed/read-all
import { Bell, BellOff } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { Button, Skeleton, cn } from '@/components/ui';

type Notif = {
  id: number;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  href: string | null;
};

const POLL_MS = 45000;

/* eslint-disable @typescript-eslint/no-explicit-any */
// Backend trả thẳng bản ghi Prisma (camelCase); nhận cả snake_case như legacy để không phụ thuộc cách trả về.
function normalize(n: any): Notif {
  const refType = n.refType ?? n.ref_type;
  return {
    id: n.id,
    title: String(n.title ?? ''),
    body: String(n.body ?? ''),
    time: timeAgo(n.createdAt ?? n.created_at),
    unread: !(n.isRead ?? n.is_read),
    // Thông báo @mention/trả lời gắn với bài diễn đàn → dẫn về Cộng đồng.
    href: refType === 'post' ? '/community' : null,
  };
}

function timeAgo(iso: unknown): string {
  if (!iso) return '';
  const s = String(iso);
  const t = new Date(/[Zz]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z').getTime();
  const diff = Math.floor((Date.now() - t) / 1000);
  if (Number.isNaN(diff)) return '';
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

export default function NotificationBell({ placement = 'below' }: { placement?: 'below' | 'beside' }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch('/api/notifications/feed');
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      setItems((d.items ?? []).map(normalize));
      setUnread(d.unread ?? 0);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  // Số chưa đọc: lấy lúc vào trang rồi poll nhẹ; chỉ poll khi tab đang hiện (đỡ tải Neon).
  useEffect(() => {
    let alive = true;
    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      apiFetch('/api/notifications/badge')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d) setUnread(d.unread ?? 0); })
        .catch(() => {});
    };
    poll();
    const t = setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', poll);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', poll); };
  }, []);

  // Đóng khi bấm ra ngoài / Escape (trả focus về nút chuông).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const toggle = () => {
    if (!open) void load(); // tải mới mỗi lần mở, như bản cũ
    setOpen(!open);
  };

  const markRead = (n: Notif) => {
    if (!n.unread) return;
    setItems((cur) => cur && cur.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
    setUnread((u) => Math.max(0, u - 1));
    apiFetch(`/api/notifications/feed/${n.id}/read`, { method: 'POST' }).catch(() => {});
  };

  const markAll = () => {
    setItems((cur) => cur && cur.map((x) => ({ ...x, unread: false })));
    setUnread(0);
    apiFetch('/api/notifications/feed/read-all', { method: 'POST' }).catch(() => {});
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
        className="ui-focus-ring relative flex size-11 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-bold leading-none text-danger-fg"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Thông báo"
          className={cn(
            'absolute z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-surface shadow-lg',
            // Mobile: định vị theo viewport (fixed) để bảng không bị cắt mép khi chuông không sát mép phải.
            placement === 'below'
              ? 'right-0 top-full mt-2 max-sm:fixed max-sm:inset-x-2 max-sm:top-[calc(theme(spacing.topbar)+0.25rem)] max-sm:mt-0 max-sm:w-auto'
              : 'bottom-0 left-full ml-3',
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold">Thông báo</h2>
            <button
              type="button"
              onClick={markAll}
              disabled={unread === 0}
              className="ui-focus-ring min-h-11 rounded-md px-2 sm:min-h-8 text-sm font-semibold text-primary hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50"
            >
              Đánh dấu đã đọc
            </button>
          </div>
          <div className="max-h-[min(24rem,60dvh)] overflow-y-auto">
            {failed && !items ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-fg-muted">
                Không tải được thông báo.
                <Button variant="ghost" size="sm" onClick={() => void load()}>
                  Thử lại
                </Button>
              </div>
            ) : !items ? (
              <div className="flex flex-col gap-3 p-4" role="status" aria-label="Đang tải thông báo">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-fg-muted">
                <BellOff className="size-6" aria-hidden="true" />
                Chưa có thông báo nào
              </div>
            ) : (
              <ul>
                {items.map((n) => {
                  const inner = (
                    <>
                      <span aria-hidden="true" className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.unread ? 'bg-primary' : 'bg-transparent')} />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-sm', n.unread ? 'font-semibold' : 'text-fg-muted')}>
                          {n.title}
                          {n.body ? `: ${n.body}` : ''}
                        </span>
                        <span className="block text-xs text-fg-muted">{n.time}</span>
                      </span>
                      {n.unread && <span className="sr-only">(chưa đọc)</span>}
                    </>
                  );
                  const cls = 'ui-focus-ring flex min-h-11 w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-2';
                  return (
                    <li key={n.id}>
                      {n.href ? (
                        <Link href={n.href} onClick={() => { markRead(n); setOpen(false); }} className={cls}>{inner}</Link>
                      ) : (
                        <button type="button" onClick={() => markRead(n)} className={cls}>{inner}</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
