/** Mốc bài lưu trữ của giáo trình cũ; để ở đây vì script cũng cần nạp trực tiếp. */
export const ARCHIVED_SORT_ORDER = 1000;

/**
 * Một bài đang hoạt động phải có số thứ tự người học thực sự mở được. Bài 0/-1
 * từng có thể lọt vào vì DTO chỉ kiểm tra số nguyên; bài từ 1000 là giáo trình
 * cũ được giữ riêng để không mất tiến độ. Ba chỗ đếm (admin, script, invariant)
 * phải dùng cùng luật này, nếu không phép kiểm sẽ báo động giả rồi bị bỏ qua.
 */
export const ACTIVE_LESSON_SORT_ORDER = {
  gte: 1,
  lt: ARCHIVED_SORT_ORDER,
} as const;

/** Dùng cho SQL kiểm bất biến; chỉ nhận bí danh do code tự viết, không nhận input. */
export const activeLessonSql = (alias: string) =>
  `${alias}.sort_order >= ${ACTIVE_LESSON_SORT_ORDER.gte} AND ${alias}.sort_order < ${ACTIVE_LESSON_SORT_ORDER.lt}`;

export type CourseLessonCountRow = {
  id: string;
  lessonCount: number;
  activeSortOrders: number[];
};

export type CourseLessonCountUpdate = {
  id: string;
  before: number;
  after: number;
};

export type CourseLessonCountPlan = {
  updates: CourseLessonCountUpdate[];
  gaps: { courseId: string; missing: number[] }[];
};

/**
 * Lập kế hoạch thuần để test được mà không cần DB. Không tự dồn sort_order:
 * đây là khoá người học đang dùng để mở bài, đổi nó có thể làm lệch tiến độ.
 */
export function planCourseLessonCount(
  rows: CourseLessonCountRow[],
): CourseLessonCountPlan {
  const updates: CourseLessonCountUpdate[] = [];
  const gaps: CourseLessonCountPlan['gaps'] = [];

  for (const row of rows) {
    const present = new Set(row.activeSortOrders);
    const count = present.size;
    const missing: number[] = [];
    for (let sortOrder = 1; sortOrder <= count; sortOrder++) {
      if (!present.has(sortOrder)) missing.push(sortOrder);
    }
    if (missing.length) gaps.push({ courseId: row.id, missing });
    if (row.lessonCount !== count) {
      updates.push({ id: row.id, before: row.lessonCount, after: count });
    }
  }
  return { updates, gaps };
}
