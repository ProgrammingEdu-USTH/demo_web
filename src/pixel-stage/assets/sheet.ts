// Asset contract: mọi sprite (placeholder vẽ bằng code hay spritesheet Aseprite thật) đều về dạng này.
// Cùng tên sprite, cùng kích thước, cùng tên tag → thay asset không phải sửa script.
export type Rect = { x: number; y: number; w: number; h: number };

export type SpriteSheet = {
  name: string;
  w: number;
  h: number;
  image: CanvasImageSource;
  frames: Rect[];
  /** idle, walk, work, happy, confused (nhân vật) hoặc idle (đạo cụ) */
  tags: Record<string, { from: number; to: number }>;
  /** feet: toạ độ là điểm chân (nhân vật); center: tâm (đạo cụ) */
  origin: "feet" | "center";
};

export const ACTOR_TAGS = ["idle", "walk", "work", "happy", "confused"] as const;

/** Spritesheet export từ Aseprite (định dạng "hash", có frameTags). */
export type AsepriteJson = {
  frames: Record<string, { frame: Rect }>;
  meta: { frameTags?: { name: string; from: number; to: number }[] };
};

export function fromAseprite(name: string, json: AsepriteJson, image: CanvasImageSource, origin: SpriteSheet["origin"]): SpriteSheet {
  const frames = Object.values(json.frames).map((f) => f.frame);
  if (frames.length === 0) throw new Error(`Spritesheet "${name}" không có frame`);
  const tags: SpriteSheet["tags"] = {};
  for (const t of json.meta.frameTags ?? []) tags[t.name] = { from: t.from, to: t.to };
  if (!tags.idle) tags.idle = { from: 0, to: 0 };
  return { name, w: frames[0].w, h: frames[0].h, image, frames, tags, origin };
}
