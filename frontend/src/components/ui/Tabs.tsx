'use client';

import Link from 'next/link';
import {
  createContext,
  useContext,
  useId,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { cn } from './cn';

/*
 * Hai loại tab:
 *  - <Tabs>/<TabList>/<Tab>/<TabPanel>: đổi nội dung TRONG trang (mẫu WAI-ARIA tabs:
 *    mũi tên trái/phải/Home/End để chuyển, chỉ tab đang chọn nằm trong thứ tự Tab).
 *  - <TabNav>/<TabNavLink>: mỗi tab là một ROUTE (/courses ↔ /courses/roadmap) → là
 *    link thật với aria-current, để mở tab mới / chia sẻ URL / nút Back đều chạy.
 * Cả hai cuộn ngang trên mobile thay vì xuống dòng.
 */

type TabsCtx = { value: string; setValue: (v: string) => void; baseId: string };
const TabsContext = createContext<TabsCtx | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tab/TabPanel phải nằm trong <Tabs>');
  return ctx;
}

export type TabsProps = {
  /** Có `value` = điều khiển từ ngoài (vd đồng bộ ?tab= trên URL). */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: ReactNode;
};

export function Tabs({ value, defaultValue = '', onValueChange, className, children }: TabsProps) {
  const [inner, setInner] = useState(defaultValue);
  const baseId = useId();
  const current = value ?? inner;
  const setValue = (v: string) => {
    if (value === undefined) setInner(v);
    onValueChange?.(v);
  };
  return (
    <TabsContext.Provider value={{ value: current, setValue, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

// Thanh tab: gạch chân dưới cả hàng, cuộn ngang khi chật (mobile 390px).
const listBase =
  'ui-no-scrollbar -mx-4 flex overflow-x-auto border-0 border-b border-solid border-border px-4 sm:mx-0 sm:px-0';

const tabBase = [
  'ui-focus-ring relative inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap px-3 text-sm font-semibold',
  'text-fg-muted no-underline transition-colors duration-fast hover:text-fg',
  // Vạch chọn 2px dưới tab — tín hiệu ngoài màu chữ, rõ cả với người mù màu.
  'after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent',
  'aria-selected:text-fg aria-selected:after:bg-primary aria-[current=page]:text-fg aria-[current=page]:after:bg-primary',
  '[&_svg]:size-4',
].join(' ');

export function TabList({ className, children, label }: { className?: string; children: ReactNode; label: string }) {
  // Điều hướng bàn phím: tìm các tab anh em và chuyển focus + chọn luôn (tự kích hoạt).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
    const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  };
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cn(listBase, className)}>
      {children}
    </div>
  );
}

export type TabProps = Omit<ComponentProps<'button'>, 'value'> & { value: string };

export function Tab({ value, className, children, ...props }: TabProps) {
  const { value: current, setValue, baseId } = useTabs();
  const selected = current === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      onClick={() => setValue(value)}
      className={cn(tabBase, className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabPanel({ value, className, children }: { value: string; className?: string; children: ReactNode }) {
  const { value: current, baseId } = useTabs();
  if (current !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
      className={cn('outline-none pt-4 sm:pt-6', className)}
    >
      {children}
    </div>
  );
}

/** Tab dạng link cho các route anh em. Trang tự quyết `active` (so pathname). */
export function TabNav({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <nav aria-label={label} className={cn(listBase, className)}>
      {children}
    </nav>
  );
}

export type TabNavLinkProps = ComponentProps<typeof Link> & { active?: boolean };

export function TabNavLink({ active = false, className, ...props }: TabNavLinkProps) {
  // min-h-11: chốt chặn vùng bấm ≥ 44px (WCAG 2.5.5) kể cả khi CSS khác ghi đè `height` của <a>
  // (review B5 đo tab Đấu trường ~22px ở 390px). Không đổi giao diện vì tabBase vốn đã h-11.
  return <Link aria-current={active ? 'page' : undefined} className={cn(tabBase, 'min-h-11', className)} {...props} />;
}
