/* Đặt phòng 2752×1536 vào màn hình: port layout(), w2s(), rectS() của prototype. */
import { ROOM_H as IH, ROOM_W as IW, type Box } from "../config/scene";

export const MOBILE_MAX = 820;

export interface RoomLayout {
  /** scale room-space → px màn hình */
  s: number;
  ox: number;
  oy: number;
  W: number;
  H: number;
  mobile: boolean;
  /** Mép trái cột phải (desktop) hoặc W (mobile) */
  sideLeft: number;
  /** Bề rộng cột phải (px) trên desktop; null trên mobile */
  side: number | null;
}

/** Camera: transform của #cam. */
export interface Cam {
  tx: number;
  ty: number;
  k: number;
}

export const CAM_REST: Cam = { tx: 0, ty: 0, k: 1 };

export function computeLayout(W: number, H: number): RoomLayout {
  const mobile = W <= MOBILE_MAX;
  if (!mobile) {
    const side = Math.min(380, Math.max(320, W * 0.23));
    const sideLeft = W - side - 16;
    let s = H / IH;
    if (IW * s < W * 0.86) s = (W * 0.86) / IW;
    const cL = 495, cR = 2348, avail0 = 6, avail1 = sideLeft - 6;
    let ox = (avail0 + avail1) / 2 - ((cL + cR) / 2) * s;
    if ((cR - cL) * s > avail1 - avail0) ox = avail0 - cL * s;
    ox = Math.min(0, ox);
    const oy = Math.min(0, (H - IH * s) * 0.8);
    return { s, ox, oy, W, H, mobile, sideLeft, side };
  }
  const stageH = H * 0.6;
  const s = Math.max((stageH / IH) * 1.15, W / IW);
  let ox = W / 2 - 1330 * s;
  ox = Math.min(0, Math.max(W - IW * s, ox));
  const oy = Math.min(0, stageH * 0.55 - 1150 * s);
  return { s, ox, oy, W, H, mobile, sideLeft: W, side: null };
}

export const roomTransform = (L: RoomLayout) => `translate(${L.ox}px,${L.oy}px) scale(${L.s})`;
export const camTransform = (C: Cam) => `translate(${C.tx}px,${C.ty}px) scale(${C.k})`;

/** Toạ độ room-space → px màn hình. */
export function w2s(L: RoomLayout, x: number, y: number, c: Cam = CAM_REST): [number, number] {
  return [c.tx + c.k * (L.ox + L.s * x), c.ty + c.k * (L.oy + L.s * y)];
}

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

/** Hộp [x0, y0, x1, y1] room-space → hình chữ nhật màn hình. */
export function rectS(L: RoomLayout, r: Box, c: Cam = CAM_REST): ScreenRect {
  const [a, b] = w2s(L, r[0], r[1], c);
  const [d, e] = w2s(L, r[2], r[3], c);
  return { x: a, y: b, w: d - a, h: e - b, cx: (a + d) / 2, cy: (b + e) / 2 };
}
