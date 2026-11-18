import type { SpriteSheet } from "../../assets/sheet";
import { ACTOR_TAGS } from "../../assets/sheet";
import { buildSheet, chibiSheet, Painter, propSheet } from "../../assets/placeholder";
import { accents, base } from "../../tokens/palette";
import { actorSize } from "../../tokens/size";
import { bitSpec } from "../shared";

const acc = accents.memory;

/** Robot dọn dẹp (bộ GC): thân hộp, ăng-ten, mắt sáng; cùng bộ tag với nhân vật. */
function robotSheet(): SpriteSheet {
  const frames: Painter[] = [];
  const tags: SpriteSheet["tags"] = {};
  for (const t of ACTOR_TAGS) {
    tags[t] = { from: frames.length, to: frames.length + 1 };
    for (const f of [0, 1]) {
      const p = new Painter(actorSize, actorSize);
      const b = t === "walk" || t === "happy" ? f : 0;
      p.rect(15, 3 - b, 2, 4, base.gray2);
      p.rect(14, 2 - b, 4, 2, t === "work" && f ? acc.a4 : acc.a1);
      p.rect(9, 7 - b, 14, 11, base.gray1);
      p.rect(9, 7 - b, 14, 2, base.paper);
      const eye = t === "idle" && f ? base.ink2 : acc.a1;
      p.rect(12, 11 - b, 3, 3, eye);
      p.rect(18, 11 - b, 3, 3, eye);
      p.rect(8, 19 - b, 16, 8, base.gray2);
      p.rect(10, 21 - b, 12, 3, base.shade);
      const up = t === "work" || t === "happy";
      p.rect(5, up ? 15 : 20, 3, 5, base.gray1);
      p.rect(24, up ? 15 : 20, 3, 5, base.gray1);
      p.ellipse(12, 28, 2, 1, base.ink2);
      p.ellipse(20, 28, 2, 1, base.ink2);
      if (t === "confused") p.pattern(25, 1, ["##.", "..#", ".#.", "...", ".#."], base.amber1);
      p.outline();
      frames.push(p);
    }
  }
  return buildSheet("robot", actorSize, actorSize, frames, tags, "feet");
}

export const sprites: Record<string, () => SpriteSheet> = {
  "bit-dev": () => chibiSheet("bit-dev", bitSpec({ outfit: base.mid, outfit2: base.pale, pants: base.ink2, hat: "none" })),
  robot: robotSheet,
  box: () =>
    propSheet("box", (p, f) => {
      p.rect(2, 4, 12, 10, base.wood1);
      p.rect(2, 4, 12, 2, base.wood2);
      p.rect(7, 4, 2, 10, base.amber1);
      p.rect(13, 6, 1, 8, base.wood3);
      if (f) p.set(3, 7, base.paper);
    }),
};
