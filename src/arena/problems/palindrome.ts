import { buildHidden, type ArenaProblem, type TestCase } from './types';

export function reference(s: string): boolean {
  const t = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return t === [...t].reverse().join('');
}

const publicTests: TestCase[] = [
  { args: ['A man, a plan, a canal: Panama'], expected: true },
  { args: ['hello'], expected: false },
  { args: [''], expected: true },
];

export const palindrome: ArenaProblem = {
  id: 'palindrome',
  title: 'Chuỗi đối xứng',
  difficulty: 'easy',
  durationSec: 600,
  statement: [
    'Cho chuỗi s. Kiểm tra s có đối xứng hay không, chỉ xét chữ cái ASCII (a-z, A-Z) và chữ số (0-9).',
    'Bỏ qua hoa/thường và mọi ký tự khác (khoảng trắng, dấu câu, kể cả dấu gạch dưới "_").',
    'Chuỗi rỗng (hoặc không còn ký tự nào được xét) được coi là đối xứng.',
    '',
    'Trả về True hoặc False.',
  ].join('\n'),
  signature: 'def solve(s: str) -> bool',
  starterCode:
    'def solve(s):\n    # Trả về True nếu s đối xứng (chỉ xét chữ cái và chữ số)\n    return False\n',
  publicTests,
  hiddenTests: buildHidden(
    [
      ['race a car'],
      ["No 'x' in Nixon"],
      ['0P'],
      ['ab_a'],
      ['12321'],
      ['Was it a car or a cat I saw?'],
      ['.,'],
      ['abcba '],
      ['Aa'],
    ] as [string][],
    reference,
  ),
  perTestMs: 2000,
};
