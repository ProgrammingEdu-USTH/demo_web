import {
  validateStudioLesson,
  type StudioLesson,
} from './studio-lesson.schema';

export type BundleRow = {
  lesson_code: string;
  sort_order: number;
  module: string;
  title: string;
  subtitle: string;
  estimated_minutes: number | null;
  xp_reward: number;
  content_json: StudioLesson;
};

export type CourseBundle = {
  course_id: string;
  partial?: boolean;
  // Thông tin khoá cho lần TẠO MỚI; khoá đã có thì chỉ cập nhật các trường này.
  course?: {
    title: string;
    subtitle?: string;
    description?: string;
    image?: string;
    language?: string;
  };
  lessons: BundleRow[];
};

/**
 * Kiểm một gói bài của khoá mới TRƯỚC khi chạm DB (cùng luật với seed-python-advanced-v4,
 * nhưng số bài lấy từ gói thay vì cứng 48 — SQL/ML sẽ có số bài khác Python).
 * Trả danh sách lỗi; rỗng = hợp lệ.
 */
export function checkBundle(bundle: CourseBundle, courseId: string): string[] {
  const errors: string[] = [];
  const rows = bundle.lessons ?? [];
  if (bundle.course_id !== courseId)
    errors.push(
      `Gói dành cho khoá "${bundle.course_id}", đang nạp "${courseId}".`,
    );
  if (bundle.partial) errors.push('Gói là bản dựng THIẾU bài (partial).');
  if (rows.length === 0) errors.push('Gói không có bài nào.');
  rows.forEach((row, i) => {
    if (row.sort_order !== i + 1)
      errors.push(
        `${row.lesson_code}: sort_order ${row.sort_order}, cần ${i + 1}.`,
      );
    if (!row.content_json?.play)
      errors.push(`${row.lesson_code}: thiếu khối play.`);
    else {
      const bad = validateStudioLesson(row.content_json);
      if (bad.length) errors.push(`${row.lesson_code}: ${bad.join(' | ')}`);
    }
  });
  if (new Set(rows.map((r) => r.lesson_code)).size !== rows.length)
    errors.push('Trùng mã bài trong gói.');
  return errors;
}
