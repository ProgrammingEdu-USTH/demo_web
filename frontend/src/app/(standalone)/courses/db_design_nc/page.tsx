// /courses/db_design_nc — dùng chung CourseDetailView (nội dung khoá lấy từ lib/db-course-meta.json).
import CourseDetailView from '@/components/CourseDetailView';

export default function Page() {
  return <CourseDetailView courseId="db_design_nc" />;
}
