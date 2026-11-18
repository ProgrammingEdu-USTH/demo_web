// Ambient của bếp: kim đồng hồ, đèn ấm chập chờn, lò có món thì kính hắt lửa và khói bay; khay ra món khi `tray` bật.
import type { Ctx } from "../../render/pixel";
import { box, dither, ellipse, plateBox, rect } from "../../render/pixel";
import { drawText, measure } from "../../render/text";
import type { WorldEnv } from "../types";
import { base } from "../../tokens/palette";
import { ambient } from "../../tokens/motion";
import { phaseOf } from "../../core/rng";
import { line } from "../shared";
import { BARS, CLOCK, HOOK, LAMP, OVENS, TRAY } from "./layout";

const TAU = Math.PI * 2;

function clockHands(c: Ctx, env: WorldEnv): void {
  const m = (env.t / ambient.clock + phaseOf(env.seed, "clock")) * TAU;
  const h = (5 + env.t / (ambient.clock * 12)) / 12 * TAU; // chiều muộn
  line(c, CLOCK.x, CLOCK.y, CLOCK.x + Math.sin(h) * 4, CLOCK.y - Math.cos(h) * 4, base.ink);
  line(c, CLOCK.x, CLOCK.y, CLOCK.x + Math.sin(m) * 6, CLOCK.y - Math.cos(m) * 6, base.ink2);
}

function lamp(c: Ctx, env: WorldEnv): void {
  const on = env.vars.light === "on";
  rect(c, LAMP.x - 2, LAMP.y + 6, 5, 2, on ? env.acc.a3 : base.gray2);
  if (!on) return;
  const flick = env.reduced ? 0 : Math.sin((env.t / ambient.flicker + phaseOf(env.seed, "lamp")) * TAU) > 0.92 ? 1 : 0;
  const lvl = flick ? 0.12 : 0.19;
  for (let y = LAMP.y + 8; y < 100; y += 4) {
    const half = 4 + Math.round((y - LAMP.y) * 0.45);
    dither(c, LAMP.x - half, y, half * 2 + 1, 4, env.acc.a3, lvl);
  }
}

function ovenGlow(c: Ctx, env: WorldEnv): void {
  OVENS.forEach((x0, k) => {
    const on = env.vars[`oven${k + 1}`] === "on";
    rect(c, x0 + 15, 70, 2, 2, on ? env.acc.a1 : base.ink);
    if (!on) return;
    const ph = phaseOf(env.seed, "oven", k);
    const flick = env.reduced ? 0 : Math.round((Math.sin((env.t / ambient.flicker + ph) * TAU * 3) + 1) * 1.5);
    dither(c, x0 + 7, 86, 18, 20, env.acc.a1, 0.38 + flick * 0.06);
    rect(c, x0 + 7, 102, 18, 4, env.acc.a2);
    dither(c, x0 + 7, 101, 18, 1, env.acc.a1, 0.5);
  });
}

function steam(c: Ctx, env: WorldEnv): void {
  if (env.reduced) return;
  OVENS.forEach((x0, k) => {
    if (env.vars[`oven${k + 1}`] !== "on") return;
    for (let i = 0; i < 5; i++) {
      const ph = phaseOf(env.seed, "steam", k, i);
      const u = (env.t / ambient.steam + ph) % 1;
      const x = x0 + 16 + Math.sin((u + ph) * TAU) * 2 + (ph - 0.5) * 4;
      const y = 55 - u * 22;
      const s = u < 0.45 ? 2 : 1;
      rect(c, x, y, s, s, u < 0.6 ? base.pale : base.gray1);
    }
  });
}

function tray(c: Ctx): void {
  rect(c, TRAY.x, TRAY.y, TRAY.w, 4, base.gray1);
  rect(c, TRAY.x, TRAY.y + 3, TRAY.w, 1, base.gray2);
  box(c, TRAY.x - 1, TRAY.y - 1, TRAY.w + 2, 6, base.ink);
  TRAY.slots.forEach((sx, i) => {
    ellipse(c, sx, TRAY.y + 1, 6, 1, base.paper);
    const t = String(i + 1);
    const w = measure(t) + 6;
    plateBox(c, sx - Math.floor(w / 2), 107, w, 11, base.paper, base.ink);
    drawText(c, t, sx - Math.floor(w / 2) + 3, 110, base.ink);
  });
}

const LOCK_OPEN = [".###.", "#...#", "#....", "#####", "##.##", "#####"];
const LOCK_SHUT = [".###.", "#...#", "#...#", "#####", "##.##", "#####"];

/** Móc treo chảo + ổ khóa: mở (xanh) khi rảnh, đóng (đỏ) khi có người giữ. */
function hook(c: Ctx, env: WorldEnv): void {
  rect(c, HOOK.x - 6, HOOK.y, 13, 2, base.gray2);
  box(c, HOOK.x - 7, HOOK.y - 1, 15, 4, base.ink);
  rect(c, HOOK.x, HOOK.y + 3, 1, 2, base.ink);
  const held = env.vars.lock !== "free";
  c.fillStyle = held ? base.err : base.ok;
  (held ? LOCK_SHUT : LOCK_OPEN).forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r[i] === "#") c.fillRect(HOOK.x + 10 + i, HOOK.y - 1 + j, 1, 1);
  });
}

/** Hai thanh thời gian: chạy tuần tự vs gather (mỗi giây = BARS.unit px). */
function bars(c: Ctx, v: { seq?: number; par?: number }, env: WorldEnv): void {
  const rows: [string, number | undefined, string][] = [["tuần tự", v.seq, env.acc.a2], ["gather", v.par, base.ok]];
  const h = 30;
  plateBox(c, BARS.x, BARS.y, BARS.w, h, base.ink2, base.ink);
  rows.forEach(([name, sec, col], k) => {
    const y = BARS.y + 6 + k * 12;
    drawText(c, name, BARS.x + 4, y, base.pale);
    if (sec === undefined) return;
    const x0 = BARS.x + 34;
    for (let s = 0; s < sec; s++) {
      rect(c, x0 + s * BARS.unit, y, BARS.unit - 1, 5, col);
    }
    drawText(c, `${sec}s`, x0 + sec * BARS.unit + 2, y, base.paper);
  });
}

export function drawBack(c: Ctx, env: WorldEnv): void {
  clockHands(c, env);
  lamp(c, env);
  ovenGlow(c, env);
  if (env.vars.tray) tray(c);
  if (env.vars.hook) hook(c, env);
  if (env.vars.bars) bars(c, env.vars.bars as { seq?: number; par?: number }, env);
}

export function drawFront(c: Ctx, env: WorldEnv): void {
  steam(c, env);
}

export const darkness = (env: WorldEnv): number => (env.vars.light === "on" ? 0 : 1);
