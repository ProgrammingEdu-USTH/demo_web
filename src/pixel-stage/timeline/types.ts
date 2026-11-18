// Định dạng Step Script (mục 6 của spec), cộng vài mở rộng tương thích ngược:
// - `after` dùng được cho mọi action: chỉ số (0-based) của action cùng step phải xong trước.
// - Thời lượng trong script là tên token (`dur`), không ghi số ms; `wait.ms` chỉ giữ để tương thích.
// - `say.actor`, `label.target`, `highlight.target`, `emit.at`, `timer.at` nhận id actor/vật hoặc tên anchor.
// - `color` là tên màu trong palette ("amber1") hoặc màu nhấn của thế giới ("a1"), không ghi mã hex.
import type { ColorRef } from "../tokens/palette";
import type { DurToken } from "../tokens/motion";

export type WorldId = "blank" | "kitchen" | "city" | "memory" | "dungeon" | "dj";
export const WORLD_IDS: readonly WorldId[] = ["blank", "kitchen", "city", "memory", "dungeon", "dj"];

export type StepScript = {
  id: string;
  world: WorldId;
  language: "python";
  code: string;
  actors: { id: string; sprite: string; at: string }[];
  steps: Step[];
};

export type Step = {
  line: number | number[];
  caption: string;
  actions: Action[];
  vars?: Record<string, string>;
};

type Seq = { after?: number };

export type FxKind = "steam" | "spark" | "dust" | "note";

export type Action = Seq &
  (
    | { type: "move"; actor: string; to: string; dur?: DurToken }
    | { type: "anim"; actor: string; tag: string; loop?: boolean }
    | { type: "spawn"; actor: string; sprite: string; at: string; label?: string }
    | { type: "despawn"; actor: string; fx?: "poof" | "fade" }
    | { type: "say"; actor: string; text: string; dur?: DurToken }
    | { type: "label"; target: string; text: string; place?: "above" | "below" }
    | { type: "highlight"; target: string; color?: ColorRef }
    | { type: "emit"; at: string; fx: FxKind; n?: number }
    | { type: "timer"; at: string; seconds: number }
    | { type: "set"; key: string; value: unknown }
    | { type: "camera"; to: string; zoom?: 1 | 2 }
    | { type: "wait"; dur?: DurToken; ms?: number }
    // mở rộng (DJ): phát âm tổng hợp khi bật âm thanh; không ảnh hưởng hình
    | { type: "sound"; name: SoundName }
  );

export type SoundName = "kick" | "snare" | "hat" | "ding";

export type ActionType = Action["type"];

/** Dòng code (1-based) mà step highlight. `line: [a, b]` (đúng 2 số) là khoảng a…b như bảng trong spec ("10–13"). */
export const linesOf = (s: Step): number[] => {
  if (!Array.isArray(s.line)) return [s.line];
  if (s.line.length === 2) {
    const [a, b] = s.line;
    return Array.from({ length: Math.max(0, b - a) + 1 }, (_, i) => a + i);
  }
  return s.line;
};
