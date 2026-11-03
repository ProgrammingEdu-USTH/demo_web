// Dữ liệu khoá học dùng chung cho vỏ bài học (LessonShell): danh sách bài lấy từ curricula.json
// (không chờ API) + tính trạng thái done/current/locked ĐÚNG logic trang khoá học (courses/[courseId]).
import CURRICULA_JSON from '@/lib/curricula.json';

type Curriculum = { modules?: { title: string; lessons: string[] }[] };
const CURRICULA = CURRICULA_JSON.CURRICULA as Record<string, Curriculum>;

export const COURSE_NAMES: Record<string, string> = {
  python: 'Python',
  python_advanced: 'Python Advanced',
  java: 'Java',
  htmlcss: 'HTML & CSS',
  cpp: 'C/C++',
  db_design: 'Thiết kế CSDL',
  db_design_tc: 'Thiết kế CSDL (tư chọn)',
  db_design_nc: 'Thiết kế CSDL (nâng cao)',
};

/** Các khoá mà trang bài nhận ?lesson=<chỉ số 0-based> — chỉ khoá này mới có mục lục bấm được. */
const LINKABLE = ['python', 'python_advanced', 'db_design', 'db_design_tc', 'db_design_nc'];

export type TocLesson = { index: number; title: string; module: string };

export function courseLessons(courseId: string): TocLesson[] {
  const out: TocLesson[] = [];
  for (const m of CURRICULA[courseId]?.modules ?? []) {
    for (const title of m.lessons) out.push({ index: out.length, title, module: m.title });
  }
  return out;
}

export const isLinkableCourse = (courseId: string) => LINKABLE.includes(courseId);

export const lessonHref = (courseId: string, index: number) => `/lesson/${courseId}?lesson=${index}`;

export type Progress = { known: boolean; done: Set<number>; next: number };

/** `enrollment` là bản ghi từ /api/enrolled. completedLessonNumbers là số thứ tự 1-based. */
export function progressFrom(enrollment: Record<string, unknown> | null, total: number): Progress {
  if (!enrollment) return { known: false, done: new Set(), next: 1 };
  const nums = Array.isArray(enrollment.completedLessonNumbers)
    ? (enrollment.completedLessonNumbers as number[])
    : null;
  const count = Number(enrollment.completedLessons) || 0;
  const done = new Set<number>();
  for (let i = 0; i < total; i++) if (nums ? nums.includes(i + 1) : i < count) done.add(i);
  let next = 1;
  while (next <= total && done.has(next - 1)) next++;
  return { known: true, done, next };
}
