import { HttpStatus, Injectable } from '@nestjs/common';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { ArenaHttpError } from './arena.errors';
import { HARNESS_PY } from './grader/harness.py';
import { WORKER_SOURCE } from './grader/worker-source';
import type { ArenaProblem } from './problems';

export const LOAD_TIMEOUT_MS = 15_000;
export const DEFINE_TIMEOUT_MS = 2_000;
export const TOTAL_TIMEOUT_MS = 30_000;
export const MAX_REBUILDS = 3;
export const MAX_QUEUE = 6;
export const MAX_TEXT = 200;

const RESOURCE_LIMITS = {
  maxOldGenerationSizeMb: 256,
  maxYoungGenerationSizeMb: 32,
  stackSizeMb: 4,
} as const;

export interface PublicResult {
  index: number;
  passed: boolean;
  got?: string;
  error?: string;
}

export interface GradeResult {
  status: 'graded' | 'rejected' | 'error';
  message: string | null;
  passed: number;
  total: number;
  publicResults: PublicResult[];
  hiddenPassed: number;
  hiddenTotal: number;
}

interface CallResult {
  ok: boolean;
  json?: string;
  repr?: string;
  error?: string;
}

type WorkerEnd =
  | { kind: 'done' }
  | { kind: 'rejected'; message: string }
  | { kind: 'defineError'; message: string }
  | { kind: 'defineTimeout' }
  | { kind: 'loadFailed' }
  | { kind: 'callTimeout' }
  | { kind: 'totalTimeout' }
  | { kind: 'crash' };

/** So sánh sâu nghiêm ngặt giữa hai giá trị JSON (kiểu phải khớp: true ≠ 1). */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((x, i) => jsonEqual(x, b[i]));
  }
  if (typeof a === 'object') {
    const ka = Object.keys(a);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    return ka.every(
      (k) =>
        Object.prototype.hasOwnProperty.call(b, k) &&
        jsonEqual(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
        ),
    );
  }
  return a === b;
}

function cut(s: string | undefined): string | undefined {
  return s === undefined ? undefined : s.slice(0, MAX_TEXT);
}

/**
 * Chấm bài trong worker_threads + Pyodide. Mỗi lần chấm một worker mới; parent
 * đếm giờ và terminate(). `expected` KHÔNG BAO GIỜ được đưa vào worker.
 * Bán đồng thời: tối đa ARENA_GRADER_CONCURRENCY (mặc định 1), hàng đợi ≤ 6.
 */
@Injectable()
export class ArenaGraderService {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  isEnabled(): boolean {
    return (
      (process.env.ARENA_GRADER_ENABLED ?? 'true').toLowerCase() !== 'false'
    );
  }

  private concurrency(): number {
    const n = Number(process.env.ARENA_GRADER_CONCURRENCY ?? 1);
    return Number.isInteger(n) && n >= 1 && n <= 8 ? n : 1;
  }

  /** Kiểm tra nhanh trước khi nhận bài (không giữ chỗ). */
  assertAvailable(): void {
    if (!this.isEnabled()) {
      throw new ArenaHttpError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'GRADER_DISABLED',
        'Hệ thống chấm bài đang tạm tắt',
      );
    }
    if (this.active >= this.concurrency() && this.waiters.length >= MAX_QUEUE) {
      throw new ArenaHttpError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'GRADER_BUSY',
        'Hệ thống chấm đang bận, thử lại sau',
      );
    }
  }

  private async acquire(): Promise<void> {
    this.assertAvailable();
    if (this.active < this.concurrency()) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next)
      next(); // chuyển nguyên suất cho người chờ
    else this.active--;
  }

  async grade(code: string, problem: ArenaProblem): Promise<GradeResult> {
    await this.acquire();
    try {
      return await this.run(code, problem);
    } finally {
      this.release();
    }
  }

  private async run(code: string, problem: ArenaProblem): Promise<GradeResult> {
    const tests = [...problem.publicTests, ...problem.hiddenTests];
    const publicCount = problem.publicTests.length;
    const total = tests.length;
    const base = (
      status: GradeResult['status'],
      message: string,
    ): GradeResult => ({
      status,
      message,
      passed: 0,
      total,
      publicResults: [],
      hiddenPassed: 0,
      hiddenTotal: total - publicCount,
    });

    let pyodidePath: string;
    try {
      pyodidePath = path.dirname(require.resolve('pyodide'));
    } catch {
      return base('error', 'Hệ thống chấm chưa sẵn sàng');
    }

    const results: Array<CallResult | undefined> = Array.from({
      length: total,
    });
    const startedAt = Date.now();
    const totalDeadline = startedAt + TOTAL_TIMEOUT_MS;
    let next = 0;
    let rebuilds = 0;
    let firstRun = true;

    while (next < total) {
      const calls = tests
        .slice(next)
        .map((t, i) => ({ index: next + i, args: t.args })); // chỉ args
      const end = await this.runWorker({
        pyodidePath,
        code,
        calls,
        perTestMs: problem.perTestMs,
        totalDeadline,
        onResult: (index, r) => {
          results[index] = r;
          next = Math.max(next, index + 1);
        },
      });

      if (end.kind === 'done') break;
      if (end.kind === 'rejected') return base('rejected', end.message);
      if (firstRun && next === 0) {
        // Chưa chấm được test nào: lỗi ở pha nạp/khai báo.
        if (end.kind === 'defineError') return base('error', end.message);
        if (end.kind === 'defineTimeout') {
          return base('error', 'Quá thời gian khi chạy mã khai báo');
        }
        if (end.kind === 'loadFailed') {
          return base('error', 'Hệ thống chấm gặp sự cố, hãy thử lại');
        }
      }
      firstRun = false;
      if (end.kind === 'defineError' || end.kind === 'defineTimeout') {
        // Dựng lại worker (lần sau) mà mã khai báo lỗi/quá giờ: các test còn lại sai.
        for (let i = next; i < total; i++)
          results[i] = { ok: false, error: 'TIMEOUT' };
        break;
      }
      if (end.kind === 'totalTimeout') {
        for (let i = next; i < total; i++)
          results[i] = { ok: false, error: 'TIMEOUT' };
        break;
      }
      if (end.kind === 'loadFailed') {
        for (let i = next; i < total; i++)
          results[i] = { ok: false, error: 'CRASH' };
        break;
      }
      // callTimeout | crash: test đang chạy hỏng, dựng worker mới cho phần còn lại.
      results[next] = {
        ok: false,
        error: end.kind === 'callTimeout' ? 'TIMEOUT' : 'CRASH',
      };
      next += 1;
      rebuilds += 1;
      if (rebuilds > MAX_REBUILDS) {
        for (let i = next; i < total; i++)
          results[i] = { ok: false, error: 'TIMEOUT' };
        break;
      }
    }

    let passed = 0;
    let hiddenPassed = 0;
    const publicResults: PublicResult[] = [];
    tests.forEach((t, i) => {
      const r = results[i] ?? { ok: false, error: 'TIMEOUT' };
      let good = false;
      if (r.ok && typeof r.json === 'string') {
        try {
          good = jsonEqual(JSON.parse(r.json), t.expected);
        } catch {
          good = false;
        }
      }
      if (good) passed++;
      if (i < publicCount) {
        const item: PublicResult = { index: i, passed: good };
        const got = cut(r.repr);
        const error = cut(r.error);
        if (got !== undefined) item.got = got;
        if (error !== undefined && !good) item.error = error;
        publicResults.push(item);
      } else if (good) {
        hiddenPassed++;
      }
    });

    return {
      status: 'graded',
      message: null,
      passed,
      total,
      publicResults,
      hiddenPassed,
      hiddenTotal: total - publicCount,
    };
  }

  private runWorker(opts: {
    pyodidePath: string;
    code: string;
    calls: Array<{ index: number; args: unknown[] }>;
    perTestMs: number;
    totalDeadline: number;
    onResult: (index: number, r: CallResult) => void;
  }): Promise<WorkerEnd> {
    return new Promise<WorkerEnd>((resolve) => {
      let settled = false;
      let timer: NodeJS.Timeout | undefined;
      let phase: 'load' | 'define' | 'call' = 'load';

      const worker = new Worker(WORKER_SOURCE, {
        eval: true,
        env: {}, // không lộ DATABASE_URL/secret
        resourceLimits: { ...RESOURCE_LIMITS },
        stdout: true,
        stderr: true,
        workerData: {
          pyodidePath: opts.pyodidePath,
          code: opts.code,
          calls: opts.calls,
          harness: HARNESS_PY,
        },
      });
      // Xả đầu ra worker (không in ra tiến trình chính, không tích luỹ).
      worker.stdout.on('data', () => undefined);
      worker.stderr.on('data', () => undefined);

      const finish = (end: WorkerEnd) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        void worker.terminate().catch(() => undefined);
        resolve(end);
      };

      const arm = (ms: number) => {
        if (timer) clearTimeout(timer);
        const remaining = opts.totalDeadline - Date.now();
        timer = setTimeout(
          () => {
            if (Date.now() >= opts.totalDeadline) {
              finish({ kind: 'totalTimeout' });
            } else if (phase === 'load') {
              finish({ kind: 'loadFailed' });
            } else if (phase === 'define') {
              finish({ kind: 'defineTimeout' });
            } else {
              finish({ kind: 'callTimeout' });
            }
          },
          Math.max(1, Math.min(ms, remaining)),
        );
      };

      arm(LOAD_TIMEOUT_MS);

      worker.on('message', (m: Record<string, unknown>) => {
        if (settled || !m || typeof m !== 'object') return;
        switch (m.type) {
          case 'ready':
            phase = 'define';
            arm(DEFINE_TIMEOUT_MS);
            break;
          case 'rejected':
            finish({
              kind: 'rejected',
              message: String(m.message).slice(0, 300),
            });
            break;
          case 'defined':
            if (typeof m.error === 'string') {
              finish({ kind: 'defineError', message: m.error.slice(0, 300) });
            } else {
              phase = 'call';
              arm(opts.perTestMs);
            }
            break;
          case 'result': {
            const index = m.index;
            if (typeof index !== 'number') break;
            opts.onResult(index, {
              ok: m.ok === true,
              json: typeof m.json === 'string' ? m.json : undefined,
              repr: typeof m.repr === 'string' ? m.repr : undefined,
              error: typeof m.error === 'string' ? m.error : undefined,
            });
            arm(opts.perTestMs);
            break;
          }
          case 'done':
            finish({ kind: 'done' });
            break;
          case 'fatal':
            finish(
              phase === 'call' ? { kind: 'crash' } : { kind: 'loadFailed' },
            );
            break;
          default:
            break;
        }
      });
      worker.on('error', () => {
        finish(phase === 'call' ? { kind: 'crash' } : { kind: 'loadFailed' });
      });
      worker.on('exit', () => {
        finish(phase === 'call' ? { kind: 'crash' } : { kind: 'loadFailed' });
      });
    });
  }
}
