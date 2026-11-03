// Hiển thị nội dung bài/bình luận: văn bản thường giữ xuống dòng, khối ```code``` hiện trong <pre>.
// Không dùng dangerouslySetInnerHTML: React tự escape nên nội dung người dùng không chèn được HTML.
import { cn } from '@/components/ui';

export default function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split('```');
  return (
    <div className={cn('break-words text-sm leading-relaxed text-fg', className)}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          // Bỏ dòng đầu nếu chỉ là tên ngôn ngữ (```python).
          <pre key={i} className="my-2 overflow-x-auto rounded-md bg-surface-2 p-3 font-mono text-[13px] leading-snug">
            <code>{p.replace(/^[a-zA-Z+#]*\n/, '').replace(/\n$/, '')}</code>
          </pre>
        ) : p ? (
          <p key={i} className="whitespace-pre-wrap">{p}</p>
        ) : null,
      )}
    </div>
  );
}
