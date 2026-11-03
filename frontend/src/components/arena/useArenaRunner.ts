'use client';

// Chạy thử phía client qua Web Worker (chỉ ví dụ công khai; KHÔNG phải kết quả chính thức).
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ProblemExample, PublicResult } from '@/lib/arena-api';

export interface RunnerOutput {
  lines: { text: string; tone?: 'ok' | 'err' | 'muted' }[];
  results: PublicResult[];
  meta: string;
}

const LOAD_LIMIT_MS = 30000; // nạp Pyodide
const RUN_LIMIT_MS = 5000; // thực thi, tính từ lúc worker báo ready

export function useArenaRunner() {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<RunnerOutput | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const fail = useCallback(
    (text: string) => {
      cleanup();
      setRunning(false);
      setOutput({ lines: [{ text, tone: 'err' }], results: [], meta: 'lỗi' });
    },
    [cleanup],
  );

  const stop = useCallback(() => {
    cleanup();
    setRunning(false);
    setOutput({ lines: [{ text: 'Đã dừng.', tone: 'muted' }], results: [], meta: 'đã dừng' });
  }, [cleanup]);

  const run = useCallback(
    (code: string, examples: ProblemExample[]) => {
      cleanup();
      setRunning(true);
      setOutput(null);
      let worker: Worker;
      try {
        worker = new Worker('/static/js/arena-run.worker.js');
      } catch {
        fail('Trình duyệt không khởi tạo được bộ chạy thử.');
        return;
      }
      workerRef.current = worker;
      timerRef.current = setTimeout(() => fail('Quá thời gian nạp Python. Thử lại sau.'), LOAD_LIMIT_MS);
      const started = performance.now();
      worker.onmessage = (ev: MessageEvent) => {
        const d = ev.data as {
          type: string;
          message?: string;
          defError?: string | null;
          out?: string;
          results?: PublicResult[];
        };
        if (d.type === 'ready') {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(
            () => fail('Quá 5 giây — đã dừng chương trình (có thể vòng lặp vô hạn).'),
            RUN_LIMIT_MS,
          );
          return;
        }
        if (d.type === 'fatal') {
          fail(d.message || 'Không chạy được Python.');
          return;
        }
        if (d.type === 'result') {
          cleanup();
          const results = d.results ?? [];
          const lines: RunnerOutput['lines'] = [];
          if (d.out) lines.push(...d.out.split('\n').filter((l, i, a) => l !== '' || i < a.length - 1).map((text) => ({ text })));
          if (d.defError) lines.push({ text: d.defError, tone: 'err' });
          const ok = results.filter((r) => r.passed).length;
          if (!d.defError) {
            lines.push({
              text: `${ok}/${results.length} ví dụ công khai đạt (chạy thử, không phải kết quả chấm).`,
              tone: ok === results.length ? 'ok' : 'muted',
            });
          }
          setOutput({ lines, results, meta: `${Math.round(performance.now() - started)} ms` });
          setRunning(false);
        }
      };
      worker.onerror = () => fail('Bộ chạy thử gặp lỗi.');
      worker.postMessage({ code, examples });
    },
    [cleanup, fail],
  );

  return { running, output, run, stop };
}
