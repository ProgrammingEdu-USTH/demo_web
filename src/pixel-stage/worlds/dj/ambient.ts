// Ô sequencer theo vars.cells (kick / snare / hat), ô đã phát (vars.played), nhánh đang sáng (vars.branch),
// loa nhún theo BPM, đèn quét; bàn DJ đè lên chân Bit.
import type { Ctx } from "../../render/pixel";
import { box, dither, ellipse, rect } from "../../render/pixel";
import { drawText, measure } from "../../render/text";
import type { WorldEnv } from "../types";
import { base } from "../../tokens/palette";
import { beatMs } from "../../tokens/motion";
import { CELLS, DEVICES, SPLIT, cellX, drawDeck } from "./layout";

const kindColor = (k: string, env: WorldEnv) => (k === "kick" ? env.acc.a1 : k === "snare" ? env.acc.a2 : env.acc.a3);

export function drawBack(c: Ctx, env: WorldEnv): void {
  const beat = env.reduced ? 0 : (env.t % beatMs) / beatMs;
  // đèn quét
  if (!env.reduced) {
    for (let k = 0; k < 2; k++) {
      const x = Math.round(160 + Math.sin(env.t / (beatMs * 4) + k * Math.PI) * 120);
      dither(c, x - 10, 0, 20, 132, k ? env.acc.a2 : env.acc.a1, 0.12);
    }
  }
  const cells = (env.vars.cells ?? []) as string[];
  const played = new Set((env.vars.played ?? []) as number[]);
  for (let i = 0; i < CELLS.n; i++) {
    const x = cellX(i), k = cells[i];
    rect(c, x, CELLS.y, CELLS.w, CELLS.h, k ? (played.has(i) ? kindColor(k, env) : base.shade) : base.ink2);
    box(c, x, CELLS.y, CELLS.w, CELLS.h, base.ink);
    if (k) {
      const w = measure(k);
      drawText(c, k, x + Math.round((CELLS.w - w) / 2), CELLS.y + 7, played.has(i) ? base.ink : kindColor(k, env));
    }
    drawText(c, String(i), x + 1, CELLS.y - 7, base.gray2);
  }
  // nhánh đang chọn
  const br = env.vars.branch as keyof typeof DEVICES | null;
  if (br && DEVICES[br]) {
    const d = DEVICES[br];
    const col = kindColor(br, env);
    const mx = SPLIT.x + SPLIT.w / 2;
    rect(c, mx, SPLIT.y + SPLIT.h, 1, 6, col);
    rect(c, Math.min(d.x, mx), SPLIT.y + SPLIT.h + 6, Math.abs(d.x - mx) + 1, 1, col);
    rect(c, d.x, SPLIT.y + SPLIT.h + 6, 1, d.y - 18 - (SPLIT.y + SPLIT.h + 6), col);
    box(c, SPLIT.x - 1, SPLIT.y - 1, SPLIT.w + 2, SPLIT.h + 2, col);
  }
  // loa nhún theo nhịp
  const k = DEVICES.kick;
  const pump = beat < 0.15 ? 1 : 0;
  ellipse(c, k.x, k.y + 6, 6 + pump, 6 + pump, base.gray2);
  ellipse(c, k.x, k.y + 6, 2, 2, base.ink2);
}

export function drawFront(c: Ctx, env: WorldEnv): void {
  drawDeck(c, !!env.vars.stop, env.acc);
}
