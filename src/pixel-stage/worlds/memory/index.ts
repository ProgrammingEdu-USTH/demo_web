import type { WorldDef } from "../types";
import { accents } from "../../tokens/palette";
import { anchors, drawStatic } from "./layout";
import { sprites } from "./actors";
import { drawBack, drawFront } from "./ambient";

export const memory: WorldDef = {
  id: "memory",
  title: "Bàn làm việc & kho",
  aria: "Cảnh pixel phòng làm việc minh hoạ quản lý bộ nhớ: bàn là cache, kệ là RAM, kho xa là disk, nhãn tên biến buộc dây vào hộp object",
  accents: accents.memory,
  anchors,
  vars: { tags: [], links: [], boxes: [], charging: false },
  sprites,
  drawStatic,
  drawBack,
  drawFront,
};
