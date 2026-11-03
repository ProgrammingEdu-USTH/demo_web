/**
 * Nhãn phím tắt theo hệ điều hành. Chỉ gọi sau hydrate (trong effect) để không lệch SSR:
 * server không biết người dùng đang dùng máy gì.
 */
export function modKeyLabel(): '⌘' | 'Ctrl' {
  if (typeof navigator === 'undefined') return 'Ctrl';
  // userAgentData chưa có ở mọi trình duyệt → lùi về platform/userAgent.
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const p = nav.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
  // iPad/iPhone có bàn phím rời cũng dùng ⌘.
  return /mac|iphone|ipad|ipod/i.test(p) ? '⌘' : 'Ctrl';
}

/** Giá trị cho `aria-keyshortcuts` của nút Chạy (Mod-Enter chấp nhận cả hai phím). */
export const RUN_ARIA_SHORTCUTS = 'Control+Enter Meta+Enter';

/** Cờ đã ẩn mẹo phím tắt (localStorage, luôn bọc try/catch). */
export const KEY_TIP_STORAGE = 'pg:key-tip-dismissed';
