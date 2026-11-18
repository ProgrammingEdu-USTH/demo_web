import type { WorldDef } from "../types";
import { accents } from "../../tokens/palette";
import { anchors, drawStatic } from "./layout";
import { sprites } from "./actors";
import { drawBack, drawFront } from "./ambient";

export const dj: WorldDef = {
  id: "dj",
  title: "Bàn DJ / Sequencer",
  aria: "Cảnh pixel bàn DJ minh hoạ vòng lặp và rẽ nhánh: 8 ô sequencer, đầu phát chạy qua từng ô, bộ chia tín hiệu if elif else tới loa, trống, hi-hat",
  accents: accents.dj,
  anchors,
  vars: { cells: [], played: [], branch: null, stop: false },
  sprites,
  drawStatic,
  drawBack,
  drawFront,
};
