/* Giá trị chỉ có ở trình duyệt (kích thước cửa sổ, giờ hiện tại, giảm chuyển động).
   Dùng useSyncExternalStore: khi render ở server và lúc hydrate trả về giá trị dự phòng, sau đó mới đổi sang giá trị thật. */
import { useSyncExternalStore } from "react";

const subscribeResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
const viewportSnapshot = () => `${window.innerWidth}x${window.innerHeight}`;

/** Kích thước khung nhìn, tính lại khi resize. */
export function useViewport(): { W: number; H: number } | null {
  const v = useSyncExternalStore(subscribeResize, viewportSnapshot, () => null);
  if (!v) return null;
  const [W, H] = v.split("x").map(Number);
  return { W, H };
}

const noopSubscribe = () => () => {};
const todaySnapshot = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** Ngày hôm nay theo giờ máy người dùng (00:00), null phía server. */
export function useToday(): Date | null {
  const v = useSyncExternalStore(noopSubscribe, todaySnapshot, () => null);
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Đồng hồ dùng chung, nhảy theo chu kỳ; giá trị được giữ nguyên giữa các lần đọc để useSyncExternalStore không render lặp. */
function tickingStore<T>(periodMs: number, read: () => T) {
  let value: T | undefined;
  return {
    subscribe(cb: () => void) {
      const id = window.setInterval(() => {
        value = read();
        cb();
      }, periodMs);
      return () => window.clearInterval(id);
    },
    snapshot(): T {
      if (value === undefined) value = read();
      return value;
    },
  };
}

const minuteClock = tickingStore(60e3, () => Date.now());

/** Thời điểm hiện tại (ms), cập nhật mỗi phút. serverNow là mốc server đã render, để HTML khớp lúc hydrate. */
export function useNow(serverNow: number): number {
  return useSyncExternalStore(minuteClock.subscribe, minuteClock.snapshot, () => serverNow);
}

/** Giờ thập phân trong ngày theo giờ máy (nowH). */
export const nowHours = () => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
};
const subscribeVisibility = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};

/** Tab đang ẩn: mọi vòng lặp chuyển động dừng lại. */
export function useDocumentHidden(): boolean {
  return useSyncExternalStore(subscribeVisibility, () => document.hidden, () => false);
}

const RM_QUERY ="(prefers-reduced-motion: reduce)";
const subscribeRm = (cb: () => void) => {
  const m = window.matchMedia(RM_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/** prefers-reduced-motion của hệ điều hành. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeRm, () => window.matchMedia(RM_QUERY).matches, () => false);
}
