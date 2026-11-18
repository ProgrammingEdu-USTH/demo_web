// Ambient phòng trống: vài hạt bụi trôi chậm, tấm biển sáng lên khi `glow` bật.
import type { Ctx } from "../../render/pixel";
import { dither, rect } from "../../render/pixel";
import type { WorldEnv } from "../types";
import { base } from "../../tokens/palette";
import { ambient } from "../../tokens/motion";
import { stageW } from "../../tokens/size";
import { rngFor } from "../../core/rng";
import { anchors, FLOOR } from "./layout";

export function drawBack(c: Ctx, env: WorldEnv): void {
  if (env.vars.glow) {
    // quầng sáng quanh viền biển, không phủ lên chữ
    const s = anchors.sign.box!;
    const g = 4;
    dither(c, s.x - g, s.y - g, s.w + g * 2, g, env.acc.a3, 0.5);
    dither(c, s.x - g, s.y + s.h, s.w + g * 2, g, env.acc.a3, 0.5);
    dither(c, s.x - g, s.y, g, s.h, env.acc.a3, 0.5);
    dither(c, s.x + s.w, s.y, g, s.h, env.acc.a3, 0.5);
  }
  if (env.reduced) return;
  const r = rngFor(env.seed, "dust");
  for (let i = 0; i < 10; i++) {
    const x0 = r() * stageW, y0 = 16 + r() * (FLOOR - 24), ph = r();
    const k = (env.t / ambient.dust + ph) % 1;
    rect(c, (x0 + k * 40) % stageW, y0 + Math.sin((k + ph) * Math.PI * 2) * 3, 1, 1, base.pale);
  }
}
