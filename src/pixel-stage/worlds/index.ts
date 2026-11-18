// Danh sách thế giới.
import type { WorldId } from "../timeline/types";
import type { WorldDef } from "./types";
import { blank } from "./blank";
import { kitchen } from "./kitchen";
import { city } from "./city";
import { memory } from "./memory";
import { dungeon } from "./dungeon";
import { dj } from "./dj";

const WORLDS: Record<WorldId, WorldDef> = { blank, kitchen, city, memory, dungeon, dj };

export function getWorld(id: WorldId): WorldDef {
  const w = WORLDS[id];
  if (!w) throw new Error(`Thế giới "${id}" không có`);
  return w;
}

export const worldTitle = (id: WorldId): string => WORLDS[id]?.title ?? id;
