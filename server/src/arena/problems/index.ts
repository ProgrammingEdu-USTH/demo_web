import { fizzbuzz } from './fizzbuzz';
import { maxSubarray } from './max-subarray';
import { palindrome } from './palindrome';
import { sumOfEvens } from './sum-of-evens';
import { topWord } from './top-word';
import type { ArenaProblem } from './types';

export type { ArenaProblem, TestCase } from './types';

export const PROBLEMS: readonly ArenaProblem[] = [
  sumOfEvens,
  fizzbuzz,
  palindrome,
  maxSubarray,
  topWord,
];

const BY_ID = new Map(PROBLEMS.map((p) => [p.id, p]));

export function getProblem(id: string): ArenaProblem | undefined {
  return BY_ID.get(id);
}

export function totalTests(p: ArenaProblem): number {
  return p.publicTests.length + p.hiddenTests.length;
}
