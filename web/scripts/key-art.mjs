// ============================================================================
// Xử lý ảnh minh hoạ AI (Antigravity) → sprite WebP trong suốt cho motion graphic
//   node scripts/key-art.mjs            (xử lý mọi ảnh trong ../_ref/ai-art/raw)
// - Ảnh vật thể: nền hồng #FF00FF → trong suốt (key mềm + khử viền hồng), cắt sát mép
// - Ảnh tên bg_*: ảnh nền, chỉ đổi cỡ + nén WebP
// - Sprite sheet (tên có trong SHEETS): chia đều theo chiều ngang thành N ảnh name_1..N
// - Ghi web/src/motion/art-manifest.json: { name: { w, h } } để renderer chỉ tải ảnh có thật
// ============================================================================
import sharp from 'sharp';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// Tham số: --raw <thư mục ảnh gốc> --out <thư mục xuất> --no-manifest (dùng cho bản mẫu)
const arg = (k) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : null;
};
const RAW = arg('--raw') || join(here, '..', '..', '_ref', 'ai-art', 'raw');
const OUT = arg('--out') || join(here, '..', 'public', 'motion-art');
const WRITE_MANIFEST = !process.argv.includes('--no-manifest');
const MANIFEST = join(here, '..', 'src', 'motion', 'art-manifest.json');

// Sprite sheet: số ô theo chiều ngang (tên bit_* và *_bit là sheet 4 tư thế)
const SHEETS = { food_icons: 4, slimes: 3, chefs: 4 };
const sheetCount = (name) => SHEETS[name] || (/^bit_|_bit$/.test(name) ? 4 : 0);

const OBJ_MAX = 512; // cạnh dài tối đa của sprite vật thể
const BG_W = 1920;

/** Mức "hồng" của 1 điểm ảnh: càng giống #FF00FF càng lớn */
function magentaness(r, g, b) {
  return Math.min(r, b) - g;
}

async function keyMagenta(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const px = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
  const HARD = 150; // chắc chắn là nền
  const SOFT = 70; // bắt đầu pha trộn ở viền
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const m = magentaness(r, g, b);
    if (m >= HARD) {
      px[i + 3] = 0;
      continue;
    }
    if (m > SOFT) {
      const a = 1 - (m - SOFT) / (HARD - SOFT);
      px[i + 3] = Math.round(255 * a);
    }
    // Khử viền hồng (despill): kéo R và B về gần G khi điểm ảnh còn ám hồng
    if (m > 0) {
      const cap = g + Math.max(0, m - SOFT) * 0.2;
      if (r > cap && b > cap) {
        const k = Math.min(1, m / HARD);
        px[i] = Math.round(r - (r - Math.max(cap, g)) * k);
        px[i + 2] = Math.round(b - (b - Math.max(cap, g)) * k);
      }
    }
  }
  return { px, width, height };
}

/** Khung bao vùng có alpha > ngưỡng trong cột [x0, x1) */
function bbox(px, width, height, x0 = 0, x1 = width) {
  let minX = x1;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = x0; x < x1; x++) {
      if (px[(y * width + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 2;
  return {
    left: Math.max(x0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(x1, maxX + pad + 1) - Math.max(x0, minX - pad),
    height: Math.min(height, maxY + pad + 1) - Math.max(0, minY - pad),
  };
}

async function writeSprite(px, width, height, box, name, manifest) {
  const img = sharp(Buffer.from(px.buffer, px.byteOffset, px.length), { raw: { width, height, channels: 4 } })
    .extract(box)
    .resize({ width: OBJ_MAX, height: OBJ_MAX, fit: 'inside', withoutEnlargement: true });
  const { data, info } = await img.webp({ quality: 90, alphaQuality: 100 }).toBuffer({ resolveWithObject: true });
  await writeFile(join(OUT, `${name}.webp`), data);
  manifest[name] = { w: info.width, h: info.height };
  return info;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const files = (await readdir(RAW)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  const manifest = {};
  for (const f of files.sort()) {
    const name = basename(f, extname(f));
    const input = join(RAW, f);
    if (/(^|_)bg_/.test(name)) {
      const { data, info } = await sharp(input).resize({ width: BG_W, withoutEnlargement: true }).webp({ quality: 86 }).toBuffer({ resolveWithObject: true });
      await writeFile(join(OUT, `${name}.webp`), data);
      manifest[name] = { w: info.width, h: info.height };
      console.log(`bg     ${name} ${info.width}x${info.height}`);
      continue;
    }
    const { px, width, height } = await keyMagenta(input);
    const n = sheetCount(name);
    if (n) {
      const cell = width / n;
      for (let k = 0; k < n; k++) {
        const box = bbox(px, width, height, Math.round(k * cell), Math.round((k + 1) * cell));
        if (!box) continue;
        const info = await writeSprite(px, width, height, box, `${name}_${k + 1}`, manifest);
        console.log(`sheet  ${name}_${k + 1} ${info.width}x${info.height}`);
      }
      continue;
    }
    const box = bbox(px, width, height);
    if (!box) {
      console.log(`EMPTY  ${name}`);
      continue;
    }
    const info = await writeSprite(px, width, height, box, name, manifest);
    console.log(`sprite ${name} ${info.width}x${info.height}`);
  }
  if (WRITE_MANIFEST) {
    await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`manifest: ${Object.keys(manifest).length} ảnh → ${MANIFEST}`);
  } else {
    console.log(`xong: ${Object.keys(manifest).length} ảnh → ${OUT}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
