// Định nghĩa một "thế giới": cảnh nền, anchor có tên, sprite, ambient.
import type { Ctx } from "../render/pixel";
import type { AccentSet } from "../tokens/palette";
import type { Rect, SpriteSheet } from "../assets/sheet";
import type { WorldId } from "../timeline/types";

/** Điểm neo: (x, y) là chỗ đứng (chân nhân vật) hoặc tâm đạo cụ; `box` là vùng của vật để gắn nhãn / highlight. */
export type Anchor = { x: number; y: number; box?: Rect };

export type WorldEnv = {
  /** thời gian ambient (ms), đã nhân tốc độ; đứng yên khi giảm chuyển động */
  t: number;
  vars: Record<string, unknown>;
  reduced: boolean;
  acc: AccentSet;
  seed: number;
  /** vị trí hiện tại (đã làm tròn) của actor / vật đang có, để vẽ dây, thanh máu, HUD gắn theo vật */
  entity: (id: string) => { x: number; y: number; alpha: number } | null;
};

export type WorldDef = {
  id: WorldId;
  /** tên hiển thị */
  title: string;
  /** mô tả cho aria-label của canvas */
  aria: string;
  accents: AccentSet;
  anchors: Record<string, Anchor>;
  /** giá trị ban đầu cho action `set` */
  vars: Record<string, unknown>;
  sprites: Record<string, () => SpriteSheet>;
  /** lớp tĩnh (vẽ một lần rồi cache) */
  drawStatic: (c: Ctx, acc: AccentSet) => void;
  /** phần đổi theo state / ambient, dưới nhân vật */
  drawBack?: (c: Ctx, env: WorldEnv) => void;
  /** phần đè lên nhân vật (mép bàn, khói…) */
  drawFront?: (c: Ctx, env: WorldEnv) => void;
  /** 0 = sáng, 1 = tối hẳn */
  darkness?: (env: WorldEnv) => number;
};
