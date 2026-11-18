import type { WorldDef } from "../types";
import { accents } from "../../tokens/palette";
import { anchors, drawStatic } from "./layout";
import { sprites } from "./actors";
import { darkness, drawBack, drawFront } from "./ambient";

export const kitchen: WorldDef = {
  id: "kitchen",
  title: "Bếp nhà hàng",
  aria: "Cảnh pixel bếp nhà hàng minh hoạ lập trình bất đồng bộ: ray ticket, bàn sơ chế, hai lò nướng và khay ra món",
  accents: accents.kitchen,
  anchors,
  vars: { light: "off", tray: false, oven1: "off", oven2: "off", hook: false, lock: "free", bars: null },
  sprites,
  drawStatic,
  drawBack,
  drawFront,
  darkness,
};
