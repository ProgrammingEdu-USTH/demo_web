import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import {
  GradeSummary,
  gradeUserMiniBfs,
  SOLUTION_MINI_CODE,
  STARTER_MINI_CODE,
} from '../utils/miniPythonRunner';

const MINI_NODES = [
  { id: 'A', x: 68, y: 108 },
  { id: 'B', x: 190, y: 44 },
  { id: 'C', x: 190, y: 172 },
  { id: 'D', x: 312, y: 108 },
] as const;

type MiniNodeId = (typeof MINI_NODES)[number]['id'];

const MINI_NODE_MAP: Record<MiniNodeId, { id: MiniNodeId; x: number; y: number }> = {
  A: MINI_NODES[0],
  B: MINI_NODES[1],
  C: MINI_NODES[2],
  D: MINI_NODES[3],
};

function trimmedLine(
  from: { x: number; y: number },
  to: { x: number; y: number },
  r = 18
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x1: from.x + (dx / len) * r,
    y1: from.y + (dy / len) * r,
    x2: to.x - (dx / len) * (r + 5),
    y2: to.y - (dy / len) * (r + 5),
  };
}

export const MiniCodeSandbox: React.FC = () => {
  const [code, setCode] = useState<string>(STARTER_MINI_CODE);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [summary, setSummary] = useState<GradeSummary | null>(null);

  const lineNumbers = useMemo(() => {
    const count = code.split(/\r?\n/).length;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [code]);

  const handleRun = () => {
    setSummary(gradeUserMiniBfs(code));
  };

  const handleReset = () => {
    setCode(STARTER_MINI_CODE);
    setSummary(null);
  };

  const handleLoadSolution = () => {
    setCode(SOLUTION_MINI_CODE);
    setSummary(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const updated = code.slice(0, start) + '    ' + code.slice(end);
      setCode(updated);
      window.requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      });
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  };

  // Visual state for 4-node graph based on Test 1 ('A' -> 'D')
  const test1 = summary?.results[0];
  const graphStatus: 'idle' | 'cycle' | 'suboptimal' | 'win' = (() => {
    if (!summary) return 'idle';
    if (summary.trace.hitCycleTrap) return 'cycle';
    if (test1?.actual === 2) return 'win';
    if (test1?.actual === 3) return 'suboptimal';
    return 'idle';
  })();

  const isEdgeHighlighted = (from: MiniNodeId, to: MiniNodeId): 'win' | 'bad' | null => {
    if (graphStatus === 'win') {
      if ((from === 'A' && to === 'C') || (from === 'C' && to === 'D')) {
        return 'win';
      }
    }
    if (graphStatus === 'cycle') {
      if ((from === 'A' && to === 'B') || (from === 'B' && to === 'A')) {
        return 'bad';
      }
    }
    if (graphStatus === 'suboptimal') {
      if (
        (from === 'A' && to === 'B') ||
        (from === 'B' && to === 'C') ||
        (from === 'C' && to === 'D')
      ) {
        return 'bad';
      }
    }
    return null;
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[1.12fr_0.88fr]">
      {/* Left Column: Python Code Editor */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-[8px] border-[1.5px] border-[#1E293B] bg-[#FFFDF9] shadow-[3px_3px_0_#1E293B]">
        {/* Editor Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-[1.5px] border-[#1E293B] bg-[#F1EDE2] px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-[#1E293B] bg-[#FECACA]" />
            <span className="h-2.5 w-2.5 rounded-full border border-[#1E293B] bg-[#FDE68A]" />
            <span className="h-2.5 w-2.5 rounded-full border border-[#1E293B] bg-[#BBF7D0]" />
            <Code2 className="ml-1 h-3.5 w-3.5 text-[#0284C7]" />
            <span className="font-mono text-[11px] font-bold text-[#1E293B]">
              min_steps.py • BÀI TOÁN CON (4 ĐỈNH)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowHint((v) => !v)}
              className={`flex items-center gap-1 rounded border border-[#1E293B] px-2 py-0.5 font-mono text-[10px] font-bold transition-colors ${
                showHint ? 'bg-[#FEF08A]' : 'bg-white hover:bg-[#FEF9C3]'
              }`}
            >
              <Lightbulb className="h-3 w-3" />
              <span>Gợi ý</span>
            </button>
            <button
              type="button"
              onClick={handleLoadSolution}
              className="rounded border border-[#1E293B] bg-[#DDD6FE] px-2 py-0.5 font-mono text-[10px] font-bold text-[#1E293B] hover:bg-[#C4B5FD]"
            >
              Xem mẫu
            </button>
            <button
              type="button"
              onClick={handleReset}
              title="Khôi phục code ban đầu"
              className="flex items-center gap-1 rounded border border-[#1E293B] bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-[#1E293B] hover:bg-[#F7F5EE]"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Khôi phục</span>
            </button>
          </div>
        </div>

        {/* Optional Hint Drawer */}
        {showHint && (
          <div className="border-b-[1.5px] border-[#1E293B] bg-[#FEF9C3] px-3 py-2 text-[11.5px] leading-snug text-[#1E293B]">
            <strong>Gợi ý 4 dòng còn thiếu:</strong> Dùng{' '}
            <code className="rounded bg-white px-1 font-mono font-bold">
              for v in graph[u]:
            </code>{' '}
            ➔ kiểm tra{' '}
            <code className="rounded bg-white px-1 font-mono font-bold">
              if v not in visited:
            </code>{' '}
            ➔{' '}
            <code className="rounded bg-white px-1 font-mono font-bold">
              visited.add(v)
            </code>{' '}
            ➔{' '}
            <code className="rounded bg-white px-1 font-mono font-bold">
              queue.append((v, dist + 1))
            </code>
            .
          </div>
        )}

        {/* Code Textarea with Line Numbers */}
        <div className="flex min-h-0 flex-1 overflow-auto bg-[#FFFDF9] font-mono text-[11.5px] leading-[20px]">
          <div className="select-none border-r border-[#E5E0D5] bg-[#FAF8F2] px-2 py-2 text-right text-[10.5px] font-semibold text-slate-400">
            {lineNumbers.map((num) => (
              <div key={num}>{num}</div>
            ))}
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            aria-label="Trình soạn thảo code Python min_steps"
            className="min-h-[220px] flex-1 resize-none bg-transparent p-2 font-mono text-[11.5px] leading-[20px] text-[#1E293B] focus:outline-none"
          />
        </div>

        {/* Editor Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t-[1.5px] border-[#1E293B] bg-[#FAF8F2] px-3 py-2">
          <span className="font-mono text-[10px] font-semibold text-slate-500">
            Không cần Dict parent • Chỉ trả về số bước ít nhất (int)
          </span>
          <button
            type="button"
            onClick={handleRun}
            className="flex items-center gap-1.5 rounded-[6px] border-[1.5px] border-[#1E293B] bg-[#BBF7D0] px-3.5 py-1.5 font-mono text-xs font-extrabold text-[#1E293B] shadow-[2px_2px_0_#1E293B] transition-transform hover:bg-[#86EFAC] active:translate-x-[1px] active:translate-y-[1px]"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Chạy Code & Chấm 4 Test</span>
          </button>
        </div>
      </div>

      {/* Right Column: 4-Node Mini Graph + 4-Test Judge */}
      <div className="flex min-h-0 flex-col gap-2.5">
        {/* Top Card: 4-Node Mini Graph */}
        <div className="flex flex-col overflow-hidden rounded-[8px] border-[1.5px] border-[#1E293B] bg-[#FFFDF9] shadow-[3px_3px_0_#1E293B]">
          <div className="flex items-center justify-between border-b-[1.5px] border-[#1E293B] bg-[#F1EDE2] px-3 py-1.5">
            <span className="font-mono text-[10.5px] font-extrabold uppercase tracking-wider text-[#1E293B]">
              ĐỒ THỊ CON 4 ĐỈNH (-33% QUY MÔ)
            </span>
            <span className="rounded border border-[#1E293B] bg-[#BAE6FD] px-1.5 py-0.5 font-mono text-[9.5px] font-bold">
              A ➔ D (2 bước)
            </span>
          </div>

          <div className="h-[188px] bg-blueprint-dots">
            <svg
              viewBox="0 0 380 210"
              preserveAspectRatio="xMidYMid meet"
              className="h-full w-full"
              aria-label="Đồ thị con 4 đỉnh A B C D"
            >
              <defs>
                <marker
                  id="mini-arrow-gray"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#64748B" />
                </marker>
                <marker
                  id="mini-arrow-green"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#16A34A" />
                </marker>
                <marker
                  id="mini-arrow-red"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#DC2626" />
                </marker>
              </defs>

              {/* Straight Edges: A->B, A->C, B->C, C->D */}
              {(
                [
                  ['A', 'B'],
                  ['A', 'C'],
                  ['B', 'C'],
                  ['C', 'D'],
                ] as Array<[MiniNodeId, MiniNodeId]>
              ).map(([u, v]) => {
                const hl = isEdgeHighlighted(u, v);
                const line = trimmedLine(MINI_NODE_MAP[u], MINI_NODE_MAP[v]);
                return (
                  <line
                    key={`${u}-${v}`}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke={
                      hl === 'win'
                        ? '#16A34A'
                        : hl === 'bad'
                          ? '#DC2626'
                          : '#94A3B8'
                    }
                    strokeWidth={hl ? 3.5 : 1.75}
                    markerEnd={
                      hl === 'win'
                        ? 'url(#mini-arrow-green)'
                        : hl === 'bad'
                          ? 'url(#mini-arrow-red)'
                          : 'url(#mini-arrow-gray)'
                    }
                  />
                );
              })}

              {/* Curved Cycle Edge B -> A */}
              {(() => {
                const hl = isEdgeHighlighted('B', 'A');
                return (
                  <path
                    d="M 173 37 Q 108 18 76 87"
                    fill="none"
                    stroke={hl === 'bad' ? '#DC2626' : '#94A3B8'}
                    strokeWidth={hl === 'bad' ? 3 : 1.6}
                    strokeDasharray="4 3"
                    markerEnd={
                      hl === 'bad'
                        ? 'url(#mini-arrow-red)'
                        : 'url(#mini-arrow-gray)'
                    }
                  />
                );
              })()}

              {/* Cycle Label */}
              <text
                x={108}
                y={22}
                textAnchor="middle"
                fontFamily="JetBrains Mono, monospace"
                fontSize={9}
                fontWeight={700}
                fill={graphStatus === 'cycle' ? '#DC2626' : '#64748B'}
              >
                Chu trình A↔B
              </text>

              {/* Animated Result Particles */}
              {graphStatus === 'win' && (
                <motion.circle
                  initial={{ cx: 68, cy: 108 }}
                  animate={{ cx: [68, 190, 312], cy: [108, 172, 108] }}
                  transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
                  r={6}
                  fill="#16A34A"
                  stroke="#1E293B"
                  strokeWidth={1.5}
                />
              )}

              {graphStatus === 'cycle' && (
                <motion.circle
                  initial={{ cx: 68, cy: 108 }}
                  animate={{ cx: [68, 190, 108, 68], cy: [108, 44, 34, 108] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  r={6}
                  fill="#DC2626"
                  stroke="#1E293B"
                  strokeWidth={1.5}
                />
              )}

              {/* 4 Nodes */}
              {MINI_NODES.map((n) => {
                const isWin =
                  graphStatus === 'win' &&
                  (n.id === 'A' || n.id === 'C' || n.id === 'D');
                const isCycle =
                  graphStatus === 'cycle' && (n.id === 'A' || n.id === 'B');
                return (
                  <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                    <circle cx={2.5} cy={2.5} r={18} fill="#1E293B" />
                    <circle
                      cx={0}
                      cy={0}
                      r={18}
                      fill={
                        isCycle ? '#FECACA' : isWin ? '#BBF7D0' : '#FFFDF9'
                      }
                      stroke={
                        isCycle ? '#DC2626' : isWin ? '#16A34A' : '#1E293B'
                      }
                      strokeWidth={isWin || isCycle ? 2.25 : 1.75}
                    />
                    <text
                      x={0}
                      y={5}
                      textAnchor="middle"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize={13.5}
                      fontWeight={800}
                      fill="#1E293B"
                    >
                      {n.id}
                    </text>
                    {(n.id === 'A' || n.id === 'D') && (
                      <g transform="translate(0, 27)">
                        <rect
                          x={-22}
                          y={-7}
                          width={44}
                          height={14}
                          rx={3}
                          fill={n.id === 'D' ? '#BBF7D0' : '#BAE6FD'}
                          stroke="#1E293B"
                          strokeWidth={1}
                        />
                        <text
                          x={0}
                          y={3}
                          textAnchor="middle"
                          fontFamily="JetBrains Mono, monospace"
                          fontSize={8.5}
                          fontWeight={800}
                          fill="#1E293B"
                        >
                          {n.id === 'A' ? 'START' : 'GOAL'}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Bottom Card: 4-Test Judge Results */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[8px] border-[1.5px] border-[#1E293B] bg-[#FFFDF9] shadow-[3px_3px_0_#1E293B]">
          <div className="flex items-center justify-between border-b-[1.5px] border-[#1E293B] bg-[#F1EDE2] px-3 py-1.5">
            <span className="font-mono text-[10.5px] font-extrabold uppercase tracking-wider text-[#1E293B]">
              KẾT QUẢ CHẤM 4 TEST CASE
            </span>
            {summary && (
              <span
                className={`rounded border border-[#1E293B] px-1.5 py-0.5 font-mono text-[10px] font-extrabold ${
                  summary.allPassed ? 'bg-[#BBF7D0] text-[#15803D]' : 'bg-[#FECACA] text-[#991B1B]'
                }`}
              >
                {summary.results.filter((r) => r.passed).length}/4 Đạt
              </span>
            )}
          </div>

          <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
            {!summary && (
              <div className="rounded-[6px] border border-dashed border-slate-400 bg-[#F7F5EE] p-3 text-center font-mono text-[11px] font-semibold text-slate-600">
                Hoàn thành phần <code># TODO</code> bên trái rồi bấm{' '}
                <strong>▶ Chạy Code &amp; Chấm 4 Test</strong>!
              </div>
            )}

            {summary?.compileError && (
              <div className="flex items-start gap-2 rounded-[6px] border-[1.5px] border-[#DC2626] bg-[#FECACA]/80 p-2 text-xs font-bold text-[#991B1B]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{summary.compileError}</span>
              </div>
            )}

            {summary?.allPassed && (
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2 rounded-[6px] border-[1.5px] border-[#16A34A] bg-[#BBF7D0] px-2.5 py-1.5 text-xs font-extrabold text-[#14532D]"
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>Xuất sắc! Vượt qua 4/4 Test Case!</span>
              </motion.div>
            )}

            {summary?.results.map((res) => (
              <div
                key={res.id}
                className={`rounded-[6px] border-[1.5px] px-2.5 py-1.5 font-mono text-[10.5px] ${
                  res.passed
                    ? 'border-[#16A34A] bg-[#BBF7D0]/45'
                    : 'border-[#DC2626] bg-[#FECACA]/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-bold text-[#1E293B]">
                  <span className="flex items-center gap-1.5">
                    {res.passed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#16A34A]" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-[#DC2626]" />
                    )}
                    <span>{res.label}</span>
                  </span>
                  <span>
                    {res.passed
                      ? `= ${res.actual} ✓`
                      : `Kỳ vọng ${res.expected} | Nhận ${res.actual ?? 'Lỗi'}`}
                  </span>
                </div>
                {res.error && (
                  <div className="mt-0.5 text-[10px] font-semibold text-[#991B1B]">
                    {res.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
