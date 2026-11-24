import { reference as fizzbuzzRef } from './fizzbuzz';
import { reference as maxSubRef } from './max-subarray';
import { reference as palindromeRef } from './palindrome';
import { reference as sumEvensRef } from './sum-of-evens';
import { reference as topWordRef } from './top-word';
import * as index from './index';
import { getProblem, PROBLEMS, totalTests } from './index';

const refs: Record<string, (...a: any[]) => unknown> = {
  'sum-of-evens': sumEvensRef,
  fizzbuzz: fizzbuzzRef,
  palindrome: palindromeRef,
  'max-subarray': maxSubRef,
  'top-word': topWordRef,
};

describe('đề Arena', () => {
  it('có đúng 5 đề, id duy nhất, getProblem hoạt động', () => {
    expect(PROBLEMS.map((p) => p.id)).toEqual([
      'sum-of-evens',
      'fizzbuzz',
      'palindrome',
      'max-subarray',
      'top-word',
    ]);
    expect(getProblem('fizzbuzz')?.title).toBe('FizzBuzz');
    expect(getProblem('nope')).toBeUndefined();
  });

  it('thời lượng, độ khó, số test khớp hợp đồng', () => {
    const expected: Record<string, [string, number, number]> = {
      'sum-of-evens': ['easy', 600, 10],
      fizzbuzz: ['easy', 600, 10],
      palindrome: ['easy', 600, 12],
      'max-subarray': ['medium', 900, 11],
      'top-word': ['medium', 900, 10],
    };
    for (const p of PROBLEMS) {
      const [diff, dur, total] = expected[p.id];
      expect(p.difficulty).toBe(diff);
      expect(p.durationSec).toBe(dur);
      expect(p.publicTests).toHaveLength(3);
      expect(totalTests(p)).toBe(total);
      expect(p.perTestMs).toBe(2000);
      expect(p.signature).toMatch(/^def solve\(/);
      expect(p.starterCode).toContain('def solve');
      expect(p.statement.length).toBeGreaterThan(20);
    }
  });

  it.each(PROBLEMS.map((p) => [p.id]))(
    'hàm tham chiếu %s khớp mọi test công khai',
    (id) => {
      const p = getProblem(id)!;
      for (const t of p.publicTests) {
        expect(refs[id](...t.args)).toEqual(t.expected);
      }
    },
  );

  it.each(PROBLEMS.map((p) => [p.id]))(
    'test ẩn %s: expected sinh từ hàm tham chiếu',
    (id) => {
      const p = getProblem(id)!;
      for (const t of p.hiddenTests) {
        expect(refs[id](...t.args)).toEqual(t.expected);
      }
    },
  );

  it('một vài đáp án ẩn đã biết', () => {
    const exp = (id: string) =>
      getProblem(id)!.hiddenTests.map((t) => t.expected);
    expect(exp('sum-of-evens')).toEqual([12, 2, 0, 2000000, -10, 30, 0]);
    expect(exp('palindrome')).toEqual([
      false,
      true,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(exp('top-word')).toEqual([
      'a',
      'x',
      'dog',
      'three',
      'out',
      'hi',
      'alpha',
    ]);
    expect(exp('max-subarray').slice(0, 7)).toEqual([-1, -2, 0, 4, 17, -1, 21]);
    expect(getProblem('max-subarray')!.hiddenTests[7].args[0]).toHaveLength(
      5000,
    );
  });

  it('index không export hàm tham chiếu', () => {
    expect(Object.keys(index)).not.toContain('reference');
  });
});
