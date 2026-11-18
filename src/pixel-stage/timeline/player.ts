// Player: giữ stepIndex, thời gian trong step, Play / Pause / tốc độ. Không vẽ gì, chỉ cho biết frame hiện tại.
import type { StepScript } from "./types";
import { linesOf } from "./types";
import type { DeriveEnv, Frame, Snapshot } from "./state";
import { derive, initialSnapshot, schedule } from "./state";
import { holdFor } from "../tokens/motion";

export type StepEvent = { index: number; count: number; line: number[]; caption: string; vars: Record<string, string> };

export class Player {
  readonly script: StepScript;
  /** snaps[k] = trạng thái cuối của step k-1; snaps[0] = trạng thái ban đầu. */
  private readonly snaps: Snapshot[];
  private totals: number[];
  index = 0;
  elapsed = 0;
  playing = false;

  constructor(script: StepScript, vars: Record<string, unknown>, private env: DeriveEnv, private readonly onStep: (e: StepEvent) => void, private readonly onPlay: (playing: boolean) => void) {
    this.script = script;
    this.snaps = [initialSnapshot(script, vars, env)];
    script.steps.forEach((s, k) => this.snaps.push(derive(this.snaps[k], s, k, Infinity, { ...env, reduced: true })));
    this.totals = script.steps.map((s) => schedule(s, env.reduced).total);
  }

  get count(): number {
    return this.script.steps.length;
  }

  /** Bật/tắt giảm chuyển động: chỉ đổi thời lượng animate, snapshot không đổi. */
  setReduced(reduced: boolean): void {
    this.env = { ...this.env, reduced };
    this.totals = this.script.steps.map((s) => schedule(s, reduced).total);
  }

  get settled(): boolean {
    return this.elapsed >= this.totals[this.index];
  }

  /** Thời gian dừng đọc caption của step hiện tại khi Play. */
  private get hold(): number {
    return holdFor(this.script.steps[this.index].caption);
  }

  /** Tiến độ trong step hiện tại, 0…1. Khi Play tính cả thời gian dừng đọc caption trước khi sang step sau. */
  get progress(): number {
    const span = this.totals[this.index] + (this.playing ? this.hold : 0);
    return span > 0 ? Math.min(1, this.elapsed / span) : 1;
  }

  goTo(n: number): void {
    this.index = Math.max(0, Math.min(this.count - 1, Math.round(n)));
    this.elapsed = 0;
    const s = this.script.steps[this.index];
    this.onStep({ index: this.index, count: this.count, line: linesOf(s), caption: s.caption, vars: s.vars ?? {} });
  }

  next(): void {
    if (this.index < this.count - 1) this.goTo(this.index + 1);
    else this.pause();
  }

  prev(): void {
    if (this.index > 0) this.goTo(this.index - 1);
  }

  play(): void {
    if (this.playing) return;
    if (this.index === this.count - 1 && this.settled) this.goTo(0);
    this.playing = true;
    this.onPlay(true);
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.onPlay(false);
  }

  /** dt đã nhân hệ số tốc độ. */
  tick(dt: number): void {
    this.elapsed += dt;
    if (this.playing && this.elapsed >= this.totals[this.index] + this.hold) {
      if (this.index < this.count - 1) this.goTo(this.index + 1);
      else this.pause();
    }
  }

  /** Frame tại thời điểm hiện tại; `settled = true` cho trạng thái cuối của step. */
  frame(settled = false): Frame {
    const e = settled ? Infinity : this.elapsed;
    return derive(this.snaps[this.index], this.script.steps[this.index], this.index, e, this.env);
  }
}
