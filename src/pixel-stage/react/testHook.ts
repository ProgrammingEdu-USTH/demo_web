// Gắn stage đang hiển thị lên window để test tự động (Playwright) điều khiển và đọc trạng thái.
import type { PixelStage } from "../core/stage";

declare global {
  interface Window {
    __pixelStage?: PixelStage;
  }
}

export function exposeStage(st: PixelStage | null): void {
  if (typeof window === "undefined") return;
  if (st) window.__pixelStage = st;
  else delete window.__pixelStage;
}
