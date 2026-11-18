/* Thao tác dùng chung cho cả prototype và app, để hai bên được đưa về cùng một trạng thái trước khi chụp/so. */
import { expect, type Page, type TestInfo } from "@playwright/test";

export type Target = "prototype" | "app";
export const targetOf = (info: TestInfo) => info.project.metadata.target as Target;

const W = 1440;
const H = 900;

/** Đếm thời gian theo đồng hồ thật (chuyển cảnh chạy bằng requestAnimationFrame, không tua được). */
export const wait = (page: Page, ms: number) => page.waitForTimeout(ms);

/**
 * Mở phòng: bỏ qua màn mở đầu, giờ cố định 18:00 qua bảng tuỳ chỉnh, đóng bảng, đưa parallax về 0 và chuột ra khỏi khung
 * (chuột ở giữa màn hình cho parallax = 0, rồi ra ngoài để không hover gì).
 */
export async function openRoom(page: Page, target: Target, path = "") {
  if (target === "app") {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem("gocHoc.introSeen", "1");
      } catch {
        /* chặn storage: vẫn bấm Bỏ qua bên dưới */
      }
    });
  }
  await page.goto(target === "prototype" ? "/goc-hoc" + path : "/" + path, { waitUntil: "networkidle" });
  if (await page.locator("#app.intro").count()) await page.locator("#skip").click();
  await expect(page.locator("#app")).not.toHaveClass(/\bintro\b/);
  await setTod(page, 18);
  await restMouse(page);
}

/** Đặt giờ trong ngày qua bảng tuỳ chỉnh (thanh trượt: đổi ngay, tắt "Theo giờ thật"). */
export async function setTod(page: Page, h: number) {
  await page.locator("#demoBtn").click();
  await page.locator("#tod").fill(String(h));
  await page.locator("#demoBtn").click();
  await expect(page.locator("#demo")).toBeHidden();
}

/** Chuột về giữa (parallax lắng về 0) rồi ra ngoài khung nhìn (bỏ hover). */
export async function restMouse(page: Page) {
  await page.mouse.move(W / 2, H / 2);
  await wait(page, 2500);
  await page.mouse.move(-10, H / 2);
  await wait(page, 600);
}

/**
 * Một điểm trên màn hình bấm trúng đúng nhóm vùng bấm của đồ vật key ("window" = cửa sổ, nhóm đứng đầu #hotHit).
 * Dò lưới trong hộp bao, chọn điểm trúng gần tâm nhất (tâm hộp bao có thể rơi vào đồ vật khác nằm trên).
 */
export async function objectCenter(page: Page, key: string) {
  const pt = await page.evaluate((key) => {
    const g =
      key === "window"
        ? document.querySelector("#hotHit > g")
        : document.querySelector(`#hotHit polygon[data-k="${key}"]`)?.parentElement;
    if (!g) return null;
    const b = g.getBoundingClientRect();
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    let best: { x: number; y: number; d: number } | null = null;
    for (let i = 1; i < 24; i++)
      for (let j = 1; j < 24; j++) {
        const x = b.x + (b.width * i) / 24;
        const y = b.y + (b.height * j) / 24;
        const el = document.elementFromPoint(x, y);
        if (!el || !g.contains(el)) continue;
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (!best || d < best.d) best = { x, y, d };
      }
    return best && { x: Math.round(best.x), y: Math.round(best.y) };
  }, key);
  if (!pt) throw new Error(`không bấm trúng được ${key}`);
  return pt;
}

export async function clickObject(page: Page, key: string) {
  const c = await objectCenter(page, key);
  await page.mouse.click(c.x, c.y);
}

export async function hoverObject(page: Page, key: string) {
  const c = await objectCenter(page, key);
  await page.mouse.move(c.x, c.y);
}

/** App: chờ engine về trạng thái (room | page | peek). Prototype không có cờ này nên chờ theo thời gian. */
export async function settle(page: Page, target: Target, scene: "room" | "page" | "peek", protoMs: number) {
  if (target === "app") {
    await expect(page.locator("#app")).toHaveAttribute("data-scene", scene, { timeout: 15_000 });
    // hiệu ứng cuối của trang (thanh trên hiện dần, các dòng hiện lần lượt…) không chặn engine
    await wait(page, 2500);
  } else {
    await wait(page, protoMs);
  }
}
