// E2E khoá Python Advanced (studio-lesson/v2): đi hết từng bài như học viên —
// nối cặp, đúng/sai, theo dõi biến, điền code, ghép code rồi CHẠY THẬT bằng
// Pyodide, săn lỗi, sửa code, nộp sandbox — tới màn tổng kết và hộp thành tích.
//
// Không cần backend hay DB: mọi request tới API được giả lập bằng page.route,
// nội dung bài đọc thẳng từ scripts/pe-v3/out-advanced (build_advanced.py).
// Pyodide vẫn tải từ CDN thật, nên cần mạng.
//
//   cd frontend && npm run dev
//   cd frontend && npx playwright test -c e2e/playwright.config.ts python-advanced
// Máy chưa tải trình duyệt của Playwright thì dùng Edge/Chrome đã cài:
//   PW_CHANNEL=msedge npx playwright test -c e2e/playwright.config.ts python-advanced
import { readFileSync } from 'fs';
import { join } from 'path';
import { expect, test, type Page, type Route } from '@playwright/test';

import type { PlayGame, StudioLesson } from '../src/lib/studio-lesson';

// Frontend gọi backend qua proxy cùng origin /backend (src/proxy.ts).
const API = process.env.E2E_API_URL || 'http://localhost:3000/backend';
const BUNDLE = join(__dirname, '..', '..', 'scripts', 'pe-v3', 'out-advanced', 'lessons.json');
const SHOTS = process.env.E2E_SHOTS;

type Row = { lesson_code: string; sort_order: number; title: string; xp_reward: number; content_json: StudioLesson };
const rows: Row[] = JSON.parse(readFileSync(BUNDLE, 'utf8')).lessons;
/** Giáo trình khoá `python` cũ (studio-lesson/v1) — để kiểm tra không bị ảnh hưởng. */
const v1Rows: Row[] = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'scripts', 'pe-v3', 'out', 'lessons.json'), 'utf8'),
).lessons;

if (process.env.PW_CHANNEL) test.use({ channel: process.env.PW_CHANNEL });
test.use({ viewport: { width: 1280, height: 900 } });

const completions: { lessonNo: number; body: Record<string, unknown> }[] = [];
const consoleErrors: string[] = [];

async function mockApi(page: Page) {
  const json = (route: Route, body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': 'http://localhost:3000', 'Access-Control-Allow-Credentials': 'true' },
      body: JSON.stringify(body),
    });
  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    // Đường dẫn backend sau khi bỏ tiền tố proxy /backend.
    Object.defineProperty(url, 'pathname', { value: url.pathname.replace(/^\/backend/, '') });
    if (req.method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:3000',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Headers': 'authorization,content-type',
          'Access-Control-Allow-Methods': 'GET,POST',
        },
      });
    if (url.pathname === '/api/user') return json(route, { id: 7, name: 'Học viên E2E', xp: 0, role: 'student' });
    if (url.pathname === '/api/enrolled')
      return json(route, {
        ok: true,
        enrolled: [
          { id: 'python_advanced', courseId: 'python_advanced', totalLessons: rows.length },
          { id: 'python', courseId: 'python', totalLessons: v1Rows.length },
        ],
      });
    if (url.pathname === '/api/stats') return json(route, { streak: 4 });
    const content = /^\/api\/courses\/(python_advanced|python)\/lessons\/(\d+)\/content$/.exec(url.pathname);
    if (content) {
      const row = (content[1] === 'python' ? v1Rows : rows)[Number(content[2]) - 1];
      return json(route, { ok: true, completed: false, lesson: { title: row.title, xpReward: row.xp_reward, contentJson: row.content_json } });
    }
    const done = /^\/api\/lessons\/(\d+)\/complete$/.exec(url.pathname);
    if (done) {
      completions.push({ lessonNo: Number(done[1]), body: req.postDataJSON() });
      return json(route, {
        ok: true,
        xpGained: 15,
        alreadyCompleted: false,
        newAchievements: [{ name: 'Thợ săn bug', icon: '🐞', description: 'Hoàn thành bài có game săn lỗi.' }],
      });
    }
    return json(route, { ok: true });
  });
}

async function primary(page: Page) {
  return page.locator('[data-cta="primary"]');
}

async function clickPrimary(page: Page, label: RegExp | string) {
  const btn = await primary(page);
  await expect(btn).toHaveText(label, { timeout: 120_000 });
  await expect(btn).toBeEnabled({ timeout: 120_000 });
  await btn.click();
}

/** Kiểm tra → (phải đúng) → Tiếp tục. */
async function checkAndNext(page: Page, checkLabel: RegExp | string = 'Kiểm tra') {
  await clickPrimary(page, checkLabel);
  await clickPrimary(page, /Tiếp tục/);
}

async function shot(page: Page, name: string) {
  // Mọi màn phải vừa bề ngang màn hình (điện thoại 390px): không cuộn ngang.
  const overflow = await page.evaluate(() => {
    // Đo cả body: body có overflow-x: hidden thì scrollWidth của
    // documentElement không lộ ra phần bị cắt.
    const vw = document.documentElement.clientWidth;
    const widest = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    // Ghi kèm phần tử hẹp nhất còn rộng hơn cột nội dung để dễ tìm thủ phạm.
    let culprit = '';
    let narrowest = Infinity;
    if (widest > vw)
      for (const el of document.querySelectorAll('main *')) {
        const r = el.getBoundingClientRect();
        if (r.width > vw - 32 && r.width < narrowest) {
          narrowest = r.width;
          culprit = `<${el.tagName.toLowerCase()} class="${el.className}">`;
        }
      }
    return { px: widest - vw, culprit };
  });
  expect(overflow.px, `${name}: tràn ngang ${overflow.px}px — ${overflow.culprit}`).toBeLessThanOrEqual(0);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function playGame(page: Page, row: Row, g: PlayGame) {
  const lesson = row.content_json;
  await shot(page, `${row.lesson_code}-${g.type}`);
  switch (g.type) {
    case 'match':
      for (const p of g.pairs) {
        await page.getByRole('button', { name: p.left, exact: true }).click();
        await page.getByRole('button', { name: p.right, exact: true }).click();
      }
      return checkAndNext(page);
    case 'trueFalse': {
      const items = page.locator('ol > li');
      for (let i = 0; i < g.items.length; i++)
        await items.nth(i).getByRole('button', { name: g.items[i].answer ? /Đúng/ : /Sai/ }).click();
      return checkAndNext(page);
    }
    case 'traceTable':
      for (const [key, value] of Object.entries(g.answers)) {
        const [r, col] = key.split('-');
        await page.getByLabel(`${g.rows[Number(r)].step} - ${col}`).fill(value.replace(/^'(.*)'$/, '$1'));
      }
      return checkAndNext(page);
    case 'fill': {
      const scaffold = lesson.step_3!.scaffold!;
      const order = [...scaffold.template.matchAll(/\{\{\s*slot(\d+)\s*\}\}/g)].map((m) => Number(m[1]));
      for (const n of order) {
        const answer = scaffold.slots.find((s) => s.n === n)!.answer;
        await page.getByRole('button', { name: answer, exact: true }).first().click();
        await page.getByRole('button', { name: 'thả vào đây' }).first().click();
      }
      return checkAndNext(page);
    }
    case 'parsons': {
      if (g.distractors.length) {
        // Bấm nhầm dòng bẫy: bị chặn, hiện lý do.
        await page.getByRole('button', { name: g.distractors[0].text.trim(), exact: true }).click();
        await expect(page.getByText(/Bẫy! Dòng này sai vì/)).toBeVisible();
      }
      for (const line of g.lines)
        await page.getByRole('button', { name: line.text.trim(), exact: true }).first().click();
      await shot(page, `${row.lesson_code}-parsons-built`);
      await clickPrimary(page, '▶ Chạy & kiểm tra');
      await expect(page.getByText('▶ Code chạy đúng!')).toBeVisible({ timeout: 120_000 });
      await shot(page, `${row.lesson_code}-parsons-ran`);
      return clickPrimary(page, /Tiếp tục/);
    }
    case 'spotError': {
      const line = g.code.split('\n')[g.line - g.firstLine];
      await page.getByRole('button', { name: new RegExp(esc(line.trim())) }).first().click();
      await clickPrimary(page, 'Kiểm tra');
      await expect(page.getByText(/Chuẩn:/)).toBeVisible();
      return clickPrimary(page, /Tiếp tục/);
    }
    case 'debug':
      await page.getByLabel('Trình soạn mã Python').fill(lesson.step_4!.solutionCode!);
      await clickPrimary(page, '▶ Chạy & kiểm tra');
      await expect(page.getByText('▶ Code chạy đúng!')).toBeVisible({ timeout: 120_000 });
      return clickPrimary(page, /Tiếp tục/);
    case 'selfExplain':
      await page
        .getByLabel('Lời giải thích của bạn')
        .fill('Thread nhận hàm compile làm target nên chỉ chạy khi start được gọi chứ không chạy ngay lúc tạo.');
      return checkAndNext(page);
  }
}

async function playLesson(page: Page, code: string) {
  const index = rows.findIndex((r) => r.lesson_code === code);
  const row = rows[index];
  const lesson = row.content_json;
  const play = lesson.play!;
  await page.goto(`/lesson/python_advanced?lesson=${index}`);
  await expect(page.getByLabel(/điểm$/)).toBeVisible({ timeout: 60_000 });

  // brief
  await shot(page, `${code}-brief`);
  await clickPrimary(page, /Tiếp tục/);
  if (!play.boss) {
    await shot(page, `${code}-explain`);
    await clickPrimary(page, /Tiếp tục/); // giải thích
    const options = lesson.step_1!.predict!.options;
    const right = options.findIndex((o) => o.correct);
    // Lời giải thích của từng phương án lộ đáp án: chỉ được hiện SAU khi kiểm tra.
    const wrongDetail = options.find((o) => !o.correct && o.detail)?.detail;
    if (wrongDetail) await expect(page.getByText(wrongDetail, { exact: true })).toHaveCount(0);
    await page.locator('button[aria-pressed]').nth(right).click();
    await clickPrimary(page, 'Kiểm tra');
    if (wrongDetail) await expect(page.getByText(wrongDetail, { exact: true })).toBeVisible();
    await clickPrimary(page, /Tiếp tục/);
  }
  for (const g of play.games) await playGame(page, row, g);

  // sandbox
  await shot(page, `${code}-sandbox`);
  if (play.boss) await expect(page.getByText('⚔️ Trận Boss của chặng.')).toBeVisible();
  await page.getByLabel('Trình soạn mã Python').fill(lesson.step_4!.solutionCode!);
  await clickPrimary(page, 'Nộp & Chấm điểm');
  await expect(page.getByText('THÀNH TÍCH MỚI')).toBeVisible({ timeout: 120_000 });
  await shot(page, `${code}-recap`);
  await page.getByRole('button', { name: 'Tuyệt vời!' }).click();
  await expect(page.getByText(play.boss ? '⚔️ Đã hạ Boss của chặng!' : 'Đã hoàn thành bài học!')).toBeVisible();
  await expect(page.getByText('+15 XP')).toBeVisible();

  const sent = completions.find((c) => c.lessonNo === index + 1);
  expect(sent?.body.courseId).toBe('python_advanced');
  // Làm đúng hết ngay lần đầu (bấm nhầm dòng bẫy không tính là chấm sai).
  expect(sent?.body.quizScore).toBe(100);
}

test.describe('Python Advanced — chơi hết bài', () => {
  test.beforeEach(async ({ page, context }) => {
    test.setTimeout(600_000);
    await context.addCookies([{ name: 'pe_has_session', value: '1', url: 'http://localhost:3000' }]);
    await page.addInitScript(() => localStorage.setItem('pe_access', 'e2e-token'));
    await mockApi(page);
    consoleErrors.length = 0;
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));
  });

  test.afterEach(() => {
    // Lỗi React/Next trong console (key trùng, setState khi render…) là lỗi thật.
    expect(consoleErrors, consoleErrors.join(String.fromCharCode(10))).toEqual([]);
  });

  for (const code of ['B01', 'B04', 'I03', 'N01', 'B20']) {
    test(`${code}: mọi game tới tổng kết`, async ({ page }) => {
      await playLesson(page, code);
    });
  }

  test('khoá python cũ (v1) giữ nguyên luồng S1–S4, không có điểm hay game', async ({ page }) => {
    await page.goto('/lesson/python?lesson=0');
    await expect(page.locator('[data-cta="primary"]')).toHaveText(/Tiếp tục/, { timeout: 60_000 });
    await expect(page.getByText(/Python · /)).toBeVisible();
    await expect(page.getByLabel(/điểm$/)).toHaveCount(0);
    // Luồng v1 của B01: brief, giải thích, ngộ nhận, dự đoán, 2 trắc nghiệm, tự giải thích,
    // lắp ghép, nhật ký, tái dự đoán, sandbox, tổng kết = 12 màn.
    await expect(page.getByText('1/12')).toBeVisible();
    await page.locator('[data-cta="primary"]').click();
    await expect(page.getByText(/S1 · Giải thích từng dòng/)).toBeVisible();
  });

  test.describe('điện thoại 390px', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    for (const code of ['B01', 'I03']) {
      test(`${code}: chơi được bằng chạm, không tràn ngang`, async ({ page }) => {
        await playLesson(page, code);
      });
    }
  });
});
