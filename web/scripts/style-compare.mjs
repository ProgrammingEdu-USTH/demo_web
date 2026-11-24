// ============================================================================
// Ghép ảnh so sánh phong cách (lưới 2×2): Hiện tại · A · B · C
//   node scripts/style-compare.mjs <thư mục sprite mẫu> <file png xuất>
// Mỗi ô dựng một cảnh M1 mô phỏng: ảnh nền + 3 tủ ngăn trên bàn + Bit (2 tư thế)
// ============================================================================
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLE = process.argv[2];
const OUTFILE = process.argv[3];
const CUR = join(here, '..', 'public', 'motion-art');
const TW = 800;
const TH = 450;

const variants = [
  { key: 'cur', title: 'Hiện tại · hoạt hình viền đậm, buổi tối', dir: CUR, bg: 'bg_memory', drawer: 'drawer', bit: 'bit_apron' },
  { key: 'sA', title: 'A · Đồ chơi đất sét 3D, pastel ban ngày', dir: SAMPLE, bg: 'sA_bg_memory', drawer: 'sA_drawer', bit: 'sA_bit' },
  { key: 'sB', title: 'B · Phẳng tối giản, không viền, màu tươi', dir: SAMPLE, bg: 'sB_bg_memory', drawer: 'sB_drawer', bit: 'sB_bit' },
  { key: 'sC', title: 'C · Tranh sách truyện màu nước, nắng sớm', dir: SAMPLE, bg: 'sC_bg_memory', drawer: 'sC_drawer', bit: 'sC_bit' },
];

const fit = (file, w, h) => sharp(file).resize({ width: w, height: h, fit: 'inside' }).png().toBuffer();
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function tile(v) {
  const p = (n) => join(v.dir, `${n}.webp`);
  const layers = [];
  const base = existsSync(p(v.bg))
    ? sharp(p(v.bg)).resize(TW, TH, { fit: 'cover' })
    : sharp({ create: { width: TW, height: TH, channels: 4, background: '#2e2540' } });
  // Bàn (dải gỗ đơn giản để thấy tủ đứng trên mặt phẳng)
  const tableY = Math.round(TH * 0.66);
  layers.push({ input: Buffer.from(`<svg width="${TW}" height="${TH}"><rect x="30" y="${tableY}" width="520" height="16" rx="6" fill="#b87a45" stroke="#3b2433" stroke-width="3"/></svg>`), left: 0, top: 0 });
  if (existsSync(p(v.drawer))) {
    const d = await fit(p(v.drawer), 140, 120);
    const meta = await sharp(d).metadata();
    for (let i = 0; i < 3; i++) layers.push({ input: d, left: 60 + i * 165, top: tableY - meta.height + 4 });
  }
  for (const [k, x] of [[1, 600], [3, 690]]) {
    const f = p(`${v.bit}_${k}`);
    if (!existsSync(f)) continue;
    const b = await fit(f, 90, 170);
    const meta = await sharp(b).metadata();
    layers.push({ input: b, left: x, top: Math.round(TH * 0.8) - meta.height });
  }
  layers.push({
    input: Buffer.from(`<svg width="${TW}" height="44"><rect width="${TW}" height="44" fill="#1b1626" opacity="0.82"/><text x="16" y="29" font-family="Segoe UI, Arial" font-size="22" font-weight="700" fill="#ffcf6b">${esc(v.title)}</text></svg>`),
    left: 0,
    top: 0,
  });
  return base.composite(layers).png().toBuffer();
}

const tiles = await Promise.all(variants.map(tile));
const G = 12;
await sharp({ create: { width: TW * 2 + G * 3, height: TH * 2 + G * 3, channels: 4, background: '#1b1626' } })
  .composite(tiles.map((t, i) => ({ input: t, left: G + (i % 2) * (TW + G), top: G + Math.floor(i / 2) * (TH + G) })))
  .png()
  .toFile(OUTFILE);
console.log('saved', OUTFILE);
