'use client';

import { useEffect, useRef } from 'react';

import { cn } from '@/components/ui';
import type { PlaygroundLang } from '@/lib/playground-samples';

export type ConsoleLine = { stream: 'stdout' | 'stderr' | 'system'; text: string };

type Props = {
  mode: PlaygroundLang;
  lines: ConsoleLine[];
  pyStatus: 'idle' | 'loading' | 'running';
  meta: string;
  /** 0 = chưa có khung xem trước; đổi số → dựng iframe mới. */
  frameKey: number;
  files: { html: string; css: string; js: string };
  onFrameLine: (line: ConsoleLine) => void;
  /** Phím bổ trợ theo hệ điều hành (⌘ trên Mac, Ctrl nơi khác). */
  modKey?: string;
};

function Console({ lines, empty, className }: { lines: ConsoleLine[]; empty: string; className?: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Tự cuộn xuống dòng mới nhất, nhưng không giành focus.
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [lines.length]);
  return (
    <div
      role="log"
      aria-label="Đầu ra"
      className={cn('overflow-auto bg-surface p-3 font-mono text-sm', className)}
    >
      {lines.length === 0 ? (
        <p className="m-0 text-fg-muted">{empty}</p>
      ) : (
        lines.map((l, i) => (
          <pre
            key={i}
            className={cn(
              'm-0 whitespace-pre-wrap break-words font-mono',
              l.stream === 'stderr' && 'text-danger',
              l.stream === 'system' && 'italic text-fg-muted',
            )}
          >
            {l.text}
          </pre>
        ))
      )}
      <div ref={end} />
    </div>
  );
}

export default function OutputPane({ mode, lines, pyStatus, meta, frameKey, files, onFrameLine, modKey = 'Ctrl' }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const filesRef = useRef(files);
  const onLineRef = useRef(onFrameLine);
  useEffect(() => {
    filesRef.current = files;
    onLineRef.current = onFrameLine;
  });

  // Nhận tin từ khung xem trước. Chỉ tin cửa sổ của chính iframe này (so `source`),
  // vì origin của nó là "null" nên không thể kiểm bằng `origin`.
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const win = frame.current?.contentWindow;
      if (!win || ev.source !== win) return;
      const d = ev.data;
      if (!d || d.source !== 'pg-frame') return;
      if (d.type === 'ready') {
        const f = filesRef.current;
        win.postMessage({ type: 'render', html: f.html, css: f.css, js: f.js }, '*');
      } else if (d.type === 'console' && typeof d.text === 'string') {
        onLineRef.current({ stream: d.level === 'error' || d.level === 'warn' ? 'stderr' : 'stdout', text: d.text.slice(0, 5000) });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (mode === 'python') {
    const status =
      pyStatus === 'loading' ? 'Đang chuẩn bị Python… (lần đầu mất vài giây)' : pyStatus === 'running' ? 'Đang chạy…' : meta ? `Xong · ${meta}` : '';
    return (
      <div className="flex h-full min-h-0 flex-col">
        <Console lines={lines} empty={`Bấm Chạy (hoặc ${modKey}+Enter) để xem kết quả ở đây.`} className="min-h-0 flex-1" />
        <p className="m-0 min-h-8 shrink-0 border-0 border-t border-solid border-border px-3 py-1.5 text-xs text-fg-muted" role="status">
          {status}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Cố ý giữ `bg-white` (không dùng token theme): khung xem trước HTML phải trắng như
          trình duyệt thật, vì trang người học viết không tự đặt nền sẽ mặc định nền trắng;
          nếu theo dark mode thì chữ đen mặc định của họ sẽ không đọc được. Không phải lỗi màu cứng. */}
      <div className="min-h-0 flex-[3] bg-white">
        {frameKey > 0 ? (
          <iframe
            key={frameKey}
            ref={frame}
            title="Xem trước"
            // KHÔNG thêm allow-same-origin: code người học phải chạy ở origin "null".
            sandbox="allow-scripts allow-modals"
            src="/static/playground/frame.html"
            // bg-white cố ý: nền mặc định của trang trong iframe là trong suốt → phải có nền trắng như trình duyệt thật.
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <p className="m-0 p-4 text-sm text-fg-muted">Bấm Chạy để xem trang của bạn ở đây.</p>
        )}
      </div>
      <p className="m-0 shrink-0 border-0 border-t border-solid border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-fg-muted">
        Console
      </p>
      <Console lines={lines} empty="console.log(...) sẽ hiện ở đây." className="min-h-0 flex-1" />
    </div>
  );
}
