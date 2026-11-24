import { buildHidden, type ArenaProblem, type TestCase } from './types';

export function reference(text: string): string {
  const counts = new Map<string, number>();
  for (const raw of text.split(/\s+/)) {
    const w = raw.toLowerCase().replace(/^[.,!?;:]+|[.,!?;:]+$/g, '');
    if (w === '') continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  let best = '';
  let bestN = 0;
  for (const [w, n] of counts) {
    if (n > bestN || (n === bestN && w < best)) {
      best = w;
      bestN = n;
    }
  }
  return best;
}

const publicTests: TestCase[] = [
  { args: ['the cat and the hat'], expected: 'the' },
  { args: ['b a b a'], expected: 'a' },
  { args: ['Hello, hello! World'], expected: 'hello' },
];

export const topWord: ArenaProblem = {
  id: 'top-word',
  title: 'Từ xuất hiện nhiều nhất',
  difficulty: 'medium',
  durationSec: 900,
  statement: [
    'Cho chuỗi text. Xử lý như sau:',
    '1. Tách theo khoảng trắng.',
    '2. Đổi mỗi từ về chữ thường.',
    '3. Bỏ các ký tự . , ! ? ; : ở HAI ĐẦU mỗi từ (không bỏ ở giữa từ).',
    '4. Bỏ các từ rỗng.',
    '',
    'Trả về từ xuất hiện nhiều nhất. Nếu nhiều từ cùng số lần, trả về từ nhỏ hơn theo thứ tự từ điển.',
    'Đảm bảo có ít nhất một từ.',
  ].join('\n'),
  signature: 'def solve(text: str) -> str',
  starterCode:
    'def solve(text):\n    # Trả về từ xuất hiện nhiều nhất\n    return ""\n',
  publicTests,
  hiddenTests: buildHidden(
    [
      ['a'],
      ['x y z'],
      ['Dog dog DOG cat cat'],
      ['one, two; two. three! three?'],
      ['  spaced   out   out '],
      ['hi! hi? ho.'],
      ['Zed zed alpha alpha beta'],
    ] as [string][],
    reference,
  ),
  perTestMs: 2000,
};
