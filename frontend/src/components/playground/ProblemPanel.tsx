'use client';

import { Badge, ErrorState, Skeleton } from '@/components/ui';
import type { PlaygroundProblem } from '@/lib/playground-api';

export type ProblemState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; problem: PlaygroundProblem };

const DIFFICULTY: Record<string, string> = { easy: 'Dễ', medium: 'Vừa' };

// Đề hiển thị dạng văn bản thuần (statement có thể chứa ký tự < >): React tự escape, không dùng innerHTML.
export default function ProblemPanel({ state }: { state: ProblemState }) {
  if (state.status === 'loading')
    return (
      <div className="space-y-3 p-4" aria-busy="true">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  if (state.status !== 'ready') return <ErrorState compact title="Không tải được đề" />;
  const p = state.problem;
  return (
    <article className="space-y-4 p-4 text-sm">
      <header className="space-y-2">
        <h2 className="m-0 text-lg font-bold tracking-tight">{p.title}</h2>
        <Badge>{DIFFICULTY[p.difficulty] ?? p.difficulty}</Badge>
      </header>
      <p className="m-0 whitespace-pre-wrap leading-relaxed">{p.statement}</p>
      <section>
        <h3 className="m-0 mb-1 text-sm font-semibold">Chữ ký hàm</h3>
        <pre className="m-0 overflow-x-auto rounded-md bg-surface-2 p-2 font-mono text-xs">{p.signature}</pre>
      </section>
      <section>
        <h3 className="m-0 mb-1 text-sm font-semibold">Ví dụ mẫu</h3>
        <ul className="m-0 list-none space-y-2 p-0">
          {p.sampleTests.map((t, i) => (
            <li key={i} className="rounded-md bg-surface-2 p-2 font-mono text-xs">
              <div>vào: {JSON.stringify(t.args)}</div>
              <div>ra: {JSON.stringify(t.expected)}</div>
            </li>
          ))}
        </ul>
      </section>
      <p className="m-0 text-xs text-fg-muted">
        “Chạy ví dụ” chỉ thử các ví dụ mẫu ở trên. Bài thật còn các test ẩn — chấm trong Arena.
      </p>
    </article>
  );
}
