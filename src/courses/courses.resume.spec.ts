import { CoursesService } from './courses.service';

const d = (s: string) => new Date(s);

/** Prisma giả: chỉ các truy vấn getResume() dùng. */
function makeSvc(opts: {
  enrollments: unknown[];
  progress: unknown[];
  lessons: unknown[];
}) {
  const prisma = {
    enrollment: { findMany: jest.fn().mockResolvedValue(opts.enrollments) },
    lessonProgress: { findMany: jest.fn().mockResolvedValue(opts.progress) },
    lesson: { findMany: jest.fn().mockResolvedValue(opts.lessons) },
  };
  return new CoursesService(prisma as never);
}

const enr = (
  courseId: string,
  completedLessons: number,
  lessonCount: number,
) => ({
  userId: 1,
  courseId,
  progress: 40,
  completedLessons,
  enrolledAt: d('2026-01-01'),
  course: { title: `Khoá ${courseId}`, lessonCount },
});

describe('CoursesService.getResume', () => {
  it('sắp theo lần học cuối, bỏ khoá đã xong, dựng URL ?lesson=', async () => {
    const svc = makeSvc({
      enrollments: [
        enr('java', 3, 10),
        enr('python', 2, 40),
        enr('htmlcss', 5, 5),
      ],
      progress: [
        {
          courseId: 'java',
          completedAt: d('2026-03-01'),
          status: 'completed',
          lesson: { sortOrder: 3 },
        },
        {
          courseId: 'python',
          completedAt: d('2026-05-01'),
          status: 'completed',
          lesson: { sortOrder: 1 },
        },
        {
          courseId: 'python',
          completedAt: d('2026-05-02'),
          status: 'completed',
          lesson: { sortOrder: 2 },
        },
      ],
      lessons: [
        { courseId: 'java', sortOrder: 4, title: 'Vòng lặp' },
        { courseId: 'python', sortOrder: 3, title: 'Hàm' },
      ],
    });
    const r = await svc.getResume(1);
    expect(r.map((x) => x.courseId)).toEqual(['python', 'java']);
    expect(r[0]).toEqual({
      courseId: 'python',
      courseName: 'Khoá python',
      lessonNo: 3,
      lessonTitle: 'Hàm',
      lessonUrl: '/lesson/python?lesson=3',
      percent: 40,
    });
    expect(r[1].lessonUrl).toBe('/lesson/java?lesson=4');
  });

  it('khoá Studio bỏ qua bài đã xong không liền kề; thiếu tiêu đề thì "Bài N"', async () => {
    const svc = makeSvc({
      enrollments: [enr('python', 1, 40)],
      progress: [
        {
          courseId: 'python',
          completedAt: d('2026-05-01'),
          status: 'completed',
          lesson: { sortOrder: 2 },
        },
      ],
      lessons: [],
    });
    const [x] = await svc.getResume(1);
    expect(x.lessonNo).toBe(1);
    expect(x.lessonTitle).toBe('Bài 1');
  });

  it('chưa đăng ký khoá nào -> mảng rỗng', async () => {
    expect(
      await makeSvc({ enrollments: [], progress: [], lessons: [] }).getResume(
        1,
      ),
    ).toEqual([]);
  });
});
