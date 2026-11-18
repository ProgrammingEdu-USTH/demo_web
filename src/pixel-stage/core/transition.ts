// Chuyển cảnh pixelate: cảnh hiện ra từ khối mosaic thô rồi mịn dần về pixel thật ("in"), hoặc ngược lại ("out").
import type { PixelStage } from "./stage";
import { transition } from "../tokens/motion";

export function pixelate(stage: PixelStage, dir: "in" | "out", reduced: boolean): Promise<void> {
  const steps = dir === "in" ? transition.mosaic : [...transition.mosaic].reverse();
  if (reduced) {
    stage.setMosaic(dir === "in" ? 1 : steps[steps.length - 1]);
    return Promise.resolve();
  }
  return new Promise((done) => {
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / transition.pixelate);
      stage.setMosaic(steps[Math.min(steps.length - 1, Math.floor(k * steps.length))]);
      if (k < 1) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });
}
