// Convert the Blender bake PNGs to WebP for the web (run after every re-bake): npm run textures
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../public/assets/', import.meta.url));
for (const name of ['bake_day', 'bake_lamp', 'props_day', 'props_lamp']) {
  const src = dir + name + '.png';
  if (!existsSync(src)) { console.log('missing', name); continue; }
  const info = await sharp(src).webp({ quality: 90 }).toFile(dir + name + '.webp');
  console.log(name, (info.size / 1024).toFixed(0) + ' KB');
}
