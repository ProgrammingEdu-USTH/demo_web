// Vòng lặp render theo requestAnimationFrame; tự dừng khi tab ẩn, chạy lại khi hiện (không cộng dồn thời gian ẩn).
import { maxFrameDt } from "../tokens/motion";

export class Loop {
  private raf = 0;
  private last = -1;
  private wanted = false;
  private readonly onVis = () => this.sync();

  constructor(private readonly onFrame: (dtMs: number) => void) {
    document.addEventListener("visibilitychange", this.onVis);
  }

  /** Đang thực sự chạy (bị dừng khi tab ẩn). */
  get running(): boolean {
    return this.raf !== 0;
  }

  start(): void {
    this.wanted = true;
    this.sync();
  }

  stop(): void {
    this.wanted = false;
    this.sync();
  }

  destroy(): void {
    this.stop();
    document.removeEventListener("visibilitychange", this.onVis);
  }

  private sync(): void {
    const go = this.wanted && document.visibilityState !== "hidden";
    if (go && !this.raf) {
      this.last = -1;
      this.raf = requestAnimationFrame(this.tick);
    } else if (!go && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private readonly tick = (ts: number) => {
    const dt = this.last < 0 ? 0 : Math.min(ts - this.last, maxFrameDt);
    this.last = ts;
    this.raf = requestAnimationFrame(this.tick);
    this.onFrame(dt);
  };
}
