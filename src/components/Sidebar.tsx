import React from 'react';
import { AlertTriangle, Compass, Lightbulb } from 'lucide-react';
import {
  HighlightableThread,
  ThreadKey,
  useHighlight,
} from '../context/HighlightContext';
import { BfsLessonStep, NodeId } from '../data/bfsLesson';

interface SidebarProps {
  step: BfsLessonStep;
  totalSteps: number;
  sandboxStart: NodeId;
  sandboxGoal: NodeId;
  sandboxFinalPath: NodeId[] | null;
}

const CALLOUT_HEADER_BG: Record<ThreadKey, string> = {
  queue: 'bg-[#BAE6FD]',
  visited: 'bg-[#DDD6FE]',
  parent: 'bg-[#BBF7D0]',
  bug: 'bg-[#FECACA]',
};

const CHIP_STYLES: Record<HighlightableThread, string> = {
  queue:
    'bg-[#BAE6FD] border-[#0284C7] text-[#0369A1] hover:ring-2 hover:ring-[#0284C7]',
  visited:
    'bg-[#DDD6FE] border-[#7C3AED] text-[#5B21B6] hover:ring-2 hover:ring-[#7C3AED]',
  parent:
    'bg-[#BBF7D0] border-[#16A34A] text-[#15803D] hover:ring-2 hover:ring-[#16A34A]',
};

export const Sidebar: React.FC<SidebarProps> = ({
  step,
  totalSteps,
  sandboxStart,
  sandboxGoal,
  sandboxFinalPath,
}) => {
  const { setHoveredThread } = useHighlight();
  const isWatchOut = step.callout.type === 'WATCH OUT';

  const renderInteractiveText = (text: string): React.ReactNode => {
    const parts = text.split(
      /(\[\[(?:queue|visited|parent):[^\]]+\]\]|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g
    );
    return parts.map((part, idx) => {
      const chipMatch = part.match(
        /^\[\[(queue|visited|parent):([^\]]+)\]\]$/
      );
      if (chipMatch) {
        const thread = chipMatch[1] as HighlightableThread;
        const label = chipMatch[2];
        return (
          <span
            key={idx}
            onMouseEnter={() => setHoveredThread(thread)}
            onMouseLeave={() => setHoveredThread(null)}
            className={`mx-0.5 inline-flex cursor-pointer items-center rounded border-[1.5px] px-1.5 py-0.2 font-mono text-[11.5px] font-extrabold transition-all ${CHIP_STYLES[thread]}`}
          >
            {label}
          </span>
        );
      }

      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            className="mx-0.5 rounded border border-[#1E293B]/25 bg-[#F1EDE2] px-1.5 py-0.5 font-mono text-[12px] font-semibold text-[#1E293B]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-bold text-[#1E293B]">
            {part.slice(2, -2)}
          </strong>
        );
      }

      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={idx} className="italic text-[#1E293B]">
            {part.slice(1, -1)}
          </em>
        );
      }

      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  return (
    <aside className="flex shrink-0 flex-col gap-4 overflow-y-auto border-t-[1.5px] border-[#1E293B] bg-[#FAF8F2] p-4 sm:p-5 lg:w-[35%] lg:border-l-[1.5px] lg:border-t-0">
      {/* Layer 1: Context Compass */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-[6px] border-[1.5px] border-[#1E293B] bg-[#1E293B] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#F7F5EE]">
            BƯỚC {step.id} / {totalSteps}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
            <Compass className="h-3.5 w-3.5 text-[#0284C7]" />
            <span>{step.contextCompass}</span>
          </span>
        </div>

        {/* Title */}
        <h1 className="text-lg font-extrabold leading-snug text-[#1E293B] sm:text-xl">
          {step.title}
        </h1>

        {/* Layer 2: Core "Why" Explanation */}
        <p className="text-[13.5px] leading-relaxed text-slate-700 sm:text-[14px]">
          {renderInteractiveText(step.whyExplanation)}
        </p>

        {step.phase === 3 && (
          <div className="rounded-[6px] border border-dashed border-[#1E293B]/35 bg-[#F7F5EE] px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">
            💡 Rê chuột vào các nhãn{' '}
            <span className="font-mono text-[#0369A1]">Queue</span>,{' '}
            <span className="font-mono text-[#5B21B6]">Set</span>,{' '}
            <span className="font-mono text-[#15803D]">Dict</span> để tô sáng
            đồng bộ Code + Sơ đồ!
          </div>
        )}
      </div>

      {/* Callout Box */}
      <div className="overflow-hidden rounded-[8px] border-[1.5px] border-[#1E293B] bg-white shadow-[3px_3px_0_#1E293B]">
        <div
          className={`flex items-center gap-2 border-b-[1.5px] border-[#1E293B] px-3 py-1.5 ${CALLOUT_HEADER_BG[step.callout.thread]}`}
        >
          {isWatchOut ? (
            <AlertTriangle className="h-4 w-4 text-[#1E293B]" />
          ) : (
            <Lightbulb className="h-4 w-4 text-[#1E293B]" />
          )}
          <span className="font-mono text-xs font-extrabold tracking-wider text-[#1E293B]">
            {step.callout.type}
          </span>
        </div>
        <div className="space-y-1 p-3.5">
          <div className="text-[13.5px] font-bold text-[#1E293B]">
            {step.callout.title}
          </div>
          <p className="text-[12.5px] leading-relaxed text-slate-700">
            {renderInteractiveText(step.callout.body)}
          </p>
        </div>
      </div>

      {/* Step 7 Sandbox Card */}
      {step.id === 7 && (
        <div className="rounded-[8px] border-[1.5px] border-[#1E293B] bg-[#FFFDF9] p-3.5 shadow-[3px_3px_0_#1E293B]">
          <div className="mb-2 flex items-center justify-between border-b border-[#E5E0D5] pb-1.5">
            <span className="font-mono text-[11px] font-extrabold uppercase tracking-wider text-[#1E293B]">
              PHÒNG THÍ NGHIỆM BFS
            </span>
            <span className="rounded border border-[#1E293B] bg-[#BBF7D0] px-1.5 py-0.5 font-mono text-[10px] font-bold">
              {sandboxStart} ➔ {sandboxGoal}
            </span>
          </div>
          <ul className="space-y-1.5 text-[12px] text-slate-700">
            <li>
              • Bấm lần lượt <strong>2 đỉnh</strong> trên đồ thị để đặt{' '}
              <code>Start</code> và <code>Goal</code> mới.
            </li>
            <li>
              • Bật/tắt <code>Queue</code>, <code>Visited</code>,{' '}
              <code>Parent</code> trên thanh tiêu đề đồ thị.
            </li>
            <li>
              • Đường ngắn nhất:{' '}
              <span className="font-mono font-extrabold text-[#15803D]">
                {sandboxFinalPath
                  ? `${sandboxFinalPath.join(' ➔ ')} (${sandboxFinalPath.length - 1} bước)`
                  : 'Nhấn "Chạy BFS" để tìm'}
              </span>
            </li>
          </ul>
        </div>
      )}
      {/* Step 9 Mini Coding Sandbox Spec Card */}
      {step.id === 9 && (
        <div className="rounded-[8px] border-[1.5px] border-[#1E293B] bg-[#FFFDF9] p-3.5 shadow-[3px_3px_0_#1E293B]">
          <div className="mb-2 flex items-center justify-between border-b border-[#E5E0D5] pb-1.5">
            <span className="font-mono text-[11px] font-extrabold uppercase tracking-wider text-[#1E293B]">
              ĐẶC TẢ BÀI TOÁN CON (-33%)
            </span>
            <span className="rounded border border-[#1E293B] bg-[#BAE6FD] px-1.5 py-0.5 font-mono text-[10px] font-bold">
              4 đỉnh • 5 cạnh
            </span>
          </div>
          <pre className="mb-2 overflow-x-auto rounded border border-[#1E293B]/25 bg-[#F7F5EE] p-2 font-mono text-[10.5px] leading-4 text-[#1E293B]">
{`mini_graph = {
  'A': ['B', 'C'],
  'B': ['A', 'C'],
  'C': ['D'],
  'D': []
}`}
          </pre>
          <ul className="space-y-1 text-[11.5px] text-slate-700">
            <li>
              • Trả về số nguyên <code>dist</code> nhỏ nhất từ <code>start</code>{' '}
              đến <code>goal</code>.
            </li>
            <li>
              • Trả về <code>-1</code> nếu không thể tới đích (ví dụ <code>D ➔ A</code>).
            </li>
          </ul>
        </div>
      )}
    </aside>
  );
};
