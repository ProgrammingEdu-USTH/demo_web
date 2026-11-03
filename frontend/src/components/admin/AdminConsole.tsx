'use client';

// Bảng điều khiển quản trị: thay admin.inline.js (DOM thủ công) bằng React + component ui.
// Giữ nguyên toàn bộ thao tác & API cũ: GET/POST /api/admin/courses, PUT/DELETE /api/admin/courses/:id,
// GET /api/admin/courses/:id/lessons, POST/PUT/DELETE /api/admin/lessons(/:id). Backend vẫn là chốt chặn
// quyền (403 nếu không phải admin) — trang chỉ hiển thị trạng thái "không có quyền".
import Link from 'next/link';
import { Palette, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import LessonImport from '@/components/admin/LessonImport';
import {
  Badge,
  Button,
  buttonVariants,
  Container,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Select,
  Sheet,
  Skeleton,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Textarea,
  useToast,
} from '@/components/ui';
import { apiFetch } from '@/lib/api';

type Course = {
  id: string;
  title?: string;
  subtitle?: string;
  description?: string;
  level?: string;
  duration?: string;
  tag?: string;
  image?: string;
  color?: string;
  accent_color?: string;
  lessonCount?: number;
  lessons?: number;
};
type Lesson = { id: number; module?: string; title?: string; content?: string; sort_order?: number };

// Lỗi có mã trạng thái để phân biệt 403 (không có quyền) với lỗi tải thường.
class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function api<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* thân rỗng (vd DELETE) */
  }
  if (!res.ok) {
    const msg = data.error ?? data.message;
    throw new ApiError(typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join(', ') : 'Lỗi không xác định', res.status);
  }
  return data as T;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

const EMPTY_COURSE = { id: '', title: '', subtitle: '', description: '', level: '', duration: '', tag: '', image: '', color: '', accent_color: '' };
const EMPTY_LESSON = { module: '', title: '', content: '', sort: '0' };

type Confirm = { kind: 'course'; id: string } | { kind: 'lesson'; id: number } | null;

export default function AdminConsole() {
  const { toast } = useToast();
  const [tab, setTab] = useState('courses');

  // ── Khoá học ──
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [courseErr, setCourseErr] = useState<ApiError | null>(null);
  const [activeCourse, setActiveCourse] = useState('');

  // Tải trong effect rồi setState ở callback (không đồng bộ); "tải lại" = tăng số phiên bản.
  const [cVer, setCVer] = useState(0);
  const loadCourses = useCallback(() => setCVer((v) => v + 1), []);
  useEffect(() => {
    let alive = true;
    api<{ courses: Course[] }>('/api/admin/courses').then(
      ({ courses: list }) => {
        if (!alive) return;
        setCourses(list ?? []);
        setCourseErr(null);
      },
      (e) => alive && setCourseErr(e as ApiError),
    );
    return () => {
      alive = false;
    };
  }, [cVer]);

  // ── Bài giảng của khoá đang chọn ──
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [lessonErr, setLessonErr] = useState(false);
  const [query, setQuery] = useState('');

  const [lVer, setLVer] = useState(0);
  const loadLessons = useCallback(() => setLVer((v) => v + 1), []);
  useEffect(() => {
    if (!activeCourse) return;
    let alive = true;
    api<{ lessons: Lesson[] }>(`/api/admin/courses/${encodeURIComponent(activeCourse)}/lessons`).then(
      ({ lessons: list }) => {
        if (!alive) return;
        setLessons(list ?? []);
        setLessonErr(false);
      },
      () => alive && setLessonErr(true),
    );
    return () => {
      alive = false;
    };
  }, [activeCourse, lVer]);

  // Chọn khoá: xoá danh sách cũ ở chỗ xử lý sự kiện (không phải trong effect).
  function chooseCourse(id: string) {
    setActiveCourse(id);
    setLessons(null);
    setLessonErr(false);
    setQuery('');
  }

  // ── Sheet sửa khoá ──
  const [courseOpen, setCourseOpen] = useState(false);
  const [editCourseId, setEditCourseId] = useState<string | null>(null); // null = tạo mới
  const [cForm, setCForm] = useState(EMPTY_COURSE);
  const [saving, setSaving] = useState(false);

  function openCourse(c?: Course) {
    setEditCourseId(c ? c.id : null);
    setCForm(
      c
        ? {
            id: c.id,
            title: c.title ?? '',
            subtitle: c.subtitle ?? '',
            description: c.description ?? '',
            level: c.level ?? '',
            duration: c.duration ?? '',
            tag: c.tag ?? '',
            image: c.image ?? '',
            color: c.color ?? '',
            accent_color: c.accent_color ?? '',
          }
        : EMPTY_COURSE,
    );
    setCourseOpen(true);
  }

  async function saveCourse() {
    const body = Object.fromEntries(Object.entries(cForm).map(([k, v]) => [k, v.trim()]));
    setSaving(true);
    try {
      if (editCourseId) {
        await api(`/api/admin/courses/${encodeURIComponent(editCourseId)}`, {
          method: 'PUT',
          headers: jsonHeaders,
          body: JSON.stringify(body),
        });
        toast({ title: 'Đã cập nhật khoá học', variant: 'success' });
      } else {
        await api('/api/admin/courses', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) });
        toast({ title: 'Đã thêm khoá học', variant: 'success' });
      }
      setCourseOpen(false);
      void loadCourses();
    } catch (e) {
      toast({ title: 'Không lưu được khoá học', description: (e as Error).message, variant: 'danger' });
    } finally {
      setSaving(false);
    }
  }

  // ── Sheet sửa bài ──
  const [lessonOpen, setLessonOpen] = useState(false);
  const [editLessonId, setEditLessonId] = useState<number | null>(null);
  const [lForm, setLForm] = useState(EMPTY_LESSON);

  function openLesson(l?: Lesson) {
    setEditLessonId(l ? l.id : null);
    setLForm(
      l
        ? { module: l.module ?? '', title: l.title ?? '', content: l.content ?? '', sort: String(l.sort_order ?? 0) }
        : EMPTY_LESSON,
    );
    setLessonOpen(true);
  }

  async function saveLesson() {
    const body = {
      course_id: activeCourse,
      module: lForm.module.trim(),
      title: lForm.title.trim(),
      content: lForm.content.trim(),
      sort_order: parseInt(lForm.sort.trim() || '0', 10),
    };
    setSaving(true);
    try {
      if (editLessonId) {
        await api(`/api/admin/lessons/${editLessonId}`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify(body) });
        toast({ title: 'Đã cập nhật bài giảng', variant: 'success' });
      } else {
        await api('/api/admin/lessons', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) });
        toast({ title: 'Đã thêm bài giảng', variant: 'success' });
      }
      setLessonOpen(false);
      void loadLessons();
      void loadCourses(); // cập nhật cột "Bài"
    } catch (e) {
      toast({ title: 'Không lưu được bài giảng', description: (e as Error).message, variant: 'danger' });
    } finally {
      setSaving(false);
    }
  }

  // ── Xoá (luôn qua hộp thoại xác nhận, thay confirm() của trình duyệt) ──
  const [confirm, setConfirm] = useState<Confirm>(null);

  async function doDelete() {
    if (!confirm) return;
    setSaving(true);
    try {
      if (confirm.kind === 'course') {
        await api(`/api/admin/courses/${encodeURIComponent(confirm.id)}`, { method: 'DELETE' });
        toast({ title: 'Đã xoá khoá học', variant: 'success' });
        if (activeCourse === confirm.id) {
          chooseCourse('');
          setLessons(null);
        }
      } else {
        await api(`/api/admin/lessons/${confirm.id}`, { method: 'DELETE' });
        toast({ title: 'Đã xoá bài giảng', variant: 'success' });
        void loadLessons();
      }
      setConfirm(null);
      void loadCourses();
    } catch (e) {
      toast({ title: 'Không xoá được', description: (e as Error).message, variant: 'danger' });
    } finally {
      setSaving(false);
    }
  }

  const activeTitle = courses?.find((c) => c.id === activeCourse)?.title || activeCourse;
  const shownLessons = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!lessons) return [];
    return q
      ? lessons.filter((l) => `${l.title ?? ''} ${l.module ?? ''}`.toLowerCase().includes(q))
      : lessons;
  }, [lessons, query]);

  const setC = (k: keyof typeof EMPTY_COURSE) => (e: { target: { value: string } }) =>
    setCForm((f) => ({ ...f, [k]: e.target.value }));
  const setL = (k: keyof typeof EMPTY_LESSON) => (e: { target: { value: string } }) =>
    setLForm((f) => ({ ...f, [k]: e.target.value }));

  // 403: người dùng không phải admin. Chặn cả trang thay vì để bảng trống khó hiểu.
  if (courseErr?.status === 403) {
    return (
      <Container>
        <ErrorState
          title="Bạn không có quyền vào trang quản trị"
          description="Trang này chỉ dành cho quản trị viên."
          action={<Link href="/dashboard" className={buttonVariants({ variant: 'primary' })}>Về trang học</Link>}
        />
      </Container>
    );
  }

  return (
    <Container>
      <PageHeader
        eyebrow="Admin"
        title="Quản trị"
        description="Quản lý khoá học, bài giảng và nhập bài từ file."
        actions={
          <Button variant="primary" onClick={() => setTab('import')}>
            <Upload aria-hidden="true" className="size-4" /> Import bài
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabList label="Mục quản trị">
            <Tab value="courses">Khoá học</Tab>
            <Tab value="lessons">Bài học</Tab>
            <Tab value="import">Import</Tab>
          </TabList>
          <Link href="/admin/lesson-chrome-demo" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <Palette aria-hidden="true" className="size-4" /> Công cụ thiết kế
          </Link>
        </div>

        {/* ───────── Khoá học ───────── */}
        <TabPanel value="courses" className="pt-4">
          <div className="mb-3 flex justify-end">
            <Button variant="secondary" onClick={() => openCourse()}>
              <Plus aria-hidden="true" className="size-4" /> Thêm khoá học
            </Button>
          </div>
          {courseErr ? (
            <ErrorState
              compact
              title="Không tải được danh sách khoá học"
              description={courseErr.message}
              action={<Button onClick={() => { setCourseErr(null); void loadCourses(); }}>Thử lại</Button>}
            />
          ) : !courses ? (
            <div className="flex flex-col gap-2" aria-busy="true" aria-label="Đang tải">
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : courses.length === 0 ? (
            <EmptyState
              compact
              title="Chưa có khoá học nào"
              action={<Button variant="primary" onClick={() => openCourse()}>Thêm khoá học</Button>}
            />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {courses.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface p-3 sm:flex-row sm:items-center sm:px-4"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-semibold text-fg">{c.title || c.id}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                      <code>{c.id}</code>
                      <Badge variant="neutral">{c.lessonCount ?? c.lessons ?? 0} bài</Badge>
                      {c.level ? <Badge variant="outline">{c.level}</Badge> : null}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="soft" onClick={() => { chooseCourse(c.id); setTab('lessons'); }}>
                      Xem bài
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openCourse(c)}>
                      <Pencil aria-hidden="true" className="size-4" /> Sửa
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'course', id: c.id })}>
                      <Trash2 aria-hidden="true" className="size-4" /> Xoá
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabPanel>

        {/* ───────── Bài học ───────── */}
        <TabPanel value="lessons" className="pt-4">
          <div className="mb-3 grid gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto] sm:items-end">
            <Field label="Khoá học">
              <Select value={activeCourse} onChange={(e) => chooseCourse(e.target.value)}>
                <option value="">— Chọn khoá —</option>
                {courses?.map((c) => (
                  <option key={c.id} value={c.id}>{c.title || c.id}</option>
                ))}
              </Select>
            </Field>
            <Field label="Tìm bài" hideLabel>
              <Input
                type="search"
                leadingIcon={<Search aria-hidden="true" />}
                placeholder="Tìm theo tiêu đề hoặc module…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={!activeCourse}
              />
            </Field>
            <Button variant="secondary" disabled={!activeCourse} onClick={() => openLesson()}>
              <Plus aria-hidden="true" className="size-4" /> Thêm bài
            </Button>
          </div>

          {!activeCourse ? (
            <EmptyState compact title="Chọn một khoá học" description="Chọn khoá ở trên để xem và sửa bài giảng." />
          ) : lessonErr ? (
            <ErrorState
              compact
              title="Không tải được bài giảng"
              action={<Button onClick={() => { setLessonErr(false); setLessons(null); void loadLessons(); }}>Thử lại</Button>}
            />
          ) : !lessons ? (
            <div className="flex flex-col gap-2" aria-busy="true" aria-label="Đang tải">
              {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : shownLessons.length === 0 ? (
            <EmptyState
              compact
              title={query ? 'Không có bài khớp từ khoá' : 'Chưa có bài trong khoá này'}
              action={
                query ? undefined : (
                  <Button variant="primary" onClick={() => setTab('import')}>Import bài</Button>
                )
              }
            />
          ) : (
            <>
              <p className="mb-2 text-sm text-fg-muted">Bài giảng — {activeTitle} · {shownLessons.length} bài</p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {shownLessons.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-col gap-3 rounded-lg border border-solid border-border bg-surface p-3 sm:flex-row sm:items-center sm:px-4"
                  >
                    <span className="w-8 shrink-0 font-mono text-sm text-fg-muted">{l.sort_order ?? 0}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-semibold text-fg">{l.title || '(chưa có tiêu đề)'}</span>
                      {l.module ? <span className="text-xs text-fg-muted">{l.module}</span> : null}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openLesson(l)}>
                        <Pencil aria-hidden="true" className="size-4" /> Sửa
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'lesson', id: l.id })}>
                        <Trash2 aria-hidden="true" className="size-4" /> Xoá
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </TabPanel>

        {/* ───────── Import ───────── */}
        <TabPanel value="import" className="pt-4">
          <LessonImport onSaved={() => { void loadCourses(); void loadLessons(); }} />
        </TabPanel>
      </Tabs>

      {/* Sửa/Thêm khoá */}
      <Sheet
        side="auto"
        open={courseOpen}
        onOpenChange={setCourseOpen}
        title={editCourseId ? `Sửa khoá học: ${editCourseId}` : 'Thêm khoá học'}
        footer={
          <>
            <Button variant="primary" loading={saving} onClick={() => void saveCourse()}>Lưu</Button>
            <Button onClick={() => setCourseOpen(false)}>Huỷ</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 pb-2">
          <Field label="Id" hint="Mã khoá, không đổi được sau khi tạo.">
            <Input value={cForm.id} onChange={setC('id')} placeholder="vd: python" disabled={editCourseId !== null} />
          </Field>
          <Field label="Tiêu đề"><Input value={cForm.title} onChange={setC('title')} /></Field>
          <Field label="Phụ đề"><Input value={cForm.subtitle} onChange={setC('subtitle')} /></Field>
          <Field label="Mô tả"><Textarea value={cForm.description} onChange={setC('description')} /></Field>
          <Field label="Cấp độ"><Input value={cForm.level} onChange={setC('level')} /></Field>
          <Field label="Thời lượng"><Input value={cForm.duration} onChange={setC('duration')} /></Field>
          <Field label="Tag"><Input value={cForm.tag} onChange={setC('tag')} /></Field>
          <Field label="Đường dẫn ảnh"><Input value={cForm.image} onChange={setC('image')} /></Field>
          <Field label="Màu (color)"><Input value={cForm.color} onChange={setC('color')} /></Field>
          <Field label="Màu nhấn (accent_color)"><Input value={cForm.accent_color} onChange={setC('accent_color')} /></Field>
        </div>
      </Sheet>

      {/* Sửa/Thêm bài */}
      <Sheet
        side="auto"
        open={lessonOpen}
        onOpenChange={setLessonOpen}
        title={editLessonId ? 'Sửa bài giảng' : `Thêm bài giảng — ${activeTitle}`}
        footer={
          <>
            <Button variant="primary" loading={saving} onClick={() => void saveLesson()}>Lưu</Button>
            <Button onClick={() => setLessonOpen(false)}>Huỷ</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 pb-2">
          <Field label="Module"><Input value={lForm.module} onChange={setL('module')} /></Field>
          <Field label="Tiêu đề bài giảng"><Input value={lForm.title} onChange={setL('title')} /></Field>
          <Field label="Nội dung"><Textarea rows={10} value={lForm.content} onChange={setL('content')} /></Field>
          <Field label="Thứ tự"><Input type="number" value={lForm.sort} onChange={setL('sort')} /></Field>
        </div>
      </Sheet>

      {/* Xác nhận xoá — nút nguy hiểm đặt cuối */}
      <Dialog
        size="sm"
        open={confirm !== null}
        onOpenChange={(o) => { if (!o) setConfirm(null); }}
        title={confirm?.kind === 'course' ? `Xoá khoá học "${confirm.id}"?` : 'Xoá bài giảng này?'}
        description={
          confirm?.kind === 'course'
            ? 'Toàn bộ bài giảng của khoá cũng bị xoá. Không hoàn tác được.'
            : 'Không hoàn tác được.'
        }
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Huỷ</Button>
            <Button variant="danger" loading={saving} onClick={() => void doDelete()}>Xoá</Button>
          </>
        }
      >
        <div />
      </Dialog>
    </Container>
  );
}
