export type Difficulty = 'easy' | 'medium';

export interface TestCase {
  args: unknown[];
  expected: unknown;
}

/**
 * Đề Arena. `hiddenTests` (đầu vào lẫn đáp án) KHÔNG BAO GIỜ rời server;
 * không lưu đáp án mẫu dạng mã, chỉ có test.
 */
export interface ArenaProblem {
  id: string;
  title: string;
  difficulty: Difficulty;
  durationSec: number;
  statement: string;
  signature: string;
  starterCode: string;
  publicTests: TestCase[];
  hiddenTests: TestCase[];
  perTestMs: number;
}

/** Sinh `expected` của test ẩn bằng hàm tham chiếu. */
export function buildHidden<A extends unknown[]>(
  argsList: A[],
  reference: (...args: A) => unknown,
): TestCase[] {
  return argsList.map((args) => ({ args, expected: reference(...args) }));
}
