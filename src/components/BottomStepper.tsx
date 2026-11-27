import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { BfsLessonStep } from '../data/bfsLesson';

interface BottomStepperProps {
  steps: BfsLessonStep[];
  currentIndex: number;
  maxUnlockedIndex: number;
  isNextLocked: boolean;
  lockReason: string;
  isPlaying: boolean;
  onSelectStep: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onReplay: () => void;
}

const STAGE_ACTIVE_BG: Record<BfsLessonStep['macroStage'], string> = {
  overview: 'bg-white',
  queue: 'bg-[#BAE6FD]',
  visited: 'bg-[#DDD6FE]',
  parent: 'bg-[#BBF7D0]',
  unified: 'bg-[#BBF7D0]',
  limit: 'bg-[#FECACA]',
};

export const BottomStepper: React.FC<BottomStepperProps> = ({
  steps,
  currentIndex,
  maxUnlockedIndex,
  isNextLocked,
  lockReason,
  isPlaying,
  onSelectStep,
  onPrev,
  onNext,
  onTogglePlay,
  onReplay,
}) => {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;

  return (
    <footer className="shrink-0 border-t-[1.5px] border-[#1E293B] bg-[#FAF8F2] px-3 py-2.5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* IN THIS LESSON Clickable Milestones */}
        <div className="flex max-w-full flex-1 items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="mr-1 shrink-0 font-mono text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">
            IN THIS LESSON
          </span>
          {steps.map((s, idx) => {
            const isActive = idx === currentIndex;
            const isPassed = idx < currentIndex;
            const isLocked = idx > maxUnlockedIndex;
            const activeBg = STAGE_ACTIVE_BG[s.macroStage];

            return (
              <button
                key={s.id}
                type="button"
                disabled={isLocked}
                onClick={() => onSelectStep(idx)}
                title={isLocked ? 'Hoàn thành bước hiện tại để mở khóa' : s.title}
                className={`flex shrink-0 items-center gap-1 rounded-[6px] border-[1.5px] px-2 py-1 font-mono text-[11px] font-bold transition-all ${
                  isActive
                    ? `border-[#1E293B] ${activeBg} text-[#1E293B] shadow-[2px_2px_0_#1E293B]`
                    : isLocked
                      ? 'cursor-not-allowed border-[#1E293B]/20 bg-[#F1EDE2] text-slate-400'
                      : isPassed
                        ? 'border-[#1E293B]/45 bg-white text-[#1E293B] hover:border-[#1E293B]'
                        : 'border-[#1E293B]/25 bg-[#F7F5EE] text-slate-500 hover:border-[#1E293B] hover:text-[#1E293B]'
                }`}
              >
                {isLocked && <Lock className="h-2.5 w-2.5 shrink-0" />}
                <span>{s.milestoneLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Transport Controls */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="hidden items-center gap-1.5 font-mono text-[10.5px] text-slate-500 xl:flex">
            <kbd className="rounded border border-[#1E293B]/40 bg-white px-1.5 py-0.5 text-[#1E293B]">
              ←
            </kbd>
            <kbd className="rounded border border-[#1E293B]/40 bg-white px-1.5 py-0.5 text-[#1E293B]">
              →
            </kbd>
            <kbd className="rounded border border-[#1E293B]/40 bg-white px-1.5 py-0.5 text-[#1E293B]">
              Space
            </kbd>
          </div>

          <button
            type="button"
            onClick={onPrev}
            disabled={isFirst}
            className="flex items-center gap-1 rounded-[6px] border-[1.5px] border-[#1E293B] bg-white px-2.5 py-1.5 font-mono text-xs font-bold text-[#1E293B] shadow-[2px_2px_0_#1E293B] transition-transform active:translate-x-[1px] active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 rounded-[6px] border-[1.5px] border-[#1E293B] px-3 py-1.5 font-mono text-xs font-bold text-[#1E293B] shadow-[2px_2px_0_#1E293B] transition-all active:translate-x-[1px] active:translate-y-[1px] ${
              isPlaying ? 'bg-[#BBF7D0]' : 'bg-[#BAE6FD]'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                <span>Play</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={isLast || isNextLocked}
            title={isNextLocked ? lockReason : undefined}
            className={`flex items-center gap-1 rounded-[6px] border-[1.5px] border-[#1E293B] px-2.5 py-1.5 font-mono text-xs font-bold shadow-[2px_2px_0_#1E293B] transition-transform active:translate-x-[1px] active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none ${
              isNextLocked
                ? 'bg-[#FEF9C3] text-[#1E293B]'
                : 'bg-white text-[#1E293B]'
            }`}
          >
            {isNextLocked ? (
              <>
                <Lock className="h-3 w-3" />
                <span>{lockReason}</span>
              </>
            ) : (
              <>
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onReplay}
            className="flex items-center gap-1 rounded-[6px] border-[1.5px] border-[#1E293B] bg-[#F7F5EE] px-2.5 py-1.5 font-mono text-xs font-bold text-[#1E293B] shadow-[2px_2px_0_#1E293B] transition-colors hover:bg-[#DDD6FE] active:translate-x-[1px] active:translate-y-[1px]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Replay</span>
          </button>
        </div>
      </div>
    </footer>
  );
};
