// Kiểm tra Step Script lúc load: sai kiểu hoặc trỏ tới actor / anchor / sprite không có thì báo lỗi rõ ràng.
import type { Action, StepScript } from "./types";
import { WORLD_IDS } from "./types";
import { dur } from "../tokens/motion";

const fail = (where: string, msg: string): never => {
  throw new Error(`Step Script không hợp lệ (${where}): ${msg}`);
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (o: Record<string, unknown>, k: string, where: string): string =>
  typeof o[k] === "string" && (o[k] as string).length > 0 ? (o[k] as string) : fail(where, `thiếu chuỗi "${k}"`);

const REQUIRED: Record<Action["type"], string[]> = {
  move: ["actor", "to"], anim: ["actor", "tag"], spawn: ["actor", "sprite", "at"], despawn: ["actor"],
  say: ["actor", "text"], label: ["target"], highlight: ["target"], emit: ["at", "fx"], timer: ["at"],
  set: ["key"], camera: ["to"], wait: [], sound: ["name"],
};

/** Kiểm tra cấu trúc và trả về script đã có kiểu. */
export function parseScript(raw: unknown): StepScript {
  if (!isObj(raw)) return fail("gốc", "không phải object");
  const id = str(raw, "id", "gốc");
  if (!WORLD_IDS.includes(raw.world as never)) fail(id, `world "${String(raw.world)}" không có`);
  if (raw.language !== "python") fail(id, `language phải là "python"`);
  const code = str(raw, "code", id);
  const nLines = code.split("\n").length;
  if (!Array.isArray(raw.actors)) fail(id, "actors phải là mảng");
  (raw.actors as unknown[]).forEach((a, i) => {
    if (!isObj(a)) fail(`${id} actors[${i}]`, "không phải object");
    else ["id", "sprite", "at"].forEach((k) => str(a, k, `${id} actors[${i}]`));
  });
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) fail(id, "steps phải là mảng khác rỗng");
  (raw.steps as unknown[]).forEach((s, si) => {
    const w = `${id} step ${si + 1}`;
    if (!isObj(s)) return fail(w, "không phải object");
    const lines = Array.isArray(s.line) ? s.line : [s.line];
    if (lines.length === 0 || !lines.every((n) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= nLines)) {
      fail(w, `line ngoài khoảng 1…${nLines}`);
    }
    str(s, "caption", w);
    if (!Array.isArray(s.actions)) fail(w, "actions phải là mảng");
    (s.actions as unknown[]).forEach((a, ai) => {
      const wa = `${w} action ${ai}`;
      if (!isObj(a)) return fail(wa, "không phải object");
      const t = a.type as Action["type"];
      if (!(t in REQUIRED)) fail(wa, `type "${String(a.type)}" không có`);
      REQUIRED[t].forEach((k) => str(a, k, wa));
      if (t === "label" && typeof a.text !== "string") fail(wa, `thiếu "text"`);
      if (t === "timer" && typeof a.seconds !== "number") fail(wa, `thiếu "seconds"`);
      if (t === "sound" && !["kick", "snare", "hat", "ding"].includes(String(a.name))) fail(wa, `âm "${String(a.name)}" không có`);
      if (a.dur !== undefined && !(String(a.dur) in dur)) fail(wa, `dur "${String(a.dur)}" không phải token`);
      if (a.after !== undefined && !(Number.isInteger(a.after) && (a.after as number) >= 0 && (a.after as number) < ai)) {
        fail(wa, `after phải trỏ tới action đứng trước trong cùng step`);
      }
    });
  });
  return raw as unknown as StepScript;
}

/** Kiểm tra tham chiếu: actor đã có trước khi dùng, anchor / sprite / tag tồn tại trong thế giới. */
export function checkRefs(
  s: StepScript,
  has: { anchor: (n: string) => boolean; sprite: (n: string) => boolean; tag: (sprite: string, tag: string) => boolean },
): void {
  const alive = new Map<string, string>();
  const place = (n: string, w: string) => {
    const handOf = n.endsWith(".hand") && alive.has(n.slice(0, -5));
    if (!has.anchor(n) && !alive.has(n) && !handOf) fail(w, `"${n}" không phải anchor hay actor đang có`);
  };
  s.actors.forEach((a) => {
    if (!has.sprite(a.sprite)) fail(s.id, `sprite "${a.sprite}" không có`);
    if (!has.anchor(a.at)) fail(s.id, `anchor "${a.at}" không có`);
    alive.set(a.id, a.sprite);
  });
  s.steps.forEach((st, si) => {
    st.actions.forEach((a, ai) => {
      const w = `${s.id} step ${si + 1} action ${ai}`;
      const actor = (id: string) => alive.has(id) || fail(w, `actor "${id}" chưa có`);
      switch (a.type) {
        case "move": actor(a.actor); place(a.to, w); break;
        case "anim": actor(a.actor); if (!has.tag(alive.get(a.actor) ?? "", a.tag)) fail(w, `tag "${a.tag}" không có`); break;
        case "spawn":
          if (!has.sprite(a.sprite)) fail(w, `sprite "${a.sprite}" không có`);
          place(a.at, w);
          alive.set(a.actor, a.sprite);
          break;
        case "despawn": actor(a.actor); break; // vẫn giữ trong `alive` tới hết step cho các action cùng step
        case "say": place(a.actor, w); break;
        case "label": case "highlight": place(a.target, w); break;
        case "emit": case "timer": place(a.at, w); break;
        case "camera": if (!has.anchor(a.to)) fail(w, `anchor "${a.to}" không có`); break;
      }
    });
    st.actions.forEach((a) => { if (a.type === "despawn") alive.delete(a.actor); });
  });
}
