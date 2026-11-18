/* Camera của cảnh (transform #cam): port focusCam() và tweenCam() của prototype. */
import { ROOM_H as IH, ROOM_W as IW, type Box } from "../config/scene";
import type { Cam, RoomLayout } from "../scene/layout";

/** Khung camera để khung FOCUS nằm giữa màn hình: zoom k trong [1.6, 3.4] (laptop tối đa 3.8), không lộ mép phòng. */
export function focusCam(L: RoomLayout, box: Box, isLearn: boolean): Cam {
  const [x0, y0, x1, y1] = box;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const rw = (x1 - x0) * L.s, rh = (y1 - y0) * L.s;
  let k = Math.min((L.W * 0.42) / rw, (L.H * 0.5) / rh);
  k = Math.max(1.6, Math.min(isLearn ? 3.8 : 3.4, k));
  const px = L.ox + L.s * cx, py = L.oy + L.s * cy;
  let tx = L.W / 2 - k * px, ty = L.H * 0.5 - k * py;
  tx = Math.min(-k * L.ox, Math.max(L.W - k * (L.ox + L.s * IW), tx));
  ty = Math.min(-k * L.oy, Math.max(L.H - k * (L.oy + L.s * IH), ty));
  return { tx, ty, k };
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Chuyển camera from → to trong dur ms. Zoom nội suy theo log(k) và tâm khung nhìn nội suy tuyến tính,
 * để zoom vào/ra trông đều tay. dur <= 0: nhảy thẳng tới đích.
 */
export function tweenCam(from: Cam, to: Cam, dur: number, W: number, H: number, apply: (c: Cam) => void): Promise<void> {
  return new Promise((res) => {
    if (dur <= 0) {
      apply(to);
      return res();
    }
    const c0 = [(W / 2 - from.tx) / from.k, (H / 2 - from.ty) / from.k];
    const c1 = [(W / 2 - to.tx) / to.k, (H / 2 - to.ty) / to.k];
    const lk0 = Math.log(from.k), lk1 = Math.log(to.k);
    const t0 = performance.now();
    const f = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = easeInOutCubic(t);
      const k = Math.exp(lk0 + (lk1 - lk0) * e);
      const cx = c0[0] + (c1[0] - c0[0]) * e, cy = c0[1] + (c1[1] - c0[1]) * e;
      apply({ k, tx: W / 2 - k * cx, ty: H / 2 - k * cy });
      if (t < 1) requestAnimationFrame(f);
      else {
        apply(to);
        res();
      }
    };
    f(t0);
  });
}
