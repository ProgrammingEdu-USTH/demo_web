// Route động /lesson/[courseId] — port logic _LESSON_TEMPLATES/_LESSON_URLS của main.py lesson_view():
//   db_design | db_design_tc | db_design_nc → LessonDbDesign
//   cpp                                     → redirect /interface
//   khác                                    → redirect /courses/<id>
// (python/java/htmlcss có route TĨNH riêng — Next ưu tiên static trước dynamic.)
// Chuyển hướng ở server (redirect) thay vì window.location.replace trong effect: không nháy trang
// trắng, và công cụ tìm kiếm/trình duyệt nhận đúng mã 307.
import { redirect } from 'next/navigation';

import LessonDbDesign from '@/components/LessonDbDesign';
import LessonShell from '@/components/lesson/LessonShell';
import PageStyles from '@/components/PageStyles';

const DB_COURSES = ['db_design', 'db_design_tc', 'db_design_nc'];
const LESSON_URLS: Record<string, string> = { cpp: '/interface' };

export default async function LessonDispatchPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  if (!DB_COURSES.includes(courseId)) {
    redirect(LESSON_URLS[courseId] || `/courses/${encodeURIComponent(courseId)}`);
  }
  return (
    <>
      <PageStyles hrefs={['/static/css/lesson_db_design.css', '/static/css/edu-theme.css', '/static/css/edu-db.css']} />
      {/* Engine DB tự lo tiến trình bước + nút tiếp theo → vỏ chỉ thêm thanh trên chung (nav none). */}
      <LessonShell courseId={courseId} title="Thiết kế CSDL" layout="fill" nav="none" chatbot={false}>
        <LessonDbDesign courseId={courseId} />
      </LessonShell>
    </>
  );
}
