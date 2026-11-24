// ============================================================================
// DESIGN TOKENS & QUY CHUẨN HÌNH ẢNH / CHUYỂN ĐỘNG
// Nguồn: "PE · Kế hoạch Motion Graphic bài học" (trang 8-9) & pe-pixel-motion-spec.html
// Không hard-code màu hex hay thời lượng lẻ ở ngoài file này.
// ============================================================================

export const STAGE = {
  W: 320,
  H: 180,
  TILE: 16,
  CHIBI: 32,
  FLOOR_Y: 140, // ~78% của 180px (140 / 180 = 77.78%)
  SAFE_MAX_X_WHEN_CODE_OPEN: 212, // Tránh vùng panel code ~400px ở góc trên phải
};

export const base = {
  ink: '#1b1626',
  ink2: '#2e2540',
  shade: '#4a3b66',
  mid: '#6e5a92',
  lav: '#a08bd0',
  pale: '#d9cdf2',
  paper: '#fff6e8',
  skin1: '#ffd8b8',
  skin2: '#f2b38f',
  skin3: '#c97f63',
  wood1: '#d49a5c',
  wood2: '#a8673f',
  wood3: '#7a4a32',
  amber1: '#ffcf6b',
  amber2: '#ffa94d',
  gray1: '#c4bfd0',
  gray2: '#8a8499',
  ok: '#57cc99',
  err: '#ff4d6d',
  uiBg: '#231c33',
};

export const accents = {
  memory:  { a1: '#2ec4b6', a2: '#8ecae6', a3: '#b5835a', a4: '#f4a259' },
  dj:      { a1: '#ff3cac', a2: '#2de2e6', a3: '#f9f871', a4: '#261447' },
  city:    { a1: '#ffd23f', a2: '#3a86ff', a3: '#1c2a4a', a4: '#ff5d8f' },
  dungeon: { a1: '#7b2cbf', a2: '#57cc99', a3: '#c77dff', a4: '#ff4d6d' },
  kitchen: { a1: '#ff7a45', a2: '#e8453c', a3: '#ffd166', a4: '#8fd694' },
};

export const WORLDS = {
  memory: {
    id: 'memory',
    name: 'Bàn & Kho',
    machineName: 'Máy in tem',
    productName: 'Tem giá / nhãn hộp',
    trayName: 'Khay tem',
    outfit: 'apron',
  },
  dj: {
    id: 'dj',
    name: 'DJ Sequencer',
    machineName: 'Máy ép đĩa',
    productName: 'Đĩa nhạc / sóng âm',
    trayName: 'Kệ đĩa',
    outfit: 'headphones',
  },
  city: {
    id: 'city',
    name: 'Giao thông & Shipper',
    machineName: 'Trạm Shipper',
    productName: 'Kiện hàng / biên nhận',
    trayName: 'Cổng nhận hàng',
    outfit: 'helmet',
  },
  dungeon: {
    id: 'dungeon',
    name: 'RPG Dungeon',
    machineName: 'Rương triệu hồi',
    productName: 'Vật phẩm / cuộn báo',
    trayName: 'Túi đồ',
    outfit: 'mage',
  },
  kitchen: {
    id: 'kitchen',
    name: 'Quán (Bếp & Quầy)',
    machineName: 'Bếp ra món / Máy in đơn',
    productName: 'Món trên khay / hóa đơn',
    trayName: 'Quầy ra món',
    outfit: 'chef',
  },
};

export const motion = {
  spriteFps: 10,
  stepMs: 2600, // Khoảng 2,6 giây mỗi bước ở tốc độ ×1 (trang 8)
  speeds: [0.5, 1, 2],
  dur: {
    xs: 120,
    sm: 250,
    md: 500,
    lg: 900,
    errorShake: 300, // Rung 300 ms rồi đứng yên ở trạng thái hỏng (trang 9)
  },
  easeSine(t) {
    const p = Math.min(1, Math.max(0, t));
    return -(Math.cos(Math.PI * p) - 1) / 2;
  },
  easeBackOut(t) {
    const p = Math.min(1, Math.max(0, t));
    const c1 = 1.2;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  },
};

/** Bộ sinh số giả ngẫu nhiên có seed (Mulberry32) để ambient & snapshot luôn tất định (deterministic) */
export function createRng(seed = 42) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
