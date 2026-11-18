// Lớp hoàn thiện chung: vignette dither (tĩnh, cache) + grain rất nhẹ đổi theo nhịp sprite. Tắt được.
import type { Ctx } from "./pixel";
import { dither, makeCanvas } from "./pixel";
import { base } from "../tokens/palette";
import { overlay } from "../tokens/fx";
import { spriteFps } from "../tokens/motion";
import { stageH, stageW } from "../tokens/size";
import { mulberry32 } from "../core/rng";

let vignette: HTMLCanvasElement | null = null;

function vignetteLayer(): HTMLCanvasElement {
  if (vignette) return vignette;
  const { canvas, ctx } = makeCanvas(stageW, stageH);
  const rings = overlay.vignette;
  // vòng ngoài cùng tối nhất; mỗi vòng dày 1/10 cạnh ngắn
  const step = Math.round(stageH / 10);
  for (let k = rings.length - 1; k >= 1; k--) {
    const inset = (rings.length - 1 - k) * step;
    const lvl = rings[k];
    const w = stageW - inset * 2, h = stageH - inset * 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(inset, inset, w, h);
    ctx.rect(inset + step, inset + step, w - step * 2, h - step * 2);
    ctx.clip("evenodd");
    dither(ctx, inset, inset, w, h, base.ink, lvl);
    ctx.restore();
  }
  vignette = canvas;
  return canvas;
}

export function drawOverlay(c: Ctx, t: number, seed: number): void {
  c.drawImage(vignetteLayer(), 0, 0);
  const frame = Math.floor((t * spriteFps) / 1000);
  const r = mulberry32(seed ^ frame);
  const n = Math.round(stageW * stageH * overlay.grainDensity);
  c.save();
  c.globalAlpha = overlay.grainAlpha;
  for (let i = 0; i < n; i++) {
    c.fillStyle = r() < 0.5 ? base.paper : base.ink;
    c.fillRect(Math.floor(r() * stageW), Math.floor(r() * stageH), 1, 1);
  }
  c.restore();
}
