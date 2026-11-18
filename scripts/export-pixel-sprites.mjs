// Xuất mọi sprite placeholder của Pixel Stage ra spritesheet định dạng Aseprite (PNG + JSON "hash", có frameTags)
// vào public/pixel-stage/sprites/<thế-giới>/<tên>.{png,json}. Đây là bộ mẫu đúng khung + tag cho người vẽ,
// và cũng là dữ liệu để test đường nạp asset thật.
//
//   npm run dev                       (hoặc npm start)
//   npm run export:pixel-sprites -- http://localhost:3000
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = "public/pixel-stage/sprites";
const FRAME_MS = 100; // spriteFps = 10 (tokens/motion.ts)

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "chrome" });
const page = await browser.newPage();
await page.goto(`${BASE}/pixel-stage`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.waitForFunction(() => (window.__pixelStage?.state.count ?? 0) > 0, null, { timeout: 120_000 });

const options = await page.$$eval("#ps-script option", (os) => os.map((o) => o.value));
const done = new Set();
let count = 0;
for (const id of options) {
  await page.selectOption("#ps-script", id);
  await page.waitForTimeout(400);
  const world = await page.evaluate(() => window.__pixelStage.state.world);
  if (done.has(world)) continue;
  done.add(world);
  const sheets = await page.evaluate(() => {
    const st = window.__pixelStage;
    return Object.keys(st.world.sprites).map((name) => {
      const s = st.sprite(name);
      const img = s.image;
      const cv = document.createElement("canvas");
      cv.width = img.width;
      cv.height = img.height;
      cv.getContext("2d").drawImage(img, 0, 0);
      return { name, w: s.w, h: s.h, frames: s.frames, tags: s.tags, size: { w: img.width, h: img.height }, png: cv.toDataURL("image/png").split(",")[1] };
    });
  });
  const dir = join(OUT, world);
  mkdirSync(dir, { recursive: true });
  for (const s of sheets) {
    const frames = {};
    s.frames.forEach((f, i) => {
      frames[`${s.name} ${i}.aseprite`] = {
        frame: f, rotated: false, trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: s.w, h: s.h }, sourceSize: { w: s.w, h: s.h }, duration: FRAME_MS,
      };
    });
    const json = {
      frames,
      meta: {
        app: "pixel-stage (mẫu từ placeholder)", version: "1",
        image: `${s.name}.png`, format: "RGBA8888", size: s.size, scale: "1",
        frameTags: Object.entries(s.tags).map(([name, t]) => ({ name, from: t.from, to: t.to, direction: "forward" })),
        layers: [], slices: [],
      },
    };
    writeFileSync(join(dir, `${s.name}.png`), Buffer.from(s.png, "base64"));
    writeFileSync(join(dir, `${s.name}.json`), JSON.stringify(json, null, 1) + "\n");
    count++;
  }
  console.log(`${world}: ${sheets.map((s) => `${s.name} ${s.w}×${s.h}`).join(", ")}`);
}
await browser.close();
console.log(`Đã xuất ${count} spritesheet vào ${OUT}`);
