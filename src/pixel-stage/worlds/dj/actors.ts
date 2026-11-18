import type { SpriteSheet } from "../../assets/sheet";
import { chibiSheet, propSheet } from "../../assets/placeholder";
import { accents, base } from "../../tokens/palette";
import { bitSpec } from "../shared";

const acc = accents.dj;

export const sprites: Record<string, () => SpriteSheet> = {
  "bit-dj": () => chibiSheet("bit-dj", bitSpec({ outfit: base.ink2, outfit2: base.lav, pants: base.shade, hat: "none" })),
  // đầu phát (playhead): mũi tên chỉ xuống ô đang phát
  head: () =>
    propSheet("head", (p, f) => {
      p.rect(4, 3 + f, 8, 2, acc.a3);
      p.rect(5, 5 + f, 6, 2, acc.a3);
      p.rect(6, 7 + f, 4, 2, acc.a3);
      p.rect(7, 9 + f, 2, 2, acc.a3);
    }),
};
