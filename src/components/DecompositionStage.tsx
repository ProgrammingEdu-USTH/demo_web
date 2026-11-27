import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Footprints,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { HighlightableThread } from '../context/HighlightContext';
import { DECOMPOSITION_CHIPS, NodeId } from '../data/bfsLesson';

interface DecompositionStageProps {
  stepId: number;
  manualPath: NodeId[];
  manualStatus: 'exploring' | 'cycle' | 'suboptimal' | 'optimal';
  selectedChipIds: string[];
  onResetManualPath: () => void;
  onAdvanceToStep2: () => void;
  onSelectChip: (chipId: string) => void;
  onAdvanceToPhase2: () => void;
}

const SLOT_CONFIG: Array<{
  chipId: string;
  slotLabel: string;
  thread: HighlightableThread;
  bg: string;
  border: string;
}> = [
  {
    chipId: 'layer',
    slotLabel: '1. Xử lý khoảng cách (Xanh dương)',
    thread: 'queue',
    bg: 'bg-[#BAE6FD]',
    border: 'border-[#0284C7]',
  },
  {
    chipId: 'visited',
    slotLabel: '2. Xử lý vòng lặp (Tím)',
    thread: 'visited',
    bg: 'bg-[#DDD6FE]',
    border: 'border-[#7C3AED]',
  },
  {
    chipId: 'parent',
    slotLabel: '3. Khôi phục lộ trình (Xanh lá)',
    thread: 'parent',
    bg: 'bg-[#BBF7D0]',
    border: 'border-[#16A34A]',
  },
];

export const DecompositionStage: React.FC<DecompositionStageProps> = ({
  stepId,
  manualPath,
  manualStatus,
  selectedChipIds,
  onResetManualPath,
  onAdvanceToStep2,
  onSelectChip,
  onAdvanceToPhase2,
}) => {
  const [rejectNotice, setRejectNotice] = useState<string | null>(null);
  const [shakingChipId, setShakingChipId] = useState<string | null>(null);

  if (stepId === 1) {
    const hopCount = Math.max(0, manualPath.length - 1);

    return (
      <div className="flex flex-col justify-between gap-3 rounded-[8px] border-[1.5px] border-[#1E293B] bg-[#FFFDF9] p-3.5 shadow-[3px_3px_0_#1E293B]">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#E5E0D5] pb-2">
            <div className="flex items-center gap-1.5">
              <Footprints className="h-4 w-4 text-[#0284C7]" />
              <span className="font-mono text-[11px] font-extrabold uppercase tracking-wider text-[#1E293B]">
                TỰ TÌM ĐƯỜNG (KHÔNG CODE)
              </span>
            </div>
            <span className="rounded border border-[#1E293B] bg-[#BAE6FD] px-1.5 py-0.5 font-mono text-[10px] font-bold">
              {hopCount} bước
            </span>
          </div>

          <p className="text-[12.5px] leading-snug text-slate-700">
            Hãy bấm trực tiếp vào các đỉnh nối tiếp trên đồ thị để đi từ{' '}
            <strong className="font-mono text-[#0369A1]">A</strong> tới{' '}
            <strong className="font-mono text-[#15803D]">F</strong> với ít bước
            nhất.
          </p>

          {/* Breadcrumb Trail */}
          <div className="rounded-[6px] border-[1.5px] border-[#1E293B] bg-[#F7F5EE] p-2.5">
            <div className="mb-1 font-mono text-[10px] font-bold uppercase text-slate-500">
              Lộ trình bạn đã đi:
            </div>
            <div className="flex flex-wrap items-center gap-1 font-mono text-xs font-extrabold text-[#1E293B]">
              {manualPath.map((node, idx) => (
                <React.Fragment key={`${node}-${idx}`}>
                  <span
                    className={`rounded border border-[#1E293B] px-1.5 py-0.5 ${
                      idx === manualPath.length - 1
                        ? 'bg-[#BAE6FD]'
                        : 'bg-white'
                    }`}
                  >
                    {node}
                  </span>
                  {idx < manualPath.length - 1 && (
                    <span className="text-slate-400">➔</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Feedback Card */}
          {manualStatus === 'cycle' && (
            <div className="rounded-[6px] border-[1.5px] border-[#DC2626] bg-[#FECACA]/75 p-2.5 text-xs font-semibold text-[#991B1B]">
              Cẩn thận! Bạn vừa đi vào vòng lặp quay lại đỉnh cũ. Nếu là máy
              tính không có trí nhớ, nó sẽ lặp mãi ở đây!
            </div>
          )}

          {manualStatus === 'suboptimal' && (
            <div className="rounded-[6px] border-[1.5px] border-[#D97706] bg-[#FEF3C7] p-2.5 text-xs font-semibold text-[#92400E]">
              Bạn đã tới F sau <strong>{hopCount} bước</strong>! Nhưng vẫn còn
              một đường ngắn hơn chỉ <strong>3 bước</strong> — thử nhánh dưới{' '}
              <code>A ➔ C</code> xem sao!
            </div>
          )}

          {manualStatus === 'optimal' && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-[6px] border-[1.5px] border-[#16A34A] bg-[#BBF7D0] p-2.5 text-xs font-bold text-[#14532D]"
            >
              Chính xác! Đường đi ngắn nhất 3 bước: <code>A ➔ C ➔ E ➔ F</code>{' '}
              ✓
            </motion.div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={onResetManualPath}
            className="flex w-full items-center justify-center gap-1.5 rounded-[6px] border-[1.5px] border-[#1E293B] bg-white px-3 py-1.5 font-mono text-xs font-bold text-[#1E293B] shadow-[2px_2px_0_#1E293B] hover:bg-[#F7F5EE] active:translate-x-[1px] active:translate-y-[1px]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Đi lại từ A</span>
          </button>

          {manualStatus === 'optimal' && (
            <motion.button
              type="button"
              onClick={onAdvanceToStep2}
              initial={{ y: 4, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex w-full items-center justify-center gap-1.5 rounded-[6px] border-[1.5px] border-[#1E293B] bg-[#BBF7D0] px-3 py-2 font-sans text-xs font-extrabold text-[#1E293B] shadow-[3px_3px_0_#1E293B] hover:bg-[#86EFAC]"
            >
              <span>Sang Bước 2: Phân rã bài toán</span>
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          )}
        </div>
      </div>
    );
  }

  // Step 2: 3-Slot Decomposition Checklist
  const allThreeDone = selectedChipIds.length === 3;

  return (
    <div className="flex flex-col justify-between gap-2.5 overflow-y-auto rounded-[8px] border-[1.5px] border-[#1E293B] bg-[#FFFDF9] p-3 shadow-[3px_3px_0_#1E293B]">
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b border-[#E5E0D5] pb-1.5">
          <span className="font-mono text-[10.5px] font-extrabold uppercase tracking-wider text-[#1E293B]">
            PHÂN RÃ 3 NHIỆM VỤ CỐT LÕI
          </span>
          <span className="rounded border border-[#1E293B] bg-[#F7F5EE] px-1.5 py-0.5 font-mono text-[10px] font-bold">
            {selectedChipIds.length}/3
          </span>
        </div>

        <p className="text-[12px] font-semibold leading-snug text-[#1E293B]">
          Để máy tính tự làm được như não bạn vừa làm, bài toán cần tách thành 3
          việc nào?
        </p>

        {/* 3 Target Slots */}
        <div className="space-y-1.5">
          {SLOT_CONFIG.map((slot) => {
            const matched = selectedChipIds.includes(slot.chipId);
            const chip = DECOMPOSITION_CHIPS.find((c) => c.id === slot.chipId);

            return (
              <div
                key={slot.chipId}
                className={`rounded-[6px] border-[1.5px] px-2.5 py-1.5 transition-all ${
                  matched
                    ? `${slot.border} ${slot.bg} shadow-[2px_2px_0_#1E293B]`
                    : 'border-dashed border-slate-400 bg-[#F7F5EE]'
                }`}
              >
                {matched && chip ? (
                  <motion.div
                    initial={{ scale: 0.94, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-[11.5px] font-extrabold text-[#1E293B]">
                        {chip.label}
                      </div>
                      <div className="text-[10px] font-medium text-slate-700">
                        {chip.sub}
                      </div>
                    </div>
                    <Check className="h-4 w-4 shrink-0 text-[#1E293B] stroke-[3]" />
                  </motion.div>
                ) : (
                  <div className="font-mono text-[10.5px] font-semibold text-slate-500">
                    {slot.slotLabel} — [ Chờ chọn ]
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 5 Clickable Requirement Chips */}
        <div className="space-y-1 pt-1">
          <div className="font-mono text-[10px] font-bold uppercase text-slate-500">
            Chọn từ 5 gợi ý (có 2 thẻ gây nhiễu):
          </div>
          <div className="flex flex-col gap-1.5">
            {DECOMPOSITION_CHIPS.map((chip) => {
              const isPicked = selectedChipIds.includes(chip.id);
              const isShaking = shakingChipId === chip.id;

              return (
                <motion.button
                  key={chip.id}
                  type="button"
                  disabled={isPicked}
                  animate={
                    isShaking ? { x: [-5, 5, -4, 4, 0] } : { x: 0 }
                  }
                  transition={{ duration: 0.3 }}
                  onClick={() => {
                    if (chip.correct) {
                      setRejectNotice(null);
                      onSelectChip(chip.id);
                    } else {
                      setShakingChipId(chip.id);
                      setRejectNotice(chip.rejectReason ?? 'Chưa hợp lý!');
                      window.setTimeout(() => setShakingChipId(null), 400);
                    }
                  }}
                  className={`flex items-center justify-between gap-2 rounded-[6px] border-[1.5px] px-2.5 py-1.5 text-left transition-all ${
                    isPicked
                      ? 'cursor-default border-[#1E293B]/30 bg-slate-100 opacity-45'
                      : isShaking
                        ? 'border-[#DC2626] bg-[#FECACA]'
                        : 'border-[#1E293B] bg-white shadow-[2px_2px_0_#1E293B] hover:bg-[#F7F5EE] active:translate-x-[1px] active:translate-y-[1px]'
                  }`}
                >
                  <div>
                    <div className="text-[11.5px] font-bold text-[#1E293B]">
                      {chip.label}
                    </div>
                    <div className="text-[10px] text-slate-500">{chip.sub}</div>
                  </div>
                  {isShaking && (
                    <XCircle className="h-4 w-4 shrink-0 text-[#DC2626]" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {rejectNotice && (
          <div className="rounded-[6px] border border-[#DC2626] bg-[#FECACA]/75 px-2.5 py-1.5 text-[11px] font-semibold text-[#991B1B]">
            {rejectNotice}
          </div>
        )}
      </div>

      {allThreeDone && (
        <motion.button
          type="button"
          onClick={onAdvanceToPhase2}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex w-full items-center justify-center gap-1.5 rounded-[6px] border-[1.5px] border-[#1E293B] bg-[#BBF7D0] px-3 py-2 font-sans text-xs font-extrabold text-[#1E293B] shadow-[3px_3px_0_#1E293B] hover:bg-[#86EFAC]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Mở khóa Quy trình & Vào Pha 2</span>
          <ArrowRight className="h-4 w-4" />
        </motion.button>
      )}
    </div>
  );
};
