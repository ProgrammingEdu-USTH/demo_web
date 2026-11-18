// Trạng thái của cảnh là một hàm thuần: frame = derive(snapshot của step trước, step hiện tại, thời gian trong step).
// Snapshot của step N = derive(snapshot N-1, step N, ∞). Vì vậy goTo(n) và bấm Next n lần luôn ra cùng một hình.
import type { Action, FxKind, Step, StepScript } from "./types";
import type { ColorRef } from "../tokens/palette";
import { actionDur, dur } from "../tokens/motion";
import { stageH, stageW } from "../tokens/size";
import { clamp01, lerp, moveEase, popScale } from "../core/ease";
import { hashSeed } from "../core/rng";

export type Vec = { x: number; y: number };

export type Entity = {
  id: string;
  sprite: string;
  x: number;
  y: number;
  tag: string;
  loop: boolean;
  flip: boolean;
  /** chỉ có trong lúc animate */
  scale: number;
  alpha: number;
  walking: boolean;
};
export type LabelState = { text: string; place: "above" | "below"; p: number };
export type TimerState = { seconds: number; total: number; p: number };
export type Bubble = { target: string; text: string; p: number };
export type Highlight = { target: string; color: ColorRef; age: number };
export type Burst = { fx: FxKind; x: number; y: number; n: number; age: number; life: number; seed: number };
export type Camera = { x: number; y: number; zoom: 1 | 2 };

export type Frame = {
  entities: Entity[];
  labels: Record<string, LabelState>;
  timers: Record<string, TimerState>;
  vars: Record<string, unknown>;
  camera: Camera;
  /** chỉ sống trong một step */
  bubbles: Bubble[];
  highlights: Highlight[];
  bursts: Burst[];
};
/** Trạng thái cuối (đã settle) của một step. */
export type Snapshot = Frame;

export type DeriveEnv = {
  /** Toạ độ của một anchor, hoặc của actor/vật đang có (hậu tố ".hand" = tay cầm đồ). */
  point: (name: string, ents: ReadonlyMap<string, Entity>) => Vec | null;
  /** Cạnh lớn của sprite (để giới hạn độ vượt khi pop). */
  sizeOf: (sprite: string) => number;
  reduced: boolean;
};

export type Slot = { a: Action; i: number; start: number; dur: number };

function durationOf(a: Action): number {
  if ((a.type === "move" || a.type === "say" || a.type === "wait") && a.dur) return dur[a.dur];
  if (a.type === "wait" && typeof a.ms === "number") return a.ms;
  const t = actionDur[a.type];
  return t ? dur[t] : 0;
}

/** Lịch chạy của các action trong step: song song, trừ khi có `after`.
 *  Giảm chuyển động: mọi action thành tức thời nhưng giữ nguyên thứ tự áp dụng, nên trạng thái cuối không đổi. */
export function schedule(step: Step, reduced: boolean): { slots: Slot[]; total: number } {
  const byIndex: Slot[] = [];
  step.actions.forEach((a, i) => {
    const prev = a.after !== undefined ? byIndex[a.after] : undefined;
    byIndex.push({ a, i, start: prev ? prev.start + prev.dur : 0, dur: durationOf(a) });
  });
  const sorted = [...byIndex].sort((x, y) => x.start - y.start || x.i - y.i);
  if (reduced) return { slots: sorted.map((s) => ({ ...s, start: 0, dur: 0 })), total: 0 };
  return { slots: sorted, total: byIndex.reduce((m, s) => Math.max(m, s.start + s.dur), 0) };
}

export function initialSnapshot(script: StepScript, vars: Record<string, unknown>, env: DeriveEnv): Snapshot {
  const ents = new Map<string, Entity>();
  for (const a of script.actors) {
    const p = env.point(a.at, ents) ?? { x: 0, y: 0 };
    ents.set(a.id, { id: a.id, sprite: a.sprite, x: p.x, y: p.y, tag: "idle", loop: true, flip: false, scale: 1, alpha: 1, walking: false });
  }
  return {
    entities: [...ents.values()], labels: {}, timers: {}, vars: { ...vars },
    camera: { x: stageW / 2, y: stageH / 2, zoom: 1 }, bubbles: [], highlights: [], bursts: [],
  };
}

/** Trạng thái tại thời điểm `e` (ms) trong step. `e = Infinity` cho trạng thái cuối. */
export function derive(prev: Snapshot, step: Step, stepIndex: number, e: number, env: DeriveEnv): Frame {
  const ents = new Map<string, Entity>();
  for (const en of prev.entities) ents.set(en.id, { ...en, scale: 1, alpha: 1, walking: false });
  const labels = { ...prev.labels };
  const timers = { ...prev.timers };
  const vars = { ...prev.vars };
  let camera = { ...prev.camera };
  const bubbles: Bubble[] = [];
  const highlights: Highlight[] = [];
  const bursts: Burst[] = [];
  const at = (name: string): Vec => env.point(name, ents) ?? { x: stageW / 2, y: stageH / 2 };

  for (const { a, i, start, dur: d } of schedule(step, env.reduced).slots) {
    if (e < start) continue;
    const age = e - start;
    const p = d > 0 ? clamp01(age / d) : 1;
    const seed = hashSeed(stepIndex, i);
    switch (a.type) {
      case "move": {
        const en = ents.get(a.actor);
        if (!en) break;
        const to = at(a.to);
        const k = moveEase(p);
        if (to.x !== en.x) en.flip = to.x < en.x;
        en.x = lerp(en.x, to.x, k);
        en.y = lerp(en.y, to.y, k);
        en.walking = p < 1;
        break;
      }
      case "anim": {
        const en = ents.get(a.actor);
        if (en) { en.tag = a.tag; en.loop = a.loop ?? true; }
        break;
      }
      case "spawn": {
        const pt = at(a.at);
        ents.delete(a.actor); // spawn lại cùng id: xếp lên trên cùng
        ents.set(a.actor, {
          id: a.actor, sprite: a.sprite, x: pt.x, y: pt.y, tag: "idle", loop: true, flip: false,
          scale: popScale(p, env.sizeOf(a.sprite)), alpha: 1, walking: false,
        });
        if (a.label) labels[a.actor] = { text: a.label, place: "below", p };
        break;
      }
      case "despawn": {
        const en = ents.get(a.actor);
        if (!en) break;
        if (a.fx === "poof" && age < d) bursts.push({ fx: "dust", x: en.x, y: en.y, n: 8, age, life: d, seed });
        if (p >= 1) {
          ents.delete(a.actor);
          delete labels[a.actor];
          delete timers[a.actor];
        } else if (a.fx === "poof") {
          en.alpha = p < 0.4 ? 1 : 0;
        } else {
          en.alpha = 1 - p;
        }
        break;
      }
      case "say":
        bubbles.push({ target: a.actor, text: a.text, p });
        break;
      case "label":
        if (a.text === "") delete labels[a.target];
        else labels[a.target] = { text: a.text, place: a.place ?? "below", p };
        break;
      case "highlight":
        highlights.push({ target: a.target, color: a.color ?? "amber1", age });
        break;
      case "emit":
        if (age < d) {
          const pt = at(a.at);
          bursts.push({ fx: a.fx, x: pt.x, y: pt.y, n: a.n ?? 0, age, life: d, seed });
        }
        break;
      case "timer":
        if (a.seconds <= 0) delete timers[a.at];
        else timers[a.at] = { seconds: a.seconds, total: prev.timers[a.at]?.total ?? a.seconds, p };
        break;
      case "set":
        vars[a.key] = a.value;
        break;
      case "camera": {
        const to = at(a.to);
        const k = moveEase(p);
        camera = { x: lerp(camera.x, to.x, k), y: lerp(camera.y, to.y, k), zoom: p >= 0.5 ? (a.zoom ?? 1) : camera.zoom };
        break;
      }
      case "wait":
      case "sound":
        break;
    }
  }
  return { entities: [...ents.values()], labels, timers, vars, camera, bubbles, highlights, bursts };
}
