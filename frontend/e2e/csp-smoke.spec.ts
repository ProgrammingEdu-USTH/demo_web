// CSP smoke test — đi qua mọi trang với backend THẬT và bắt mọi vi phạm CSP
// (securitypolicyviolation) cùng lỗi console. CSP của trang không còn
// 'unsafe-inline' hay CDN, nên script/handler/tài nguyên nào sót lại sẽ lộ ra ở đây.
// Kèm kiểm tra CSP shim (pe-bridge.js): handler onclick="…" của JS legacy phải
// được gỡ khỏi DOM và vẫn chạy khi bấm.
//
// Cần backend + frontend đang chạy và một tài khoản test:
//   E2E_EMAIL=… E2E_PASSWORD=… PW_CHANNEL=msedge npx playwright test -c e2e/playwright.config.ts csp-smoke
import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

if (process.env.PW_CHANNEL) test.use({ channel: process.env.PW_CHANNEL });
test.use({ viewport: { width: 1366, height: 900 } });

type Report = { violations: string[]; errors: string[]; shim: string[] };

async function watch(page: Page): Promise<Report> {
  const report: Report = { violations: [], errors: [], shim: [] };
  await page.exposeFunction('__cspViolation', (v: string) => report.violations.push(v));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __cspViolation: (v: string) => void }).__cspViolation(
        `${e.violatedDirective} ← ${e.blockedURI || '(inline)'} @ ${e.sourceFile || location.pathname}:${e.lineNumber}`,
      );
    });
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') report.errors.push(msg.text().slice(0, 240));
    // pe-bridge.js báo handler nội tuyến mà shim không hiểu / không cho phép.
    if (msg.text().startsWith('[CSP shim]')) report.shim.push(msg.text().slice(0, 240));
  });
  page.on('pageerror', (err) => report.errors.push(err.message.slice(0, 240)));
  return report;
}

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('#login-email', EMAIL!);
  await page.fill('#login-password', PASSWORD!);
  await page.click('#loginBtn');
  await page.waitForURL(/dashboard|questionaire/, { timeout: 30_000 });
}

/** Trang đã nạp xong JS legacy; không còn thuộc tính on* nào trong DOM. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  const leftover = await page.evaluate(
    () => document.querySelectorAll('[onclick],[onchange],[onkeydown],[oninput],[onsubmit]').length,
  );
  expect(leftover, 'còn thuộc tính on* chưa được CSP shim gỡ').toBe(0);
  if (process.env.E2E_SHOTS) {
    const name = new URL(page.url()).pathname.replace(/\W+/g, '_') || 'root';
    await page.screenshot({ path: `${process.env.E2E_SHOTS}/${name}.png` });
  }
}

test.describe('CSP smoke — mọi trang, backend thật', () => {
  test.skip(!EMAIL || !PASSWORD, 'Cần E2E_EMAIL / E2E_PASSWORD');
  test.setTimeout(300_000);

  test('bộ bắt vi phạm hoạt động (tự gây một vi phạm connect-src)', async ({ page }) => {
    const r = await watch(page);
    await page.goto('/login');
    await settle(page);
    await page.evaluate(() => fetch('https://example.com/').catch(() => undefined));
    await expect.poll(() => r.violations.length).toBe(1);
    expect(r.violations[0]).toContain('connect-src');
  });

  test('trang công khai không vi phạm CSP', async ({ page }) => {
    const r = await watch(page);
    for (const path of ['/', '/login', '/register']) {
      await page.goto(path);
      await settle(page);
    }
    expect(r.violations, r.violations.join('\n')).toEqual([]);
  });

  test('trang cần đăng nhập không vi phạm CSP, onclick legacy vẫn chạy', async ({ page }) => {
    const r = await watch(page);
    await login(page);

    // Dashboard SPA: lần lượt các tab (navigate() của main.js — được gọi qua shim).
    await page.goto('/dashboard');
    await settle(page);
    for (const tab of ['courses', 'roadmap', 'forum', 'leaderboard', 'skills', 'profile', 'dashboard']) {
      await page.evaluate((t) => (window as unknown as { navigate?: (x: string) => void }).navigate?.(t), tab);
      await page.waitForTimeout(700);
      await settle(page);
    }

    // Handler onclick của legacy đi qua shim: bấm tab "Kỹ năng" filter nếu có.
    await page.evaluate(() => (window as unknown as { navigate?: (x: string) => void }).navigate?.('skills'));
    await page.waitForTimeout(600);
    const skTab = page.locator('[data-pe-onclick^="skSetFilter"]').nth(1);
    if (await skTab.count()) {
      await skTab.click();
      await expect(page.locator('[data-pe-onclick^="skSetFilter"].active')).toHaveCount(1);
    }

    for (const path of [
      '/courses/python',
      '/courses/python_advanced',
      '/courses/db_design',
      '/lesson/db_design',
      '/lesson/python?lesson=0',
      '/lesson/python_advanced?lesson=0',
      '/interface',
      '/lesson/htmlcss',
      '/lesson/java',
      '/practice',
    ]) {
      await page.goto(path);
      await settle(page);
    }

    expect(r.violations, r.violations.join('\n')).toEqual([]);
    const cspErrors = r.errors.filter((e) => /Content Security Policy|Refused to/i.test(e));
    expect(cspErrors, cspErrors.join('\n')).toEqual([]);
    expect(r.shim, r.shim.join(String.fromCharCode(10))).toEqual([]);
  });
});
