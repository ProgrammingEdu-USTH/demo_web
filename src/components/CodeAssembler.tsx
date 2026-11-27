import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { HighlightableThread } from '../context/HighlightContext';

interface CodeAssemblerProps {
  snappedSlots: Record<HighlightableThread, boolean>;
  onSnapSlot: (slot: HighlightableThread) => void;
  onSnapAll: () => void;
  onAdvanceToStep7: () => void;
}

const SLOT_TOOLS: Array<{
  key: HighlightableThread;
  label: string;
  chipBg: string;
  border: string;
  initCode: string;
  loopCode: string;
}> = [
  {
    key: 'queue',
    label: 'Queue (FIFO)',
    chipBg: 'bg-[#BAE6FD]',
    border: 'border-[#0284C7]',
    initCode: 'queue = deque([start])',
    loopCode: 'u = queue.popleft()  # ... queue.append(v)',
  },
  {
    key: 'visited',
    label: 'Set visited',
    chipBg: 'bg-[#DDD6FE]',
    border: 'border-[#7C3AED]',
    initCode: 'visited = {start}',
    loopCode: 'if v not in visited: visited.add(v)',
  },
  {
    key: 'parent',
    label: 'Dict parent',
    chipBg: 'bg-[#BBF7D0]',
    border: 'border-[#16A34A]',
    initCode: 'parent = {start: None}',
    loopCode: 'parent[v] = u',
  },
];

export const CodeAssembler: React.FC<CodeAssemblerProps> = ({
  snappedSlots,
  onSnapSlot,
  onSnapAll,
  onAdvanceToStep7,
}) => {
  const allSnapped =
    snappedSlots.queue && snappedSlots.visited && snappedSlots.parent;

  return (
    <div className="flex flex-col justify-between gap-2.5 overflow-hidden rounded-[8px] border-[1.5px] border-[#1E293B] bg-[#FFFDF9] shadow-[3px_3px_0_#1E293B]">
      {/* Window Header */}
      <div className="flex items-center justify-between gap-2 border-b-[1.5px] border-[#1E293B] bg-[#F1EDE2] px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-[#1E293B] bg-[#FECACA]" />
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-[#1E293B] bg-[#FDE68A]" />
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-[#1E293B] bg-[#BBF7D0]" />
          <span className="ml-1 truncate font-mono text-[10.5px] font-bold text-[#1E293B]">
            bfs_shortest.py
          </span>
        </div>
        <span className="shrink-0 font-mono text-[9.5px] font-extrabold text-[#15803D]">
          MIND-TO-CODE
        </span>
      </div>

      {/* Code Frame with 3 Snappable Dashed Slots */}
      <div className="flex-1 space-y-1 px-2.5 py-1 font-mono text-[10.5px] leading-5">
        <div className="font-bold text-[#1E293B]">
          <span className="text-[#7C3AED]">def</span> bfs(graph, start, goal):
        </div>

        {/* Init Slots */}
        {SLOT_TOOLS.map((tool) => {
          const snapped = snappedSlots[tool.key];
          return (
            <div key={`init-${tool.key}`} className="pl-3">
              {snapped ? (
                <motion.div
                  initial={{ scale: 0.94, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`rounded border-l-[3px] px-2 py-0.5 font-bold text-[#1E293B] ${tool.border} ${tool.chipBg}/70`}
                >
                  {tool.initCode}
                </motion.div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSnapSlot(tool.key)}
                  className={`w-full rounded border-[1.5px] border-dashed px-2 py-0.5 text-left font-semibold text-slate-500 transition-colors hover:text-[#1E293B] ${tool.border} bg-[#F7F5EE]`}
                >
                  {`[ + Lắp ${tool.label} ]`}
                </button>
              )}
            </div>
          );
        })}

        <div className="pl-3 text-slate-600">
          <span className="font-bold text-[#7C3AED]">while</span>{' '}
          {snappedSlots.queue ? 'queue:' : '[ ... ]:'}
        </div>

        <div className="pl-6">
          {snappedSlots.queue ? (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded bg-[#BAE6FD]/70 px-1.5 py-0.5 font-bold text-[#0369A1]"
            >
              u = queue.popleft()
            </motion.span>
          ) : (
            <span className="text-slate-400">[ lấy đỉnh tiếp theo ]</span>
          )}
        </div>

        <div className="pl-6 text-slate-600">
          <span className="font-bold text-[#7C3AED]">for</span> v{' '}
          <span className="font-bold text-[#7C3AED]">in</span> graph[u]:
        </div>

        <div className="space-y-1 pl-9">
          {snappedSlots.visited ? (
            <motion.div
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded border-l-[3px] border-l-[#7C3AED] bg-[#DDD6FE]/70 px-1.5 py-0.5 font-bold text-[#5B21B6]"
            >
              if v not in visited: visited.add(v)
            </motion.div>
          ) : (
            <div className="rounded border border-dashed border-[#7C3AED] bg-[#F7F5EE] px-1.5 py-0.5 text-slate-400">
              [ chặn lặp bằng Set ]
            </div>
          )}

          {snappedSlots.parent ? (
            <motion.div
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded border-l-[3px] border-l-[#16A34A] bg-[#BBF7D0]/75 px-1.5 py-0.5 font-bold text-[#15803D]"
            >
              parent[v] = u
            </motion.div>
          ) : (
            <div className="rounded border border-dashed border-[#16A34A] bg-[#F7F5EE] px-1.5 py-0.5 text-slate-400">
              [ ghi dấu cha bằng Dict ]
            </div>
          )}

          {snappedSlots.queue ? (
            <motion.div
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded border-l-[3px] border-l-[#0284C7] bg-[#BAE6FD]/70 px-1.5 py-0.5 font-bold text-[#0369A1]"
            >
              queue.append(v)
            </motion.div>
          ) : (
            <div className="rounded border border-dashed border-[#0284C7] bg-[#F7F5EE] px-1.5 py-0.5 text-slate-400">
              [ đẩy vào Queue ]
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="space-y-2 border-t-[1.5px] border-[#1E293B] bg-[#FAF8F2] p-2.5">
        <div className="flex flex-wrap gap-1.5">
          {SLOT_TOOLS.map((tool) => {
            const snapped = snappedSlots[tool.key];
            return (
              <button
                key={tool.key}
                type="button"
                disabled={snapped}
                onClick={() => onSnapSlot(tool.key)}
                className={`flex items-center gap-1 rounded border-[1.5px] border-[#1E293B] px-2 py-0.5 font-mono text-[10px] font-bold transition-all ${
                  snapped
                    ? `${tool.chipBg} opacity-60`
                    : `${tool.chipBg} shadow-[1.5px_1.5px_0_#1E293B] hover:brightness-95`
                }`}
              >
                {snapped && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                <span>{tool.label}</span>
              </button>
            );
          })}
        </div>

        {!allSnapped ? (
          <button
            type="button"
            onClick={onSnapAll}
            className="flex w-full items-center justify-center gap-1.5 rounded-[6px] border-[1.5px] border-[#1E293B] bg-[#FEF08A] px-3 py-1.5 font-mono text-[11px] font-extrabold text-[#1E293B] shadow-[2px_2px_0_#1E293B] hover:bg-[#FDE047]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Lắp 3 công cụ vào Code</span>
          </button>
        ) : (
          <motion.button
            type="button"
            onClick={onAdvanceToStep7}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex w-full items-center justify-center gap-1.5 rounded-[6px] border-[1.5px] border-[#1E293B] bg-[#BBF7D0] px-3 py-1.5 font-sans text-xs font-extrabold text-[#1E293B] shadow-[2px_2px_0_#1E293B] hover:bg-[#86EFAC]"
          >
            <span>Chạy mô phỏng hoàn chỉnh</span>
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        )}
      </div>
    </div>
  );
};
