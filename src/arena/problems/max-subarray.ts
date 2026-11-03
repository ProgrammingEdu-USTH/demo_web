import { buildHidden, type ArenaProblem, type TestCase } from './types';

/** Kadane. */
export function reference(nums: number[]): number {
  let best = nums[0];
  let cur = nums[0];
  for (let i = 1; i < nums.length; i++) {
    cur = Math.max(nums[i], cur + nums[i]);
    best = Math.max(best, cur);
  }
  return best;
}

const publicTests: TestCase[] = [
  { args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expected: 6 },
  { args: [[1]], expected: 1 },
  { args: [[5, 4, -1, 7, 8]], expected: 23 },
];

// Test hiệu năng: 5000 phần tử.
const perfNums = Array.from({ length: 5000 }, (_, i) => ((i * 37) % 101) - 50);

export const maxSubarray: ArenaProblem = {
  id: 'max-subarray',
  title: 'Dãy con liên tiếp có tổng lớn nhất',
  difficulty: 'medium',
  durationSec: 900,
  statement: [
    'Cho danh sách số nguyên nums. Tìm dãy con LIÊN TIẾP, KHÔNG RỖNG có tổng lớn nhất và trả về tổng đó.',
    '',
    'Ràng buộc: 1 ≤ len(nums) ≤ 10^4, |nums[i]| ≤ 10^4.',
    'Gợi ý: có lời giải O(n).',
  ].join('\n'),
  signature: 'def solve(nums: list[int]) -> int',
  starterCode:
    'def solve(nums):\n    # Trả về tổng lớn nhất của một dãy con liên tiếp không rỗng\n    return 0\n',
  publicTests,
  hiddenTests: buildHidden(
    [
      [[-1]],
      [[-3, -2, -5]],
      [[0, 0, 0]],
      [[2, -1, 2, -1, 2]],
      [[-5, 10, -3, 10, -5]],
      [[-2, -1]],
      [[8, -19, 5, -4, 20]],
      [perfNums],
    ] as [number[]][],
    reference,
  ),
  perTestMs: 2000,
};
