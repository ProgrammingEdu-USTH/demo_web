import React from 'react';
import { motion } from 'framer-motion';
import { Play, RotateCcw } from 'lucide-react';
import { HighlightableThread } from '../context/HighlightContext';
import {
  BFS_ADJACENCY,
  BfsLessonStep,
  BfsTickSnapshot,
  GRAPH_EDGES,
  GRAPH_NODES,
  GRAPH_NODE_MAP,
  NodeId,
} from '../data/bfsLesson';

export interface LayerVisibility {
  queue: boolean;
  visited: boolean;
  parent: boolean;
}

export type ArenaVisualMode =
  | 'idle'
  | 'stack-fail'
  | 'queue-win'
  | 'list-slow'
  | 'set-fast'
  | 'prev-fail'
  | 'dict-win';

interface GraphCanvasProps {
  step: BfsLessonStep;
  // Phase 1: Step 1 manual path
  manualPath: NodeId[];
  manualStatus: 'exploring' | 'cycle' | 'suboptimal' | 'optimal';
  onManualNodeClick: (nodeId: NodeId) => void;
  // Phase 2: Arena visual mode
  arenaVisual: ArenaVisualMode;
  step5Beat: number;
  // Phase 3: Step 6 assembled slots
  snappedSlots: Record<HighlightableThread, boolean>;
  // Phase 3: Step 7 Sandbox props
  sandboxStart: NodeId;
  sandboxGoal: NodeId;
  sandboxSnapshot: BfsTickSnapshot | null;
  sandboxPlaying: boolean;
  layerVisibility: LayerVisibility;
  onToggleLayer: (layer: keyof LayerVisibility) => void;
  onSelectSandboxNode: (nodeId: NodeId) => void;
  onRunSandboxBfs: () => void;
  // Phase 4: Step 8 Weighted BFS
  step8BfsRun: boolean;
}

const NODE_RADIUS = 23;

function getTrimmedLine(
  from: { x: number; y: number },
  to: { x: number; y: number },
  trimStart = NODE_RADIUS,
  trimEnd = NODE_RADIUS + 5
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x1: from.x + ux * trimStart,
    y1: from.y + uy * trimStart,
    x2: to.x - ux * trimEnd,
    y2: to.y - uy * trimEnd,
  };
}

function quadPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number
) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

function isEdgeInPath(
  from: NodeId,
  to: NodeId,
  path: NodeId[] | null | undefined
): boolean {
  if (!path || path.length < 2) return false;
  for (let i = 0; i < path.length - 1; i += 1) {
    if (path[i] === from && path[i + 1] === to) return true;
  }
  return false;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  step,
  manualPath,
  manualStatus,
  onManualNodeClick,
  arenaVisual,
  step5Beat,
  snappedSlots,
  sandboxStart,
  sandboxGoal,
  sandboxSnapshot,
  sandboxPlaying,
  layerVisibility,
  onToggleLayer,
  onSelectSandboxNode,
  onRunSandboxBfs,
  step8BfsRun,
}) => {
  const isStep1 = step.id === 1;
  const isStep7 = step.id === 7;
  const isStep8 = step.id === 8;

  const activeStart = isStep7 ? sandboxStart : 'A';
  const activeGoal = isStep7 ? sandboxGoal : 'F';

  const nodeA = GRAPH_NODE_MAP.A;
  const nodeB = GRAPH_NODE_MAP.B;
  const nodeC = GRAPH_NODE_MAP.C;
  const nodeD = GRAPH_NODE_MAP.D;
  const nodeE = GRAPH_NODE_MAP.E;
  const nodeF = GRAPH_NODE_MAP.F;
  const qCtrl = { x: 210, y: 18 };

  const step1Head = manualPath[manualPath.length - 1];
  const step1ValidNext = isStep1 ? BFS_ADJACENCY[step1Head] : [];

  const QUEUE_PORT = { x: 105, y: 352 };
  const VISITED_PORT = { x: 280, y: 352 };
  const PARENT_PORT = { x: 455, y: 352 };

  // Compute active path overlay depending on Step & Arena state
  const highlightedOptimalPath: NodeId[] | null = (() => {
    if (isStep1 && manualStatus === 'optimal') return manualPath;
    if (step.id === 3 && arenaVisual === 'queue-win')
      return ['A', 'C', 'E', 'F'];
    if (step.id === 5 && arenaVisual === 'dict-win' && step5Beat === 4)
      return ['A', 'C', 'E', 'F'];
    if (isStep7 && layerVisibility.parent)
      return sandboxSnapshot?.finalPath ?? null;
    if (isStep8 && step8BfsRun) return ['A', 'B', 'D', 'E', 'F']; // True shortest km (10 km)
    return null;
  })();

  const highlightedBadPath: NodeId[] | null = (() => {
    if (isStep1 && (manualStatus === 'suboptimal' || manualStatus === 'cycle'))
      return manualPath;
    if (step.id === 3 && arenaVisual === 'stack-fail')
      return ['A', 'B', 'D', 'E', 'F'];
    if (isStep8 && step8BfsRun) return ['A', 'C', 'E', 'F']; // Stubborn 50km BFS choice
    return null;
  })();

  const visitedSet = new Set<NodeId>(
    (() => {
      if (isStep1) return manualPath;
      if (
        step.id === 4 &&
        (arenaVisual === 'list-slow' || arenaVisual === 'set-fast')
      )
        return ['A', 'B', 'C', 'D', 'E'];
      if (step.id === 5 && arenaVisual === 'prev-fail') {
        if (step5Beat === 0) return ['A', 'B', 'C'];
        if (step5Beat === 1) return ['A', 'B', 'C', 'D'];
        if (step5Beat === 2) return ['A', 'B', 'C', 'D', 'E'];
        return ['A', 'B', 'C', 'D', 'E', 'F'];
      }
      if (step.id === 5 && arenaVisual === 'dict-win') {
        if (step5Beat === 0) return ['A', 'B', 'C'];
        if (step5Beat === 1) return ['A', 'B', 'C', 'D'];
        if (step5Beat === 2) return ['A', 'B', 'C', 'D', 'E'];
        return ['A', 'B', 'C', 'D', 'E', 'F'];
      }
      if (step.id === 6 && snappedSlots.visited)
        return ['A', 'B', 'C', 'D', 'E', 'F'];
      if (isStep7 && layerVisibility.visited)
        return sandboxSnapshot?.visited ?? [sandboxStart];
      return [];
    })()
  );

  // Only show parent tags on the winning path when a final path exists (never clutter off-path branches)
  const parentTags = (() => {
    const filterToPath = (
      pairs: Array<{ child: NodeId; from: NodeId | null }>
    ) => {
      if (!highlightedOptimalPath) return pairs;
      const pathSet = new Set(highlightedOptimalPath);
      return pairs.filter((p) => pathSet.has(p.child));
    };

    if (step.id === 5 && arenaVisual === 'dict-win') {
      if (step5Beat === 0) {
        return [
          { child: 'B' as NodeId, from: 'A' as NodeId },
          { child: 'C' as NodeId, from: 'A' as NodeId },
        ];
      }
      if (step5Beat === 1) {
        return [
          { child: 'B' as NodeId, from: 'A' as NodeId },
          { child: 'C' as NodeId, from: 'A' as NodeId },
          { child: 'D' as NodeId, from: 'B' as NodeId },
        ];
      }
      if (step5Beat === 2) {
        return [
          { child: 'B' as NodeId, from: 'A' as NodeId },
          { child: 'C' as NodeId, from: 'A' as NodeId },
          { child: 'D' as NodeId, from: 'B' as NodeId },
          { child: 'E' as NodeId, from: 'C' as NodeId },
        ];
      }
      return filterToPath(step.dataState.parent);
    }
    if (step.id === 6 && snappedSlots.parent)
      return [
        { child: 'B' as NodeId, from: 'A' as NodeId },
        { child: 'C' as NodeId, from: 'A' as NodeId },
        { child: 'E' as NodeId, from: 'C' as NodeId },
        { child: 'F' as NodeId, from: 'E' as NodeId },
      ];
    if (isStep7 && layerVisibility.parent) {
      return filterToPath(sandboxSnapshot?.parent ?? []);
    }
    return [];
  })();

  const activeCurrentNode: NodeId | undefined = (() => {
    if (isStep1) return step1Head;
    if (isStep7) return sandboxSnapshot?.currentNode ?? undefined;
    return undefined;
  })();

  const sandboxQueueTarget =
    isStep7 &&
    layerVisibility.queue &&
    sandboxSnapshot?.handoffTarget === 'queue-pop'
      ? sandboxSnapshot.handoffNode
      : null;

  const sandboxDockTarget =
    isStep7 &&
    sandboxSnapshot?.handoffTarget === 'visited-parent' &&
    sandboxSnapshot.handoffNode
      ? {
          node: sandboxSnapshot.handoffNode,
          showVisited: layerVisibility.visited,
          showParent: layerVisibility.parent,
        }
      : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[8px] border-[1.5px] border-[#1E293B] bg-[#FFFDF9] shadow-[3px_3px_0_#1E293B]">
      {/* Canvas Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-[1.5px] border-[#1E293B] bg-[#F1EDE2] px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-extrabold uppercase tracking-wider text-[#1E293B]">
            ĐỒ THỊ BỀN VỮNG (PERSISTENT GRAPH)
          </span>
          <span className="rounded border border-[#1E293B] bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#1E293B]">
            Start: {activeStart} → Goal: {activeGoal}
          </span>
        </div>

        {/* Step 7 Sandbox Layer Toggles & Run Button */}
        {isStep7 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: 'queue', label: 'Queue', bg: 'bg-[#BAE6FD]' },
                { key: 'visited', label: 'Visited', bg: 'bg-[#DDD6FE]' },
                { key: 'parent', label: 'Parent', bg: 'bg-[#BBF7D0]' },
              ] as const
            ).map((item) => {
              const checked = layerVisibility[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onToggleLayer(item.key)}
                  className={`flex items-center gap-1 rounded border-[1.5px] border-[#1E293B] px-1.5 py-0.5 font-mono text-[10px] font-bold transition-all ${
                    checked ? `${item.bg} text-[#1E293B]` : 'bg-white text-slate-400'
                  }`}
                >
                  <span>{checked ? '☑' : '☐'}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={onRunSandboxBfs}
              className="ml-1 flex items-center gap-1 rounded border-[1.5px] border-[#1E293B] bg-[#BBF7D0] px-2 py-0.5 font-mono text-[10.5px] font-extrabold text-[#1E293B] shadow-[1.5px_1.5px_0_#1E293B] hover:bg-[#86EFAC] active:translate-x-[1px] active:translate-y-[1px]"
            >
              {sandboxPlaying ? (
                <>
                  <RotateCcw className="h-3 w-3" />
                  <span>Chạy lại</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 fill-current" />
                  <span>Chạy BFS</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <span className="font-mono text-[10px] font-semibold text-slate-500">
            {isStep8 ? 'Có trọng số km' : '6 đỉnh • Chu trình A-B-D-A'}
          </span>
        )}
      </div>

      {/* Step 7 Sandbox Hint Strip */}
      {isStep7 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E0D5] bg-[#FAF8F2] px-3 py-1 font-mono text-[10px] font-semibold text-slate-600">
          <span>
            Bấm 2 đỉnh trên đồ thị để đổi Start / Goal •{' '}
            {sandboxSnapshot?.title ?? 'Nhấn "Chạy BFS" để mô phỏng'}
          </span>
          {sandboxSnapshot?.finalPath && (
            <span className="rounded border border-[#16A34A] bg-[#BBF7D0] px-1.5 py-0.2 font-bold text-[#15803D]">
              Ngắn nhất: {sandboxSnapshot.finalPath.join(' ➔ ')}
            </span>
          )}
        </div>
      )}

      {/* Persistent SVG Graph Canvas */}
      <div className="relative min-h-0 flex-1 bg-blueprint-dots">
        <svg
          viewBox="0 0 560 360"
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          aria-label="Đồ thị 6 đỉnh BFS"
        >
          <defs>
            <marker
              id="arrow-default"
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
              id="arrow-blue"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#0284C7" />
            </marker>
            <marker
              id="arrow-red"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#DC2626" />
            </marker>
            <marker
              id="arrow-green"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6.5"
              markerHeight="6.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#16A34A" />
            </marker>
            <marker
              id="arrow-purple"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#7C3AED" />
            </marker>
            <marker
              id="arrow-amber"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#D97706" />
            </marker>
          </defs>

          {/* Concentric Sky Blue Wave Rings (Step 3 Queue Win & Step 6 Queue Snap) */}
          {((step.id === 3 && arenaVisual === 'queue-win') ||
            (step.id === 6 && snappedSlots.queue)) && (
            <g>
              {[155, 279, 390].map((radius, idx) => (
                <motion.circle
                  key={`wave-${radius}`}
                  cx={nodeA.x}
                  cy={nodeA.y}
                  r={radius}
                  fill="none"
                  stroke="#0284C7"
                  strokeWidth={1.5}
                  strokeDasharray="6 5"
                  initial={{ opacity: 0.2 }}
                  animate={{ opacity: [0.2, 0.72, 0.2] }}
                  transition={{
                    repeat: Infinity,
                    duration: 2.3,
                    delay: idx * 0.4,
                  }}
                />
              ))}
            </g>
          )}

          {/* Graph Edges */}
          {GRAPH_EDGES.map((edge) => {
            const fromNode = GRAPH_NODE_MAP[edge.from];
            const toNode = GRAPH_NODE_MAP[edge.to];

            const isStackCycleBranch =
              step.id === 3 &&
              arenaVisual === 'stack-fail' &&
              edge.from === 'D' &&
              edge.to === 'A';

            const isListSlowEdge =
              step.id === 4 &&
              arenaVisual === 'list-slow' &&
              edge.from === 'D' &&
              edge.to === 'A';

            const isShieldedEdge =
              (step.id === 4 &&
                arenaVisual === 'set-fast' &&
                edge.from === 'D' &&
                edge.to === 'A') ||
              (isStep7 &&
                layerVisibility.visited &&
                sandboxSnapshot?.blockedEdges.some(
                  (b) => b.from === edge.from && b.to === edge.to
                ));

            const isOptEdge = isEdgeInPath(
              edge.from,
              edge.to,
              highlightedOptimalPath
            );
            const isBadEdge =
              isStackCycleBranch ||
              isEdgeInPath(edge.from, edge.to, highlightedBadPath);
            const isStep1Exploring =
              isStep1 &&
              manualStatus === 'exploring' &&
              isEdgeInPath(edge.from, edge.to, manualPath);

            const isPrevActiveEdge =
              step.id === 5 &&
              arenaVisual === 'prev-fail' &&
              ((step5Beat === 0 &&
                edge.from === 'A' &&
                (edge.to === 'B' || edge.to === 'C')) ||
                (step5Beat === 1 && edge.from === 'B' && edge.to === 'D') ||
                (step5Beat === 2 && edge.from === 'C' && edge.to === 'E') ||
                (step5Beat === 3 && edge.from === 'E' && edge.to === 'F'));

            const isDictActiveEdge =
              step.id === 5 &&
              arenaVisual === 'dict-win' &&
              ((step5Beat === 0 &&
                edge.from === 'A' &&
                (edge.to === 'B' || edge.to === 'C')) ||
                (step5Beat === 1 && edge.from === 'B' && edge.to === 'D') ||
                (step5Beat === 2 && edge.from === 'C' && edge.to === 'E') ||
                (step5Beat === 3 && edge.from === 'E' && edge.to === 'F'));

            const isSandboxActiveEdge =
              isStep7 &&
              !sandboxSnapshot?.finalPath &&
              sandboxSnapshot?.activeEdge?.from === edge.from &&
              sandboxSnapshot?.activeEdge?.to === edge.to;

            const isParentEdge =
              !highlightedOptimalPath &&
              !(isStep7 && sandboxSnapshot && !sandboxSnapshot.finalPath) &&
              parentTags.some(
                (p) => p.child === edge.to && p.from === edge.from
              );

            const strokeColor = isBadEdge
              ? '#DC2626'
              : isOptEdge || isDictActiveEdge
                ? '#16A34A'
                : isPrevActiveEdge
                  ? '#D97706'
                  : isSandboxActiveEdge || isStep1Exploring
                    ? '#0284C7'
                    : isListSlowEdge
                      ? '#D97706'
                      : isShieldedEdge
                        ? '#7C3AED'
                        : isParentEdge
                          ? '#4ADE80'
                          : '#CBD5E1';

            const strokeWidth =
              isBadEdge ||
              isOptEdge ||
              isStep1Exploring ||
              isSandboxActiveEdge ||
              isPrevActiveEdge ||
              isDictActiveEdge
                ? 3.75
                : isListSlowEdge || isShieldedEdge || isParentEdge
                  ? 2.5
                  : 1.6;

            const markerEnd = isBadEdge
              ? 'url(#arrow-red)'
              : isOptEdge || isParentEdge || isDictActiveEdge
                ? 'url(#arrow-green)'
                : isSandboxActiveEdge || isStep1Exploring
                  ? 'url(#arrow-blue)'
                  : isListSlowEdge || isPrevActiveEdge
                    ? 'url(#arrow-amber)'
                    : isShieldedEdge
                      ? 'url(#arrow-purple)'
                      : 'url(#arrow-default)';

            const dashArray =
              isStackCycleBranch || isShieldedEdge || isListSlowEdge
                ? '5 4'
                : isStep8 && step8BfsRun && isOptEdge && !isBadEdge
                  ? '6 4'
                  : undefined;

            if (edge.curved === 'top-cycle') {
              const endPt = quadPoint(fromNode, qCtrl, toNode, 0.89);
              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={`M ${fromNode.x} ${fromNode.y - NODE_RADIUS + 2} Q ${qCtrl.x} ${qCtrl.y} ${endPt.x} ${endPt.y}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                  markerEnd={markerEnd}
                />
              );
            }

            const line = getTrimmedLine(fromNode, toNode);
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                markerEnd={markerEnd}
              />
            );
          })}

          {/* Phase 4 (Step 8): Weighted km Labels on All Edges */}
          {isStep8 &&
            GRAPH_EDGES.map((edge) => {
              const isExpensive =
                step8BfsRun &&
                isEdgeInPath(edge.from, edge.to, ['A', 'C', 'E', 'F']) &&
                !(edge.from === 'E' && edge.to === 'F');
              const isCheap =
                step8BfsRun &&
                isEdgeInPath(edge.from, edge.to, ['A', 'B', 'D', 'E', 'F']);

              return (
                <motion.g
                  key={`w-${edge.from}-${edge.to}`}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <g transform={`translate(${edge.labelX}, ${edge.labelY})`}>
                    <rect
                      x={-22}
                      y={-10}
                      width={44}
                      height={18}
                      rx={4}
                      fill={
                        isExpensive
                          ? '#FECACA'
                          : isCheap
                            ? '#BBF7D0'
                            : '#FFFDF9'
                      }
                      stroke={
                        isExpensive
                          ? '#DC2626'
                          : isCheap
                            ? '#16A34A'
                            : '#1E293B'
                      }
                      strokeWidth={1.25}
                    />
                    <text
                      x={0}
                      y={2.5}
                      textAnchor="middle"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize={9.5}
                      fontWeight={800}
                      fill="#1E293B"
                    >
                      {`${edge.weightKm}km`}
                    </text>
                  </g>
                </motion.g>
              );
            })}

          {/* Step 4 List-Slow vs Set-Fast Visual Comparison on Graph */}
          {step.id === 4 && arenaVisual === 'list-slow' && (
            <g>
              {/* Sequential Array Strip at Top of Graph */}
              <g transform="translate(280, 22)">
                <rect
                  x={-160}
                  y={-13}
                  width={320}
                  height={24}
                  rx={6}
                  fill="#FEF3C7"
                  stroke="#D97706"
                  strokeWidth={1.5}
                />
                <text
                  x={-148}
                  y={2.5}
                  textAnchor="start"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize={9.5}
                  fontWeight={800}
                  fill="#92400E"
                >
                  visited_list =
                </text>
                {(['B', 'C', 'D', 'E', 'A'] as const).map((item, idx) => (
                  <g key={item} transform={`translate(${-42 + idx * 36}, 0)`}>
                    <rect
                      x={-13}
                      y={-9}
                      width={26}
                      height={17}
                      rx={3}
                      fill="#FFFDF9"
                      stroke="#D97706"
                      strokeWidth={1.25}
                    />
                    <text
                      x={0}
                      y={3}
                      textAnchor="middle"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize={10}
                      fontWeight={800}
                      fill="#1E293B"
                    >
                      {item}
                    </text>
                  </g>
                ))}
                {/* Moving Scanner Box across 5 list slots */}
                <motion.rect
                  initial={{ x: -55 }}
                  animate={{ x: [-55, -19, 17, 53, 89] }}
                  transition={{
                    duration: 2.8,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  y={-10}
                  width={26}
                  height={19}
                  rx={3}
                  fill="none"
                  stroke="#DC2626"
                  strokeWidth={2.25}
                />
              </g>

              {/* Sequential Node-by-Node Scan Ring on Graph: B -> C -> D -> E -> A */}
              <motion.circle
                initial={{ cx: nodeB.x, cy: nodeB.y }}
                animate={{
                  cx: [nodeB.x, nodeC.x, nodeD.x, nodeE.x, nodeA.x],
                  cy: [nodeB.y, nodeC.y, nodeD.y, nodeE.y, nodeA.y],
                }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                r={NODE_RADIUS + 7}
                fill="none"
                stroke="#DC2626"
                strokeWidth={2.5}
                strokeDasharray="4 3"
              />

              {/* Badge on D -> A Arc */}
              <g transform="translate(214, 62)">
                <rect
                  x={-68}
                  y={-12}
                  width={136}
                  height={22}
                  rx={6}
                  fill="#FEF3C7"
                  stroke="#D97706"
                  strokeWidth={1.75}
                />
                <text
                  x={0}
                  y={2.5}
                  textAnchor="middle"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize={10}
                  fontWeight={800}
                  fill="#92400E"
                >
                  🐢 List dò từng ô O(n)
                </text>
              </g>
            </g>
          )}

          {step.id === 4 && arenaVisual === 'set-fast' && (
            <g>
              {/* Instant Hash Lookup Pill at Top */}
              <g transform="translate(280, 22)">
                <rect
                  x={-136}
                  y={-13}
                  width={272}
                  height={24}
                  rx={6}
                  fill="#DDD6FE"
                  stroke="#7C3AED"
                  strokeWidth={1.5}
                />
                <text
                  x={0}
                  y={2.5}
                  textAnchor="middle"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize={10}
                  fontWeight={800}
                  fill="#5B21B6"
                >
                  hash(&apos;A&apos;) ➔ Ô băm #A (Tức thì O(1)!)
                </text>
              </g>

              {/* Direct O(1) Hit Ring ONLY on Target Node A */}
              <motion.circle
                cx={nodeA.x}
                cy={nodeA.y}
                r={NODE_RADIUS + 8}
                fill="none"
                stroke="#16A34A"
                strokeWidth={2.75}
                animate={{ scale: [0.96, 1.08, 0.96], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.1 }}
              />

              {/* Shield Badge on D -> A Arc */}
              <g transform="translate(214, 62)">
                <rect
                  x={-72}
                  y={-12}
                  width={144}
                  height={22}
                  rx={6}
                  fill="#DDD6FE"
                  stroke="#7C3AED"
                  strokeWidth={1.75}
                />
                <text
                  x={0}
                  y={2.5}
                  textAnchor="middle"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize={10}
                  fontWeight={800}
                  fill="#5B21B6"
                >
                  ⚡ Set Hash O(1) • Chặn!
                </text>
              </g>
            </g>
          )}

          {/* Step 7 Sandbox Purple Shield Badge */}
          {isStep7 &&
            layerVisibility.visited &&
            sandboxSnapshot &&
            sandboxSnapshot.blockedEdges.length > 0 && (
              <g>
                {(() => {
                  const blocked = sandboxSnapshot.blockedEdges[0];
                  const isTopCycle =
                    blocked.from === 'D' && blocked.to === 'A';
                  const pos = isTopCycle
                    ? { x: 214, y: 62 }
                    : {
                        x:
                          (GRAPH_NODE_MAP[blocked.from].x +
                            GRAPH_NODE_MAP[blocked.to].x) /
                          2,
                        y:
                          (GRAPH_NODE_MAP[blocked.from].y +
                            GRAPH_NODE_MAP[blocked.to].y) /
                          2,
                      };
                  return (
                    <g transform={`translate(${pos.x}, ${pos.y})`}>
                      <motion.g
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                      >
                        <rect
                          x={-50}
                          y={-13}
                          width={100}
                          height={24}
                          rx={6}
                          fill="#DDD6FE"
                          stroke="#7C3AED"
                          strokeWidth={1.75}
                        />
                        <text
                          x={0}
                          y={3}
                          textAnchor="middle"
                          fontFamily="JetBrains Mono, monospace"
                          fontSize={10.5}
                          fontWeight={800}
                          fill="#5B21B6"
                        >
                          {`🛡 ${blocked.to} ∈ visited`}
                        </text>
                      </motion.g>
                    </g>
                  );
                })()}
              </g>
            )}

          {/* Step 5 prev-fail: 5-Beat Live Memory Monitor + Overwrite Execution */}
          {step.id === 5 && arenaVisual === 'prev-fail' && (() => {
            const beatInfo = [
              {
                prevVal: "'A'",
                overwritten: null as string | null,
                note: "A mở B, C → prev = 'A'",
                lostNodes: [] as NodeId[],
                edges: [
                  { from: nodeA, to: nodeB },
                  { from: nodeA, to: nodeC },
                ],
              },
              {
                prevVal: "'B'",
                overwritten: "'A'",
                note: "B mở D → đè prev = 'B' (mất cha C!)",
                lostNodes: ['C'] as NodeId[],
                edges: [{ from: nodeB, to: nodeD }],
              },
              {
                prevVal: "'C'",
                overwritten: "'B'",
                note: "C mở E → đè prev = 'C' (mất cha D!)",
                lostNodes: ['C', 'D'] as NodeId[],
                edges: [{ from: nodeC, to: nodeE }],
              },
              {
                prevVal: "'E'",
                overwritten: "'C'",
                note: "E mở F → đè prev = 'E' (mất cha E!)",
                lostNodes: ['C', 'D', 'E'] as NodeId[],
                edges: [{ from: nodeE, to: nodeF }],
              },
              {
                prevVal: "'E'",
                overwritten: "'A','B','C'",
                note: "Từ F lùi về E, rồi TẮC NGHẼN tại E!",
                lostNodes: ['C', 'D'] as NodeId[],
                edges: [] as Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>,
              },
            ][Math.min(step5Beat, 4)];

            return (
              <g>
                {/* Top Live Single-Variable Memory Monitor Box */}
                <g transform="translate(280, 20)">
                  <rect
                    x={-222}
                    y={-13}
                    width={444}
                    height={25}
                    rx={6}
                    fill="#FEF3C7"
                    stroke="#DC2626"
                    strokeWidth={1.5}
                  />
                  <text
                    x={-212}
                    y={3}
                    textAnchor="start"
                    fontFamily="JetBrains Mono, monospace"
                    fontSize={9.5}
                    fontWeight={800}
                    fill="#92400E"
                  >
                    Ô NHỚ ĐƠN:
                  </text>
                  <g transform="translate(-108, 0)">
                    <motion.g
                      key={`prev-val-${step5Beat}`}
                      initial={{ scale: 0.85 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    >
                      <rect
                        x={-36}
                        y={-9}
                        width={76}
                        height={17}
                        rx={4}
                        fill="#FECACA"
                        stroke="#DC2626"
                        strokeWidth={1.35}
                      />
                      <text
                        x={2}
                        y={3}
                        textAnchor="middle"
                        fontFamily="JetBrains Mono, monospace"
                        fontSize={10}
                        fontWeight={800}
                        fill="#991B1B"
                      >
                        {`prev = ${beatInfo.prevVal}`}
                      </text>
                    </motion.g>
                  </g>
                  <text
                    x={-56}
                    y={3}
                    textAnchor="start"
                    fontFamily="JetBrains Mono, monospace"
                    fontSize={9.5}
                    fontWeight={700}
                    fill="#991B1B"
                  >
                    {beatInfo.note}
                  </text>
                </g>

                {/* Animated Moving Particles for Beats 0..3 */}
                {beatInfo.edges.map((e, idx) => (
                  <motion.circle
                    key={`prev-p-${step5Beat}-${idx}`}
                    initial={{ cx: e.from.x, cy: e.from.y }}
                    animate={{
                      cx: [e.from.x, e.to.x],
                      cy: [e.from.y, e.to.y],
                    }}
                    transition={{
                      duration: 0.85,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                    r={6.5}
                    fill="#D97706"
                    stroke="#1E293B"
                    strokeWidth={1.5}
                  />
                ))}

                {/* Overwritten "Mất cha!" Tags on Lost Nodes */}
                {beatInfo.lostNodes.map((nid) => {
                  const pt = GRAPH_NODE_MAP[nid];
                  return (
                    <g
                      key={`lost-${nid}`}
                      transform={`translate(${pt.x}, ${pt.y + 34})`}
                    >
                      <rect
                        x={-34}
                        y={-8}
                        width={68}
                        height={16}
                        rx={4}
                        fill="#FECACA"
                        stroke="#DC2626"
                        strokeWidth={1.25}
                      />
                      <text
                        x={0}
                        y={3}
                        textAnchor="middle"
                        fontFamily="JetBrains Mono, monospace"
                        fontSize={9}
                        fontWeight={800}
                        fill="#991B1B"
                      >
                        Mất cha!
                      </text>
                    </g>
                  );
                })}

                {/* Beat 4: Broken Backtrack F -> E & Stuck Error */}
                {step5Beat === 4 && (
                  <g>
                    <line
                      x1={nodeF.x}
                      y1={nodeF.y}
                      x2={nodeE.x}
                      y2={nodeE.y}
                      stroke="#DC2626"
                      strokeWidth={3.5}
                      strokeDasharray="5 4"
                    />
                    <motion.circle
                      initial={{ cx: nodeF.x, cy: nodeF.y }}
                      animate={{
                        cx: [nodeF.x, nodeE.x, nodeE.x - 4, nodeE.x + 4, nodeE.x],
                        cy: [nodeF.y, nodeE.y, nodeE.y, nodeE.y, nodeE.y],
                      }}
                      transition={{
                        duration: 1.4,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      r={7}
                      fill="#DC2626"
                      stroke="#1E293B"
                      strokeWidth={1.5}
                    />
                    <g transform={`translate(${nodeE.x}, ${nodeE.y + 34})`}>
                      <rect
                        x={-68}
                        y={-10}
                        width={136}
                        height={20}
                        rx={5}
                        fill="#FECACA"
                        stroke="#DC2626"
                        strokeWidth={1.5}
                      />
                      <text
                        x={0}
                        y={3}
                        textAnchor="middle"
                        fontFamily="JetBrains Mono, monospace"
                        fontSize={9.5}
                        fontWeight={800}
                        fill="#991B1B"
                      >
                        ? Kẹt tại E (prev=&apos;E&apos;)
                      </text>
                    </g>
                  </g>
                )}
              </g>
            );
          })()}

          {/* Parent Tags near discovered nodes */}
          {parentTags
            .filter((p) => p.from !== null)
            .map((p) => {
              const childNode = GRAPH_NODE_MAP[p.child];
              return (
                <g
                  key={`p-tag-${p.child}`}
                  transform={`translate(${childNode.x}, ${childNode.y + 34})`}
                >
                  <rect
                    x={-26}
                    y={-8}
                    width={52}
                    height={16}
                    rx={4}
                    fill="#BBF7D0"
                    stroke="#16A34A"
                    strokeWidth={1.25}
                  />
                  <text
                    x={0}
                    y={3}
                    textAnchor="middle"
                    fontFamily="JetBrains Mono, monospace"
                    fontSize={9.5}
                    fontWeight={800}
                    fill="#15803D"
                  >
                    {`${p.child}←${p.from}`}
                  </text>
                </g>
              );
            })}

          {/* Step 3 Stack Fail: Split at D into BOTH directions (D->A loop & D->E->F 4-step) */}
          {step.id === 3 && arenaVisual === 'stack-fail' && (() => {
            const q25 = quadPoint(nodeD, qCtrl, nodeA, 0.25);
            const q50 = quadPoint(nodeD, qCtrl, nodeA, 0.5);
            const q75 = quadPoint(nodeD, qCtrl, nodeA, 0.75);
            return (
              <g>
                {/* Particle 1: A -> B -> D -> A (Cycle branch) */}
                <motion.circle
                  initial={{ cx: nodeA.x, cy: nodeA.y }}
                  animate={{
                    cx: [nodeA.x, nodeB.x, nodeD.x, q25.x, q50.x, q75.x, nodeA.x],
                    cy: [nodeA.y, nodeB.y, nodeD.y, q25.y, q50.y, q75.y, nodeA.y],
                  }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
                  r={6.5}
                  fill="#F59E0B"
                  stroke="#1E293B"
                  strokeWidth={1.5}
                />

                {/* Particle 2: A -> B -> D -> E -> F (Deep 4-step branch) */}
                <motion.circle
                  initial={{ cx: nodeA.x, cy: nodeA.y }}
                  animate={{
                    cx: [nodeA.x, nodeB.x, nodeD.x, nodeE.x, nodeF.x],
                    cy: [nodeA.y, nodeB.y, nodeD.y, nodeE.y, nodeF.y],
                  }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
                  r={7}
                  fill="#DC2626"
                  stroke="#1E293B"
                  strokeWidth={1.5}
                />

                {/* Direction 1 Label on Top Arc */}
                <g transform="translate(214, 52)">
                  <rect
                    x={-72}
                    y={-11}
                    width={144}
                    height={20}
                    rx={5}
                    fill="#FEF3C7"
                    stroke="#DC2626"
                    strokeWidth={1.5}
                  />
                  <text
                    x={0}
                    y={2.5}
                    textAnchor="middle"
                    fontFamily="JetBrains Mono, monospace"
                    fontSize={9.5}
                    fontWeight={800}
                    fill="#991B1B"
                  >
                    Hướng 1: D➔A (Lặp ↺)
                  </text>
                </g>

                {/* Direction 2 Label at Bottom */}
                <g transform="translate(280, 340)">
                  <rect
                    x={-118}
                    y={-11}
                    width={236}
                    height={20}
                    rx={5}
                    fill="#FECACA"
                    stroke="#DC2626"
                    strokeWidth={1.5}
                  />
                  <text
                    x={0}
                    y={2.5}
                    textAnchor="middle"
                    fontFamily="JetBrains Mono, monospace"
                    fontSize={9.5}
                    fontWeight={800}
                    fill="#991B1B"
                  >
                    Hướng 2: D➔E➔F (4 bước — Bỏ quên C!)
                  </text>
                </g>
              </g>
            );
          })()}

          {/* Step 7 Single Active Edge Particle (during Chạy BFS tick-by-tick) */}
          {isStep7 &&
            !sandboxSnapshot?.finalPath &&
            sandboxSnapshot?.activeEdge && (
              <motion.circle
                key={`step7-edge-${sandboxSnapshot.tickIndex}`}
                initial={{
                  cx: GRAPH_NODE_MAP[sandboxSnapshot.activeEdge.from].x,
                  cy: GRAPH_NODE_MAP[sandboxSnapshot.activeEdge.from].y,
                }}
                animate={{
                  cx: [
                    GRAPH_NODE_MAP[sandboxSnapshot.activeEdge.from].x,
                    GRAPH_NODE_MAP[sandboxSnapshot.activeEdge.to].x,
                  ],
                  cy: [
                    GRAPH_NODE_MAP[sandboxSnapshot.activeEdge.from].y,
                    GRAPH_NODE_MAP[sandboxSnapshot.activeEdge.to].y,
                  ],
                }}
                transition={{ duration: 0.7, repeat: Infinity, ease: 'easeOut' }}
                r={7}
                fill="#0284C7"
                stroke="#1E293B"
                strokeWidth={1.5}
              />
            )}

          {/* Step 7 Single Shortest Path Particle (strictly 1 winning route) */}
          {isStep7 &&
            layerVisibility.parent &&
            highlightedOptimalPath &&
            highlightedOptimalPath.length >= 2 && (
              <motion.circle
                key={`step7-win-${highlightedOptimalPath.join('-')}`}
                initial={{
                  cx: GRAPH_NODE_MAP[highlightedOptimalPath[0]].x,
                  cy: GRAPH_NODE_MAP[highlightedOptimalPath[0]].y,
                }}
                animate={{
                  cx: highlightedOptimalPath.map((id) => GRAPH_NODE_MAP[id].x),
                  cy: highlightedOptimalPath.map((id) => GRAPH_NODE_MAP[id].y),
                }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                r={7}
                fill="#16A34A"
                stroke="#1E293B"
                strokeWidth={1.5}
              />
            )}

          {/* Step 3 Queue Win & Step 5 Dict Win Particle */}
          {((step.id === 3 && arenaVisual === 'queue-win') ||
            (step.id === 5 && arenaVisual === 'dict-win' && step5Beat === 4)) && (
            <motion.circle
              initial={{
                cx: step.id === 5 ? nodeF.x : nodeA.x,
                cy: step.id === 5 ? nodeF.y : nodeA.y,
              }}
              animate={
                step.id === 5
                  ? {
                      cx: [nodeF.x, nodeE.x, nodeC.x, nodeA.x],
                      cy: [nodeF.y, nodeE.y, nodeC.y, nodeA.y],
                    }
                  : {
                      cx: [nodeA.x, nodeC.x, nodeE.x, nodeF.x],
                      cy: [nodeA.y, nodeC.y, nodeE.y, nodeF.y],
                    }
              }
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              r={7}
              fill="#16A34A"
              stroke="#1E293B"
              strokeWidth={1.5}
            />
          )}

          {/* Step 8 Weighted BFS Stubborn 50km Particle */}
          {isStep8 && step8BfsRun && (
            <g>
              <motion.circle
                initial={{ cx: nodeA.x, cy: nodeA.y }}
                animate={{
                  cx: [nodeA.x, nodeC.x, nodeE.x, nodeF.x],
                  cy: [nodeA.y, nodeC.y, nodeE.y, nodeF.y],
                }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                r={7}
                fill="#DC2626"
                stroke="#1E293B"
                strokeWidth={1.5}
              />
              <g transform="translate(280, 342)">
                <rect
                  x={-168}
                  y={-11}
                  width={336}
                  height={20}
                  rx={5}
                  fill="#FECACA"
                  stroke="#DC2626"
                  strokeWidth={1.5}
                />
                <text
                  x={0}
                  y={2.5}
                  textAnchor="middle"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize={10}
                  fontWeight={800}
                  fill="#991B1B"
                >
                  BFS chọn 50km (Đỏ) • Đường 10km (Xanh) mới ngắn nhất!
                </text>
              </g>
            </g>
          )}

          {/* Step 7 Sandbox Visual Handoff Particles (Pure cx/cy) */}
          {sandboxQueueTarget && (
            <motion.circle
              key={`q-handoff-${sandboxQueueTarget}`}
              initial={{ cx: QUEUE_PORT.x, cy: QUEUE_PORT.y, opacity: 0 }}
              animate={{
                cx: [QUEUE_PORT.x, GRAPH_NODE_MAP[sandboxQueueTarget].x],
                cy: [QUEUE_PORT.y, GRAPH_NODE_MAP[sandboxQueueTarget].y],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: 'easeOut',
                times: [0, 0.15, 0.85, 1],
              }}
              r={6}
              fill="#0284C7"
              stroke="#1E293B"
              strokeWidth={1.5}
            />
          )}

          {sandboxDockTarget && (
            <g>
              {sandboxDockTarget.showVisited && (
                <motion.circle
                  key={`v-handoff-${sandboxDockTarget.node}`}
                  initial={{
                    cx: GRAPH_NODE_MAP[sandboxDockTarget.node].x,
                    cy: GRAPH_NODE_MAP[sandboxDockTarget.node].y,
                    opacity: 0,
                  }}
                  animate={{
                    cx: [GRAPH_NODE_MAP[sandboxDockTarget.node].x, VISITED_PORT.x],
                    cy: [GRAPH_NODE_MAP[sandboxDockTarget.node].y, VISITED_PORT.y],
                    opacity: [0, 1, 1, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeIn',
                    times: [0, 0.15, 0.85, 1],
                  }}
                  r={6}
                  fill="#7C3AED"
                  stroke="#1E293B"
                  strokeWidth={1.5}
                />
              )}
              {sandboxDockTarget.showParent && (
                <motion.circle
                  key={`p-handoff-${sandboxDockTarget.node}`}
                  initial={{
                    cx: GRAPH_NODE_MAP[sandboxDockTarget.node].x,
                    cy: GRAPH_NODE_MAP[sandboxDockTarget.node].y,
                    opacity: 0,
                  }}
                  animate={{
                    cx: [GRAPH_NODE_MAP[sandboxDockTarget.node].x, PARENT_PORT.x],
                    cy: [GRAPH_NODE_MAP[sandboxDockTarget.node].y, PARENT_PORT.y],
                    opacity: [0, 1, 1, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeIn',
                    times: [0, 0.15, 0.85, 1],
                  }}
                  r={6}
                  fill="#16A34A"
                  stroke="#1E293B"
                  strokeWidth={1.5}
                />
              )}
            </g>
          )}

          {/* 6 Persistent Graph Nodes (NEVER move or disappear) */}
          {GRAPH_NODES.map((node) => {
            const isStart = node.id === activeStart;
            const isGoal = node.id === activeGoal;
            const isCurrent = node.id === activeCurrentNode;
            const isVisited = visitedSet.has(node.id);
            const isOptNode = Boolean(highlightedOptimalPath?.includes(node.id));
            const isBadNode = Boolean(highlightedBadPath?.includes(node.id));
            const isStep1Candidate =
              isStep1 &&
              manualStatus !== 'optimal' &&
              step1ValidNext.includes(node.id);
            const isClickable = isStep1Candidate || isStep7;

            const isListAmber =
              step.id === 4 && arenaVisual === 'list-slow' && isVisited;

            const fillColor = isBadNode && !isOptNode
              ? '#FECACA'
              : isOptNode
                ? '#BBF7D0'
                : isCurrent
                  ? '#BAE6FD'
                  : isListAmber
                    ? '#FEF3C7'
                    : isVisited
                      ? '#DDD6FE'
                      : '#FFFDF9';

            const strokeColor = isBadNode && !isOptNode
              ? '#DC2626'
              : isOptNode
                ? '#16A34A'
                : isCurrent
                  ? '#0284C7'
                  : isListAmber
                    ? '#D97706'
                    : isVisited
                      ? '#7C3AED'
                      : '#1E293B';

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className={isClickable ? 'cursor-pointer' : 'cursor-default'}
                onClick={() => {
                  if (isStep1Candidate) {
                    onManualNodeClick(node.id);
                  } else if (isStep7) {
                    onSelectSandboxNode(node.id);
                  }
                }}
              >
                {/* Pulsing clickable halo in Step 1 */}
                {isStep1Candidate && (
                  <motion.circle
                    cx={0}
                    cy={0}
                    r={NODE_RADIUS + 7}
                    fill="none"
                    stroke="#0284C7"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    animate={{
                      scale: [0.96, 1.07, 0.96],
                      opacity: [0.45, 0.95, 0.45],
                    }}
                    transition={{ repeat: Infinity, duration: 1.3 }}
                  />
                )}

                <circle cx={3} cy={3} r={NODE_RADIUS} fill="#1E293B" />
                <circle
                  cx={0}
                  cy={0}
                  r={NODE_RADIUS}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isCurrent || isOptNode || isBadNode ? 2.5 : 1.75}
                />
                <text
                  x={0}
                  y={5.5}
                  textAnchor="middle"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize={16}
                  fontWeight={800}
                  fill="#1E293B"
                >
                  {node.id}
                </text>

                {(isStart || isGoal) && (
                  <g transform="translate(0, -34)">
                    <rect
                      x={-26}
                      y={-9}
                      width={52}
                      height={17}
                      rx={4}
                      fill={isGoal ? '#BBF7D0' : '#BAE6FD'}
                      stroke="#1E293B"
                      strokeWidth={1.25}
                    />
                    <text
                      x={0}
                      y={2.5}
                      textAnchor="middle"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize={9.5}
                      fontWeight={800}
                      fill="#1E293B"
                    >
                      {isStart && isGoal ? 'S / G' : isStart ? 'START' : 'GOAL'}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
