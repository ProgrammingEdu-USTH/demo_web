'use client';

import { FolderOpen, Trash2 } from 'lucide-react';

import { Button, Dialog, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import type { Snippet } from '@/lib/playground-api';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = đang tải; 'error' = tải lỗi. */
  items: Snippet[] | null | 'error';
  currentId: number | null;
  busyId: number | null;
  onOpenItem: (s: Snippet) => void;
  onDelete: (s: Snippet) => void;
  onRetry: () => void;
};

const LANG_LABEL = { python: 'Python', web: 'HTML/CSS/JS', sql: 'SQL' } as const;

export default function SnippetsDialog({ open, onOpenChange, items, currentId, busyId, onOpenItem, onDelete, onRetry }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Code của tôi"
      description="Các đoạn code bạn đã lưu lên tài khoản (tối đa 50)."
      footer={<Button variant="secondary" onClick={() => onOpenChange(false)}>Đóng</Button>}
    >
      {items === null ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : items === 'error' ? (
        <ErrorState compact title="Không tải được danh sách" action={<Button size="sm" onClick={onRetry}>Thử lại</Button>} />
      ) : items.length === 0 ? (
        <EmptyState compact title="Chưa lưu đoạn code nào" description="Bấm “Lưu” trên thanh công cụ để lưu code hiện tại." />
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {items.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-md border border-solid border-border bg-surface-2 p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-sm font-semibold">
                  {s.title}
                  {s.id === currentId && <span className="ml-2 text-xs font-normal text-primary-soft-fg">đang mở</span>}
                </p>
                <p className="m-0 text-xs text-fg-muted">
                  {LANG_LABEL[s.language]} · {new Date(s.updatedAt).toLocaleString('vi-VN')}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => onOpenItem(s)} disabled={busyId === s.id}>
                <FolderOpen aria-hidden="true" className="size-4" />
                Mở
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(s)}
                disabled={busyId === s.id}
                aria-label={`Xoá ${s.title}`}
                title="Xoá"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
