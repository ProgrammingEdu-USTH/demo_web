'use client';

// /settings: Tài khoản · Mật khẩu · Thông báo · Giao diện, viết bằng React + token (thay #page-settings legacy).
// API: GET/PUT /api/user, PUT /api/user/password, GET/PUT /api/notifications.
// Mỗi mục là một Card có form + nút lưu riêng; lỗi xác thực hiện dưới đúng ô (không toast), thành công mới toast.
// KHÔNG làm: "Đổi ảnh" (backend chưa có endpoint tải ảnh) và "Đăng xuất mọi thiết bị" (chưa có API riêng).
import { Eye, EyeOff, Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';

import {
  Avatar, Button, Card, CardTitle, ErrorState, Field, IconButton, Input, PageHeader, Skeleton, cn, useToast,
} from '@/components/ui';
import { ApiError, fetchJson, sendJson, useRemote } from '@/lib/fetch-json';

type User = { name?: string | null; email?: string | null; phone?: string | null; birthday?: string | null };
type NotifKey = 'emailNotif' | 'pushNotif' | 'studyRemind' | 'contentUpdate';
type Notif = Record<NotifKey, boolean>;

const SECTIONS = [
  { id: 'account', label: 'Tài khoản' },
  { id: 'password', label: 'Mật khẩu' },
  { id: 'notifications', label: 'Thông báo' },
  { id: 'appearance', label: 'Giao diện' },
] as const;

const NOTIFS: { key: NotifKey; label: string; hint: string }[] = [
  { key: 'emailNotif', label: 'Thông báo qua email', hint: 'Tóm tắt hoạt động và tin quan trọng.' },
  { key: 'pushNotif', label: 'Thông báo đẩy trên trình duyệt', hint: 'Nhận nhắc việc ngay cả khi không mở trang.' },
  { key: 'studyRemind', label: 'Nhắc học mỗi ngày', hint: 'Giữ chuỗi học (streak) không bị đứt.' },
  { key: 'contentUpdate', label: 'Bài học và khoá học mới', hint: 'Báo khi có nội dung mới.' },
];

// Báo trình duyệt hỏi trước khi rời trang nếu form còn thay đổi chưa lưu.
function useLeaveGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    // Link nội bộ của Next điều hướng phía client nên không kích hoạt beforeunload: chặn ở pha capture và hỏi lại.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      // Neo trong cùng trang (#account…) và link ra ngoài (đã có beforeunload) không cần hỏi.
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      if (!window.confirm('Bạn có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', h);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', h);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);
}

function CardSkeleton() {
  return <div role="status" aria-label="Đang tải" className="flex flex-col gap-4"><Skeleton className="h-11" /><Skeleton className="h-11" /></div>;
}

/* ───────── Tài khoản ───────── */
const bday = (u: User) => (u.birthday ? String(u.birthday).slice(0, 10) : '');

function AccountCard() {
  const [res, reload] = useRemote(() => fetchJson<User>('/api/user'));
  return (
    <Card id="account" className="scroll-mt-4">
      <CardTitle as="h2">Tài khoản</CardTitle>
      {res.state === 'loading' ? <CardSkeleton /> : res.state === 'error' ? (
        <ErrorState compact title="Không tải được thông tin" action={<Button variant="secondary" onClick={reload}>Thử lại</Button>} />
      ) : (
        <AccountForm initial={res.data} />
      )}
    </Card>
  );
}

// Tách khỏi lớp tải để state form khởi tạo thẳng từ dữ liệu (không cần effect đồng bộ).
function AccountForm({ initial }: { initial: User }) {
  const { toast } = useToast();
  const [base, setBase] = useState<User>(initial);
  const [form, setForm] = useState({ name: initial.name ?? '', email: initial.email ?? '', phone: initial.phone ?? '', birthday: bday(initial) });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Focus ô lỗi đầu tiên theo thuộc tính name (không giữ ref từng ô).
  const focusField = (k: string) => (formRef.current?.elements.namedItem(k) as HTMLInputElement | null)?.focus();

  const dirty = form.name !== (base.name ?? '') || form.email !== (base.email ?? '') || form.phone !== (base.phone ?? '') || form.birthday !== bday(base);
  useLeaveGuard(dirty);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Hãy nhập họ tên.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Email không hợp lệ.';
    if (Object.keys(next).length) return fail(next);
    setBusy(true);
    try {
      const d = await sendJson<{ user: User }>('/api/user', 'PUT', {
        name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), birthday: form.birthday,
      });
      setBase(d.user);
      setErrs({});
      toast({ title: 'Đã lưu thông tin tài khoản', variant: 'success' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không lưu được, thử lại nhé.';
      // Gán lỗi vào đúng ô theo nội dung thông báo của backend.
      const key = /email/i.test(msg) ? 'email' : /điện thoại|phone/i.test(msg) ? 'phone' : /ngày sinh/i.test(msg) ? 'birthday' : /họ tên|tên/i.test(msg) ? 'name' : 'form';
      fail({ [key]: msg });
    } finally {
      setBusy(false);
    }
  }
  function fail(next: Record<string, string>) {
    setErrs(next);
    const first = ['name', 'email', 'phone', 'birthday'].find((k) => next[k]);
    if (first) focusField(first);
  }
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="mt-4 flex max-w-xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar name={form.name || 'Học viên'} size="lg" />
        <p className="m-0 text-sm text-fg-muted">Ảnh đại diện tạo từ chữ cái đầu của tên.</p>
      </div>
      <Field label="Họ tên" required error={errs.name}><Input name="name" value={form.name} onChange={set('name')} autoComplete="name" maxLength={100} /></Field>
      <Field label="Email" required error={errs.email}><Input name="email" type="email" value={form.email} onChange={set('email')} autoComplete="email" /></Field>
      <Field label="Số điện thoại" error={errs.phone}><Input name="phone" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" /></Field>
      <Field label="Ngày sinh" error={errs.birthday}><Input name="birthday" type="date" value={form.birthday} onChange={set('birthday')} autoComplete="bday" /></Field>
      {errs.form ? <p role="alert" className="m-0 text-sm text-danger-soft-fg">{errs.form}</p> : null}
      <Button type="submit" variant="primary" loading={busy} disabled={!dirty} className="max-sm:w-full sm:self-start">Lưu thay đổi</Button>
    </form>
  );
}

/* ───────── Mật khẩu ───────── */
function PasswordInput({ show, onToggle, ...props }: { show: boolean; onToggle: () => void } & Omit<React.ComponentProps<'input'>, 'type'>) {
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} className="pr-12" {...props} />
      <IconButton
        label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        icon={show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="absolute right-0 top-1/2 size-11 sm:size-11 -translate-y-1/2"
      />
    </div>
  );
}

function PasswordCard() {
  const { toast } = useToast();
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const [show, setShow] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Focus ô lỗi đầu tiên theo thuộc tính name (không giữ ref từng ô).
  const focusField = (k: string) => (formRef.current?.elements.namedItem(k) as HTMLInputElement | null)?.focus();
  useLeaveGuard(Boolean(f.current || f.next || f.again));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n: Record<string, string> = {};
    if (!f.current) n.current = 'Nhập mật khẩu hiện tại.';
    if (f.next.length < 8) n.next = 'Mật khẩu mới phải có ít nhất 8 ký tự.';
    else if (f.next === f.current) n.next = 'Mật khẩu mới phải khác mật khẩu hiện tại.';
    if (f.again !== f.next) n.again = 'Mật khẩu nhập lại không khớp.';
    if (Object.keys(n).length) return fail(n);
    setBusy(true);
    try {
      await sendJson('/api/user/password', 'PUT', { current: f.current, new: f.next });
      setF({ current: '', next: '', again: '' });
      setErrs({});
      toast({ title: 'Đã đổi mật khẩu', description: 'Các thiết bị khác sẽ phải đăng nhập lại.', variant: 'success' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không đổi được mật khẩu, thử lại nhé.';
      fail(/hiện tại|không đúng/i.test(msg) ? { current: msg } : /mới/i.test(msg) ? { next: msg } : { form: msg });
    } finally {
      setBusy(false);
    }
  }
  function fail(n: Record<string, string>) {
    setErrs(n);
    const first = (['current', 'next', 'again'] as const).find((k) => n[k]);
    if (first) focusField(first);
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  return (
    <Card id="password" className="scroll-mt-4">
      <CardTitle as="h2">Mật khẩu</CardTitle>
      <form ref={formRef} onSubmit={submit} noValidate className="mt-4 flex max-w-xl flex-col gap-4">
        <Field label="Mật khẩu hiện tại" required error={errs.current}>
          <PasswordInput name="current" show={show} onToggle={() => setShow((s) => !s)} value={f.current} onChange={set('current')} autoComplete="current-password" />
        </Field>
        <Field label="Mật khẩu mới" required hint="Từ 8 đến 128 ký tự." error={errs.next}>
          <PasswordInput name="next" show={show} onToggle={() => setShow((s) => !s)} value={f.next} onChange={set('next')} autoComplete="new-password" />
        </Field>
        <Field label="Nhập lại mật khẩu mới" required error={errs.again}>
          <PasswordInput name="again" show={show} onToggle={() => setShow((s) => !s)} value={f.again} onChange={set('again')} autoComplete="new-password" />
        </Field>
        {errs.form ? <p role="alert" className="m-0 text-sm text-danger-soft-fg">{errs.form}</p> : null}
        <Button type="submit" variant="primary" loading={busy} disabled={!f.current && !f.next && !f.again} className="max-sm:w-full sm:self-start">Đổi mật khẩu</Button>
      </form>
    </Card>
  );
}

/* ───────── Thông báo ───────── */
function NotificationsCard() {
  const [res, reload] = useRemote(() => fetchJson<{ settings: Notif }>('/api/notifications'));
  return (
    <Card id="notifications" className="scroll-mt-4">
      <CardTitle as="h2">Thông báo</CardTitle>
      {res.state === 'loading' ? <div className="mt-4"><CardSkeleton /></div> : res.state === 'error' ? (
        <ErrorState compact title="Không tải được cài đặt thông báo" action={<Button variant="secondary" onClick={reload}>Thử lại</Button>} />
      ) : (
        <NotificationsList initial={res.data.settings} />
      )}
    </Card>
  );
}

function NotificationsList({ initial }: { initial: Notif }) {
  const { toast } = useToast();
  const [vals, setVals] = useState<Notif>(initial);

  // Lưu ngay khi gạt công tắc; lỗi thì trả công tắc về giá trị cũ và báo lại.
  async function toggle(key: NotifKey, value: boolean) {
    setVals((v) => ({ ...v, [key]: value }));
    try {
      await sendJson('/api/notifications', 'PUT', { [key]: value });
      toast({ title: 'Đã lưu', variant: 'success', duration: 1800 });
    } catch (err) {
      setVals((v) => ({ ...v, [key]: !value }));
      toast({ title: err instanceof ApiError ? err.message : 'Không lưu được cài đặt', variant: 'danger' });
    }
  }

  return (
    <ul className="m-0 mt-2 flex max-w-xl list-none flex-col p-0">
      {NOTIFS.map((n) => (
        <li key={n.key} className="border-b border-solid border-border last:border-b-0">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 py-3">
            <input type="checkbox" checked={vals[n.key]} onChange={(e) => void toggle(n.key, e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary" />
            <span className="flex flex-col"><span className="text-sm font-semibold">{n.label}</span><span className="text-xs text-fg-muted">{n.hint}</span></span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/* ───────── Giao diện ───────── */
type Pref = 'light' | 'dark' | 'system';

function applyPref(p: Pref) {
  const dark = p === 'dark' || (p === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.body.classList.toggle('dark', dark);
  document.body.classList.toggle('light', !dark);
  // Layout gốc chỉ đọc 'theme' (dark|khác) nên ghi giá trị đã quy đổi; 'theme_pref' nhớ lựa chọn "theo hệ thống".
  try { localStorage.setItem('theme', dark ? 'dark' : 'light'); localStorage.setItem('theme_pref', p); } catch { /* chế độ riêng tư */ }
  window.dispatchEvent(new Event(PREF_EVENT));
}

const PREF_EVENT = 'pe:theme-pref';
const subscribePref = (cb: () => void) => { window.addEventListener(PREF_EVENT, cb); return () => window.removeEventListener(PREF_EVENT, cb); };
function readPref(): Pref {
  try { if (localStorage.getItem('theme_pref') === 'system') return 'system'; } catch { /* bỏ qua */ }
  return document.body.classList.contains('dark') ? 'dark' : 'light';
}

function AppearanceCard() {
  // Đọc lựa chọn từ body/localStorage qua useSyncExternalStore: SSR luôn 'light', client tự cập nhật sau hydrate.
  const pref = useSyncExternalStore(subscribePref, readPref, () => 'light' as Pref);
  useEffect(() => { if (pref === 'system') applyPref('system'); }, [pref]);
  const opts: { v: Pref; label: string; icon: React.ReactNode }[] = [
    { v: 'light', label: 'Sáng', icon: <Sun aria-hidden="true" className="size-5" /> },
    { v: 'dark', label: 'Tối', icon: <Moon aria-hidden="true" className="size-5" /> },
    { v: 'system', label: 'Theo hệ thống', icon: <Monitor aria-hidden="true" className="size-5" /> },
  ];
  return (
    <Card id="appearance" className="scroll-mt-4">
      <fieldset className="m-0 border-0 p-0">
        <legend className="p-0"><CardTitle as="h2">Giao diện</CardTitle></legend>
        <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-3">
          {opts.map((o) => (
            <label key={o.v} className={cn('flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-solid p-3 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary', pref === o.v ? 'border-primary bg-primary-soft text-primary-soft-fg' : 'border-border hover:bg-surface-2')}>
              <input type="radio" name="theme" value={o.v} checked={pref === o.v} onChange={() => applyPref(o.v)} className="sr-only" />
              {o.icon}{o.label}
            </label>
          ))}
        </div>
      </fieldset>
    </Card>
  );
}

export default function SettingsView() {
  const [active, setActive] = useState<string>('account');
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-8 sm:px-6 lg:px-8">
      <PageHeader title="Cài đặt" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Mục cài đặt" className="-mx-4 overflow-x-auto px-4 lg:sticky lg:top-4 lg:mx-0 lg:self-start lg:overflow-visible lg:px-0">
          <ul className="m-0 flex list-none gap-1 p-0 lg:flex-col">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={() => setActive(s.id)}
                  aria-current={active === s.id ? 'true' : undefined}
                  className={cn('ui-focus-ring flex min-h-11 items-center whitespace-nowrap rounded-md px-3 text-sm font-semibold transition-colors', active === s.id ? 'bg-primary-soft text-primary-soft-fg' : 'text-fg-muted hover:bg-surface-2')}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-col gap-4">
          <AccountCard />
          <PasswordCard />
          <NotificationsCard />
          <AppearanceCard />
        </div>
      </div>
    </div>
  );
}
