import React from 'react';
import { ArrowRight, Check, Layers, Lock } from 'lucide-react';
import { HighlightableThread, useHighlight } from '../context/HighlightContext';
import { BfsLessonStep } from '../data/bfsLesson';

interface MacroPipelineProps {
  step: BfsLessonStep;
  liveCurrentNode: string;
  liveQueueLength: string;
  pipelineUnlocked: boolean;
  lockedWinners: Record<HighlightableThread, boolean>;
}

const PIPELINE_STAGES: Array<{
  key: HighlightableThread;
  label: string;
  activeCls: string;
}> = [
  {
    key: 'queue',
    label: '1. Duyệt lớp (Queue)',
    activeCls: 'bg-[#BAE6FD] border-[#0284C7] shadow-[3px_3px_0_#1E293B]',
  },
  {
    key: 'visited',
    label: '2. Chống lặp (Visited)',
    activeCls: 'bg-[#DDD6FE] border-[#7C3AED] shadow-[3px_3px_0_#1E293B]',
  },
  {
    key: 'parent',
    label: '3. Truy vết (Parent)',
    activeCls: 'bg-[#BBF7D0] border-[#16A34A] shadow-[3px_3px_0_#1E293B]',
  },
];

export const MacroPipeline: React.FC<MacroPipelineProps> = ({
  step,
  liveCurrentNode,
  liveQueueLength,
  pipelineUnlocked,
  lockedWinners,
}) => {
  const { hoveredThread, setHoveredThread } = useHighlight();

  return (
    <header className="shrink-0 border-b-[1.5px] border-[#1E293B] bg-[#FAF8F2] px-3 py-2 sm:px-5 sm:py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Title + Concept Recipe Badge */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[8px] border-[1.5px] border-[#1E293B] bg-[#BAE6FD] shadow-[2px_2px_0_#1E293B]">
            <Layers className="h-4 w-4 text-[#1E293B]" />
          </div>
          <div className="leading-tight">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-extrabold text-[#1E293B] sm:text-sm">
                BFS Shortest Path
              </span>
              {pipelineUnlocked ? (
                <span className="inline-flex items-center gap-1 rounded-[6px] border-[1.5px] border-[#1E293B] bg-[#FFFDF9] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#1E293B]">
                  <span>BFS =</span>
                  <span className="rounded bg-[#BAE6FD] px-1 text-[#0369A1]">
                    Queue
                  </span>
                  <span>+</span>
                  <span className="rounded bg-[#DDD6FE] px-1 text-[#6D28D9]">
                    Set
                  </span>
                  <span>+</span>
                  <span className="rounded bg-[#BBF7D0] px-1 text-[#15803D]">
                    Dict
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-[6px] border-[1.5px] border-dashed border-[#1E293B]/60 bg-[#F7F5EE] px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                  BFS = ? + ? + ?
                </span>
              )}
            </div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              GUIDED DISCOVERY • PHA {step.phase}/4
            </div>
          </div>
        </div>

        {/* Center: 3 Connected Macro Pipeline Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {!pipelineUnlocked ? (
            [1, 2, 3].map((num, idx) => (
              <React.Fragment key={num}>
                <div className="flex items-center gap-1 rounded-[8px] border-[1.5px] border-dashed border-[#1E293B]/40 bg-[#F7F5EE] px-2.5 py-1 font-mono text-[11px] font-bold text-slate-500">
                  <Lock className="h-3 w-3" />
                  <span>{`Mảnh ghép ${num}`}</span>
                </div>
                {idx < 2 && (
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                )}
              </React.Fragment>
            ))
          ) : (
            PIPELINE_STAGES.map((stage, idx) => {
              const isCompleted =
                lockedWinners[stage.key] ||
                step.completedStages.includes(stage.key);
              const isActive =
                step.macroStage === stage.key ||
                step.macroStage === 'unified' ||
                step.macroStage === 'limit';
              const isHovered = hoveredThread === stage.key;

              return (
                <React.Fragment key={stage.key}>
                  <div
                    onMouseEnter={() => setHoveredThread(stage.key)}
                    onMouseLeave={() => setHoveredThread(null)}
                    className={`flex cursor-default items-center gap-1.5 rounded-[8px] border-[1.5px] px-2.5 py-1 font-mono text-[11px] font-bold transition-all ${
                      isActive
                        ? `${stage.activeCls} scale-[1.02] text-[#1E293B]`
                        : isCompleted
                          ? 'border-[#1E293B] bg-white text-[#1E293B] shadow-[2px_2px_0_#1E293B]'
                          : 'border-[#1E293B]/35 bg-[#F7F5EE] text-slate-500 opacity-60'
                    } ${isHovered ? 'ring-2 ring-[#1E293B] ring-offset-1' : ''}`}
                  >
                    {isCompleted && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#1E293B] bg-[#BBF7D0] text-[#15803D]">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    )}
                    <span>{stage.label}</span>
                  </div>
                  {idx < PIPELINE_STAGES.length - 1 && (
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Right: 3 Live Compact Metrics */}
        <div className="flex items-center gap-2">
          <div className="rounded-[8px] border-[1.5px] border-[#1E293B] bg-white px-2.5 py-1 shadow-[2px_2px_0_#1E293B]">
            <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">
              Bước
            </div>
            <div className="font-mono text-xs font-bold text-[#1E293B]">
              {step.metrics.stepLabel}
            </div>
          </div>

          <div className="rounded-[8px] border-[1.5px] border-[#1E293B] bg-white px-2.5 py-1 shadow-[2px_2px_0_#1E293B]">
            <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">
              Trạng thái
            </div>
            <div className="font-mono text-xs font-bold text-[#1E293B]">
              {liveCurrentNode}
            </div>
          </div>

          <div className="rounded-[8px] border-[1.5px] border-[#1E293B] bg-[#BAE6FD]/60 px-2.5 py-1 shadow-[2px_2px_0_#1E293B]">
            <div className="text-[9.5px] font-semibold uppercase tracking-wide text-[#1E293B]/75">
              Tiêu điểm
            </div>
            <div className="font-mono text-xs font-bold text-[#1E293B]">
              {liveQueueLength}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
