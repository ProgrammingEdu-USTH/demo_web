// Hàm vẽ pixel cơ bản. Mọi toạ độ được làm tròn về pixel nguyên; không có khử răng cưa.
export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ Canvas 2D");
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

export function rect(c: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Viền 1px bên trong khung. */
export function box(c: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  rect(c, x, y, w, 1, color);
  rect(c, x, y + h - 1, w, 1, color);
  rect(c, x, y + 1, 1, h - 2, color);
  rect(c, x + w - 1, y + 1, 1, h - 2, color);
}

/** Khung bo góc 1px: nền + viền, cắt 4 góc. */
export function plateBox(c: Ctx, x: number, y: number, w: number, h: number, fill: string, line: string): void {
  rect(c, x + 1, y + 1, w - 2, h - 2, fill);
  rect(c, x + 1, y, w - 2, 1, line);
  rect(c, x + 1, y + h - 1, w - 2, 1, line);
  rect(c, x, y + 1, 1, h - 2, line);
  rect(c, x + w - 1, y + 1, 1, h - 2, line);
}

/** Elip đặc theo hàng (pixel-perfect). */
export function ellipse(c: Ctx, cx: number, cy: number, rx: number, ry: number, color: string): void {
  c.fillStyle = color;
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5)))));
    c.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
  }
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const patterns = new Map<string, CanvasPattern | null>();

/** Tô dither 4×4 (Bayer): `level` 0…1 là tỉ lệ điểm được tô. Thay cho tô trong suốt để ảnh vẫn là pixel sạch. */
export function dither(c: Ctx, x: number, y: number, w: number, h: number, color: string, level: number): void {
  const q = Math.max(0, Math.min(16, Math.round(level * 16)));
  if (q === 0) return;
  if (q === 16) return rect(c, x, y, w, h, color);
  const key = `${color}|${q}`;
  let pat = patterns.get(key);
  if (pat === undefined) {
    const { canvas, ctx } = makeCanvas(4, 4);
    ctx.fillStyle = color;
    BAYER4.forEach((v, i) => { if (v < q) ctx.fillRect(i % 4, i >> 2, 1, 1); });
    pat = c.createPattern(canvas, "repeat");
    patterns.set(key, pat);
  }
  if (!pat) return;
  c.fillStyle = pat;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
