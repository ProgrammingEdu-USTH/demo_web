// Vẽ poster "Đấu trường" (Arena) treo trên tường trái cửa sổ, xuất cut-out + ảnh viền sáng giống các vật khác.
//   npm run poster  →  public/items/arena.webp, public/items/arena-g.webp
// Khung ảnh trong toạ độ phòng (2752×1536): ARENA_BOX bên dưới, khớp DATA.meta.arena trong index.html.
// Ảnh xuất ở 2× để rõ nét khi camera zoom vào.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

export const ARENA_BOX = [760, 160, 210, 320]; // x, y, w, h (room px)
const S = 2;
const W = ARENA_BOX[2] * S, H = ARENA_BOX[3] * S;
// tờ poster bên trong khung (để chừa chỗ cho bóng đổ và viền sáng)
const P = { x: 20, y: 20, w: 380, h: 590 };
const out = fileURLToPath(new URL('../public/items/', import.meta.url));

const INK = '#2a1712';
const font = `font-family="'Arial Black','Segoe UI Black',Impact,sans-serif"`;
const fontB = `font-family="'Segoe UI','Arial',sans-serif" font-weight="700"`;

// tia nắng toả ra từ tâm huy hiệu VS
const cx = P.x + P.w / 2, cy = P.y + 318;
const rays = Array.from({ length: 18 }, (_, i) => {
  const a0 = (i / 18) * Math.PI * 2, a1 = a0 + Math.PI / 18, R = 520;
  return `<path d="M${cx} ${cy} L${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} L${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}Z"/>`;
}).join('');

const paper = (inner) => `
  <g transform="rotate(-1.2 ${cx} ${P.y})">${inner}</g>`;

const art = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#241a46"/><stop offset=".5" stop-color="#4b2a66"/><stop offset="1" stop-color="#b24e6a"/>
    </linearGradient>
    <radialGradient id="core" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#ffe3a8" stop-opacity=".9"/><stop offset=".55" stop-color="#ffb070" stop-opacity=".25"/><stop offset="1" stop-color="#ffb070" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe6a6"/><stop offset=".55" stop-color="#ffc97a"/><stop offset="1" stop-color="#f09a4a"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="panel"><rect x="${P.x + 16}" y="${P.y + 16}" width="${P.w - 32}" height="${P.h - 32}" rx="6"/></clipPath>
  </defs>
  <!-- giấy -->
  <rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" rx="8" fill="#f2e7cf" stroke="${INK}" stroke-width="4"/>
  <!-- tranh -->
  <g clip-path="url(#panel)">
    <rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" fill="url(#bg)"/>
    <g fill="#ffd9a0" opacity=".09">${rays}</g>
    <circle cx="${cx}" cy="${cy}" r="190" fill="url(#core)"/>
    <!-- thành phố đêm phía dưới -->
    <path d="M${P.x} ${P.y + 520} h40 v-46 h34 v26 h30 v-62 h44 v40 h26 v-30 h40 v52 h36 v-74 h40 v58 h30 v-34 h40 V${P.y + P.h} H${P.x}Z" fill="#2a1838" opacity=".85"/>
    <g fill="#ffd38a" opacity=".85">
      <rect x="${P.x + 132}" y="${P.y + 474}" width="9" height="11"/><rect x="${P.x + 150}" y="${P.y + 474}" width="9" height="11"/>
      <rect x="${P.x + 250}" y="${P.y + 470}" width="9" height="11"/><rect x="${P.x + 268}" y="${P.y + 492}" width="9" height="11"/>
      <rect x="${P.x + 52}" y="${P.y + 494}" width="9" height="11"/>
    </g>
    <!-- tiêu đề -->
    <text x="${cx}" y="${P.y + 74}" text-anchor="middle" ${fontB} font-size="21" letter-spacing="3" fill="#ffe9d0" opacity=".9">PE · ĐẤU CODE 1v1</text>
    <text x="${cx}" y="${P.y + 168}" text-anchor="middle" ${font} font-size="76" letter-spacing="1" fill="url(#gold)" stroke="${INK}" stroke-width="7" paint-order="stroke" stroke-linejoin="round">ARENA</text>
    <path d="M${cx - 120} ${P.y + 188} H${cx + 120}" stroke="#ffc97a" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 12" opacity=".8"/>
    <!-- hai đấu thủ -->
    <g stroke="${INK}" stroke-width="5">
      <circle cx="${cx - 104}" cy="${cy + 6}" r="56" fill="#ff9db8"/>
      <circle cx="${cx + 104}" cy="${cy + 6}" r="56" fill="#9ad8ff"/>
    </g>
    <text x="${cx - 104}" y="${cy + 24}" text-anchor="middle" ${font} font-size="46" fill="${INK}">{ }</text>
    <text x="${cx + 104}" y="${cy + 22}" text-anchor="middle" ${font} font-size="38" fill="${INK}">&lt;/&gt;</text>
    <!-- tia chớp VS -->
    <path d="M${cx + 10} ${cy - 78} L${cx - 34} ${cy + 14} H${cx - 4} L${cx - 16} ${cy + 92} L${cx + 36} ${cy - 6} H${cx + 6}Z" fill="url(#gold)" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <text x="${cx}" y="${cy + 140}" text-anchor="middle" ${font} font-size="40" fill="#fff6ee" stroke="${INK}" stroke-width="6" paint-order="stroke">VS</text>
    <!-- dải băng -->
    <path d="M${P.x + 30} ${P.y + 496} H${P.x + P.w - 30} l-14 20 l14 20 H${P.x + 30} l14 -20Z" fill="#c8323d" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <text x="${cx}" y="${P.y + 523}" text-anchor="middle" ${fontB} font-size="18" letter-spacing="1.5" fill="#fff6ee">PYTHON · XẾP HẠNG ELO</text>
    <rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" fill="url(#sheen)"/>
  </g>
  <rect x="${P.x + 16}" y="${P.y + 16}" width="${P.w - 32}" height="${P.h - 32}" rx="6" fill="none" stroke="${INK}" stroke-width="3"/>
  <!-- góc giấy hơi quăn -->
  <path d="M${P.x + P.w} ${P.y + P.h - 34} L${P.x + P.w - 34} ${P.y + P.h} L${P.x + P.w - 30} ${P.y + P.h - 30}Z" fill="#d9c9a8" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <!-- băng dính -->
  <rect x="${P.x - 22}" y="${P.y - 10}" width="84" height="30" fill="#ffbebe" opacity=".75" transform="rotate(-32 ${P.x + 20} ${P.y + 5})"/>
  <rect x="${P.x + P.w - 62}" y="${P.y - 10}" width="84" height="30" fill="#ffbebe" opacity=".75" transform="rotate(32 ${P.x + P.w - 20} ${P.y + 5})"/>`;

const shadow = `
  <defs><filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter></defs>
  <g transform="translate(8 12)" filter="url(#blur)"><rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" rx="8" fill="#12081a" opacity=".42" transform="rotate(-1.2 ${cx} ${P.y})"/></g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${shadow}${paper(art)}</svg>`;

// viền sáng (giống calendar-g.webp): nét kem quanh tờ giấy + quầng mờ
const glow = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter></defs>
  ${paper(`<rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" rx="8" fill="none" stroke="#ffd79a" stroke-width="12" filter="url(#g)" opacity=".9"/>
  <rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" rx="8" fill="none" stroke="#fff1d2" stroke-width="5"/>`)}
</svg>`;

const r1 = await sharp(Buffer.from(svg)).modulate({ saturation: 0.82, brightness: 0.96 }).webp({ quality: 92, alphaQuality: 100 }).toFile(out + 'arena.webp');
const r2 = await sharp(Buffer.from(glow)).webp({ quality: 90, alphaQuality: 100 }).toFile(out + 'arena-g.webp');
console.log('arena.webp', r1.width + '×' + r1.height, (r1.size / 1024).toFixed(0) + ' KB');
console.log('arena-g.webp', r2.width + '×' + r2.height, (r2.size / 1024).toFixed(0) + ' KB');
