import { buildHidden, type ArenaProblem, type TestCase } from './types';

/** Hàm tham chiếu — chỉ để sinh expected của test ẩn và để test đối chiếu. */
export function reference(nums: number[]): number {
  return nums.reduce((acc, x) => (x % 2 === 0 ? acc + x : acc), 0);
}

const publicTests: TestCase[] = [
  { args: [[1, 2, 3, 4]], expected: 6 },
  { args: [[]], expected: 0 },
  { args: [[7, 9]], expected: 0 },
];

export const sumOfEvens: ArenaProblem = {
  id: 'sum-of-evens',
  title: 'Tổng các số chẵn',
  difficulty: 'easy',
  durationSec: 600,
  statement: [
    'Cho danh sách số nguyên nums. Trả về tổng các phần tử chẵn của nums.',
    'Số âm cũng được xét (ví dụ -2 là số chẵn). Danh sách rỗng cho kết quả 0.',
    '',
    'Ràng buộc: 0 ≤ len(nums) ≤ 10^5, |nums[i]| ≤ 10^6.',
  ].join('\n'),
  signature: 'def solve(nums: list[int]) -> int',
  starterCode:
    'def solve(nums):\n    # Trả về tổng các phần tử chẵn của nums\n    return 0\n',
  publicTests,
  hiddenTests: buildHidden(
    [
      [[2, 4, 6]],
      [[-2, -3, 4]],
      [[0]],
      [[1000000, 1, 1000000]],
      [[-4, -6]],
      [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
      [[3]],
    ] as [number[]][],
    reference,
  ),
  perTestMs: 2000,
};
