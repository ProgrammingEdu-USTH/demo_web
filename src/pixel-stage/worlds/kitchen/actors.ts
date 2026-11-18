// Nhân vật và đạo cụ của bếp. Tên sprite / tag là hợp đồng với asset thật sau này.
import type { SpriteSheet } from "../../assets/sheet";
import { chibiSheet, propSheet } from "../../assets/placeholder";
import { accents, base } from "../../tokens/palette";
import { ambient, spriteFps } from "../../tokens/motion";
import { bitSpec } from "../shared";

const acc = accents.kitchen;
/** ticket lắc chậm: nửa chu kỳ một tư thế, nửa còn lại lệch 1px */
const SWAY_FRAMES = Math.round((ambient.sway * spriteFps) / 1000);

export const sprites: Record<string, () => SpriteSheet> = {
  // Bếp trưởng Bit = event loop
  "bit-chef": () => chibiSheet("bit-chef", bitSpec({ outfit: base.paper, outfit2: base.pale, pants: base.ink2, hat: "chef" })),
  // Đầu bếp = luồng duy nhất chạy các coroutine
  cook: () => chibiSheet("cook", { hair: base.ink2, hairShade: base.ink, outfit: base.wood1, outfit2: base.paper, pants: base.shade, hat: "none" }),
  // script threading: đầu bếp thứ hai
  binh: () => chibiSheet("binh", { hair: base.wood3, hairShade: base.ink2, outfit: base.lav, outfit2: base.paper, pants: base.ink2, hat: "none" }),
  pan: () =>
    propSheet("pan", (p, f) => {
      p.ellipse(6, 9, 5, 2, base.gray2);
      p.rect(2, 9, 9, 2, base.shade);
      p.rect(11, 8, 4, 1, base.wood3);
      if (f) p.set(4, 8, base.gray1);
    }),
  ticket: () =>
    propSheet("ticket", (p, f) => {
      const o = f < SWAY_FRAMES / 2 ? 0 : 1;
      p.rect(4, 3, 8, 6, base.paper);
      p.rect(4 + o, 9, 8, 6, base.paper);
      p.rect(5, 5, 6, 1, base.gray2);
      p.rect(5 + o, 10, 5, 1, base.gray2);
      p.rect(5 + o, 12, 4, 1, base.gray2);
      p.rect(7, 1, 2, 2, acc.a2);
    }, SWAY_FRAMES),
  pizza: () =>
    propSheet("pizza", (p, f) => {
      p.ellipse(8, 9, 6, 4, base.wood1);
      p.ellipse(8, 9, 5, 3, base.amber1);
      p.rect(5, 8, 2, 1, acc.a2);
      p.rect(9, 10, 2, 1, acc.a2);
      p.rect(9, 7, 2, 1, acc.a2);
      p.rect(6, 11, 1, 1, acc.a4);
      if (f) p.set(5, 7, base.paper);
    }),
  bread: () =>
    propSheet("bread", (p, f) => {
      p.ellipse(8, 9, 6, 3, base.wood1);
      p.rect(3, 11, 11, 1, base.wood2);
      p.set(5, 8, base.wood3); p.set(6, 7, base.wood3);
      p.set(8, 8, base.wood3); p.set(9, 7, base.wood3);
      p.set(11, 8, base.wood3); p.set(12, 7, base.wood3);
      if (f) p.set(4, 8, base.paper);
    }),
};
