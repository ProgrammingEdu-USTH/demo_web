'use client';

// Chi tiết khoá học (/courses/[courseId]) — đích của mọi thẻ khoá học. Toàn bộ giao diện nằm ở
// components/CourseDetailView.tsx (dùng chung với 3 khoá CSDL /courses/db_design*).
import { use } from 'react';

import CourseDetailView from '@/components/CourseDetailView';

export default function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  return <CourseDetailView courseId={courseId} />;
}
