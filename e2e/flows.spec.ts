/* Test luồng trên app (project "prototype" chỉ chạy visual.spec): vào/thoát trang bằng đồ vật và menu, đổi tab, Esc,
   back/forward trình duyệt, sách khoá, ghi chú thứ 5. */
import { expect, test, type Page } from "@playwright/test";
import { clickObject, openRoom, targetOf } from "./helpers";

const app = (page: Page) => page.locator("#app");

async function expectRoom(page: Page) {
  await expect(app(page)).toHaveAttribute("data-scene", "room", { timeout: 15_000 });
  expect(new URL(page.url()).search).toBe("");
  await expect(page.locator("#topbar")).toHaveCount(0);
}

async function expectPage(page: Page, route: string, query: Record<string, string> = {}) {
  await expect(app(page)).toHaveAttribute("data-scene", "page", { timeout: 15_000 });
  const sp = new URL(page.url()).searchParams;
  expect(sp.get("p")).toBe(route);
  for (const [k, v] of Object.entries(query)) expect(sp.get(k)).toBe(v);
  await expect(page.locator(`#topbar .tab[aria-current="page"]`)).toHaveAttribute("data-tab", route);
}

const liveNotes = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("#notes .snote")]
      .filter((e) => getComputedStyle(e).pointerEvents !== "none")
      .map((e) => e.innerText.replace(/\n/g, " | ")),
  );

test.beforeEach(async ({ page }, info) => {
  await openRoom(page, targetOf(info));
  await expectRoom(page);
});

test.describe("vào và thoát bằng đồ vật", () => {
  const CASES: { key: string; route: string; query?: Record<string, string> }[] = [
    { key: "laptop", route: "learn" },
    { key: "corkboard", route: "roadmap" },
    { key: "notebook", route: "practice" },
    { key: "cupTop", route: "achievements" },
    { key: "medalHang", route: "achievements" },
    { key: "phone", route: "phone", query: { tab: "me" } },
    { key: "book3", route: "learn", query: { shelf: "0", lesson: "3" } },
  ];
  for (const C of CASES)
    test(`${C.key} → ${C.route}, thoát bằng nút Góc học`, async ({ page }) => {
      await clickObject(page, C.key);
      await expectPage(page, C.route, C.query);
      await page.locator("#backBtn").click();
      await expectRoom(page);
    });
});

// Sách Python: bài học là cảnh motion toàn màn hình, mở ngay sau khi sách bay ra; thoát bằng nút "Góc học" trong cảnh.
test("pb0 → learn (cảnh motion Python), thoát bằng nút Góc học trong cảnh", async ({ page }) => {
  await clickObject(page, "pb0");
  await expectPage(page, "learn", { shelf: "1", lesson: "0" });
  const runner = page.getByTestId("step-runner");
  await expect(runner).toBeVisible();
  await runner.getByRole("button", { name: /Góc học/ }).click();
  await expectRoom(page);
});

test.describe("vào và thoát bằng menu", () => {
  const CASES: { sel: string; route: string; query?: Record<string, string> }[] = [
    { sel: "#side .hero", route: "learn" },
    { sel: '#side .mi[data-go="roadmap"]', route: "roadmap" },
    { sel: '#side .mi[data-go="courses"]', route: "courses" },
    { sel: '#side .mi[data-go="practice"]', route: "practice" },
    { sel: '#side .mi[data-go="achievements"]', route: "achievements" },
    { sel: '#side .mi[data-go="phone"]', route: "phone", query: { tab: "rank" } },
    { sel: '#side .event [data-go="practice"]', route: "practice" },
    { sel: "#profile", route: "phone", query: { tab: "me" } },
  ];
  for (const C of CASES)
    test(`${C.sel} → ${C.route}, thoát bằng Esc`, async ({ page }) => {
      await page.locator(C.sel).click();
      await expectPage(page, C.route, C.query);
      await page.keyboard.press("Escape");
      await expectRoom(page);
    });
});

test("đổi tab trên thanh trên, đổi tab trong điện thoại, rồi về phòng", async ({ page }) => {
  await page.locator("#side .hero").click();
  await expectPage(page, "learn");
  for (const r of ["roadmap", "courses", "practice", "achievements", "phone", "learn"]) {
    await page.locator(`#topbar .tab[data-tab="${r}"]`).click();
    await expectPage(page, r);
  }
  await page.locator(`#topbar .tab[data-tab="phone"]`).click();
  await expectPage(page, "phone");
  await page.locator('[data-pt="rank"]').click();
  await expect(page.locator('[data-pt="rank"]')).toHaveAttribute("aria-selected", "true");
  expect(new URL(page.url()).searchParams.get("tab")).toBe("rank");
  // đổi tab dùng replaceState: một lần back là về phòng
  await page.goBack();
  await expectRoom(page);
});

test("Khóa học: bấm sách mở bài, sách khoá báo toast", async ({ page }) => {
  await page.locator('#side .mi[data-go="courses"]').click();
  await expectPage(page, "courses");
  await page.locator(".bk.lock").first().click();
  await expect(page.locator("#toast")).toHaveClass(/\bon\b/);
  await expect(page.locator("#toast")).toContainText("để mở");
  await expectPage(page, "courses");
  await page.locator(".bk.cur").first().click();
  await expectPage(page, "learn");
});

test("Esc: thoát trang, đóng lịch đang xem, Esc giữa chuyển cảnh không kẹt", async ({ page }) => {
  await clickObject(page, "calendar");
  await expect(app(page)).toHaveAttribute("data-scene", "peek", { timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(app(page)).toHaveAttribute("data-scene", "room", { timeout: 15_000 });

  await clickObject(page, "laptop");
  await expect(app(page)).toHaveAttribute("data-scene", "busy");
  await page.keyboard.press("Escape"); // đang zoom: làm ngay sau khi chuyển cảnh xong
  await expectRoom(page);
});

test("nút back / forward của trình duyệt", async ({ page }) => {
  await clickObject(page, "corkboard");
  await expectPage(page, "roadmap");
  await page.goBack();
  await expectRoom(page);
  await page.goForward();
  await expectPage(page, "roadmap");
  await page.locator(`#topbar .tab[data-tab="learn"]`).click();
  await expectPage(page, "learn");
  await page.goBack();
  await expectRoom(page);
});

test("bấm sách khoá trong phòng: toast, không đổi trang", async ({ page }) => {
  await clickObject(page, "book4");
  await expect(page.locator("#toast")).toHaveClass(/\bon\b/);
  await expect(page.locator("#toast")).toHaveText("C++: học xong Bài 4 để mở “Tam giác ngược”");
  await expectRoom(page);
  await expect(app(page)).toHaveAttribute("data-scene", "room");
});

test("thêm ghi chú thứ 5 thì tờ cũ nhất bị gỡ", async ({ page }) => {
  const demo = page.locator("#demo");
  const addNote = async () => {
    if (await demo.isHidden()) await page.locator("#demoBtn").click();
    await page.locator("#tNote").click();
  };
  // lúc vào có 2 tờ, hẹn giờ 5 giây có thể đã thêm tờ thứ 3; thêm tay cho đủ 4 (hẹn giờ 24 giây chỉ thêm khi còn dưới 4 tờ)
  expect((await liveNotes(page)).length).toBeGreaterThanOrEqual(2);
  while ((await liveNotes(page)).length < 4) {
    await addNote();
    await page.waitForTimeout(1300); // tờ mới bay vào xong
  }
  await expect.poll(() => liveNotes(page).then((n) => n.length)).toBe(4);
  const before = await liveNotes(page);
  await expect(page.locator("#badge")).toHaveText("4");

  await addNote();
  await expect.poll(() => liveNotes(page)).not.toEqual(before);
  const after = await liveNotes(page);
  expect(after).toHaveLength(4);
  expect(after).not.toContain(before[0]);
  expect(after.slice(0, 3)).toEqual(before.slice(1));
  // tờ bị bóc rơi xong thì rời DOM
  await expect(page.locator("#notes .snote")).toHaveCount(4, { timeout: 5_000 });
});
