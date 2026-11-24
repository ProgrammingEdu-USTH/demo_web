// ============================================================================
// SPRITE ẢNH MINH HOẠ (tạo bằng Antigravity, xử lý bởi scripts/key-art.mjs)
// - Chỉ tải ảnh có trong art-manifest.json (không gọi mạng thừa, không 404)
// - Tải lười: lần đầu hỏi thì bắt đầu tải, khi xong renderer tự vẽ ở frame sau
// - Ảnh chưa có / tải lỗi → trả null, renderer vẽ bằng code như cũ (fallback)
// ============================================================================
import MANIFEST from './art-manifest.json';

const BASE = `${(import.meta.env && import.meta.env.BASE_URL) || '/'}motion-art/`;
const cache = new Map();

export function hasSprite(name) {
  return Object.prototype.hasOwnProperty.call(MANIFEST, name);
}

/** Ảnh đã tải xong, hoặc null (đang tải / không có) */
export function getSprite(name) {
  if (!hasSprite(name)) return null;
  let e = cache.get(name);
  if (!e) {
    const img = new Image();
    img.decoding = 'async';
    e = { img, ok: false };
    img.onload = () => {
      e.ok = true;
    };
    img.onerror = () => {
      e.failed = true;
    };
    img.src = `${BASE}${name}.webp`;
    cache.set(name, e);
  }
  return e.ok ? e.img : null;
}

/** Tải trước một nhóm ảnh (ví dụ khi đổi bài) */
export function preloadSprites(names) {
  for (const n of names) getSprite(n);
}

/**
 * Vẽ sprite vừa khung (x, y, w, h) theo toạ độ logic, giữ tỉ lệ ảnh.
 * fit: 'contain' (mặc định, căn đáy-giữa) | 'fill' (kéo đầy khung) | 'cover'
 * Trả true nếu đã vẽ được.
 */
export function drawSprite(ctx, name, x, y, w, h, opts = {}) {
  const img = getSprite(name);
  if (!img) return false;
  const fit = opts.fit || 'contain';
  let dx = x;
  let dy = y;
  let dw = w;
  let dh = h;
  if (fit !== 'fill') {
    const ar = img.naturalWidth / img.naturalHeight;
    const scale = fit === 'cover' ? Math.max(w / img.naturalWidth, h / img.naturalHeight) : Math.min(w / img.naturalWidth, h / img.naturalHeight);
    dw = img.naturalWidth * scale;
    dh = dw / ar;
    dx = x + (w - dw) / 2;
    dy = opts.align === 'center' ? y + (h - dh) / 2 : y + h - dh; // mặc định đặt đáy chạm đáy khung
  }
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (opts.flip) {
    ctx.save();
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, dw, dh);
    ctx.restore();
  } else {
    ctx.drawImage(img, dx, dy, dw, dh);
  }
  ctx.imageSmoothingEnabled = prev;
  return true;
}
