import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, Play, Swords, Zap } from 'lucide-react';

export type ArenaChoice = 'A' | 'B';

interface ToolArenaSelectorProps {
  stepId: number;
  choice: ArenaChoice;
  hasRun: boolean;
  isWinnerLocked: boolean;
  onSelectChoice: (choice: ArenaChoice) => void;
  onRunArena: () => void;
  onLockSetWinner?: () => void;
}

export const ToolArenaSelector: React.FC<ToolArenaSelectorProps> = ({
  stepId,
  choice,
  hasRun,
  isWinnerLocked,
  onSelectChoice,
  onRunArena,
  onLockSetWinner,
}) => {
  const config = (() => {
    if (stepId === 3) {
      return {
        title: 'ĐẤU TRƯỜNG 1: CHỌN CẤU TRÚC DUYỆT ĐỈNH',
        accentBg: 'bg-[#BAE6FD]',
        optionA: {
          label: 'A: Stack (LIFO)',
          sub: 'Lấy đỉnh mới thêm nhất',
        },
        optionB: {
          label: 'B: Queue (FIFO)',
          sub: 'Lấy đỉnh vào sớm nhất',
        },
        failBanner:
          'WATCH OUT: Qua B ➔ D, đỉnh D rẽ 2 hướng: D ➔ A (lặp về A) và D ➔ E ➔ F (4 bước) — bỏ quên C!',
        winBanner:
          'Winner ✓ Queue loang đều theo lớp, tìm ra A ➔ C ➔ E ➔ F chỉ với 3 bước!',
      };
    }

    if (stepId === 4) {
      return {
        title: 'ĐẤU TRƯỜNG 2: CHỌN CẤU TRÚC CHO VISITED',
        accentBg: 'bg-[#DDD6FE]',
        optionA: {
          label: 'A: List (v in list)',
          sub: 'Dò tuần tự O(n)',
        },
        optionB: {
          label: 'B: Set (v in set)',
          sub: 'Bảng băm O(1)',
        },
        failBanner:
          'Trên 6 đỉnh thì List vẫn chạy được — nhưng hãy xem bài test 100,000 đỉnh bên dưới!',
        winBanner:
          'Set kiểm tra tức thì O(1) ngay cả với 100,000 đỉnh! Hãy bấm "Chốt dùng Set" bên dưới.',
      };
    }

    return {
      title: 'ĐẤU TRƯỜNG 3: CÁCH LƯU DẤU VẾT ĐƯỜNG ĐI',
      accentBg: 'bg-[#BBF7D0]',
      optionA: {
        label: 'A: 1 biến prev',
        sub: 'Chỉ nhớ 1 đỉnh trước đó',
      },
      optionB: {
        label: 'B: Dict parent',
        sub: 'Lưu cặp {con: cha}',
      },
      failBanner:
        'WATCH OUT: Khi rẽ nhánh B và C, 1 biến prev bị ghi đè mất dấu vết — lần ngược từ F bị đứt đoạn (?)!',
      winBanner:
        'Winner ✓ Dict parent giữ trọn mọi nhánh {B:A, C:A, E:C, F:E}, truy vết F ➔ E ➔ C ➔ A hoàn hảo!',
    };
  })();

  const isFailedAttempt = hasRun && choice === 'A';
  const isWinningAttempt = hasRun && choice === 'B';

  return (
    <div className="shrink-0 rounded-[8px] border-[1.5px] border-[#1E293B] bg-[#FFFDF9] p-2.5 shadow-[3px_3px_0_#1E293B]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded border-[1.5px] border-[#1E293B] ${config.accentBg}`}
          >
            <Swords className="h-3.5 w-3.5 text-[#1E293B]" />
          </span>
          <span className="font-mono text-[11px] font-extrabold uppercase tracking-wider text-[#1E293B]">
            {config.title}
          </span>
          {isWinnerLocked && (
            <span className="rounded border border-[#16A34A] bg-[#BBF7D0] px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-[#15803D]">
              Đã chốt ✓
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectChoice('A')}
            className={`rounded-[6px] border-[1.5px] px-2.5 py-1 text-left font-mono text-[11px] font-bold transition-all ${
              choice === 'A'
                ? 'border-[#1E293B] bg-[#FECACA] text-[#1E293B] shadow-[2px_2px_0_#1E293B]'
                : 'border-[#1E293B]/40 bg-white text-slate-600 hover:border-[#1E293B]'
            }`}
          >
            <span>{config.optionA.label}</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectChoice('B')}
            className={`rounded-[6px] border-[1.5px] px-2.5 py-1 text-left font-mono text-[11px] font-bold transition-all ${
              choice === 'B'
                ? `border-[#1E293B] ${config.accentBg} text-[#1E293B] shadow-[2px_2px_0_#1E293B]`
                : 'border-[#1E293B]/40 bg-white text-slate-600 hover:border-[#1E293B]'
            }`}
          >
            <span>{config.optionB.label}</span>
          </button>

          <button
            type="button"
            onClick={onRunArena}
            className="flex items-center gap-1 rounded-[6px] border-[1.5px] border-[#1E293B] bg-[#FEF08A] px-3 py-1 font-mono text-[11px] font-extrabold text-[#1E293B] shadow-[2px_2px_0_#1E293B] hover:bg-[#FDE047] active:translate-x-[1px] active:translate-y-[1px]"
          >
            <Play className="h-3 w-3 fill-current" />
            <span>Chạy thử</span>
          </button>
        </div>
      </div>

      {/* Verdict Banner */}
      {isFailedAttempt && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 flex items-center gap-2 rounded-[6px] border-[1.5px] border-[#DC2626] bg-[#FECACA]/85 px-2.5 py-1.5 text-[11.5px] font-bold text-[#991B1B]"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{config.failBanner}</span>
        </motion.div>
      )}

      {isWinningAttempt && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-[6px] border-[1.5px] border-[#16A34A] bg-[#BBF7D0]/85 px-2.5 py-1.5 text-[11.5px] font-bold text-[#14532D]"
        >
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 stroke-[3]" />
            <span>{config.winBanner}</span>
          </div>
          {stepId === 4 && !isWinnerLocked && onLockSetWinner && (
            <button
              type="button"
              onClick={onLockSetWinner}
              className="rounded border-[1.5px] border-[#1E293B] bg-white px-2 py-0.5 font-mono text-[10.5px] font-extrabold text-[#15803D] shadow-[1.5px_1.5px_0_#1E293B] hover:bg-[#DDD6FE]"
            >
              ✓ Chốt dùng Set
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
};

interface ToolArenaBottomWidgetProps {
  stepId: number;
  choice: ArenaChoice;
  hasRun: boolean;
  setLocked: boolean;
  step5Beat: number;
  onSelectStep5Beat: (beat: number) => void;
  onLockSetWinner: () => void;
}

export const ToolArenaBottomWidget: React.FC<ToolArenaBottomWidgetProps> = ({
  stepId,
  choice,
  hasRun,
  setLocked,
  step5Beat,
  onSelectStep5Beat,
  onLockSetWinner,
}) => {
  // Step 4: Scale Stress-Test Widget (100,000 nodes)
  if (stepId === 4) {
    return (
      <div className="shrink-0 rounded-[8px] border-[1.5px] border-[#7C3AED] bg-[#FFFDF9] p-3 shadow-[3px_3px_0_#1E293B]">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-[#7C3AED]" />
            <span className="font-mono text-[11px] font-extrabold uppercase tracking-wider text-[#1E293B]">
              THỬ TẢI THỰC TẾ: ĐỒ THỊ 100,000 ĐỈNH
            </span>
          </div>

          {hasRun && (
            <button
              type="button"
              onClick={onLockSetWinner}
              className={`flex items-center gap-1.5 rounded-[6px] border-[1.5px] border-[#1E293B] px-3 py-1 font-mono text-[11px] font-extrabold shadow-[2px_2px_0_#1E293B] transition-all ${
                setLocked
                  ? 'bg-[#BBF7D0] text-[#14532D]'
                  : 'animate-pulse bg-[#DDD6FE] text-[#1E293B] hover:bg-[#C4B5FD]'
              }`}
            >
              <Check className="h-3.5 w-3.5 stroke-[3]" />
              <span>{setLocked ? 'Đã chốt dùng Set ✓' : 'Chốt dùng Set'}</span>
            </button>
          )}
        </div>

        {!hasRun ? (
          <div className="rounded-[6px] border border-dashed border-slate-400 bg-[#F7F5EE] px-3 py-2 text-center font-mono text-[11px] font-semibold text-slate-600">
            Chọn List hoặc Set phía trên rồi bấm <strong>▶ Chạy thử</strong> để
            đo tốc độ trên 100,000 đỉnh!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {/* List O(n) Bar */}
            <div
              className={`rounded-[6px] border-[1.5px] border-[#DC2626] p-2 transition-all ${
                choice === 'A'
                  ? 'bg-[#FECACA]/55 ring-2 ring-[#DC2626]'
                  : 'bg-[#FECACA]/25 opacity-65'
              }`}
            >
              <div className="mb-1 flex items-center justify-between font-mono text-[10.5px] font-bold text-[#991B1B]">
                <span>
                  List — Quét tuần tự O(n)
                  {choice === 'A' ? ' • ĐANG CHẠY' : ''}
                </span>
                <span>~4.2 ms / lần</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full border border-[#1E293B] bg-white">
                <motion.div
                  key={`list-crawl-${hasRun}-${choice}`}
                  initial={{ width: '4%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2.8, ease: 'linear' }}
                  className="h-full bg-[#DC2626]"
                />
              </div>
              <div className="mt-1 font-mono text-[9.5px] font-semibold text-slate-600">
                Dò tuần tự B ➔ C ➔ D ➔ E ➔ A (100,000 ô)...
              </div>
            </div>

            {/* Set O(1) Bar */}
            <div
              className={`rounded-[6px] border-[1.5px] border-[#16A34A] p-2 transition-all ${
                choice === 'B'
                  ? 'bg-[#BBF7D0]/65 ring-2 ring-[#16A34A]'
                  : 'bg-[#BBF7D0]/25 opacity-65'
              }`}
            >
              <div className="mb-1 flex items-center justify-between font-mono text-[10.5px] font-bold text-[#15803D]">
                <span>
                  Set — Bảng băm O(1)
                  {choice === 'B' ? ' • ĐANG CHẠY' : ''}
                </span>
                <span>~0.0001 ms</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full border border-[#1E293B] bg-white">
                <motion.div
                  key={`set-jump-${hasRun}-${choice}`}
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  className="h-full bg-[#16A34A]"
                />
              </div>
              <div className="mt-1 font-mono text-[9.5px] font-semibold text-[#15803D]">
                hash('A') ➔ Nhảy thẳng tới ô nhớ tức thì!
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Step 3: Stack vs Queue Live Trace Strip
  if (stepId === 3) {
    return (
      <div className="shrink-0 rounded-[8px] border-[1.5px] border-[#0284C7] bg-[#BAE6FD]/45 p-2.5 shadow-[3px_3px_0_#1E293B]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-extrabold text-[#1E293B]">
            {choice === 'A'
              ? 'Stack (LIFO): Qua B ➔ D, tại D rẽ 2 hướng: D ➔ A (lặp về A) & D ➔ E ➔ F (4 bước)'
              : 'Queue (FIFO): Đẩy [B, C] → Xét hết lớp 1 (B, C) → Chạm F trong 3 bước'}
          </span>
          <span className="rounded border border-[#1E293B] bg-white px-2 py-0.5 font-mono text-[10.5px] font-bold">
            {!hasRun
              ? 'Chờ chạy thử'
              : choice === 'A'
                ? 'Kết quả: 4 bước (Chậm)'
                : 'Kết quả: 3 bước (Tối ưu ✓)'}
          </span>
        </div>
      </div>
    );
  }

  // Step 5: 1 biến prev vs Dict parent 5-beat Live Execution Strip
  const prevBeats = [
    { idx: 0, label: "1. A➔B,C: prev='A'", val: "'A'" },
    { idx: 1, label: "2. B➔D: prev='B' (đè 'A')", val: "'B'" },
    { idx: 2, label: "3. C➔E: prev='C' (đè 'B')", val: "'C'" },
    { idx: 3, label: "4. E➔F: prev='E' (đè 'C')", val: "'E'" },
    { idx: 4, label: '5. Truy vết: Kẹt ở E!', val: "'E'" },
  ];

  const dictBeats = [
    { idx: 0, label: '1. {B:A, C:A}' },
    { idx: 1, label: '2. +D:B' },
    { idx: 2, label: '3. +E:C' },
    { idx: 3, label: '4. +F:E' },
    { idx: 4, label: '5. F➔E➔C➔A ✓' },
  ];

  return (
    <div className="shrink-0 rounded-[8px] border-[1.5px] border-[#16A34A] bg-[#BBF7D0]/45 p-2.5 shadow-[3px_3px_0_#1E293B]">
      {!hasRun ? (
        <div className="text-center font-mono text-[11px] font-semibold text-slate-700">
          Chọn <strong>A: 1 biến prev</strong> hoặc{' '}
          <strong>B: Dict parent</strong> rồi bấm{' '}
          <strong>▶ Chạy thử</strong> để xem biến thay đổi qua từng bước!
        </div>
      ) : choice === 'A' ? (
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10.5px]">
          <div className="flex flex-wrap items-center gap-1.5">
            {prevBeats.map((b) => {
              const isCurrent = step5Beat === b.idx;
              const isOverwritten = b.idx < step5Beat && b.idx < 4;
              return (
                <button
                  key={b.idx}
                  type="button"
                  onClick={() => onSelectStep5Beat(b.idx)}
                  className={`rounded border-[1.5px] px-1.5 py-0.5 font-bold transition-all ${
                    isCurrent
                      ? 'border-[#DC2626] bg-[#FECACA] text-[#991B1B] shadow-[1.5px_1.5px_0_#1E293B]'
                      : isOverwritten
                        ? 'border-[#DC2626]/40 bg-white/75 text-slate-400 line-through'
                        : 'border-[#1E293B]/30 bg-white text-slate-600 hover:border-[#1E293B]'
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
          <span className="font-extrabold text-[#DC2626]">
            {step5Beat === 4
              ? 'Tắc nghẽn tại E!'
              : `prev = ${prevBeats[step5Beat]?.val ?? "'A'"}`}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10.5px]">
          <div className="flex flex-wrap items-center gap-1.5">
            {dictBeats.map((b) => {
              const isCurrent = step5Beat === b.idx;
              const isDone = b.idx <= step5Beat;
              return (
                <button
                  key={b.idx}
                  type="button"
                  onClick={() => onSelectStep5Beat(b.idx)}
                  className={`rounded border-[1.5px] px-1.5 py-0.5 font-bold transition-all ${
                    isCurrent
                      ? 'border-[#16A34A] bg-[#BBF7D0] text-[#14532D] shadow-[1.5px_1.5px_0_#1E293B]'
                      : isDone
                        ? 'border-[#16A34A]/60 bg-white text-[#15803D]'
                        : 'border-[#1E293B]/30 bg-white text-slate-500'
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
          <span className="font-extrabold text-[#15803D]">
            {step5Beat === 4 ? 'Truy vết: F ➔ E ➔ C ➔ A ✓' : 'Đang lưu Dict...'}
          </span>
        </div>
      )}
    </div>
  );
};
