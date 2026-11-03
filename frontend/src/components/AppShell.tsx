'use client';

// Vỏ ứng dụng mới (design/SYSTEM.md §4): sidebar (≥1024) · rail icon (640–1023) · topbar + bottom-nav (<640).
// Chế độ tập trung (bài học, Playground, trận Arena): không dựng chrome nào — trang tự có thanh trên gọn.
import {
  Home, BookOpen, Code2, Swords, Users, User, Settings, ShieldCheck, Moon, Sun, LogOut, type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import NotificationBell from '@/components/NotificationBell';
import { apiFetch } from '@/lib/api';
import { Avatar, PromptMark, Sheet, SkipLink, cn } from '@/components/ui';

type NavItem = { href: string; label: string; icon: LucideIcon; match: string[] };

// Menu chính 5 mục — DECISIONS #7. `match`: tiền tố đường dẫn làm mục sáng lên
// (khoá học còn có /courses/[id] và /lesson/*, nhưng bài học là chế độ tập trung nên không tới đây).
const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Trang chủ', icon: Home, match: ['/dashboard'] },
  { href: '/courses', label: 'Khoá học', icon: BookOpen, match: ['/courses', '/practice'] },
  { href: '/playground', label: 'Playground', icon: Code2, match: ['/playground'] },
  { href: '/arena', label: 'Đấu trường', icon: Swords, match: ['/arena'] },
  { href: '/community', label: 'Cộng đồng', icon: Users, match: ['/community'] },
];

/** Màn hình cần toàn bộ chiều cao cho editor/đề: ẩn sidebar & bottom-nav. */
export function isFocusPath(pathname: string): boolean {
  return (
    pathname.startsWith('/lesson/') ||
    pathname === '/interface' ||
    pathname.startsWith('/card/') ||
    pathname === '/playground' ||
    pathname.startsWith('/playground/') ||
    pathname.startsWith('/arena/match/')
  );
}

type Me = { name: string; role?: string; avatar?: string | null };

function isActive(pathname: string, item: NavItem): boolean {
  return item.match.some((m) => pathname === m || pathname.startsWith(m + '/'));
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const [me, setMe] = useState<Me | null>(null);
  // Menu mở gắn với đường dẫn lúc mở: đổi trang thì tự coi như đóng (không cần setState trong effect).
  const [menuAt, setMenuAt] = useState<string | null>(null);
  const menuOpen = menuAt === pathname;
  const setMenuOpen = (open: boolean) => setMenuAt(open ? pathname : null);
  const [dark, setDark] = useState(false);
  // XP cho chip ở topbar mobile (desktop đã có ở trang); lỗi thì không hiện chip.
  const [xp, setXp] = useState<number | null>(null);

  // Thông tin người dùng cho avatar/menu; lỗi mạng thì giữ trạng thái "chưa biết" (menu vẫn có Đăng xuất).
  useEffect(() => {
    let alive = true;
    apiFetch('/api/user')
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (alive && u && typeof u.name === 'string') setMe({ name: u.name, role: u.role, avatar: u.avatar_url ?? u.avatar ?? null });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);


  useEffect(() => {
    let alive = true;
    apiFetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d.xp === 'number') setXp(d.xp);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Đọc chủ đề thật từ body lúc mở menu (script trong layout gốc đặt nó trước khi vẽ).
  const openMenu = () => {
    setDark(document.body.classList.contains('dark'));
    setMenuOpen(true);
  };

  // Cùng cách main.js toggleTheme(): đặt cả `dark` lẫn `light` trên body + lưu localStorage('theme').
  const toggleTheme = useCallback(() => {
    const next = !document.body.classList.contains('dark');
    document.body.classList.toggle('dark', next);
    document.body.classList.toggle('light', !next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch { /* chế độ riêng tư */ }
    setDark(next);
  }, []);

  if (isFocusPath(pathname)) {
    return <div className="ui-scope min-h-dvh bg-bg font-sans text-fg">{children}</div>;
  }

  const name = me?.name ?? 'Tài khoản';

  return (
    <div className="ui-scope min-h-dvh bg-bg font-sans text-fg">
      <SkipLink />

      {/* Sidebar (≥1024) và rail (640–1023): cùng một phần tử, nhãn chỉ hiện từ lg. */}
      <aside className="fixed inset-y-0 left-0 z-30 w-[72px] flex-col border-r border-border bg-surface max-sm:hidden sm:flex lg:w-sidebar">
        <Link href="/dashboard" className="ui-focus-ring flex h-topbar items-center justify-center gap-2 text-lg font-bold tracking-tight lg:justify-start lg:px-5" title="Programming EDU">
          <PromptMark />
          <span className="max-lg:hidden">Programming EDU</span>
        </Link>
        <nav aria-label="Điều hướng chính" className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'ui-focus-ring flex min-h-11 items-center justify-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors lg:justify-start',
                  active ? 'bg-primary-soft text-primary-soft-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                <item.icon className="size-5 shrink-0" aria-hidden="true" />
                <span className="max-lg:hidden">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-1 border-t border-border p-3">
          <div className="flex justify-center lg:justify-start lg:px-1">
            <NotificationBell placement="beside" />
          </div>
          <button
            type="button"
            onClick={() => openMenu()}
            title={name}
            aria-haspopup="dialog"
            className="ui-focus-ring flex min-h-11 w-full items-center justify-center gap-3 rounded-md px-2 text-left text-sm transition-colors hover:bg-surface-2 lg:justify-start"
          >
            <Avatar name={name} src={me?.avatar} size="sm" />
            <span className="min-w-0 truncate font-semibold max-lg:hidden">{name}</span>
          </button>
        </div>
      </aside>

      {/* Topbar mobile */}
      <header className="sticky top-0 z-30 flex h-topbar items-center justify-between border-b border-border bg-surface px-4 sm:hidden">
        <Link href="/dashboard" className="ui-focus-ring flex min-h-11 items-center gap-2 text-base font-bold tracking-tight">
          <PromptMark />
          Programming EDU
        </Link>
        <div className="flex items-center gap-1">
        {xp !== null && (
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold tabular-nums text-fg-muted" title="Điểm kinh nghiệm">
            {xp} XP
          </span>
        )}
        <NotificationBell />
        <button
          type="button"
          onClick={() => openMenu()}
          aria-label="Mở menu tài khoản"
          aria-haspopup="dialog"
          className="ui-focus-ring flex size-11 items-center justify-center rounded-full"
        >
          <Avatar name={name} src={me?.avatar} size="sm" />
        </button>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="min-w-0 pb-[calc(theme(spacing.bottomnav)+env(safe-area-inset-bottom))] sm:ml-[72px] sm:pb-0 lg:ml-sidebar"
      >
        {children}
      </main>

      {/* Bottom-nav mobile */}
      <nav
        aria-label="Điều hướng chính"
        className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(theme(spacing.bottomnav)+env(safe-area-inset-bottom))] grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'ui-focus-ring relative flex min-w-0 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors',
                active ? 'text-primary' : 'text-fg-muted',
              )}
            >
              {active && <span aria-hidden="true" className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" />}
              <item.icon className="size-5" aria-hidden="true" />
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title={name} description={me?.role === 'admin' ? 'Quản trị viên' : 'Học viên'}>
        <ul className="flex flex-col gap-1 py-2">
          <MenuLink href="/profile" icon={User}>Hồ sơ</MenuLink>
          <MenuLink href="/settings" icon={Settings}>Cài đặt</MenuLink>
          {me?.role === 'admin' && <MenuLink href="/admin" icon={ShieldCheck}>Quản trị</MenuLink>}
          <li>
            <button type="button" onClick={toggleTheme} className={menuItemCls}>
              {dark ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
              {dark ? 'Giao diện sáng' : 'Giao diện tối'}
            </button>
          </li>
          <li>
            {/* /auth/logout là trang client thu hồi token rồi về "/" — điều hướng cứng cho chắc. */}
            <a href="/auth/logout" className={cn(menuItemCls, 'text-danger')}>
              <LogOut className="size-5" aria-hidden="true" />
              Đăng xuất
            </a>
          </li>
        </ul>
      </Sheet>
    </div>
  );
}

const menuItemCls =
  'ui-focus-ring flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-base transition-colors hover:bg-surface-2';

function MenuLink({ href, icon: Icon, children }: { href: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className={menuItemCls}>
        <Icon className="size-5" aria-hidden="true" />
        {children}
      </Link>
    </li>
  );
}
