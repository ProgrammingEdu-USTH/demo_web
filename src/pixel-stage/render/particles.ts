// Hạt của action emit (và bụi khi despawn "poof"). Vị trí là hàm của (seed, tuổi) nên luôn tái lập được.
import type { Burst } from "../timeline/state";
import type { Ctx } from "./pixel";
import { rect } from "./pixel";
import type { AccentSet } from "../tokens/palette";
import { base } from "../tokens/palette";
import { emitCount } from "../tokens/fx";
import { mulberry32 } from "../core/rng";

const NOTE = [".##", ".#.", "##."];

export function drawBurst(c: Ctx, b: Burst, acc: AccentSet): void {
  const r = mulberry32(b.seed);
  const n = b.n > 0 ? b.n : emitCount;
  const t = b.life > 0 ? b.age / b.life : 1;
  if (t >= 1) return;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.8;
    const sp = 0.6 + r() * 0.6;
    const ph = r();
    const life = 0.7 + r() * 0.3; // mỗi hạt tắt ở thời điểm riêng
    if (t > life) continue;
    switch (b.fx) {
      case "spark": {
        const d = t * 16 * sp;
        rect(c, b.x + Math.cos(a) * d, b.y + Math.sin(a) * d * 0.8, 1, 1, i % 2 ? acc.a3 : base.amber1);
        break;
      }
      case "dust": {
        const d = t * 9 * sp;
        const s = t < 0.5 ? 2 : 1;
        rect(c, b.x + Math.cos(a) * d, b.y - 2 - Math.abs(Math.sin(a)) * d * 0.6, s, s, i % 2 ? base.gray1 : base.gray2);
        break;
      }
      case "steam": {
        const x = b.x + (ph - 0.5) * 8 + Math.sin((t + ph) * Math.PI * 2) * 2;
        const y = b.y - 2 - t * 18 * sp;
        const s = t < 0.4 ? 2 : 1;
        rect(c, x, y, s, s, t < 0.5 ? base.pale : base.gray1);
        break;
      }
      case "note": {
        c.fillStyle = i % 2 ? acc.a1 : acc.a3;
        const x = Math.round(b.x + (ph - 0.5) * 14 + Math.sin((t + ph) * Math.PI * 2) * 3);
        const y = Math.round(b.y - 4 - t * 20 * sp);
        NOTE.forEach((row, j) => { for (let k = 0; k < row.length; k++) if (row[k] === "#") c.fillRect(x + k, y + j, 1, 1); });
        break;
      }
    }
  }
}
