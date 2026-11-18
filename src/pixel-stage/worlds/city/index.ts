import type { WorldDef } from "../types";
import { accents } from "../../tokens/palette";
import { anchors, drawStatic } from "./layout";
import { sprites } from "./actors";
import { drawBack } from "./ambient";

export const city: WorldDef = {
  id: "city",
  title: "Giao thông đô thị",
  aria: "Bản đồ phố pixel nhìn từ trên minh hoạ thuật toán BFS: ngã tư là đỉnh, đường là cạnh, hàng xe shipper là hàng đợi",
  accents: accents.city,
  anchors,
  vars: { lit: [], path: [] },
  sprites,
  drawStatic,
  drawBack,
};
