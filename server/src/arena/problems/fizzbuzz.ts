import { buildHidden, type ArenaProblem, type TestCase } from './types';

export function reference(n: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    if (i % 15 === 0) out.push('FizzBuzz');
    else if (i % 3 === 0) out.push('Fizz');
    else if (i % 5 === 0) out.push('Buzz');
    else out.push(String(i));
  }
  return out;
}

const publicTests: TestCase[] = [
  { args: [5], expected: ['1', '2', 'Fizz', '4', 'Buzz'] },
  { args: [1], expected: ['1'] },
  { args: [3], expected: ['1', '2', 'Fizz'] },
];

export const fizzbuzz: ArenaProblem = {
  id: 'fizzbuzz',
  title: 'FizzBuzz',
  difficulty: 'easy',
  durationSec: 600,
  statement: [
    'Cho số nguyên n. Trả về danh sách n chuỗi, phần tử thứ i (i từ 1 đến n) là:',
    '- "FizzBuzz" nếu i chia hết cho 15,',
    '- "Fizz" nếu i chia hết cho 3,',
    '- "Buzz" nếu i chia hết cho 5,',
    '- ngược lại là str(i).',
    '',
    'Ràng buộc: 0 ≤ n ≤ 1000. n = 0 trả về danh sách rỗng.',
  ].join('\n'),
  signature: 'def solve(n: int) -> list[str]',
  starterCode:
    'def solve(n):\n    # Trả về danh sách n chuỗi theo luật FizzBuzz\n    return []\n',
  publicTests,
  hiddenTests: buildHidden(
    [[0], [10], [15], [16], [30], [100], [2]] as [number][],
    reference,
  ),
  perTestMs: 2000,
};
