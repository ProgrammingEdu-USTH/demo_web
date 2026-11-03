import LessonShell from '@/components/lesson/LessonShell';
import PageStyles from '@/components/PageStyles';
import StudioLesson from '@/components/python-studio/StudioLesson';

const STUDIO_CSS = [
  '/static/css/edu-theme.css',
  '/static/css/studio-tokens.css',
];

// Khoá Python Advanced: cùng 40 bài PE v3 nhưng nội dung là studio-lesson/v2
// (mini-game sinh bởi scripts/pe-v3/build_advanced.py). Link từ trang khoá học
// truyền chỉ số bài 0-based; bảng lessons đánh số từ 1 (sort_order).
export default async function LessonPythonAdvancedPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { lesson } = await searchParams;
  const index = Number(lesson);
  const sortOrder =
    lesson === undefined || !Number.isInteger(index) || index < 0 ? 1 : index + 1;
  return (
    <>
      <PageStyles hrefs={STUDIO_CSS} />
      <LessonShell courseId="python_advanced" lessonIndex={sortOrder - 1} layout="fill" nav="none">
        <StudioLesson courseId="python_advanced" courseName="Python Advanced" lessonNo={sortOrder} />
      </LessonShell>
    </>
  );
}
