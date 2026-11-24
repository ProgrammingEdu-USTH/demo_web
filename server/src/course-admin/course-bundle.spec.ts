import { readFileSync } from 'fs';
import { join } from 'path';
import { checkBundle, type CourseBundle } from './course-bundle';

// Hình dạng THẬT: lấy 3 bài đầu của gói Advanced Python đang seed (xem AGENTS.md, bẫy fixture).
const real = JSON.parse(
  readFileSync(
    join(__dirname, '../../scripts/pe-v4/out-advanced/lessons.json'),
    'utf8',
  ),
) as CourseBundle;
const make = (): CourseBundle => ({
  course_id: 'sql_advanced',
  lessons: real.lessons.slice(0, 3).map((l) => structuredClone(l)),
});

describe('checkBundle', () => {
  it('gói hợp lệ không có lỗi, số bài tuỳ ý', () => {
    expect(checkBundle(make(), 'sql_advanced')).toEqual([]);
  });
  it('từ chối gói của khoá khác', () => {
    expect(checkBundle(make(), 'ml_advanced')[0]).toMatch(/sql_advanced/);
  });
  it('từ chối gói rỗng, gói partial, trùng mã và sort_order lệch', () => {
    expect(checkBundle({ course_id: 'x', lessons: [] }, 'x')).toContain(
      'Gói không có bài nào.',
    );
    expect(
      checkBundle({ ...make(), partial: true }, 'sql_advanced').join(),
    ).toMatch(/THIẾU/);
    const dup = make();
    dup.lessons[1].lesson_code = dup.lessons[0].lesson_code;
    expect(checkBundle(dup, 'sql_advanced').join()).toMatch(/Trùng mã/);
    const gap = make();
    gap.lessons[2].sort_order = 9;
    expect(checkBundle(gap, 'sql_advanced').join()).toMatch(
      /sort_order 9, cần 3/,
    );
  });
  it('từ chối bài thiếu khối play', () => {
    const b = make();
    delete (b.lessons[0].content_json as { play?: unknown }).play;
    expect(checkBundle(b, 'sql_advanced').join()).toMatch(/thiếu khối play/);
  });
});
