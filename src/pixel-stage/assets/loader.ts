// Nạp spritesheet thật xuất từ Aseprite (PNG + JSON dạng "hash", có frameTags) và kiểm tra asset contract
// với placeholder cùng tên: cùng kích thước khung, đủ mọi tag. Đạt thì thay vào, script không phải sửa.
import type { AsepriteJson, SpriteSheet } from "./sheet";
import { fromAseprite } from "./sheet";

/** Lỗi khi sheet thật không khớp hợp đồng với placeholder. */
export function contractProblems(placeholder: SpriteSheet, real: SpriteSheet): string[] {
  const out: string[] = [];
  if (real.w !== placeholder.w || real.h !== placeholder.h) out.push(`khung phải là ${placeholder.w}×${placeholder.h}, đang là ${real.w}×${real.h}`);
  const missing = Object.keys(placeholder.tags).filter((t) => !(t in real.tags));
  if (missing.length) out.push(`thiếu tag: ${missing.join(", ")}`);
  const bad = real.frames.filter((f) => f.w !== real.w || f.h !== real.h).length;
  if (bad) out.push(`${bad} frame có kích thước khác nhau`);
  for (const [t, r] of Object.entries(real.tags)) {
    if (r.from < 0 || r.to >= real.frames.length || r.from > r.to) out.push(`tag "${t}" trỏ ra ngoài danh sách frame`);
  }
  return out;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Không tải được ảnh ${url}`));
    img.src = url;
  });
}

/** Tải JSON Aseprite tại `jsonUrl`; ảnh lấy theo `meta.image` (đường dẫn tương đối với file JSON). */
export async function loadAseprite(name: string, jsonUrl: string, origin: SpriteSheet["origin"]): Promise<SpriteSheet> {
  const res = await fetch(jsonUrl);
  if (!res.ok) throw new Error(`Không tải được ${jsonUrl} (${res.status})`);
  const json = (await res.json()) as AsepriteJson & { meta: { image?: string } };
  const imageUrl = new URL(json.meta.image ?? jsonUrl.replace(/\.json$/i, ".png"), new URL(jsonUrl, location.href)).href;
  const image = await loadImage(imageUrl);
  return fromAseprite(name, json, image, origin);
}
