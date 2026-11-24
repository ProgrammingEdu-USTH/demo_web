/**
 * Phần THUẦN (không DB) của `scripts/update-lesson-content.ts`: chọn bài trong gói
 * `scripts/pe-v4/out-advanced/lessons.json` theo mã, kiểm gói, và lập kế hoạch
 * `UPDATE lessons SET content_json` so với các hàng đang có trong DB.
 *
 * Vì sao tách ra đây thay vì để trong script: script duy nhất trước đó
 * (`seed-python-advanced-v4.ts --apply`) XOÁ toàn bộ `lesson_progress` của khoá, nên
 * khi tester đã học thì không dùng được — sửa nội dung 4 bài mà xoá tiến độ của mọi
 * người. Đường thay thế này chỉ được phép đổi đúng cột `content_json` của đúng các bài
 * được chọn; những luật bảo đảm điều đó nằm ở đây để Jest kiểm được mà không cần DB
 * (jest chỉ quét `src/`, và `npm run typecheck` cũng chỉ thấy `src/`).
 */
import { createHash } from 'crypto';

import { validateStudioLesson } from './studio-lesson.schema';

export const ADVANCED_COURSE_ID = 'python_advanced';
export const ADVANCED_LESSON_TOTAL = 48;

/** Một hàng của gói, đúng hình dạng build_advanced.py ghi ra. */
export interface BundleRow {
  lesson_code: string;
  sort_order: number;
  module?: string;
  title?: string;
  subtitle?: string;
  estimated_minutes?: number | null;
  xp_reward?: number;
  content_json: unknown;
}

/** Hàng `lessons` đang có trong DB — chỉ các cột kế hoạch cần đọc. */
export interface DbLessonRow {
  sortOrder: number;
  lessonCode: string | null;
  contentJson: unknown;
}

export interface Fingerprint {
  bytes: number;
  sha256: string;
}

export interface UpdatePlanItem {
  code: string;
  sortOrder: number;
  before: Fingerprint;
  after: Fingerprint;
  changed: boolean;
  /** Nội dung sẽ ghi (lấy nguyên từ gói). */
  content: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Đọc `--codes P01,P02` hoặc `--codes=P01,P02`. Mã được viết hoa và bỏ trùng.
 * Ném lỗi khi thiếu hoặc rỗng: không có mặc định "tất cả bài" — cập nhật cả khoá là
 * việc của seed, ở đây phải nói rõ bài nào.
 */
export function parseCodesArg(argv: readonly string[]): string[] {
  let raw: string | undefined;
  argv.forEach((arg, i) => {
    if (arg === '--codes') raw = argv[i + 1];
    else if (arg.startsWith('--codes=')) raw = arg.slice('--codes='.length);
  });
  const codes = (raw ?? '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c) => c && !c.startsWith('--'));
  if (!codes.length) {
    throw new Error('Thiếu --codes=<mã,mã,…> (vd. --codes=P01,P02,P03,G01).');
  }
  return [...new Set(codes)];
}

/**
 * Kiểm CẢ gói rồi mới chọn bài. Có lỗi là trả `rows: []` — hoặc đủ, hoặc không gì cả.
 *
 * Vì sao đòi gói đủ 48 bài, sort_order 1..48 dù chỉ cập nhật vài bài: bài trong DB
 * được tra theo `(course_id, sort_order)` (xem AGENTS.md). Gói dựng thiếu (`--partial`,
 * `--only`) có thể dồn thứ tự, khi đó sort_order 14 của gói không còn là G01 và ta sẽ
 * ghi nội dung G01 đè lên bài khác.
 */
export function selectLessons(
  bundle: unknown,
  codes: readonly string[],
): { rows: BundleRow[]; errors: string[] } {
  const errors: string[] = [];
  if (!isObject(bundle) || !Array.isArray(bundle.lessons)) {
    return { rows: [], errors: ['Gói không có mảng lessons.'] };
  }
  const lessons = bundle.lessons as BundleRow[];
  if (bundle.course_id !== ADVANCED_COURSE_ID) {
    errors.push(
      `Gói dành cho khoá "${String(bundle.course_id)}", không phải "${ADVANCED_COURSE_ID}".`,
    );
  }
  if (bundle.partial) {
    errors.push(
      'Gói là bản dựng THIẾU bài (--partial/--only) — dựng lại đủ 48 bài.',
    );
  }
  if (lessons.length !== ADVANCED_LESSON_TOTAL) {
    errors.push(
      `Gói có ${lessons.length} bài, cần đúng ${ADVANCED_LESSON_TOTAL}.`,
    );
  }
  lessons.forEach((row, i) => {
    if (row.sort_order !== i + 1) {
      errors.push(
        `${row.lesson_code}: sort_order ${row.sort_order}, cần ${i + 1}.`,
      );
    }
  });
  const byCode = new Map<string, BundleRow>();
  for (const row of lessons) {
    if (byCode.has(row.lesson_code)) {
      errors.push(`Trùng mã bài ${row.lesson_code} trong gói.`);
    }
    byCode.set(row.lesson_code, row);
  }

  if (!codes.length) errors.push('Chưa chọn bài nào.');
  const unknown = codes.filter((code) => !byCode.has(code));
  if (unknown.length) {
    errors.push(`Mã không có trong gói: ${unknown.join(', ')}.`);
  }

  const rows = codes
    .map((code) => byCode.get(code))
    .filter((row): row is BundleRow => row !== undefined);
  for (const row of rows) {
    if (!isObject(row.content_json) || !row.content_json.play) {
      errors.push(
        `${row.lesson_code}: thiếu khối play (gói chưa qua build_advanced.py?).`,
      );
    }
    const invalid = validateStudioLesson(row.content_json);
    if (invalid.length) {
      errors.push(`${row.lesson_code}: ${invalid.join(' | ')}`);
    }
  }
  return errors.length ? { rows: [], errors } : { rows, errors };
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (isObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort())
      out[key] = sortKeys(value[key]);
    return out;
  }
  return value;
}

/**
 * JSON với khoá object xếp theo thứ tự chữ. Cần vì Postgres `jsonb` KHÔNG giữ thứ tự
 * khoá như file: so chuỗi JSON thô thì bài chưa đổi gì cũng hiện là "đổi".
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value)) ?? 'null';
}

export function fingerprint(value: unknown): Fingerprint {
  const text = canonicalJson(value);
  return {
    bytes: Buffer.byteLength(text, 'utf8'),
    sha256: createHash('sha256').update(text).digest('hex'),
  };
}

/**
 * So từng bài được chọn với hàng DB cùng sort_order.
 *
 * Từ chối (lỗi, không ghi gì) khi DB không có hàng ở sort_order đó, hoặc hàng đó mang
 * mã khác: nghĩa là bố cục khoá trong DB không phải bố cục của gói — ghi đè lúc đó là
 * đặt nội dung bài này vào chỗ (và tiến độ) của bài khác. Trường hợp ấy phải xử lý
 * bằng tay, không phải bằng script này.
 */
export function planContentUpdates(
  rows: readonly BundleRow[],
  dbRows: readonly DbLessonRow[],
): { items: UpdatePlanItem[]; errors: string[] } {
  const errors: string[] = [];
  const items: UpdatePlanItem[] = [];
  const bySort = new Map(dbRows.map((r) => [r.sortOrder, r]));
  for (const row of rows) {
    const db = bySort.get(row.sort_order);
    if (!db) {
      errors.push(
        `${row.lesson_code}: DB không có bài sort_order ${row.sort_order} — script này chỉ CẬP NHẬT, không tạo bài.`,
      );
      continue;
    }
    if (db.lessonCode !== row.lesson_code) {
      errors.push(
        `${row.lesson_code}: ô sort_order ${row.sort_order} trong DB đang là "${db.lessonCode ?? '(NULL)'}" — bố cục khoá lệch gói, không ghi.`,
      );
      continue;
    }
    const before = fingerprint(db.contentJson);
    const after = fingerprint(row.content_json);
    items.push({
      code: row.lesson_code,
      sortOrder: row.sort_order,
      before,
      after,
      changed: before.sha256 !== after.sha256,
      content: row.content_json,
    });
  }
  return errors.length ? { items: [], errors } : { items, errors };
}
