import type { SpriteSheet } from "../../assets/sheet";
import type { Painter } from "../../assets/placeholder";
import { chibiSheet, propSheet } from "../../assets/placeholder";
import { accents, base } from "../../tokens/palette";
import { bitSpec } from "../shared";

const acc = accents.city;

/** Xe máy nhìn ngang, thùng hàng phía sau. */
function bike(p: Painter, f: number, body: string): void {
  p.ellipse(4, 12, 2, 2, base.ink2);
  p.ellipse(12, 12, 2, 2, base.ink2);
  p.rect(4, 8, 9, 3, body);
  p.rect(11, 5, 2, 4, base.gray1);
  p.rect(2, 4, 5, 4, base.wood1);
  p.rect(2, 4, 5, 1, base.wood2);
  p.rect(7, 5, 3, 3, base.skin1);
  p.set(4 + f, 12, base.gray1);
  p.set(12 + f, 12, base.gray1);
}

export const sprites: Record<string, () => SpriteSheet> = {
  "bit-dispatch": () => chibiSheet("bit-dispatch", bitSpec({ outfit: base.amber2, outfit2: base.paper, pants: base.ink2, hat: "none" })),
  bike: () => propSheet("bike", (p, f) => bike(p, f, base.lav)),
  shipper: () => propSheet("shipper", (p, f) => bike(p, f, acc.a1)),
  flag: () =>
    propSheet("flag", (p, f) => {
      p.rect(5, 3, 1, 10, base.wood3);
      p.rect(6, 3, 6, 4 - f, acc.a4);
      p.rect(6, 6 - f, 4, 1, acc.a4);
    }),
};
