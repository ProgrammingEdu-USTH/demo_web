import type { SpriteSheet } from "../../assets/sheet";
import { ACTOR_TAGS } from "../../assets/sheet";
import { buildSheet, chibiSheet, Painter } from "../../assets/placeholder";
import { accents, base } from "../../tokens/palette";
import { actorSize } from "../../tokens/size";
import { bitSpec } from "../shared";

const acc = accents.dungeon;

/** Slime: khối thạch xanh, nhún khi đứng, bật nhảy khi đi; cùng bộ tag với nhân vật. */
function slimeSheet(): SpriteSheet {
  const frames: Painter[] = [];
  const tags: SpriteSheet["tags"] = {};
  for (const t of ACTOR_TAGS) {
    tags[t] = { from: frames.length, to: frames.length + 1 };
    for (const f of [0, 1]) {
      const p = new Painter(actorSize, actorSize);
      const squash = t === "idle" ? f : 0;
      const hop = t === "walk" || t === "happy" ? f * 3 : 0;
      const lunge = t === "work" ? f * 3 : 0;
      const rx = 9 + squash + (t === "work" ? 1 : 0), ry = 7 - squash;
      const cx = 16 + lunge, cy = 29 - ry - hop;
      p.ellipse(cx, cy, rx, ry, (x, y) => ((x - cx) / rx + (y - cy) / ry > 0.9 ? base.gray2 : acc.a2));
      p.rect(cx - 6, cy - ry + 2, 3, 2, base.paper);
      const eyeY = cy - 1;
      if (t === "confused") { p.rect(cx - 4, eyeY, 2, 1, base.ink); p.rect(cx + 2, eyeY - 1, 1, 2, base.ink); }
      else if (t === "work") { p.rect(cx - 4, eyeY - 1, 2, 1, base.ink); p.rect(cx + 2, eyeY - 1, 2, 1, base.ink); p.rect(cx - 3, eyeY, 1, 2, base.ink); p.rect(cx + 2, eyeY, 1, 2, base.ink); }
      else { p.rect(cx - 4, eyeY, 1, 2, base.ink); p.rect(cx + 3, eyeY, 1, 2, base.ink); }
      if (t === "happy") p.rect(cx - 1, eyeY + 3, 3, 1, base.ink);
      p.outline();
      frames.push(p);
    }
  }
  return buildSheet("slime", actorSize, actorSize, frames, tags, "feet");
}

export const sprites: Record<string, () => SpriteSheet> = {
  "bit-hero": () => chibiSheet("bit-hero", bitSpec({ outfit: base.wood1, outfit2: base.amber1, pants: base.ink2, hat: "none" })),
  slime: slimeSheet,
};
