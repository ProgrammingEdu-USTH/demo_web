import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Code2,
  Compass,
  Play,
  RotateCcw,
} from 'lucide-react';

interface LimitBreakerProps {
  hasRunWeightedBfs: boolean;
  onRunWeightedBfs: () => void;
  onOpenCodingSandbox: () => void;
}

export const LimitBreaker: React.FC<LimitBreakerProps> = ({
  hasRunWeightedBfs,
  onRunWeightedBfs,
  onOpenCodingSandbox,
}) => {
  return (
    <div className="flex flex-col justify-between gap-2.5 overflow-y-auto rounded-[8px] border-[1.5px] border-[#1E293B] bg-[#FFFDF9] p-3 shadow-[3px_3px_0_#1E293B]">
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b border-[#E5E0D5] pb-1.5">
          <span className="font-mono text-[10.5px] font-extrabold uppercase tracking-wider text-[#1E293B]">
            ĐỒ THỊ CÓ TRỌNG SỐ (KM)
          </span>
          <span className="rounded border border-[#1E293B] bg-[#FEF08A] px-1.5 py-0.5 font-mono text-[10px] font-bold">
            PHA 4
          </span>
        </div>

        {/* Route Comparison Cards */}
        <div className="space-y-1.5">
          <div
            className={`rounded-[6px] border-[1.5px] p-2 transition-all ${
              hasRunWeightedBfs
                ? 'border-[#DC2626] bg-[#FECACA]/75 shadow-[2px_2px_0_#1E293B]'
                : 'border-[#1E293B]/40 bg-[#F7F5EE]'
            }`}
          >
            <div className="flex items-center justify-between font-mono text-[11px] font-extrabold">
              <span>A ➔ C ➔ E ➔ F</span>
              <span className="text-[#DC2626]">3 bước • 50 km</span>
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-slate-600">
              25km + 22km + 3km = 50km
            </div>
          </div>

          <div
            className={`rounded-[6px] border-[1.5px] p-2 transition-all ${
              hasRunWeightedBfs
                ? 'border-[#16A34A] bg-[#BBF7D0]/75 shadow-[2px_2px_0_#1E293B]'
                : 'border-[#1E293B]/40 bg-[#F7F5EE]'
            }`}
          >
            <div className="flex items-center justify-between font-mono text-[11px] font-extrabold">
              <span>A ➔ B ➔ D ➔ E ➔ F</span>
              <span className="text-[#15803D]">4 bước • 10 km</span>
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-slate-600">
              2km + 3km + 2km + 3km = 10km
            </div>
          </div>
        </div>

        {/* Run BFS Button */}
        <button
          type="button"
          onClick={onRunWeightedBfs}
          className={`flex w-full items-center justify-center gap-1.5 rounded-[6px] border-[1.5px] border-[#1E293B] px-3 py-1.5 font-mono text-xs font-extrabold text-[#1E293B] shadow-[2px_2px_0_#1E293B] transition-all active:translate-x-[1px] active:translate-y-[1px] ${
            hasRunWeightedBfs
              ? 'bg-[#FECACA] hover:bg-[#FCA5A5]'
              : 'bg-[#BAE6FD] hover:bg-[#7DD3FC]'
          }`}
        >
          {hasRunWeightedBfs ? (
            <>
              <RotateCcw className="h-3.5 w-3.5" />
              <span>BFS chọn nhầm 50 km!</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Chạy BFS</span>
            </>
          )}
        </button>

        {/* Failure & Key Takeaway Bridge + Unlock Coding Sandbox CTA */}
        {hasRunWeightedBfs && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <div className="flex items-start gap-2 rounded-[6px] border-[1.5px] border-[#DC2626] bg-[#FECACA]/85 p-2 text-[11px] font-bold text-[#991B1B]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Ít bước hơn (3 bước), nhưng xa gấp 5 lần (50 km vs 10 km)!
              </span>
            </div>

            <div className="overflow-hidden rounded-[6px] border-[1.5px] border-[#1E293B] bg-white shadow-[2px_2px_0_#1E293B]">
              <div className="flex items-center gap-1.5 border-b border-[#1E293B] bg-[#DDD6FE] px-2.5 py-1 font-mono text-[10px] font-extrabold text-[#1E293B]">
                <Compass className="h-3.5 w-3.5" />
                <span>KEY TAKEAWAY • BÀI TIẾP THEO</span>
              </div>
              <p className="p-2 text-[11px] leading-snug text-slate-700">
                BFS chỉ tối ưu khi mọi cạnh bằng nhau. Có trọng số khác nhau ➔
                dùng <strong className="text-[#5B21B6]">Priority Queue</strong>{' '}
                (<strong>Dijkstra</strong>).
              </p>
            </div>

            <motion.button
              type="button"
              onClick={onOpenCodingSandbox}
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex w-full items-center justify-center gap-1.5 rounded-[6px] border-[1.5px] border-[#1E293B] bg-[#BBF7D0] px-2.5 py-2 font-sans text-xs font-extrabold text-[#1E293B] shadow-[3px_3px_0_#1E293B] hover:bg-[#86EFAC]"
            >
              <Code2 className="h-4 w-4 shrink-0" />
              <span>Mở Sandbox Tự Code Bài Toán Con</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
};
