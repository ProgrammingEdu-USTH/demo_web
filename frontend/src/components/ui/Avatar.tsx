'use client';

import { useState } from 'react';

import { cn } from './cn';

export type AvatarProps = {
  /** URL ảnh; thiếu hoặc lỗi tải → hiện chữ cái đầu. */
  src?: string | null;
  /** Tên hiển thị — dùng cho alt và chữ viết tắt. */
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
};

/** "Nguyễn Văn An" → "NA" (họ + tên), một từ → 2 chữ đầu. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const sizes = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-24 text-2xl',
};

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(src) && !failed;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full',
        'bg-primary-soft font-semibold text-primary-soft-fg',
        sizes[size],
        className,
      )}
    >
      {showImg ? (
        // <img> thường thay vì next/image: ảnh đại diện đến từ nhiều nguồn (upload, OAuth)
        // không khai báo trước được trong images.remotePatterns.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src ?? undefined} alt={name} className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span role="img" aria-label={name}>
          {initials(name)}
        </span>
      )}
    </span>
  );
}
