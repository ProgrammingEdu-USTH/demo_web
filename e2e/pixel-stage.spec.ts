/* Nghiệm thu engine Pixel Stage (mục 9 của spec pe-pixel-motion-spec): chạy bằng `npm run test:pixel`. */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

type Act = Record<string, unknown>;
type Script = { id: string; world: string; code: string; steps: { line: number | number[]; caption: string; actions: Act[] }[] };
const WORLDS_DIR = "src/pixel-stage/worlds";
const SCRIPTS: Script[] = readdirSync(WORLDS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) => {
    const dir = `${WORLDS_DIR}/${d.name}/scripts`;
    try { return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as Script); }
    catch { return []; }
  });
const byId = (id: string): Script => {
  const s = SCRIPTS.find((x) => x.id === id);
  if (!s) throw new Error(`thiếu script ${id}`);
  return s;
};
const KITCHEN = byId("async-kitchen-01");
const allActions = (s: Script): Act[] => s.steps.flatMap((st) => st.actions);

type StageApi = {
  goTo(n: number): void; next(): void; prev(): void; still(t: number): string; setOverlay(on: boolean): void;
  state: { index: number; count: number; playing: boolean; settled: boolean; reduced: boolean; running: boolean; scale: number; world: string };
  sprite(name: string): { w: number; h: number; image: CanvasImageSource; frames: { x: number; y: number; w: number; h: number }[]; tags: Record<string, { from: number; to: number }> };
  replaceSprite(name: string, json: unknown, image: CanvasImageSource): void;
};
type W = Window & { __pixelStage: StageApi };

const linesOf = (l: number | number[]): number[] =>
  !Array.isArray(l) ? [l] : l.length === 2 ? Array.from({ length: l[1] - l[0] + 1 }, (_, i) => l[0] + i) : l;

async function open(page: Page, s: Script): Promise<void> {
  await page.goto("/pixel-stage");
  await page.waitForFunction(() => ((window as unknown as W).__pixelStage?.state.count ?? 0) > 0);
  await page.selectOption("#ps-script", s.id);
  await page.waitForFunction(
    ([world, n]) => { const st = (window as unknown as W).__pixelStage.state; return st.world === world && st.count === n; },
    [s.world, s.steps.length] as const,
  );
  await expect(page.getByTestId("caption")).toHaveText(s.steps[0].caption);
  await page.locator("canvas").click(); // bỏ focus khỏi ô chọn để phím tắt có tác dụng
}

const still = (page: Page, t = 1234) => page.evaluate((tt) => (window as unknown as W).__pixelStage.still(tt), t);

for (const s of SCRIPTS) {
  test(`1. deterministic: goTo(n) = bấm Next n lần = lùi Prev (${s.id})`, async ({ page }) => {
    await open(page, s);
    const direct: string[] = [];
    for (let n = 0; n < s.steps.length; n++) {
      await page.evaluate((k) => (window as unknown as W).__pixelStage.goTo(k), n);
      direct.push(await still(page));
    }
    expect(new Set(direct).size).toBe(direct.length); // mỗi step cho một hình khác nhau

    await open(page, s);
    const forward: string[] = [await still(page)];
    for (let n = 1; n < s.steps.length; n++) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout((n * 137) % 400); // bấm cả khi animation đang chạy dở
      forward.push(await still(page));
    }
    expect(forward).toEqual(direct);

    const back: string[] = [];
    for (let n = s.steps.length - 2; n >= 0; n--) {
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout((n * 89) % 300);
      back.unshift(await still(page));
    }
    expect(back).toEqual(direct.slice(0, -1));
  });
}

test("2. pixel sạch: scale nguyên, mỗi pixel logic là một khối màu đồng nhất, kể cả sau khi resize", async ({ page }) => {
  await open(page, KITCHEN);
  for (const vp of [{ width: 1440, height: 900 }, { width: 1013, height: 700 }, { width: 777, height: 640 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => {
      const st = (window as unknown as W).__pixelStage;
      st.goTo(7);
      st.still(500);
      const cv = document.querySelector("canvas") as HTMLCanvasElement;
      const s = st.state.scale;
      const ox = Math.floor((cv.width - 320 * s) / 2), oy = Math.floor((cv.height - 180 * s) / 2);
      const d = (cv.getContext("2d") as CanvasRenderingContext2D).getImageData(0, 0, cv.width, cv.height).data;
      let bad = 0;
      for (let ly = 0; ly < 180; ly += 3) for (let lx = 0; lx < 320; lx += 3) {
        const o0 = ((oy + ly * s) * cv.width + ox + lx * s) * 4;
        for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
          const o = ((oy + ly * s + j) * cv.width + ox + lx * s + i) * 4;
          if (d[o] !== d[o0] || d[o + 1] !== d[o0 + 1] || d[o + 2] !== d[o0 + 2]) { bad++; i = s; j = s; }
        }
      }
      const rect = cv.getBoundingClientRect();
      return { s, bad, w: cv.width, h: cv.height, cssW: rect.width * devicePixelRatio, rendering: getComputedStyle(cv).imageRendering };
    });
    expect(Number.isInteger(r.s) && r.s >= 1).toBe(true);
    expect(r.bad).toBe(0);
    expect(Math.abs(r.w - r.cssW)).toBeLessThanOrEqual(1); // canvas = đúng số điểm ảnh thiết bị, trình duyệt không nội suy lại
    expect(r.rendering).toBe("pixelated");
  }
});

test("3. token: không có màu hex / thời lượng ghi cứng ngoài tokens/", () => {
  const r = spawnSync(process.execPath, ["scripts/check-pixel-tokens.mjs"], { encoding: "utf8" });
  expect(r.status, r.stderr || r.stdout).toBe(0);
});

test("4. đồng bộ code: mỗi step highlight đúng dòng, caption là text thật ≤ 2 câu", async ({ page }) => {
  for (const s of SCRIPTS) {
    await open(page, s);
    const nLines = s.code.split("\n").length;
    for (let n = 0; n < s.steps.length; n++) {
      const step = s.steps[n];
      await page.evaluate((k) => (window as unknown as W).__pixelStage.goTo(k), n);
      await expect(page.getByTestId("caption")).toHaveText(step.caption);
      const on = await page.locator('[aria-current="true"][data-line]').evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-line"))));
      expect(on).toEqual([...linesOf(step.line)].sort((a, b) => a - b));
      expect(on.every((l) => l >= 1 && l <= nLines)).toBe(true);
      const sentences = step.caption.split(/[.!?](?=\s|$)/).filter((x) => x.trim()).length;
      expect(sentences, step.caption).toBeLessThanOrEqual(2);
    }
  }
});

test("5. hiệu năng: ~60 fps; render loop dừng khi tab ẩn", async ({ page }) => {
  await open(page, KITCHEN);
  await page.evaluate(() => (window as unknown as W).__pixelStage.goTo(4));
  const fps = await page.evaluate(() => new Promise<number>((res) => {
    let n = 0;
    const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res((n * 1000) / (performance.now() - t0)); };
    requestAnimationFrame(f);
  }));
  expect(fps).toBeGreaterThan(50);
  const ms = await page.evaluate(() => {
    const st = (window as unknown as W).__pixelStage;
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) st.still(i * 16);
    return (performance.now() - t0) / 60;
  });
  expect(ms, `một khung mất ${ms.toFixed(2)} ms`).toBeLessThan(8);

  const running = await page.evaluate(() => {
    const st = (window as unknown as W).__pixelStage;
    const set = (v: string) => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => v });
      document.dispatchEvent(new Event("visibilitychange"));
    };
    set("hidden");
    const hidden = st.state.running;
    set("visible");
    return { hidden, visible: st.state.running };
  });
  expect(running).toEqual({ hidden: false, visible: true });
});

test("6a. accessibility: phím ←/→/Space, canvas có aria-label, caption ngoài canvas", async ({ page }) => {
  await open(page, KITCHEN);
  const st = () => page.evaluate(() => (window as unknown as W).__pixelStage.state);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  expect((await st()).index).toBe(2);
  await page.keyboard.press("ArrowLeft");
  expect((await st()).index).toBe(1);
  await page.keyboard.press(" ");
  expect((await st()).playing).toBe(true);
  await page.keyboard.press(" ");
  expect((await st()).playing).toBe(false);
  // Space vẫn là Phát / Tạm dừng khi đang focus nút "Bước sau"
  await page.getByRole("button", { name: /Bước sau/ }).focus();
  await page.keyboard.press(" ");
  expect(await st()).toMatchObject({ index: 1, playing: true });
  await page.keyboard.press(" ");
  await expect(page.locator("canvas")).toHaveAttribute("aria-label", /bếp/i);
  await expect(page.locator("canvas")).toHaveAttribute("role", "img");
});

test("6b. reduced-motion: tới trạng thái cuối ngay, ambient đứng yên", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, KITCHEN);
  const r = await page.evaluate(() => {
    const st = (window as unknown as W).__pixelStage;
    st.goTo(5);
    const settled = st.state.settled;
    return { settled, reduced: st.state.reduced, a: st.still(0), b: st.still(7777) };
  });
  expect(r.reduced).toBe(true);
  expect(r.settled).toBe(true);
  expect(r.a).toBe(r.b);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(() => !(window as unknown as W).__pixelStage.state.reduced);
  const animating = await page.evaluate(() => { const st = (window as unknown as W).__pixelStage; st.goTo(5); return st.state.settled; });
  expect(animating).toBe(false);
});

/* 7. Đúng kiến thức: chạy code của từng script bằng Python thật rồi so với những gì cảnh "in" ra (bong bóng / nhãn). */
const python = (code: string) => spawnSync("python", ["-X", "utf8", "-c", code], { encoding: "utf8", timeout: 30_000 });
const pyLines = (code: string): string[] | null => {
  const r = python(code);
  return r.error || r.status !== 0 ? null : r.stdout.trim().split(/\r?\n/);
};
const hasPython = !python("print(1)").error;
/** Chữ trong bong bóng / nhãn của cảnh, theo thứ tự, chỉ giữ những dòng mà Python thật có in. */
const scenePrints = (s: Script, out: string[]) =>
  allActions(s).filter((a) => a.type === "say" || a.type === "label").map((a) => String(a.text)).filter((t) => out.includes(t));

test.describe("7. đúng kiến thức (so với Python thật)", () => {
  test.skip(!hasPython, "Không có Python trên máy");

  for (const id of ["async-kitchen-01", "async-kitchen-02", "bfs-city-01", "var-memory-01", "while-city-01", "func-kitchen-01", "review-kitchen-01", "dict-dungeon-01", "str-blank-01"]) {
    test(`thứ tự in khớp Python (${id})`, () => {
      const s = byId(id);
      const out = pyLines(s.code);
      expect(out).not.toBeNull();
      expect(scenePrints(s, out!)).toEqual(out);
    });
  }

  for (const id of ["if-dj-01", "branch-dj-01"]) {
    test(`thứ tự phát khớp Python (${id})`, () => {
      const s = byId(id);
      const out = pyLines(`phat = print\n${s.code}`);
      expect(out).not.toBeNull();
      expect(scenePrints(s, out!)).toEqual(out);
    });
  }

  test("nhập và xuất: input() trả về chuỗi, int() đổi sang số, print khớp cảnh (io-kitchen-01)", () => {
    const s = byId("io-kitchen-01");
    const r = spawnSync("python", ["-X", "utf8", "-c", s.code], { input: "Pizza\n2\n", encoding: "utf8", timeout: 30_000 });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("Bạn muốn ăn gì? Mấy phần? Đã nhận: 2 phần Pizza");
    const says = allActions(s).filter((a) => a.type === "say").map((a) => String(a.text));
    expect(says).toContain("Đã nhận: 2 phần Pizza");
  });

  test("gather: món về khay theo thứ tự gọi, không theo thứ tự xong", () => {
    const moves = allActions(KITCHEN).filter((a) => a.type === "move" && String(a.to).startsWith("tray."));
    expect(moves.map((a) => `${a.actor}->${a.to}`)).toEqual(["bread->tray.2", "pizza->tray.1"]);
  });

  test("DJ: thứ tự âm phát khớp vòng lặp có break", () => {
    const s = byId("loop-dj-01");
    const out = pyLines(`phat = print\n${s.code}`);
    const played = allActions(s).filter((a) => a.type === "say" && ["kick", "snare", "hat"].includes(String(a.actor))).map((a) => String(a.text));
    expect(played).toEqual(out);
    const sounds = allActions(s).filter((a) => a.type === "sound").map((a) => String(a.name));
    expect(sounds).toEqual(["kick", "snare", "kick", "hat", "kick", "kick"]);
  });

  test("threading: mỗi luồng in đúng thứ tự, khóa không cho hai người dùng chảo cùng lúc", () => {
    const s = byId("thread-kitchen-01");
    const out = pyLines(s.code);
    expect(out).not.toBeNull();
    const scene = scenePrints(s, out!);
    expect([...scene].sort()).toEqual([...out!].sort()); // thứ tự giữa hai luồng tuỳ hệ điều hành, nội dung phải đủ
    for (const ten of ["An", "Bình"]) {
      const mine = scene.filter((t) => t.startsWith(ten));
      expect(mine[0]).toContain("dùng chảo");
      expect(mine[1]).toContain("xong");
    }
    // trong cảnh: "Bình dùng chảo" chỉ xảy ra sau khi An đã trả khóa
    const lockSets = allActions(s).filter((a) => a.type === "set" && a.key === "lock").map((a) => a.value);
    expect(lockSets).toEqual(["An", "Bình", "free"]);
  });

  test("dungeon: s1 đổi trạng thái, s2 giữ nguyên", () => {
    const s = byId("oop-dungeon-01");
    const out = pyLines(`${s.code}\nprint(s1.trang_thai, s2.trang_thai, s1.mau, s2.ten)`);
    expect(out).toEqual(["duoi_theo tuan_tra 10 Slime"]);
    const fsm = allActions(s).filter((a) => a.type === "set" && a.key === "fsm").map((a) => a.value).pop();
    expect(fsm).toEqual({ s1: "duoi_theo", s2: "tuan_tra" });
  });

  test("bộ nhớ: hết reference thì giải phóng ngay, del chỉ gỡ nhãn", () => {
    const s = byId("ref-memory-01");
    const lines = s.code.split("\n");
    const code = [
      "class L(list):\n    def __del__(self): print('giai_phong')",
      lines[0].replace('["táo", "sữa"]', 'L(["táo", "sữa"])'), lines[1], lines[2], lines[3], "print('sau_del')", lines[4], "print('sau_None')",
    ].join("\n");
    expect(pyLines(code)).toEqual(["sau_del", "giai_phong", "sau_None"]);
    const last = s.steps[s.steps.length - 1];
    expect(last.caption).toMatch(/ngay/);
    expect(last.actions.some((a) => a.type === "despawn")).toBe(true);
  });

  test("bộ nhớ: vòng tham chiếu chỉ được dọn bởi gc.collect()", () => {
    const s = byId("gc-memory-02");
    const code = `import gc\ngc.disable()\n${s.code.replace("gc.collect()", "print(gc.collect() >= 2)")}`;
    expect(pyLines(code)).toEqual(["True"]);
  });

  test("caption không nói GC chạy định kỳ dọn mọi thứ", () => {
    for (const s of SCRIPTS) for (const st of s.steps) expect(st.caption).not.toMatch(/định kỳ/i);
  });
});

test("8. thay asset: spritesheet Aseprite cùng tên thay placeholder, script không đổi", async ({ page }) => {
  await open(page, KITCHEN);
  const r = await page.evaluate(() => {
    const st = (window as unknown as W).__pixelStage;
    st.goTo(7);
    const before = st.still(1000);
    const old = st.sprite("cook");
    const json = {
      frames: Object.fromEntries(old.frames.map((f, i) => [`cook ${i}.aseprite`, { frame: f }])),
      meta: { frameTags: Object.entries(old.tags).map(([name, t]) => ({ name, ...t })) },
    };
    st.replaceSprite("cook", json, old.image);
    const same = st.still(1000);
    // sheet khác hình (lật ngang) vẫn chạy được cùng script
    const cv = document.createElement("canvas");
    cv.width = (old.image as HTMLCanvasElement).width;
    cv.height = (old.image as HTMLCanvasElement).height;
    const c = cv.getContext("2d") as CanvasRenderingContext2D;
    c.scale(1, -1);
    c.drawImage(old.image, 0, -cv.height);
    st.replaceSprite("cook", json, cv);
    const changed = st.still(1000);
    let wrongSize = "";
    try { st.replaceSprite("cook", { frames: { a: { frame: { x: 0, y: 0, w: 16, h: 16 } } }, meta: {} }, cv); } catch (e) { wrongSize = String(e); }
    return { before, same, changed, wrongSize };
  });
  expect(r.same).toBe(r.before);
  expect(r.changed).not.toBe(r.before);
  expect(r.wrongSize).toMatch(/kích thước/);
});

/* Phase 3: khóa Python trong trang Học tiếp — mỗi bài là một cảnh motion toàn màn hình. */
async function openLesson(page: Page, shelf: number, lesson: number) {
  await page.addInitScript(() => {
    try { sessionStorage.setItem("gocHoc.introSeen", "1"); } catch { /* bỏ qua */ }
  });
  await page.goto(`/?p=learn&shelf=${shelf}&lesson=${lesson}`, { waitUntil: "networkidle" });
  await expect(page.locator("#lesson")).toBeVisible();
}

/** Script của 11 bài Python, theo thứ tự bài (khớp PYTHON_STEP_SCRIPTS trong mock/lessons.ts). */
const PYTHON_LESSONS = [
  "var-memory-01", "io-kitchen-01", "if-dj-01", "branch-dj-01", "loop-dj-01", "while-city-01",
  "func-kitchen-01", "ref-memory-01", "dict-dungeon-01", "str-blank-01", "review-kitchen-01",
];

test("9. bài học: C++ giữ lý thuyết + editor; bài Python mở thẳng motion, không còn editor", async ({ page }) => {
  await openLesson(page, 0, 3); // C++ Tam giác sao: giữ nguyên như prototype
  await expect(page.locator("#run")).toBeVisible();
  await expect(page.getByTestId("step-runner")).toHaveCount(0);
  await openLesson(page, 1, 0);
  const runner = page.getByTestId("step-runner");
  await expect(runner).toBeVisible();
  await expect(runner).toHaveAttribute("aria-modal", "true");
  await expect(page.locator("#run")).toHaveCount(0);
  await expect(runner.getByTestId("caption")).toHaveText(byId(PYTHON_LESSONS[0]).steps[0].caption);
  await expect(runner.getByTestId("lesson-label")).toHaveText("Bài 1/11");
});

test("10. bài học: đi hết 11 bài Python bằng nút Bài sau, mỗi bài đúng script, chuyển cảnh pixelate", async ({ page }) => {
  test.setTimeout(120_000);
  await openLesson(page, 1, 0);
  const runner = page.getByTestId("step-runner");
  for (let i = 0; i < PYTHON_LESSONS.length; i++) {
    const sc = byId(PYTHON_LESSONS[i]);
    await expect(runner.getByTestId("caption")).toHaveText(sc.steps[0].caption);
    await expect(runner.getByTestId("lesson-label")).toHaveText(`Bài ${i + 1}/11`);
    await page.waitForFunction(([w, n]) => { const st = (window as unknown as W).__pixelStage.state; return st.world === w && st.count === n && st.mosaic === 1; }, [sc.world, sc.steps.length] as const);
    expect(new URL(page.url()).searchParams.get("lesson")).toBe(String(i));
    const next = runner.getByRole("button", { name: /^Bài sau/ });
    if (i === PYTHON_LESSONS.length - 1) {
      await expect(next).toBeDisabled();
      break;
    }
    await next.click();
  }
  // lùi lại một bài
  await runner.getByRole("button", { name: /^Bài trước/ }).click();
  await expect(runner.getByTestId("caption")).toHaveText(byId(PYTHON_LESSONS[9]).steps[0].caption);
});

test("11. bài học: Esc và nút Góc học đều đóng cảnh và về phòng", async ({ page }) => {
  await openLesson(page, 1, 4);
  const runner = page.getByTestId("step-runner");
  await expect(runner.getByTestId("caption")).toHaveText(byId("loop-dj-01").steps[0].caption);
  await expect(page.locator("#app")).toHaveAttribute("inert", "");
  await page.keyboard.press("ArrowRight");
  await expect(runner.getByTestId("caption")).toHaveText(byId("loop-dj-01").steps[1].caption);
  await page.keyboard.press("Escape");
  await expect(runner).toHaveCount(0);
  await expect(page.locator("#lesson")).toHaveCount(0);
  await expect(page.locator("#app")).not.toHaveAttribute("inert", "");

  await openLesson(page, 1, 8);
  await expect(runner.getByTestId("caption")).toHaveText(byId("dict-dungeon-01").steps[0].caption);
  await runner.getByRole("button", { name: /Góc học/ }).click();
  await expect(runner).toHaveCount(0);
  await expect(page.locator("#lesson")).toHaveCount(0);
});

/* Phase 4: nạp spritesheet Aseprite thật qua danh mục asset, script không đổi. */
type AssetApi = StageApi & {
  useAssets(map: Record<string, string>): void;
  reload(): Promise<void>;
  assets(): Record<string, { source: string; url?: string; problems?: string[] }>;
};

test("12. asset thật: nạp sheet Aseprite cho cả thế giới, hình khớp từng pixel với placeholder", async ({ page }) => {
  await open(page, KITCHEN);
  const sprites = ["bit-chef", "cook", "binh", "pan", "ticket", "pizza", "bread"];
  const fetched: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/pixel-stage/sprites/kitchen/")) fetched.push(new URL(r.url()).pathname); });
  const r = await page.evaluate(async (names) => {
    const st = (window as unknown as { __pixelStage: AssetApi }).__pixelStage;
    st.goTo(7);
    const before = st.still(1000);
    st.useAssets(Object.fromEntries(names.map((n) => [`kitchen/${n}`, `/pixel-stage/sprites/kitchen/${n}.json`])));
    await st.reload();
    st.goTo(7);
    return { before, after: st.still(1000), status: st.assets(), index: st.state.index };
  }, sprites);
  expect(r.index).toBe(7);
  for (const n of sprites) expect(r.status[n].source, n).toBe("asset");
  expect(r.after).toBe(r.before);
  expect(fetched).toEqual(expect.arrayContaining(sprites.flatMap((n) => [`/pixel-stage/sprites/kitchen/${n}.json`, `/pixel-stage/sprites/kitchen/${n}.png`])));
});

test("13. asset thật: sheet sai hợp đồng hoặc không tải được thì giữ placeholder, cảnh vẫn chạy", async ({ page }) => {
  await open(page, KITCHEN);
  const warnings: string[] = [];
  page.on("console", (m) => { if (m.type() === "warning") warnings.push(m.text()); });
  const r = await page.evaluate(async () => {
    const st = (window as unknown as { __pixelStage: AssetApi }).__pixelStage;
    st.goTo(7);
    const before = st.still(1000);
    st.useAssets({
      "kitchen/cook": "/pixel-stage/sprites/kitchen/bread.json", // 16×16, thiếu tag nhân vật
      "kitchen/pizza": "/pixel-stage/sprites/kitchen/khong-co.json", // 404
    });
    await st.reload();
    st.goTo(7);
    return { before, after: st.still(1000), status: st.assets() };
  });
  expect(r.status.cook.source).toBe("failed");
  expect(r.status.cook.problems?.join(" ")).toMatch(/32×32/);
  expect(r.status.pizza.source).toBe("failed");
  expect(r.status.bread.source).toBe("placeholder");
  expect(r.after).toBe(r.before);
  expect(warnings.some((w) => w.includes("kitchen/cook"))).toBe(true);
});

test("14. màn toàn cảnh: canvas phủ khung, viền thừa kéo dài mép cảnh, dòng code hiện khi tương tác, nút Chạy góc phải", async ({ page }) => {
  await page.goto("/pixel-stage");
  await page.waitForFunction(() => ((window as unknown as W).__pixelStage?.state.count ?? 0) > 0);
  await page.selectOption("#ps-script", KITCHEN.id);
  await page.waitForFunction((n) => (window as unknown as W).__pixelStage.state.count === n, KITCHEN.steps.length);

  // canvas phủ toàn viewport
  const vp = page.viewportSize()!;
  const box = (await page.locator("canvas").boundingBox())!;
  expect(box).toMatchObject({ x: 0, y: 0, width: vp.width, height: vp.height });

  // phần thừa ngoài khung 320×180 không còn là màu nền ink đặc (đã kéo dài mép cảnh)
  const edge = await page.evaluate(() => {
    const st = (window as unknown as W).__pixelStage;
    st.still(0);
    const cv = document.querySelector("canvas") as HTMLCanvasElement;
    const s = st.state.scale, ox = Math.floor((cv.width - 320 * s) / 2), oy = Math.floor((cv.height - 180 * s) / 2);
    const ctx = cv.getContext("2d") as CanvasRenderingContext2D;
    const px = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3));
    // một điểm trong vùng thừa (trái hoặc trên) và điểm mép cảnh liền kề
    return ox > 0
      ? { bar: px(ox - 1, oy + 90 * s), scene: px(ox, oy + 90 * s), ink: [0x1b, 0x16, 0x26] }
      : oy > 0 ? { bar: px(ox + 160 * s, oy - 1), scene: px(ox + 160 * s, oy), ink: [0x1b, 0x16, 0x26] } : null;
  });
  if (edge) expect(edge.bar).not.toEqual(edge.ink);

  // chưa tương tác: chỉ có gợi ý, chưa có dòng code
  await expect(page.getByTestId("code-hint")).toBeVisible();
  await expect(page.getByTestId("code-line")).toHaveCount(0);

  // nút Chạy nằm góc phải trên
  const run = page.getByTestId("run");
  const rb = (await run.boundingBox())!;
  expect(rb.x + rb.width).toBeGreaterThan(vp.width * 0.8);
  expect(rb.y).toBeLessThan(vp.height * 0.15);

  // tương tác (→): dòng code của bước hiện ra phía trên, đúng dòng của script
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowRight");
  const line = page.getByTestId("code-line");
  await expect(line).toBeVisible();
  await expect(line).toHaveAttribute("data-lines", linesOf(KITCHEN.steps[1].line).join(","));
  const first = KITCHEN.code.split("\n")[linesOf(KITCHEN.steps[1].line)[0] - 1].trim();
  await expect(line).toContainText(first);
  const lb = (await line.boundingBox())!;
  expect(lb.y).toBeLessThan(vp.height * 0.15);

  // Chạy: tự sang bước sau, dòng code đổi theo; bấm lần nữa thì tạm dừng
  await run.click();
  await expect(run).toHaveAttribute("aria-pressed", "true");
  await page.waitForFunction(() => (window as unknown as W).__pixelStage.state.index >= 2, null, { timeout: 15_000 });
  await run.click();
  await expect(run).toHaveAttribute("aria-pressed", "false");
  const idx = await page.evaluate(() => (window as unknown as W).__pixelStage.state.index);
  await expect(line).toHaveAttribute("data-lines", linesOf(KITCHEN.steps[idx].line).join(","));

  // bấm vào dòng code mở toàn bộ code, Esc đóng
  await line.click();
  await expect(page.locator("#ps-code-drawer")).toHaveAttribute("data-open", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator("#ps-code-drawer")).toHaveAttribute("data-open", "false");
});
