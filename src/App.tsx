import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HighlightableThread,
  HighlightProvider,
} from './context/HighlightContext';
import {
  BFS_ADJACENCY,
  BFS_STEPS,
  NodeId,
  runBfsSimulation,
} from './data/bfsLesson';
import { MacroPipeline } from './components/MacroPipeline';
import { DecompositionStage } from './components/DecompositionStage';
import {
  ArenaChoice,
  ToolArenaBottomWidget,
  ToolArenaSelector,
} from './components/ToolArena';
import { CodeAssembler } from './components/CodeAssembler';
import { LimitBreaker } from './components/LimitBreaker';
import { MiniCodeSandbox } from './components/MiniCodeSandbox';
import { CodePanel } from './components/CodePanel';
import {
  ArenaVisualMode,
  GraphCanvas,
  LayerVisibility,
} from './components/GraphCanvas';
import { DataStructuresDock } from './components/DataStructuresDock';
import { Sidebar } from './components/Sidebar';
import { BottomStepper } from './components/BottomStepper';

function BfsVisualizerShell() {
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Phase 1 States (Steps 1 & 2)
  const [manualPath, setManualPath] = useState<NodeId[]>(['A']);
  const [selectedChipIds, setSelectedChipIds] = useState<string[]>([]);

  // Phase 2 States (Steps 3, 4, 5 Tool Arena)
  const [arenaChoiceByStep, setArenaChoiceByStep] = useState<
    Record<number, ArenaChoice>
  >({ 3: 'A', 4: 'A', 5: 'A' });
  const [arenaHasRunByStep, setArenaHasRunByStep] = useState<
    Record<number, boolean>
  >({ 3: false, 4: false, 5: false });
  const [lockedWinners, setLockedWinners] = useState<
    Record<HighlightableThread, boolean>
  >({ queue: false, visited: false, parent: false });
  const [step5Beat, setStep5Beat] = useState<number>(0);
  const [step5RunKey, setStep5RunKey] = useState<number>(0);

  // Phase 3 States (Step 6 Code Assembly + Step 7 Sandbox)
  const [snappedSlots, setSnappedSlots] = useState<
    Record<HighlightableThread, boolean>
  >({ queue: false, visited: false, parent: false });
  const [sandboxStart, setSandboxStart] = useState<NodeId>('A');
  const [sandboxGoal, setSandboxGoal] = useState<NodeId>('F');
  const [sandboxPickNext, setSandboxPickNext] = useState<'start' | 'goal'>(
    'start'
  );
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    queue: true,
    visited: true,
    parent: true,
  });
  const [sandboxTickIndex, setSandboxTickIndex] = useState<number | null>(null);
  const [sandboxPlaying, setSandboxPlaying] = useState(false);

  // Phase 4 State (Step 8 Weighted BFS Limit)
  const [step8BfsRun, setStep8BfsRun] = useState(false);

  const totalSteps = BFS_STEPS.length;
  const currentStep = BFS_STEPS[stepIndex];

  // Derived manual path status for Step 1
  const manualStatus: 'exploring' | 'cycle' | 'suboptimal' | 'optimal' =
    useMemo(() => {
      if (manualPath.length >= 2) {
        const last = manualPath[manualPath.length - 1];
        const prevSlice = manualPath.slice(0, -1);
        if (prevSlice.includes(last)) return 'cycle';
        if (last === 'F') {
          return manualPath.length - 1 === 3 ? 'optimal' : 'suboptimal';
        }
      }
      return 'exploring';
    }, [manualPath]);

  const pipelineUnlocked = selectedChipIds.length === 3;

  // Step 7 Sandbox snapshots
  const sandboxSnapshots = useMemo(
    () => runBfsSimulation(sandboxStart, sandboxGoal),
    [sandboxStart, sandboxGoal]
  );

  const activeSandboxSnapshot = useMemo(() => {
    if (currentStep.id !== 7) return null;
    if (sandboxTickIndex === null) {
      return sandboxSnapshots[sandboxSnapshots.length - 1] ?? null;
    }
    return (
      sandboxSnapshots[
        Math.min(sandboxTickIndex, sandboxSnapshots.length - 1)
      ] ?? null
    );
  }, [currentStep.id, sandboxTickIndex, sandboxSnapshots]);

  // Step 5: 5-beat execution timer when user clicks "Chạy thử"
  useEffect(() => {
    if (currentStep.id !== 5 || !arenaHasRunByStep[5]) {
      setStep5Beat(0);
      return;
    }

    setStep5Beat(0);
    const timers = [1, 2, 3, 4].map((beat) =>
      window.setTimeout(() => setStep5Beat(beat), beat * 1050)
    );

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [currentStep.id, arenaHasRunByStep, step5RunKey]);

  // Step 7 Sandbox tick timer
  useEffect(() => {
    if (!sandboxPlaying || currentStep.id !== 7) return;
    if (
      sandboxTickIndex === null ||
      sandboxTickIndex >= sandboxSnapshots.length - 1
    ) {
      setSandboxPlaying(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setSandboxTickIndex((prev) =>
        prev === null ? 0 : Math.min(prev + 1, sandboxSnapshots.length - 1)
      );
    }, 850);

    return () => window.clearTimeout(timer);
  }, [sandboxPlaying, currentStep.id, sandboxTickIndex, sandboxSnapshots.length]);

  // Determine sequential unlock gate
  const isCurrentStepCompleted = (() => {
    switch (currentStep.id) {
      case 1:
        return manualStatus === 'optimal';
      case 2:
        return pipelineUnlocked;
      case 3:
        return lockedWinners.queue;
      case 4:
        return lockedWinners.visited;
      case 5:
        return lockedWinners.parent;
      case 6:
        return (
          snappedSlots.queue && snappedSlots.visited && snappedSlots.parent
        );
      case 8:
        return step8BfsRun;
      default:
        return true;
    }
  })();

  const maxUnlockedIndex = (() => {
    if (manualStatus !== 'optimal') return Math.max(0, stepIndex);
    if (!pipelineUnlocked) return Math.max(1, stepIndex);
    if (!lockedWinners.queue) return Math.max(2, stepIndex);
    if (!lockedWinners.visited) return Math.max(3, stepIndex);
    if (!lockedWinners.parent) return Math.max(4, stepIndex);
    if (
      !(snappedSlots.queue && snappedSlots.visited && snappedSlots.parent)
    ) {
      return Math.max(5, stepIndex);
    }
    if (!step8BfsRun) return Math.max(7, stepIndex);
    return totalSteps - 1;
  })();

  const lockReason = (() => {
    switch (currentStep.id) {
      case 1:
        return 'Tìm đường 3 bước';
      case 2:
        return 'Chọn đủ 3 việc';
      case 3:
        return 'Thử Queue';
      case 4:
        return 'Chốt dùng Set';
      case 5:
        return 'Thử Dict parent';
      case 6:
        return 'Lắp 3 công cụ';
      case 8:
        return 'Chạy BFS trước';
      default:
        return '';
    }
  })();

  // Auto-Play progression (auto-completes Guided Discovery steps smoothly when Play is ON)
  useEffect(() => {
    if (!isPlaying) return;

    if (currentStep.id === 1 && manualStatus !== 'optimal') {
      const target: NodeId[] = ['A', 'C', 'E', 'F'];
      if (manualPath.length < target.length) {
        const t = window.setTimeout(() => {
          setManualPath(target.slice(0, manualPath.length + 1));
        }, 700);
        return () => window.clearTimeout(t);
      }
    }

    if (currentStep.id === 2 && !pipelineUnlocked) {
      const order = ['layer', 'visited', 'parent'];
      const nextChip = order.find((c) => !selectedChipIds.includes(c));
      if (nextChip) {
        const t = window.setTimeout(() => {
          setSelectedChipIds((prev) => [...prev, nextChip]);
        }, 700);
        return () => window.clearTimeout(t);
      }
    }

    if (currentStep.id === 3 && !lockedWinners.queue) {
      const t = window.setTimeout(() => {
        setArenaChoiceByStep((p) => ({ ...p, 3: 'B' }));
        setArenaHasRunByStep((p) => ({ ...p, 3: true }));
        setLockedWinners((p) => ({ ...p, queue: true }));
      }, 1400);
      return () => window.clearTimeout(t);
    }

    if (currentStep.id === 4 && !lockedWinners.visited) {
      const t = window.setTimeout(() => {
        setArenaChoiceByStep((p) => ({ ...p, 4: 'B' }));
        setArenaHasRunByStep((p) => ({ ...p, 4: true }));
        setLockedWinners((p) => ({ ...p, visited: true }));
      }, 1500);
      return () => window.clearTimeout(t);
    }

    if (currentStep.id === 5 && !lockedWinners.parent) {
      const t = window.setTimeout(() => {
        setArenaChoiceByStep((p) => ({ ...p, 5: 'B' }));
        setArenaHasRunByStep((p) => ({ ...p, 5: true }));
        setLockedWinners((p) => ({ ...p, parent: true }));
      }, 1400);
      return () => window.clearTimeout(t);
    }

    if (
      currentStep.id === 6 &&
      !(snappedSlots.queue && snappedSlots.visited && snappedSlots.parent)
    ) {
      const t = window.setTimeout(() => {
        setSnappedSlots({ queue: true, visited: true, parent: true });
      }, 1100);
      return () => window.clearTimeout(t);
    }

    if (currentStep.id === 8 && !step8BfsRun) {
      const t = window.setTimeout(() => setStep8BfsRun(true), 1100);
      return () => window.clearTimeout(t);
    }

    if (stepIndex >= totalSteps - 1) {
      setIsPlaying(false);
      return;
    }

    const duration = currentStep.autoPlayDurationMs ?? 4500;
    const timer = window.setTimeout(() => {
      setStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
    }, duration);

    return () => window.clearTimeout(timer);
  }, [
    isPlaying,
    stepIndex,
    totalSteps,
    currentStep.id,
    currentStep.autoPlayDurationMs,
    manualPath,
    manualStatus,
    pipelineUnlocked,
    selectedChipIds,
    lockedWinners,
    snappedSlots,
    step8BfsRun,
  ]);

  // Handlers
  const handleManualNodeClick = useCallback(
    (nodeId: NodeId) => {
      if (manualStatus === 'optimal' || manualStatus === 'suboptimal') return;
      const head = manualPath[manualPath.length - 1];
      if (!BFS_ADJACENCY[head].includes(nodeId)) return;
      setManualPath((prev) => [...prev, nodeId]);
    },
    [manualPath, manualStatus]
  );

  const handleSelectChip = useCallback((chipId: string) => {
    setSelectedChipIds((prev) =>
      prev.includes(chipId) ? prev : [...prev, chipId]
    );
  }, []);

  const handleRunArena = useCallback(() => {
    const id = currentStep.id;
    const choice = arenaChoiceByStep[id] ?? 'A';
    setArenaHasRunByStep((prev) => ({ ...prev, [id]: true }));
    if (id === 3 && choice === 'B') {
      setLockedWinners((prev) => ({ ...prev, queue: true }));
    }
    if (id === 5) {
      setStep5Beat(0);
      setStep5RunKey((k) => k + 1);
      if (choice === 'B') {
        setLockedWinners((prev) => ({ ...prev, parent: true }));
      }
    }
  }, [currentStep.id, arenaChoiceByStep]);

  const handleSnapAllSlots = useCallback(() => {
    setSnappedSlots((prev) => ({ ...prev, queue: true }));
    window.setTimeout(
      () => setSnappedSlots((prev) => ({ ...prev, visited: true })),
      300
    );
    window.setTimeout(
      () => setSnappedSlots((prev) => ({ ...prev, parent: true })),
      600
    );
  }, []);

  const handleSelectSandboxNode = useCallback(
    (nodeId: NodeId) => {
      setSandboxPlaying(false);
      if (sandboxPickNext === 'start') {
        setSandboxStart(nodeId);
        setSandboxPickNext('goal');
        setSandboxTickIndex(0);
      } else {
        setSandboxGoal(nodeId);
        setSandboxPickNext('start');
        setSandboxTickIndex(0);
      }
    },
    [sandboxPickNext]
  );

  const handlePrev = useCallback(() => {
    setIsPlaying(false);
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setIsPlaying(false);
    if (!isCurrentStepCompleted) return;
    setStepIndex((prev) => Math.min(totalSteps - 1, prev + 1));
  }, [isCurrentStepCompleted, totalSteps]);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev && stepIndex >= totalSteps - 1) {
        setStepIndex(0);
        return true;
      }
      return !prev;
    });
  }, [stepIndex, totalSteps]);

  const handleReplay = useCallback(() => {
    setStepIndex(0);
    setIsPlaying(false);
    setManualPath(['A']);
    setSelectedChipIds([]);
    setArenaChoiceByStep({ 3: 'A', 4: 'A', 5: 'A' });
    setArenaHasRunByStep({ 3: false, 4: false, 5: false });
    setLockedWinners({ queue: false, visited: false, parent: false });
    setStep5Beat(0);
    setSnappedSlots({ queue: false, visited: false, parent: false });
    setSandboxStart('A');
    setSandboxGoal('F');
    setSandboxTickIndex(null);
    setSandboxPlaying(false);
    setStep8BfsRun(false);
  }, []);

  // Keyboard shortcuts: ArrowLeft, ArrowRight, Space
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNext, handlePrev, handleTogglePlay]);

  // Compute Arena Visual Mode for Steps 3, 4, 5
  const arenaVisual: ArenaVisualMode = (() => {
    if (currentStep.phase !== 2) return 'idle';
    const hasRun = arenaHasRunByStep[currentStep.id];
    const choice = arenaChoiceByStep[currentStep.id] ?? 'A';
    if (!hasRun) return 'idle';
    if (currentStep.id === 3) {
      return choice === 'A' ? 'stack-fail' : 'queue-win';
    }
    if (currentStep.id === 4) {
      return choice === 'A' ? 'list-slow' : 'set-fast';
    }
    if (currentStep.id === 5) {
      return choice === 'A' ? 'prev-fail' : 'dict-win';
    }
    return 'idle';
  })();

  const liveCurrentNode = (() => {
    if (currentStep.id === 1) return manualPath[manualPath.length - 1];
    if (currentStep.id === 7 && activeSandboxSnapshot) {
      return activeSandboxSnapshot.currentNode ?? '—';
    }
    return currentStep.metrics.currentNode;
  })();

  const liveQueueLength = (() => {
    if (currentStep.id === 1) return `${manualPath.length - 1} bước`;
    if (currentStep.id === 2) return `${selectedChipIds.length}/3 việc`;
    if (currentStep.id === 7 && activeSandboxSnapshot) {
      return `Queue (${activeSandboxSnapshot.queue.length})`;
    }
    return currentStep.metrics.queueLength;
  })();

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F5EE] text-[#1E293B] lg:h-screen lg:overflow-hidden">
      {/* Zone 1: Top Macro Pipeline & Metrics */}
      <MacroPipeline
        step={currentStep}
        liveCurrentNode={liveCurrentNode}
        liveQueueLength={liveQueueLength}
        pipelineUnlocked={pipelineUnlocked}
        lockedWinners={lockedWinners}
      />

      {/* Zone 2 (Main Stage ~65%) + Zone 3 (Right Sidebar ~35%) */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Main Stage (~65%) */}
        <section className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto bg-blueprint-dots p-3 sm:p-4 lg:w-[65%] lg:overflow-hidden">
          {/* Phase 2: A-vs-B Tool Selector directly ABOVE Graph */}
          {currentStep.phase === 2 && (
            <ToolArenaSelector
              stepId={currentStep.id}
              choice={arenaChoiceByStep[currentStep.id] ?? 'A'}
              hasRun={Boolean(arenaHasRunByStep[currentStep.id])}
              isWinnerLocked={
                currentStep.id === 3
                  ? lockedWinners.queue
                  : currentStep.id === 4
                    ? lockedWinners.visited
                    : lockedWinners.parent
              }
              onSelectChoice={(c) => {
                setArenaChoiceByStep((prev) => ({
                  ...prev,
                  [currentStep.id]: c,
                }));
                setArenaHasRunByStep((prev) => ({
                  ...prev,
                  [currentStep.id]: false,
                }));
                if (currentStep.id === 5) {
                  setStep5Beat(0);
                }
              }}
              onRunArena={handleRunArena}
              onLockSetWinner={() =>
                setLockedWinners((prev) => ({ ...prev, visited: true }))
              }
            />
          )}

          {/* Middle Row: Phase-specific Left Panel (HIDDEN Code on Phase 1 & 2!) + Persistent Graph, or Step 9 Mini Code Sandbox */}
          {currentStep.id === 9 ? (
            <MiniCodeSandbox />
          ) : currentStep.phase === 2 ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <GraphCanvas
                step={currentStep}
                manualPath={manualPath}
                manualStatus={manualStatus}
                onManualNodeClick={handleManualNodeClick}
                arenaVisual={arenaVisual}
                step5Beat={step5Beat}
                snappedSlots={snappedSlots}
                sandboxStart={sandboxStart}
                sandboxGoal={sandboxGoal}
                sandboxSnapshot={activeSandboxSnapshot}
                sandboxPlaying={sandboxPlaying}
                layerVisibility={layerVisibility}
                onToggleLayer={(layer) =>
                  setLayerVisibility((prev) => ({
                    ...prev,
                    [layer]: !prev[layer],
                  }))
                }
                onSelectSandboxNode={handleSelectSandboxNode}
                onRunSandboxBfs={() => {
                  setSandboxTickIndex(0);
                  setSandboxPlaying(true);
                }}
                step8BfsRun={step8BfsRun}
              />
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[290px_1fr] xl:grid-cols-[312px_1fr]">
              {currentStep.phase === 1 && (
                <DecompositionStage
                  stepId={currentStep.id}
                  manualPath={manualPath}
                  manualStatus={manualStatus}
                  selectedChipIds={selectedChipIds}
                  onResetManualPath={() => setManualPath(['A'])}
                  onAdvanceToStep2={() => setStepIndex(1)}
                  onSelectChip={handleSelectChip}
                  onAdvanceToPhase2={() => setStepIndex(2)}
                />
              )}

              {currentStep.id === 6 && (
                <CodeAssembler
                  snappedSlots={snappedSlots}
                  onSnapSlot={(slot) =>
                    setSnappedSlots((prev) => ({ ...prev, [slot]: true }))
                  }
                  onSnapAll={handleSnapAllSlots}
                  onAdvanceToStep7={() => setStepIndex(6)}
                />
              )}

              {currentStep.id === 7 && (
                <CodePanel activeLineNums={currentStep.activeLineNums} />
              )}

              {currentStep.phase === 4 && currentStep.id === 8 && (
                <LimitBreaker
                  hasRunWeightedBfs={step8BfsRun}
                  onRunWeightedBfs={() => setStep8BfsRun(true)}
                  onOpenCodingSandbox={() => setStepIndex(8)}
                />
              )}

              <GraphCanvas
                step={currentStep}
                manualPath={manualPath}
                manualStatus={manualStatus}
                onManualNodeClick={handleManualNodeClick}
                arenaVisual={arenaVisual}
                step5Beat={step5Beat}
                snappedSlots={snappedSlots}
                sandboxStart={sandboxStart}
                sandboxGoal={sandboxGoal}
                sandboxSnapshot={activeSandboxSnapshot}
                sandboxPlaying={sandboxPlaying}
                layerVisibility={layerVisibility}
                onToggleLayer={(layer) =>
                  setLayerVisibility((prev) => ({
                    ...prev,
                    [layer]: !prev[layer],
                  }))
                }
                onSelectSandboxNode={handleSelectSandboxNode}
                onRunSandboxBfs={() => {
                  setSandboxTickIndex(0);
                  setSandboxPlaying(true);
                }}
                step8BfsRun={step8BfsRun}
              />
            </div>
          )}

          {/* Phase 2 Bottom Widget: Scale Stress-Test (Step 4) or Trace Strip (Step 3 & 5) */}
          {currentStep.phase === 2 && (
            <ToolArenaBottomWidget
              stepId={currentStep.id}
              choice={arenaChoiceByStep[currentStep.id] ?? 'A'}
              hasRun={Boolean(arenaHasRunByStep[currentStep.id])}
              setLocked={lockedWinners.visited}
              step5Beat={step5Beat}
              onSelectStep5Beat={(b) => setStep5Beat(b)}
              onLockSetWinner={() =>
                setLockedWinners((prev) => ({ ...prev, visited: true }))
              }
            />
          )}

          {/* Phase 3 (Step 7) Data Structures Dock */}
          {currentStep.id === 7 && (
            <DataStructuresDock
              step={currentStep}
              step3Solved={true}
              step4Running={false}
              visitedEnabled={true}
              sandboxSnapshot={activeSandboxSnapshot}
              layerVisibility={layerVisibility}
            />
          )}
        </section>

        {/* Zone 3: Right Explanation Sidebar (~35%) */}
        <Sidebar
          step={currentStep}
          totalSteps={totalSteps}
          sandboxStart={sandboxStart}
          sandboxGoal={sandboxGoal}
          sandboxFinalPath={activeSandboxSnapshot?.finalPath ?? null}
        />
      </main>

      {/* Zone 4: Bottom Navigation Bar */}
      <BottomStepper
        steps={BFS_STEPS}
        currentIndex={stepIndex}
        maxUnlockedIndex={maxUnlockedIndex}
        isNextLocked={!isCurrentStepCompleted}
        lockReason={lockReason}
        isPlaying={isPlaying}
        onSelectStep={(idx) => {
          setIsPlaying(false);
          setStepIndex(idx);
        }}
        onPrev={handlePrev}
        onNext={handleNext}
        onTogglePlay={handleTogglePlay}
        onReplay={handleReplay}
      />
    </div>
  );
}

export function App() {
  return (
    <HighlightProvider>
      <BfsVisualizerShell />
    </HighlightProvider>
  );
}

export default App;
