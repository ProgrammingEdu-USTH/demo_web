import {
  planCourseLessonCount,
  type CourseLessonCountRow,
} from './course-lesson-count';

describe('planCourseLessonCount', () => {
  const row = (
    id: string,
    lessonCount: number,
    activeSortOrders: number[],
  ): CourseLessonCountRow => ({ id, lessonCount, activeSortOrders });

  it('chỉ lập kế hoạch cho khoá khai sai; khoá khớp và khoá không có bài giữ nguyên', () => {
    const plan = planCourseLessonCount([
      row('le', 2, [1, 2, 3]),
      row('dung', 2, [1, 2]),
      row('rong', 0, []),
    ]);

    expect(plan.updates).toEqual([{ id: 'le', before: 2, after: 3 }]);
    expect(plan.gaps).toEqual([]);
  });

  it('không tính bài lưu trữ hay sort_order không mở được vì caller chỉ truyền bài hoạt động', () => {
    // DB query phải dùng ACTIVE_LESSON_SORT_ORDER; hàm này chỉ nhận tập đã lọc
    // để luật tính không vô tình kéo bài 0/1000 vào mẫu số tiến độ.
    const plan = planCourseLessonCount([row('python', 2, [1, 2])]);

    expect(plan.updates).toEqual([]);
    expect(plan.gaps).toEqual([]);
  });

  it('phát hiện lỗ sort_order và không coi số lượng là số thứ tự cuối cùng', () => {
    const plan = planCourseLessonCount([row('lo', 2, [1, 3])]);

    expect(plan.updates).toEqual([]);
    expect(plan.gaps).toEqual([{ courseId: 'lo', missing: [2] }]);
  });
});
