import React from 'react';
import {
  HighlightableThread,
  ThreadKey,
  useHighlight,
} from '../context/HighlightContext';
import { UNIFIED_BFS_CODE } from '../data/bfsLesson';

interface CodePanelProps {
  activeLineNums: number[];
}

const LEFT_BORDER_COLOR: Record<ThreadKey, string> = {
  queue: 'border-l-[3.5px] border-l-[#0284C7]',
  visited: 'border-l-[3.5px] border-l-[#7C3AED]',
  parent: 'border-l-[3.5px] border-l-[#16A34A]',
  bug: 'border-l-[3.5px] border-l-[#DC2626]',
};

const ACTIVE_ROW_BG: Record<ThreadKey, string> = {
  queue: 'bg-[#BAE6FD]/55',
  visited: 'bg-[#DDD6FE]/60',
  parent: 'bg-[#BBF7D0]/65',
  bug: 'bg-[#FECACA]/70',
};

function renderPythonSyntax(code: string): React.ReactNode {
  const commentIdx = code.indexOf('#');
  const main = commentIdx >= 0 ? code.slice(0, commentIdx) : code;
  const comment = commentIdx >= 0 ? code.slice(commentIdx) : '';

  const tokens = main.split(
    /(\bdef\b|\bwhile\b|\bfor\b|\bin\b|\bif\b|\bnot\b|\bis\b|\bNone\b|\bbreak\b|\breturn\b|\bdeque\b|\bqueue\b|\bvisited\b|\bparent\b)/g
  );

  return (
    <>
      {tokens.map((tok, i) => {
        if (
          tok === 'def' ||
          tok === 'while' ||
          tok === 'for' ||
          tok === 'in' ||
          tok === 'if' ||
          tok === 'not' ||
          tok === 'is' ||
          tok === 'break' ||
          tok === 'return'
        ) {
          return (
            <span key={i} className="font-bold text-[#7C3AED]">
              {tok}
            </span>
          );
        }
        if (tok === 'None') {
          return (
            <span key={i} className="font-bold text-[#B45309]">
              {tok}
            </span>
          );
        }
        if (tok === 'deque' || tok === 'queue') {
          return (
            <span key={i} className="font-semibold text-[#0369A1]">
              {tok}
            </span>
          );
        }
        if (tok === 'visited') {
          return (
            <span key={i} className="font-semibold text-[#6D28D9]">
              {tok}
            </span>
          );
        }
        if (tok === 'parent') {
          return (
            <span key={i} className="font-semibold text-[#15803D]">
              {tok}
            </span>
          );
        }
        return <span key={i}>{tok}</span>;
      })}
      {comment && <span className="italic text-[#15803D]">{comment}</span>}
    </>
  );
}

export const CodePanel: React.FC<CodePanelProps> = ({ activeLineNums }) => {
  const { hoveredThread, setHoveredThread } = useHighlight();

  return (
    <div className="flex flex-col overflow-hidden rounded-[8px] border-[1.5px] border-[#1E293B] bg-[#FFFDF9] shadow-[3px_3px_0_#1E293B]">
      {/* Header */}
      <div className="flex items-center justify-between border-b-[1.5px] border-[#1E293B] bg-[#F1EDE2] px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-[#1E293B] bg-[#FECACA]" />
          <span className="h-2.5 w-2.5 rounded-full border border-[#1E293B] bg-[#FDE68A]" />
          <span className="h-2.5 w-2.5 rounded-full border border-[#1E293B] bg-[#BBF7D0]" />
          <span className="ml-1 font-mono text-[11px] font-bold text-[#1E293B]">
            bfs_shortest.py
          </span>
        </div>
        <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
          3 LUỒNG MÀU
        </span>
      </div>

      {/* Code Lines */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {UNIFIED_BFS_CODE.map((line) => {
          const isActive = activeLineNums.includes(line.num);
          const hoverMatch =
            hoveredThread !== null && line.thread === hoveredThread;
          const hoverDim =
            hoveredThread !== null && line.thread !== hoveredThread;

          const borderCls = line.thread
            ? LEFT_BORDER_COLOR[line.thread]
            : 'border-l-[3.5px] border-l-transparent';

          let rowBg = '';
          if (hoverMatch && line.thread) {
            rowBg = ACTIVE_ROW_BG[line.thread];
          } else if (isActive && line.thread) {
            rowBg = ACTIVE_ROW_BG[line.thread];
          } else if (isActive) {
            rowBg = 'bg-[#F1EDE2]/80';
          }

          const opacityCls = hoverMatch
            ? 'opacity-100'
            : hoverDim
              ? 'opacity-35'
              : isActive
                ? 'opacity-100'
                : 'opacity-55';

          const hoverable =
            line.thread === 'queue' ||
            line.thread === 'visited' ||
            line.thread === 'parent';

          return (
            <div
              key={line.num}
              onMouseEnter={() => {
                if (hoverable) {
                  setHoveredThread(line.thread as HighlightableThread);
                }
              }}
              onMouseLeave={() => {
                if (hoverable) setHoveredThread(null);
              }}
              className={`flex items-center gap-2 px-2 py-0.5 font-mono text-[11px] leading-[19px] transition-all duration-150 ${borderCls} ${rowBg} ${opacityCls}`}
            >
              <span className="w-4 shrink-0 select-none text-right text-[10px] font-semibold text-slate-400">
                {line.num}
              </span>
              <code className="whitespace-pre text-[#1E293B]">
                {renderPythonSyntax(line.code)}
              </code>
            </div>
          );
        })}
      </div>
    </div>
  );
};
