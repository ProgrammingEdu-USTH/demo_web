// Bản thiết kế class (vars.bp: 1 = QuaiVat, 2 = + luật chuyển trạng thái, 3 = + Slime kế thừa), cổng triệu hồi,
// đuốc, bảng chỉ số trên đầu từng quái (vars.hp) và HUD state machine riêng cho từng quái (vars.fsm).
import type { Ctx } from "../../render/pixel";
import { box, dither, ellipse, plateBox, rect } from "../../render/pixel";
import { drawText, measure } from "../../render/text";
import type { WorldEnv } from "../types";
import { base } from "../../tokens/palette";
import { ambient } from "../../tokens/motion";
import { phaseOf } from "../../core/rng";
import { line } from "../shared";
import { BOARD, HUD, PORTAL, STATE_NAME, TORCHES } from "./layout";

const TAU = Math.PI * 2;

function blueprint(c: Ctx, bp: number, env: WorldEnv): void {
  if (bp <= 0) return;
  const { x, y, w } = BOARD;
  const card = (top: number, h: number, title: string, rows: string[]) => {
    plateBox(c, x, top, w, h, base.pale, base.ink);
    rect(c, x + 1, top + 1, w - 2, 10, base.lav);
    drawText(c, title, x + 4, top + 4, base.ink);
    rows.forEach((r, i) => drawText(c, r, x + 4, top + 15 + i * 9, base.ink2));
  };
  card(y, bp >= 2 ? 62 : 44, "class QuaiVat", ["ten, mau", "trang_thai", "cap_nhat()", ...(bp >= 2 ? ["tuần tra →(<5)", "đuổi theo →(<1)"] : [])]);
  if (bp >= 3) {
    line(c, x + w / 2, y + 62, x + w / 2, y + 72, base.paper);
    rect(c, x + w / 2 - 1, y + 63, 3, 1, base.paper);
    card(y + 72, 28, "Slime(QuaiVat)", ['"Slime", 10']);
  }
  void env;
}

function torches(c: Ctx, env: WorldEnv): void {
  TORCHES.forEach((x, i) => {
    const k = env.reduced ? 0 : Math.round((Math.sin((env.t / ambient.flicker + phaseOf(env.seed, "torch", i)) * TAU * 2) + 1));
    // quầng sáng tròn (dither theo từng hàng của một elip) rồi mới tới ngọn lửa
    const R = 15;
    for (let dy = -R; dy <= R; dy++) {
      const half = Math.round(R * Math.sqrt(1 - (dy * dy) / (R * R)));
      dither(c, x - half, 36 + dy, half * 2 + 1, 1, env.acc.a3, Math.abs(dy) < R / 2 ? 0.19 : 0.12);
    }
    ellipse(c, x, 34 - k, 2, 3 + k, env.acc.a1);
    rect(c, x, 34 - k, 1, 2, env.acc.a3);
  });
}

function portal(c: Ctx, env: WorldEnv): void {
  if (!env.vars.portal) return;
  const spin = env.reduced ? 0 : env.t / ambient.flicker;
  ellipse(c, PORTAL.x, PORTAL.y - 8, 11, 15, env.acc.a1);
  ellipse(c, PORTAL.x, PORTAL.y - 8, 8, 12, env.acc.a3);
  for (let i = 0; i < 6; i++) {
    const a = spin * TAU + (i / 6) * TAU;
    rect(c, PORTAL.x + Math.cos(a) * 6, PORTAL.y - 8 + Math.sin(a) * 9, 1, 1, base.paper);
  }
}

type Fsm = Record<string, string>;

/** vars.fsmEdge: { s1: 0 } = mũi tên thứ 0 (tuần tra → đuổi theo) của s1 vừa được đi qua, sáng lên. */
function hud(c: Ctx, fsm: Fsm, env: WorldEnv): void {
  const ids = Object.keys(fsm);
  if (!ids.length) return;
  const edge = (env.vars.fsmEdge ?? {}) as Record<string, number>;
  plateBox(c, HUD.x, HUD.y, HUD.w, 4 + ids.length * HUD.row, base.ink2, base.ink);
  ids.forEach((id, r) => {
    const y = HUD.y + 3 + r * HUD.row;
    drawText(c, id, HUD.x + 4, y + 4, base.paper);
    let x = HUD.x + 14;
    HUD.states.forEach((st, k) => {
      const name = STATE_NAME[st];
      const w = measure(name) + 4;
      const on = fsm[id] === st;
      rect(c, x, y, w, HUD.row - 3, on ? env.acc.a2 : base.shade);
      box(c, x, y, w, HUD.row - 3, base.ink);
      drawText(c, name, x + 2, y + 4, on ? base.ink : base.gray1);
      x += w;
      if (k < HUD.states.length - 1) {
        drawText(c, "→", x + 1, y + 4, edge[id] === k ? env.acc.a4 : base.gray2);
        x += 6;
      }
    });
  });
}

export function drawBack(c: Ctx, env: WorldEnv): void {
  torches(c, env);
  blueprint(c, Number(env.vars.bp ?? 0), env);
  portal(c, env);
  // thước đo khoảng cách giữa hai vật
  const ruler = env.vars.ruler as { from: string; to: string; text: string } | null;
  if (ruler) {
    const a = env.entity(ruler.from), b = env.entity(ruler.to);
    if (a && b) {
      const y = Math.max(a.y, b.y) + 6;
      rect(c, Math.min(a.x, b.x), y, Math.abs(b.x - a.x), 1, env.acc.a4);
      for (const x of [a.x, b.x]) rect(c, x, y - 2, 1, 5, env.acc.a4);
      const w = measure(ruler.text);
      drawText(c, ruler.text, Math.round((a.x + b.x) / 2 - w / 2), y + 3, env.acc.a4);
    }
  }
}

export function drawFront(c: Ctx, env: WorldEnv): void {
  const hp = (env.vars.hp ?? {}) as Record<string, number>;
  for (const [id, v] of Object.entries(hp)) {
    const e = env.entity(id);
    if (!e) continue;
    const text = `${id} · máu ${v}`;
    const w = measure(text) + 6;
    const x = e.x - Math.round(w / 2), y = e.y - 36;
    plateBox(c, x, y, w, 15, base.ink2, base.ink);
    drawText(c, text, x + 3, y + 3, base.paper);
    rect(c, x + 3, y + 11, w - 6, 2, base.err);
    rect(c, x + 3, y + 11, Math.round(((w - 6) * v) / 10), 2, env.acc.a2);
  }
  hud(c, (env.vars.fsm ?? {}) as Fsm, env);
}
