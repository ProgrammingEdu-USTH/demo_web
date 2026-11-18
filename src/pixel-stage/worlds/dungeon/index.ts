import type { WorldDef } from "../types";
import { accents } from "../../tokens/palette";
import { anchors, drawStatic } from "./layout";
import { sprites } from "./actors";
import { drawBack, drawFront } from "./ambient";

export const dungeon: WorldDef = {
  id: "dungeon",
  title: "RPG Dungeon",
  aria: "Cảnh pixel hầm ngục minh hoạ lập trình hướng đối tượng: bản thiết kế class, cổng triệu hồi object, slime có máu và trạng thái riêng",
  accents: accents.dungeon,
  anchors,
  vars: { bp: 0, portal: false, hp: {}, fsm: {}, fsmEdge: {}, ruler: null },
  sprites,
  drawStatic,
  drawBack,
  drawFront,
};
