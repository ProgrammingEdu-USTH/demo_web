import { readFileSync } from 'fs';
import { join } from 'path';

import {
  canonicalJson,
  parseCodesArg,
  planContentUpdates,
  selectLessons,
  type BundleRow,
  type DbLessonRow,
} from './lesson-content-update';

// Gói THẬT do build_advanced.py dựng — AGENTS.md: fixture không giống dữ liệu thật thì
// test vô dụng. Đọc lại mỗi ca (structuredClone) để ca nào sửa gói cũng không lây.
const BUNDLE_PATH = join(
  __dirname,
  '..',
  '..',
  'scripts',
  'pe-v4',
  'out-advanced',
  'lessons.json',
);
const REAL = JSON.parse(readFileSync(BUNDLE_PATH, 'utf8')) as {
  course_id: string;
  partial?: boolean;
  lessons: BundleRow[];
};
const bundle = () => structuredClone(REAL);
const CODES = ['P01', 'P02', 'P03', 'G01'];

describe('parseCodesArg', () => {
  it('nhận cả hai dạng, viết hoa, bỏ trùng và khoảng trắng', () => {
    expect(parseCodesArg(['--codes', 'p01, P02,,P01'])).toEqual(['P01', 'P02']);
    expect(parseCodesArg(['--apply', '--codes=G01'])).toEqual(['G01']);
  });

  it('thiếu --codes thì ném lỗi, không mặc định "mọi bài"', () => {
    expect(() => parseCodesArg(['--apply'])).toThrow(/--codes/);
    expect(() => parseCodesArg(['--codes', '--apply'])).toThrow(/--codes/);
  });
});

describe('selectLessons — trên gói out-advanced thật', () => {
  it('chọn đúng 4 bài theo mã, đúng sort_order, không lỗi', () => {
    const { rows, errors } = selectLessons(bundle(), CODES);
    expect(errors).toEqual([]);
    expect(rows.map((r) => [r.lesson_code, r.sort_order])).toEqual([
      ['P01', 1],
      ['P02', 2],
      ['P03', 3],
      ['G01', 14],
    ]);
  });

  it('từ chối mã không có trong gói và KHÔNG trả bài nào', () => {
    const { rows, errors } = selectLessons(bundle(), ['P01', 'P99']);
    expect(rows).toEqual([]);
    expect(errors.join('\n')).toMatch(/P99/);
  });

  it('từ chối gói không đủ 48 bài (bản dựng thiếu dồn sort_order)', () => {
    const short = bundle();
    short.lessons = short.lessons.slice(0, 47);
    const { rows, errors } = selectLessons(short, CODES);
    expect(rows).toEqual([]);
    expect(errors.join('\n')).toMatch(/47 bài, cần đúng 48/);
  });

  it('từ chối gói có sort_order lệch dù vẫn đủ 48 bài', () => {
    const shifted = bundle();
    shifted.lessons[13].sort_order = 15;
    expect(selectLessons(shifted, CODES).rows).toEqual([]);
  });

  it('từ chối gói đánh dấu partial và gói của khoá khác', () => {
    const partial = { ...bundle(), partial: true };
    expect(selectLessons(partial, CODES).errors.join('\n')).toMatch(/THIẾU/);
    const other = { ...bundle(), course_id: 'python' };
    expect(selectLessons(other, CODES).errors.join('\n')).toMatch(/"python"/);
  });

  it('chạy validateStudioLesson trên bài được chọn', () => {
    const broken = bundle();
    const g01 = broken.lessons.find((r) => r.lesson_code === 'G01')!;
    (g01.content_json as Record<string, unknown>).title = '';
    const { rows, errors } = selectLessons(broken, CODES);
    expect(rows).toEqual([]);
    expect(errors.join('\n')).toMatch(/G01: .*title/);
  });

  it('từ chối bài thiếu khối play (gói out/ chưa qua build_advanced)', () => {
    const noPlay = bundle();
    delete (noPlay.lessons[0].content_json as Record<string, unknown>).play;
    expect(selectLessons(noPlay, ['P01']).errors.join('\n')).toMatch(
      /P01: thiếu khối play/,
    );
  });
});

describe('planContentUpdates', () => {
  const selected = () => selectLessons(bundle(), CODES).rows;
  const dbFrom = (rows: BundleRow[]): DbLessonRow[] =>
    rows.map((r) => ({
      sortOrder: r.sort_order,
      lessonCode: r.lesson_code,
      contentJson: structuredClone(r.content_json),
    }));

  it('nội dung giống hệt nhưng khoá xếp khác (jsonb) → không đổi', () => {
    const rows = selected();
    const db = dbFrom(rows).map((r) => ({
      ...r,
      // jsonb trả khoá theo thứ tự của nó, không theo file — đảo ngược để mô phỏng.
      contentJson: Object.fromEntries(
        Object.entries(r.contentJson as Record<string, unknown>).reverse(),
      ),
    }));
    const { items, errors } = planContentUpdates(rows, db);
    expect(errors).toEqual([]);
    expect(items.map((i) => i.changed)).toEqual([false, false, false, false]);
    expect(canonicalJson(db[0].contentJson)).toBe(
      canonicalJson(rows[0].content_json),
    );
  });

  it('chỉ bài có nội dung khác mới được đánh dấu đổi', () => {
    const rows = selected();
    const db = dbFrom(rows);
    (db[3].contentJson as Record<string, unknown>).title = 'G01 · bản cũ';
    const { items } = planContentUpdates(rows, db);
    expect(items.filter((i) => i.changed).map((i) => i.code)).toEqual(['G01']);
    expect(items[3].content).toBe(rows[3].content_json);
  });

  it('từ chối khi ô sort_order trong DB mang mã khác hoặc NULL', () => {
    const rows = selected();
    const db = dbFrom(rows);
    db[3].lessonCode = null;
    const { items, errors } = planContentUpdates(rows, db);
    expect(items).toEqual([]);
    expect(errors.join('\n')).toMatch(/G01: ô sort_order 14 .*\(NULL\)/);
  });

  it('từ chối khi DB chưa có bài — script không tạo bài', () => {
    const rows = selected();
    const { items, errors } = planContentUpdates(
      rows,
      dbFrom(rows).slice(0, 3),
    );
    expect(items).toEqual([]);
    expect(errors.join('\n')).toMatch(/G01: DB không có bài sort_order 14/);
  });
});
