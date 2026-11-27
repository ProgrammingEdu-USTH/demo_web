import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { HighlightableThread, useHighlight } from '../context/HighlightContext';
import { BfsLessonStep, BfsTickSnapshot, NodeId, ParentPair } from '../data/bfsLesson';
import { LayerVisibility } from './GraphCanvas';

interface DataStructuresDockProps {
  step: BfsLessonStep;
  step3Solved: boolean;
  step4Running: boolean;
  visitedEnabled: boolean;
  sandboxSnapshot: BfsTickSnapshot | null;
  layerVisibility: LayerVisibility;
}

export const DataStructuresDock: React.FC<DataStructuresDockProps> = ({
  step,
  step3Solved,
  step4Running,
  visitedEnabled,
  sandboxSnapshot,
  layerVisibility,
}) => {
  const { hoveredThread, setHoveredThread } = useHighlight();
  const [peeked, setPeeked] = useState<Record<HighlightableThread, boolean>>({
    queue: false,
    visited: false,
    parent: false,
  });

  const isStep7 = step.id === 7;

  // Compute live Queue, Visited, Parent arrays based on interactive state
  const queueItems: NodeId[] = (() => {
    if (isStep7 && sandboxSnapshot) return sandboxSnapshot.queue;
    if (step.id === 3 && step3Solved) return ['C', 'D'];
    if (step.id === 4 && !step4Running) return ['A'];
    if (step.id === 5 && !visitedEnabled) return ['A', 'B', 'D', 'A', 'B'];
    return step.dataState.queue;
  })();

  const visitedItems: NodeId[] = (() => {
    if (isStep7 && sandboxSnapshot) return sandboxSnapshot.visited;
    if (step.id === 5 && !visitedEnabled) return [];
    return step.dataState.visited;
  })();

  const parentItems: ParentPair[] = (() => {
    if (isStep7 && sandboxSnapshot) return sandboxSnapshot.parent;
    return step.dataState.parent;
  })();

  const isQueueBugCrash =
    (step.id === 4 && step4Running) || (step.id === 5 && !visitedEnabled);

  const isExpanded = (key: HighlightableThread): boolean => {
    if (isStep7) {
      return layerVisibility[key] || peeked[key];
    }
    if (step.dockFocus === 'all') return true;
    if (step.dockFocus === key) return true;
    return peeked[key];
  };

  const togglePeek = (key: HighlightableThread) => {
    setPeeked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderCard = (
    key: HighlightableThread,
    title: string,
    shortTitle: string,
    subtitle: string,
    count: number,
    theme: {
      bg: string;
      border: string;
      pillBg: string;
      text: string;
    },
    content: React.ReactNode
  ) => {
    const expanded = isExpanded(key);
    const isHovered = hoveredThread === key;
    const isDimmed = hoveredThread !== null && hoveredThread !== key;
    const isHiddenLayer = isStep7 && !layerVisibility[key];

    const finalBg =
      key === 'queue' && isQueueBugCrash ? 'bg-[#FECACA]' : theme.bg;
    const finalBorder =
      key === 'queue' && isQueueBugCrash ? 'border-[#DC2626]' : theme.border;

    return (
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onMouseEnter={() => setHoveredThread(key)}
        onMouseLeave={() => setHoveredThread(null)}
        className={`flex min-w-0 flex-col overflow-hidden rounded-[8px] border-[1.5px] ${finalBorder} ${finalBg} shadow-[3px_3px_0_#1E293B] transition-opacity duration-150 ${
          expanded ? 'flex-[2]' : 'flex-[1.05]'
        } ${isHovered ? 'ring-2 ring-[#1E293B] ring-offset-1' : ''} ${
          isDimmed ? 'opacity-45' : isHiddenLayer ? 'opacity-50' : 'opacity-100'
        }`}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-1.5 border-b-[1.5px] border-[#1E293B] bg-[#FFFDF9]/85 px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full border border-[#1E293B] ${theme.pillBg}`}
            />
            <span className="truncate font-mono text-[11px] font-extrabold text-[#1E293B]">
              {expanded ? title : `${shortTitle} (${count})`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => togglePeek(key)}
            title={expanded ? 'Thu gọn hộp' : 'Mở xem dữ liệu'}
            className="flex shrink-0 items-center gap-1 rounded border border-[#1E293B]/45 bg-white px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-[#1E293B] hover:border-[#1E293B]"
          >
            {expanded ? (
              <>
                <EyeOff className="h-2.5 w-2.5" />
                <span className="hidden sm:inline">Ẩn</span>
              </>
            ) : (
              <>
                <Eye className="h-2.5 w-2.5" />
                <span>Xem</span>
              </>
            )}
          </button>
        </div>

        {/* Body: Expanded live items vs Collapsed Black-Box Pill */}
        {expanded ? (
          <div className="flex flex-1 flex-col justify-between gap-1.5 p-2.5">
            <div className="flex items-center justify-between font-mono text-[9.5px] font-bold text-slate-600">
              <span>{isHiddenLayer ? 'Đang ẩn lớp trên đồ thị' : subtitle}</span>
              <span>
                {key === 'queue' && isQueueBugCrash
                  ? 'TRÀN ∞!'
                  : `${count} phần tử`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">{content}</div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-between px-2.5 py-2">
            <span className="font-mono text-[10px] font-semibold text-slate-600">
              Black-Box
            </span>
            <span className="rounded border border-[#1E293B] bg-white px-1.5 py-0.5 font-mono text-[10.5px] font-extrabold text-[#1E293B]">
              {count} mục
            </span>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
      {/* 1. Queue Box (Sky Blue) */}
      {renderCard(
        'queue',
        'Queue',
        'Queue',
        'FIFO • Lấy đầu, thêm cuối',
        queueItems.length,
        {
          bg: 'bg-[#BAE6FD]/65',
          border: 'border-[#0284C7]',
          pillBg: 'bg-[#38BDF8]',
          text: 'text-[#0369A1]',
        },
        <AnimatePresence mode="popLayout">
          {queueItems.length === 0 ? (
            <span className="font-mono text-[11px] font-semibold text-slate-500">
              [ ] (Trống)
            </span>
          ) : (
            <>
              {queueItems.map((node, idx) => (
                <motion.span
                  key={`q-${idx}-${node}`}
                  initial={{ scale: 0.75, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.75, opacity: 0 }}
                  className={`flex h-7 min-w-[28px] items-center justify-center rounded border-[1.5px] border-[#1E293B] px-2 font-mono text-xs font-extrabold shadow-[1.5px_1.5px_0_#1E293B] ${
                    isQueueBugCrash
                      ? 'bg-[#FECACA] text-[#991B1B]'
                      : idx === 0
                        ? 'bg-[#FFFDF9] text-[#0369A1] ring-2 ring-[#0284C7]'
                        : 'bg-white text-[#1E293B]'
                  }`}
                >
                  {node}
                </motion.span>
              ))}
              {isQueueBugCrash && (
                <span className="font-mono text-xs font-extrabold text-[#DC2626]">
                  ... ∞
                </span>
              )}
            </>
          )}
        </AnimatePresence>
      )}

      {/* 2. Visited Set Box (Lavender Purple) */}
      {renderCard(
        'visited',
        'Visited Set',
        'Visited',
        'Hash Set • Tra cứu O(1)',
        visitedItems.length,
        {
          bg: 'bg-[#DDD6FE]/65',
          border: 'border-[#7C3AED]',
          pillBg: 'bg-[#A78BFA]',
          text: 'text-[#6D28D9]',
        },
        <AnimatePresence mode="popLayout">
          {visitedItems.length === 0 ? (
            <span className="font-mono text-[11px] font-semibold text-[#DC2626]">
              {'{ } (Đang TẮT!)'}
            </span>
          ) : (
            visitedItems.map((node) => (
              <motion.span
                key={`v-${node}`}
                initial={{ scale: 0.75, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-7 min-w-[28px] items-center justify-center rounded-full border-[1.5px] border-[#1E293B] bg-white px-2 font-mono text-xs font-extrabold text-[#5B21B6] shadow-[1.5px_1.5px_0_#1E293B]"
              >
                {node}
              </motion.span>
            ))
          )}
        </AnimatePresence>
      )}

      {/* 3. Parent Dict Box (Mint Green) */}
      {renderCard(
        'parent',
        'Parent Dict',
        'Parent',
        'Truy vết • parent[con] = cha',
        parentItems.length,
        {
          bg: 'bg-[#BBF7D0]/65',
          border: 'border-[#16A34A]',
          pillBg: 'bg-[#4ADE80]',
          text: 'text-[#15803D]',
        },
        <AnimatePresence mode="popLayout">
          {parentItems.length === 0 ? (
            <span className="font-mono text-[11px] font-semibold text-slate-500">
              {'{ } (Chưa ghi)'}
            </span>
          ) : (
            parentItems.map((pair) => (
              <motion.span
                key={`p-${pair.child}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded border-[1.5px] border-[#1E293B] bg-white px-1.5 py-0.5 font-mono text-[11px] font-extrabold text-[#15803D] shadow-[1.5px_1.5px_0_#1E293B]"
              >
                {`${pair.child}:${pair.from ?? '∅'}`}
              </motion.span>
            ))
          )}
        </AnimatePresence>
      )}
    </div>
  );
};
