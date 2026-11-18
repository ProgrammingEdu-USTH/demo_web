import type { SpriteSheet } from "../../assets/sheet";
import { chibiSheet, propSheet } from "../../assets/placeholder";
import { accents, base } from "../../tokens/palette";
import { bitSpec } from "../shared";

const acc = accents.blank;

export const sprites: Record<string, () => SpriteSheet> = {
  bit: () => chibiSheet("bit", bitSpec({ outfit: base.lav, outfit2: base.pale, pants: base.ink2, hat: "none" })),
  box: () =>
    propSheet("box", (p, f) => {
      p.rect(3, 4, 10, 10, base.wood1);
      p.rect(3, 4, 10, 2, base.wood2);
      p.rect(7, 4, 2, 10, base.wood2);
      p.rect(12, 6, 1, 8, base.wood3);
      if (f) p.set(4, 7, base.paper);
    }),
  star: () =>
    propSheet("star", (p, f) => {
      p.ellipse(8, 8, 4, 4, acc.a3);
      p.rect(7, 6, 2, 4, base.amber2);
      if (f) p.set(6, 6, base.paper);
    }),
};
