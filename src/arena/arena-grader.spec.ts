/**
 * Bộ test sandbox: chạy Pyodide THẬT trong worker_threads (ngoại tuyến).
 * Mỗi đoạn tấn công phải bị `rejected` hoặc làm test sai/lỗi — không bao giờ
 * lấy được js/process/require/hệ thống tệp (contracts/features.md §7 mục 9).
 */
import { ArenaHttpError } from './arena.errors';
import {
  ArenaGraderService,
  jsonEqual,
  type GradeResult,
} from './arena-grader.service';
import { getProblem, PROBLEMS } from './problems';

let pyodideOk = true;
try {
  require.resolve('pyodide');
} catch {
  pyodideOk = false;
  console.warn(
    '[arena-grader.spec] Không tìm thấy pyodide: bỏ qua test sandbox',
  );
}
const d = pyodideOk ? describe : describe.skip;

jest.setTimeout(240_000);

const evens = getProblem('sum-of-evens')!;
const GOOD_EVENS =
  'def solve(nums):\n    return sum(x for x in nums if x % 2 == 0)\n';

describe('jsonEqual', () => {
  it('so sánh sâu nghiêm ngặt về kiểu', () => {
    expect(jsonEqual(true, 1)).toBe(false);
    expect(jsonEqual(0, false)).toBe(false);
    expect(jsonEqual('1', 1)).toBe(false);
    expect(jsonEqual(null, 0)).toBe(false);
    expect(jsonEqual([1, [2, 'a']], [1, [2, 'a']])).toBe(true);
    expect(jsonEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(jsonEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(jsonEqual({ a: 1 }, { b: 1 })).toBe(false);
    expect(jsonEqual([], {})).toBe(false);
  });
});

d('ArenaGraderService (Pyodide thật)', () => {
  let grader: ArenaGraderService;
  let saved: string | undefined;

  beforeAll(() => {
    saved = process.env.ARENA_GRADER_CONCURRENCY;
    process.env.ARENA_GRADER_CONCURRENCY = '4';
    grader = new ArenaGraderService();
  });
  afterAll(() => {
    if (saved === undefined) delete process.env.ARENA_GRADER_CONCURRENCY;
    else process.env.ARENA_GRADER_CONCURRENCY = saved;
  });

  /** Chấm nhiều đoạn, tối đa 8 cái cùng lúc (4 chạy + hàng đợi). */
  async function gradeAll(
    codes: string[],
    problemId = 'sum-of-evens',
  ): Promise<GradeResult[]> {
    const p = getProblem(problemId)!;
    const out: GradeResult[] = [];
    for (let i = 0; i < codes.length; i += 8) {
      out.push(
        ...(await Promise.all(
          codes.slice(i, i + 8).map((c) => grader.grade(c, p)),
        )),
      );
    }
    return out;
  }

  const notPerfect = (r: GradeResult) =>
    r.status === 'rejected' ||
    r.status === 'error' ||
    (r.status === 'graded' && r.passed < r.total);

  describe('hành vi tốt', () => {
    const solutions: Record<string, string> = {
      'sum-of-evens': GOOD_EVENS,
      fizzbuzz: [
        'def solve(n):',
        '    out = []',
        '    for i in range(1, n + 1):',
        "        s = ('Fizz' if i % 3 == 0 else '') + ('Buzz' if i % 5 == 0 else '')",
        '        out.append(s or str(i))',
        '    return out',
      ].join('\n'),
      palindrome: [
        'import re',
        'def solve(s):',
        "    t = re.sub('[^a-z0-9]', '', s.lower())",
        '    return t == t[::-1]',
      ].join('\n'),
      'max-subarray': [
        'def solve(nums):',
        '    best = cur = nums[0]',
        '    for x in nums[1:]:',
        '        cur = max(x, cur + x)',
        '        best = max(best, cur)',
        '    return best',
      ].join('\n'),
      'top-word': [
        'from collections import Counter',
        'def solve(text):',
        "    words = [w.strip('.,!?;:') for w in text.lower().split()]",
        '    c = Counter(w for w in words if w)',
        '    return min(c.items(), key=lambda kv: (-kv[1], kv[0]))[0]',
      ].join('\n'),
    };

    it('5 lời giải đúng đạt 100%', async () => {
      expect(PROBLEMS.length).toBe(5);
      const results = await Promise.all(
        Object.entries(solutions).map(([id, code]) =>
          grader.grade(code, getProblem(id)!),
        ),
      );
      for (const r of results) {
        expect(r.status).toBe('graded');
        expect(r.passed).toBe(r.total);
        expect(r.publicResults.every((x) => x.passed)).toBe(true);
      }
    });

    it('lời giải sai đạt một phần, test công khai sai có got', async () => {
      const [r] = await gradeAll(['def solve(nums):\n    return sum(nums)\n']);
      expect(r.status).toBe('graded');
      expect(r.passed).toBeGreaterThan(0);
      expect(r.passed).toBeLessThan(r.total);
      const bad = r.publicResults.find((x) => !x.passed);
      expect(bad).toBeDefined();
      expect(bad!.got).toBeDefined();
    });

    it('dùng được heapq, math, itertools, functools, bisect, statistics, typing', async () => {
      const [r] = await gradeAll([
        [
          'import heapq, math, itertools, functools, bisect, statistics',
          'from typing import List',
          'def solve(nums: List[int]) -> int:',
          '    ev = [x for x in nums if x % 2 == 0]',
          '    h = list(ev)',
          '    heapq.heapify(h)',
          '    total = 0',
          '    while h:',
          '        total += heapq.heappop(h)',
          '    assert math.isfinite(total)',
          '    assert list(itertools.islice(itertools.count(), 2)) == [0, 1]',
          '    assert functools.reduce(lambda a, b: a + b, [1, 2]) == 3',
          '    assert bisect.bisect_left([1, 2, 3], 2) == 1',
          '    statistics.mean([1, 2, 3])',
          '    return total',
        ].join('\n'),
      ]);
      expect(r.status).toBe('graded');
      expect(r.passed).toBe(r.total);
    });

    it('thiếu hàm solve: mọi call lỗi, không crash', async () => {
      const [r] = await gradeAll(['x = 1\n']);
      expect(r.status).toBe('graded');
      expect(r.passed).toBe(0);
      expect(r.publicResults[0].error).toContain('solve');
    });

    it('lỗi cú pháp -> error; lỗi lúc khai báo -> error', async () => {
      const [a, b] = await gradeAll([
        'def solve(:\n',
        'raise ValueError("boom")\n',
      ]);
      expect(a.status).toBe('error');
      expect(b.status).toBe('error');
      expect(b.message).toContain('ValueError');
    });

    it('exception trong solve chỉ làm test đó lỗi, có tên lỗi (công khai)', async () => {
      const [r] = await gradeAll(['def solve(nums):\n    return 1 // 0\n']);
      expect(r.status).toBe('graded');
      expect(r.publicResults[0].error).toContain('ZeroDivisionError');
    });

    it('mã người dùng sửa args không ảnh hưởng test sau', async () => {
      const [r] = await gradeAll([
        'def solve(nums):\n    t = sum(x for x in nums if x % 2 == 0)\n    nums.clear()\n    return t\n',
      ]);
      expect(r.passed).toBe(r.total);
    });
  });

  describe('đối kháng: bị rejected hoặc làm test sai/lỗi', () => {
    const attacks: Array<[string, string]> = [
      ['import js', 'import js\ndef solve(nums): return 0'],
      ['import os', 'import os\ndef solve(nums): return 0'],
      ['import sys', 'import sys\ndef solve(nums): return 0'],
      [
        'from pyodide.code import run_js',
        'from pyodide.code import run_js\ndef solve(nums): return run_js("1")',
      ],
      ['__import__ os', "def solve(nums): return __import__('os')"],
      ['().__class__.__mro__', 'def solve(nums): return ().__class__.__mro__'],
      [
        'subclasses',
        'def solve(nums): return [c for c in ().__class__.__base__.__subclasses__()]',
      ],
      ['lambda.__globals__', 'def solve(nums): return (lambda: 0).__globals__'],
      [
        'gi_frame',
        'def solve(nums): return (x for x in []).gi_frame.f_globals',
      ],
      ['str.format', 'def solve(nums): return "{0.__class__}".format(1)'],
      ['getattr', "def solve(nums): return getattr(1, 'real')"],
      ['open', "def solve(nums): return open('/etc/passwd').read()"],
      ['eval', "def solve(nums): return eval('1')"],
      ['re.enum.sys', 'import re\ndef solve(nums): return re.enum.sys.modules'],
      [
        'collections.sys',
        'import collections\ndef solve(nums): return collections.sys',
      ],
      ['exec', "def solve(nums):\n    exec('x=1')\n    return 0"],
      [
        'match class dunder',
        'def solve(nums):\n    match 1:\n        case object(__class__=c):\n            return c\n    return 0',
      ],
      [
        'import as __builtins__',
        'import math as __builtins__\ndef solve(nums): return 0',
      ],
      [
        'def __builtins__',
        'def __builtins__(): pass\ndef solve(nums): return 0',
      ],
      [
        'singledispatch eval gadget',
        [
          'import functools',
          'def f(x: "(LEAK := ().__class__.__base__.__subclasses__())"): pass',
          'def solve(nums):',
          '    functools.singledispatch(lambda x: 0).register(f)',
          '    return len(LEAK)',
        ].join('\n'),
      ],
      [
        'typing.get_type_hints eval gadget',
        [
          'import typing',
          'def f(x: "(LEAK := ().__class__.__base__.__subclasses__())"): pass',
          'def solve(nums):',
          '    typing.get_type_hints(f)',
          '    return len(LEAK)',
        ].join('\n'),
      ],
      ['async', 'async def solve(nums): return 0'],
      [
        'globals via function attr',
        'def g(): pass\ndef solve(nums): return g.__globals__',
      ],
      ['relative import', 'from . import x\ndef solve(nums): return 0'],
      ['dotted import', 'import collections.abc\ndef solve(nums): return 0'],
      ['type()', 'def solve(nums): return type(1)'],
      ['vars', 'def solve(nums): return vars()'],
    ];

    let results: GradeResult[];
    beforeAll(async () => {
      results = await gradeAll(attacks.map(([, c]) => c));
    });

    attacks.forEach(([name], i) => {
      it(`chặn: ${name}`, () => {
        const r = results[i];
        expect(notPerfect(r)).toBe(true);
        // Không có dấu hiệu rò rỉ nào trong kết quả trả client.
        const text = JSON.stringify(r);
        expect(text).not.toMatch(/LEAK|process|require|\/etc\/passwd|root:/);
      });
    });

    it('đoạn qua kiểm tra tĩnh nhưng sai lúc chạy: không có thuộc tính module con', () => {
      const idx = (n: string) => attacks.findIndex(([x]) => x === n);
      for (const n of ['re.enum.sys', 'collections.sys']) {
        const r = results[idx(n)];
        expect(r.status).toBe('graded');
        expect(r.passed).toBe(0);
        expect(r.publicResults[0].error).toMatch(/AttributeError/);
      }
      for (const n of [
        'singledispatch eval gadget',
        'typing.get_type_hints eval gadget',
      ]) {
        const r = results[idx(n)];
        expect(r.passed).toBe(0);
        expect(r.publicResults[0]?.error ?? '').toMatch(
          /AttributeError|NameError/,
        );
      }
    });
  });

  describe('thời gian và bộ nhớ', () => {
    it('while True ở top-level: error, không treo', async () => {
      const t = Date.now();
      const [r] = await gradeAll([
        'while True:\n    pass\ndef solve(nums): return 0',
      ]);
      expect(r.status).toBe('error');
      expect(r.message).toContain('Quá thời gian');
      expect(Date.now() - t).toBeLessThan(20_000);
    });

    it('while True trong solve: TIMEOUT, tiến trình vẫn chạy tiếp', async () => {
      const t = Date.now();
      const [r] = await gradeAll([
        'def solve(nums):\n    while True:\n        pass\n',
      ]);
      expect(r.status).toBe('graded');
      expect(r.passed).toBe(0);
      expect(r.publicResults.every((x) => x.error === 'TIMEOUT')).toBe(true);
      expect(Date.now() - t).toBeLessThan(30_000);
      const [ok] = await gradeAll([GOOD_EVENS]);
      expect(ok.passed).toBe(ok.total);
    });

    it('chỉ một input lặp vô hạn: các test khác vẫn được chấm (dựng lại worker)', async () => {
      const [r] = await gradeAll([
        [
          'def solve(nums):',
          '    if nums == [0]:',
          '        while True: pass',
          '    return sum(x for x in nums if x % 2 == 0)',
        ].join('\n'),
      ]);
      expect(r.status).toBe('graded');
      expect(r.passed).toBe(r.total - 1);
    });

    it('đệ quy vô hạn: RecursionError, không sập', async () => {
      const [r] = await gradeAll([
        'def solve(nums):\n    return solve(nums)\n',
      ]);
      expect(r.status).toBe('graded');
      expect(r.passed).toBe(0);
      expect(r.publicResults[0].error).toMatch(/RecursionError|TIMEOUT|CRASH/);
    });

    it('cấp phát lớn: MemoryError/TIMEOUT, test sau vẫn chạy', async () => {
      const [r] = await gradeAll([
        'def solve(nums):\n    return [0] * (10 ** 9)\n',
      ]);
      expect(r.passed).toBe(0);
      const [ok] = await gradeAll([GOOD_EVENS]);
      expect(ok.passed).toBe(ok.total);
    });

    it('in rất nhiều không làm hỏng kết quả', async () => {
      const [r] = await gradeAll([
        'def solve(nums):\n    for i in range(20000):\n        print("x" * 100)\n    return sum(x for x in nums if x % 2 == 0)\n',
      ]);
      expect(r.passed).toBe(r.total);
    });
  });

  describe('đồng thời', () => {
    it('quá hàng đợi -> GRADER_BUSY; tắt -> GRADER_DISABLED', async () => {
      const g = new ArenaGraderService();
      process.env.ARENA_GRADER_CONCURRENCY = '1';
      try {
        const running = Array.from({ length: 7 }, () =>
          g.grade(GOOD_EVENS, evens),
        );
        let err: unknown;
        try {
          await g.grade(GOOD_EVENS, evens);
        } catch (e) {
          err = e;
        }
        expect(err).toBeInstanceOf(ArenaHttpError);
        expect((err as ArenaHttpError).arenaCode).toBe('GRADER_BUSY');
        await Promise.all(running);
      } finally {
        process.env.ARENA_GRADER_CONCURRENCY = '4';
      }

      process.env.ARENA_GRADER_ENABLED = 'false';
      try {
        expect(() => g.assertAvailable()).toThrow(ArenaHttpError);
      } finally {
        delete process.env.ARENA_GRADER_ENABLED;
      }
    });
  });
});
