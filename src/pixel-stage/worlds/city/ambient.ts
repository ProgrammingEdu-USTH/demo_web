// Đường đã duyệt sáng xanh (a2), con đường kết quả sáng vàng (a1); đèn nhà khách nhấp nháy.
import type { Ctx } from "../../render/pixel";
import { rect } from "../../render/pixel";
import type { WorldEnv } from "../types";
import { base } from "../../tokens/palette";
import { ambient } from "../../tokens/motion";
import { EDGES, NODES, edgeKey, road } from "./layout";

const list = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

export function drawBack(c: Ctx, env: WorldEnv): void {
  const lit = new Set(list(env.vars.lit));
  const path = new Set(list(env.vars.path));
  for (const [a, b] of EDGES) {
    const k = edgeKey(a, b);
    if (path.has(k)) road(c, NODES[a].x, NODES[a].y, NODES[b].x, NODES[b].y, 4, env.acc.a1);
    else if (lit.has(k)) road(c, NODES[a].x, NODES[a].y, NODES[b].x, NODES[b].y, 2, env.acc.a2);
  }
  const on = env.reduced || Math.floor(env.t / (ambient.flicker / 2)) % 2 === 0;
  rect(c, 309, 70, 4, 4, on ? env.acc.a1 : base.ink2);
}
