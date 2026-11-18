/* Test đối chiếu app với prototype (Playwright).
   - Project "prototype": chụp ảnh mẫu từ prototype gốc  → npm run test:e2e:baseline
   - Project "app": so ảnh của app với ảnh mẫu đó + test luồng → npm run test:e2e
   Hai project dùng chung thư mục ảnh mẫu (snapshotPathTemplate không có tên project), nên ảnh diff là "app so với prototype".
   Dùng Chrome cài sẵn trên máy (channel "chrome"); máy không có Chrome thì chạy `npx playwright install chromium` và đặt PW_CHANNEL=chromium. */
import { defineConfig } from "@playwright/test";

const APP_PORT = 3100;
const PROTO_PORT = 5050;

const SHOT = {
  threshold: 0.2,
  animations: "disabled",
  caret: "hide",
  stylePath: "e2e/hide-dynamic.css",
} as const;

export default defineConfig({
  testDir: "e2e",
  // chuyển cảnh dài vài giây, mỗi test mở một trang mới
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      // bỏ qua khác biệt khử răng cưa nhỏ; cho phép lệch tối đa 1,5% số điểm ảnh
      ...SHOT,
      maxDiffPixelRatio: 0.015,
    },
  },
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFileName}/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    channel: process.env.PW_CHANNEL ?? "chrome",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "prototype",
      testMatch: /visual\.spec\.ts/,
      use: { baseURL: `http://localhost:${PROTO_PORT}` },
      metadata: { target: "prototype" },
    },
    {
      name: "app",
      testIgnore: /pixel-stage\.spec\.ts/,
      use: { baseURL: `http://localhost:${APP_PORT}` },
      metadata: { target: "app" },
    },
    {
      // như "app" nhưng không cho lệch điểm ảnh nào: xuất ảnh diff của mọi chỗ lệch để rà (npm run test:e2e:diff)
      name: "app-diff",
      testMatch: /visual\.spec\.ts/,
      use: { baseURL: `http://localhost:${APP_PORT}` },
      metadata: { target: "app" },
      expect: { toHaveScreenshot: { ...SHOT, maxDiffPixelRatio: 0 } },
    },
    {
      // engine Pixel Stage (spec pe-pixel-motion-spec, mục 9): npm run test:pixel
      name: "pixel",
      testMatch: /pixel-stage\.spec\.ts/,
      use: { baseURL: `http://localhost:${APP_PORT}` },
    },
  ],
  webServer: [
    {
      command: `npm run build && npm start -- -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      command: `npx serve handoff/reference/prototype -l ${PROTO_PORT} --no-request-logging`,
      url: `http://localhost:${PROTO_PORT}/goc-hoc`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
