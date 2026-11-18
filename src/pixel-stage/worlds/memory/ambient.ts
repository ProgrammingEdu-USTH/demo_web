// Nhãn tên biến buộc dây vào hộp (object); số trên hộp = số dây đang buộc vào (reference count).
// vars.tags: [{ name, to: id hộp | null, slot }]; vars.links: [[từ hộp, tới hộp]]; vars.boxes: các hộp cần hiện số.
import type { Ctx } from "../../render/pixel";
import { ellipse, plateBox, rect } from "../../render/pixel";
import { drawText, measure } from "../../render/text";
import type { WorldEnv } from "../types";
import { base } from "../../tokens/palette";
import { ambient } from "../../tokens/motion";
import { line } from "../shared";
import { BOARD } from "./layout";

type Tag = { name: string; to: string | null; slot: number };
const tagsOf = (v: unknown): Tag[] => (Array.isArray(v) ? (v as Tag[]) : []);
const linksOf = (v: unknown): [string, string][] => (Array.isArray(v) ? (v as [string, string][]) : []);
const idsOf = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

/** Số dây buộc vào hộp `id`: từ nhãn tên và từ hộp khác. */
export const refCount = (vars: Record<string, unknown>, id: string): number =>
  tagsOf(vars.tags).filter((t) => t.to === id).length + linksOf(vars.links).filter(([, to]) => to === id).length;

export function drawBack(c: Ctx, env: WorldEnv): void {
  // dây từ nhãn tới hộp
  for (const t of tagsOf(env.vars.tags)) {
    const x = BOARD.slots[t.slot];
    const e = t.to ? env.entity(t.to) : null;
    if (e) line(c, x, BOARD.tagY + 12, e.x, e.y - 7, base.pale);
    else rect(c, x, BOARD.tagY + 12, 1, 8, base.pale); // dây đứt (None)
  }
  // dây giữa các hộp: A→B ở mép trên, B→A ở mép dưới để không chồng nhau
  for (const [from, to] of linksOf(env.vars.links)) {
    const a = env.entity(from), b = env.entity(to);
    if (!a || !b) continue;
    const dy = a.x < b.x ? -4 : 4;
    line(c, a.x + Math.sign(b.x - a.x) * 7, a.y + dy, b.x - Math.sign(b.x - a.x) * 9, b.y + dy, env.acc.a1);
    const hx = b.x - Math.sign(b.x - a.x) * 9;
    rect(c, hx, b.y + dy - 1, 1, 3, env.acc.a1);
  }
}

export function drawFront(c: Ctx, env: WorldEnv): void {
  for (const t of tagsOf(env.vars.tags)) {
    const x = BOARD.slots[t.slot];
    const label = t.to ? t.name : `${t.name}=None`;
    const w = measure(label) + 6;
    rect(c, x, BOARD.tagY - 6, 1, 6, base.ink);
    plateBox(c, x - Math.round(w / 2), BOARD.tagY, w, 12, base.paper, base.ink);
    drawText(c, label, x - Math.round(w / 2) + 3, BOARD.tagY + 4, base.ink);
  }
  for (const id of idsOf(env.vars.boxes)) {
    const e = env.entity(id);
    if (!e || e.alpha <= 0) continue;
    const n = refCount(env.vars, id);
    const x = e.x + 7, y = e.y - 11;
    ellipse(c, x, y, 4, 4, base.ink);
    ellipse(c, x, y, 3, 3, n > 0 ? env.acc.a1 : base.err);
    drawText(c, String(n), x - 1, y - 2, base.ink);
  }
  // robot đang sạc: đèn sạc nhấp nháy
  if (env.vars.charging) {
    const on = env.reduced || Math.floor(env.t / (ambient.flicker / 4)) % 2 === 0;
    rect(c, 268, 150, 3, 3, on ? env.acc.a4 : base.ink2);
  }
}
