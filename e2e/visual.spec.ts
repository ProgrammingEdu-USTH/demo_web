/* So ảnh app với prototype. Ảnh mẫu chụp từ prototype (project "prototype"), project "app" so với cùng ảnh đó. */
import { expect, test, type Page } from "@playwright/test";
import { clickObject, hoverObject, openRoom, restMouse, settle, targetOf, wait, type Target } from "./helpers";

// phần động (mây, laptop gõ code, giấy note…) được ẩn bằng e2e/hide-dynamic.css (stylePath trong config)
const shot = (page: Page, name: string) => expect(page).toHaveScreenshot(name);

test.describe("so ảnh với prototype", () => {
  let target: Target;
  test.beforeEach(async ({ page }, info) => {
    target = targetOf(info);
    await openRoom(page, target);
  });

  test("màn chính", async ({ page }) => {
    await shot(page, "room.png");
  });

  test("hover một cuốn sách", async ({ page }) => {
    // sách bài 4 (đang học): sách nhô ra, viền sáng, nhãn, mục menu Khóa học sáng
    await hoverObject(page, "book3");
    await wait(page, 2500); // parallax theo chuột lắng hẳn
    await shot(page, "hover-book.png");
  });

  test("cửa sổ mở", async ({ page }) => {
    await clickObject(page, "window");
    await restMouse(page);
    await wait(page, 1500); // cánh cửa mở xong
    await shot(page, "window-open.png");
  });

  test("lịch đang zoom", async ({ page }) => {
    await clickObject(page, "calendar");
    await page.mouse.move(-10, 450);
    await settle(page, target, "peek", 3000);
    await shot(page, "calendar-peek.png");
  });

  const PAGES: { name: string; open: (page: Page) => Promise<void> }[] = [
    { name: "learn", open: (p) => p.locator("#side .hero").click() },
    { name: "roadmap", open: (p) => p.locator('#side .mi[data-go="roadmap"]').click() },
    { name: "courses", open: (p) => p.locator('#side .mi[data-go="courses"]').click() },
    { name: "practice", open: (p) => p.locator('#side .mi[data-go="practice"]').click() },
    { name: "achievements", open: (p) => p.locator('#side .mi[data-go="achievements"]').click() },
    { name: "phone", open: (p) => p.locator("#profile").click() },
  ];
  for (const P of PAGES)
    test(`trang ${P.name}`, async ({ page }) => {
      await P.open(page);
      await page.mouse.move(-10, 450);
      await settle(page, target, "page", 6000);
      await shot(page, `page-${P.name}.png`);
    });
});
