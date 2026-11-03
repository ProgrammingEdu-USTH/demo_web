import { PATH_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorators';
import { PublicCoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Khoá ${id}`,
  level: 'beginner',
  rating: 4.5,
  lessonCount: 12,
  xp_reward: 100,
  isPublished: true,
  language: 'python',
  accentColor: null,
  contentMeta: { subtitle: 'Phụ đề', description: 'Mô tả', duration: '4 tuần' },
  ...extra,
});

describe('CoursesService.listPublicCourses', () => {
  it('chỉ hỏi khoá đã công khai và chỉ trả trường danh mục', async () => {
    const findMany = jest.fn().mockResolvedValue([row('python')]);
    const svc = new CoursesService({ course: { findMany } } as never);

    const res = await svc.listPublicCourses();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublished: true } }),
    );
    expect(res.ok).toBe(true);
    const c = res.courses[0];
    expect(c).toMatchObject({
      id: 'python',
      title: 'Khoá python',
      subtitle: 'Phụ đề',
      level: 'Cơ bản',
      totalLessons: 12,
      image: 'static/images/python.webp',
    });
    // Không lộ dữ liệu người dùng / nội bộ.
    for (const k of ['enrolled', 'isPublished', 'xpReward', 'students']) {
      expect(c).not.toHaveProperty(k);
    }
  });

  it('không đụng tới bảng ghi danh (không có dữ liệu người dùng)', async () => {
    const prisma = {
      course: { findMany: jest.fn().mockResolvedValue([]) },
      enrollment: { findMany: jest.fn() },
    };
    await new CoursesService(prisma as never).listPublicCourses();
    expect(prisma.enrollment.findMany).not.toHaveBeenCalled();
  });
});

describe('PublicCoursesController', () => {
  it('tiền tố public/courses và @Public()', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PublicCoursesController)).toBe(
      'public/courses',
    );
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, PublicCoursesController)).toBe(
      true,
    );
  });
});
