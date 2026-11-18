import type { WorldDef } from "../types";
import { accents } from "../../tokens/palette";
import { anchors, drawStatic } from "./layout";
import { sprites } from "./actors";
import { drawBack } from "./ambient";

export const blank: WorldDef = {
  id: "blank",
  title: "Phòng của Bit",
  aria: "Cảnh pixel căn phòng của Bit: tấm biển PIXEL, cái kệ và các hộp ký tự",
  accents: accents.blank,
  anchors,
  vars: { glow: false },
  sprites,
  drawStatic,
  drawBack,
};
