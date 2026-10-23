import { expect, test } from '@playwright/test';

const openApp = async (page: import('@playwright/test').Page) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/bug report/i);
};

test('30-second reproduction, deterministic timeline and fixed logic', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('requestfailed', (request) =>
    errors.push(request.url() + ': ' + request.failure()?.errorText),
  );
  await openApp(page);
  await page.getByTestId('run-demo').click();
  const buggyTotal = await page.getByTestId('checkout-total').innerText();
  await expect(page.getByTestId('diff-status')).toContainText(
    /diverg|mismatch|difference|расхожд|отлич/i,
  );
  await page.getByTestId('timeline-step-0').click();
  await expect(page.getByTestId('diff-status')).toContainText(
    /match|sync|identical|совпад|синхрон/i,
  );
  const steps = page.locator('[data-testid^="timeline-step-"]');
  await steps.last().click();
  await expect(page.getByTestId('checkout-total')).toHaveText(buggyTotal);
  await page.getByTestId('logic-toggle').click();
  await expect(page.getByTestId('diff-status')).toContainText(
    /match|sync|identical|совпад|синхрон/i,
  );
  await expect(page.getByTestId('checkout-total')).not.toHaveText(buggyTotal);
  expect(errors).toEqual([]);
});

test('manual demo actions are recorded and reset clears the timeline', async ({ page }) => {
  await openApp(page);
  const start = await page.getByTestId('checkout-total').innerText();
  await page.getByTestId('quantity-plus').click();
  await expect(page.getByTestId('checkout-total')).not.toHaveText(start);
  await expect(page.getByTestId('timeline-step-1')).toBeVisible();
  await page.getByTestId('coupon-toggle').click();
  await expect(page.getByTestId('timeline-step-2')).toBeVisible();
  await page.getByTestId('reset').click();
  await expect(page.getByTestId('timeline-step-1')).toHaveCount(0);
  await expect(page.getByTestId('checkout-total')).toHaveText(start);
});

test('quantity upper bound cannot crash the recorder', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openApp(page);
  for (let i = 1; i < 9; i++) await page.getByTestId('quantity-plus').click();
  await expect(page.getByTestId('quantity-plus')).toBeDisabled();
  await expect(page.getByTestId('checkout-total')).toBeVisible();
  expect(errors).toEqual([]);
});

test('shipping scenario exposes its distinct stale shipping defect', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /Express, at a slow price/i }).click();
  await page.getByTestId('run-demo').click();
  await expect(page.getByTestId('checkout-total')).toHaveText('$183.00');
  await expect(page.getByTestId('expected-total')).toHaveText('$193.00');
  await page.getByTestId('logic-toggle').click();
  await expect(page.getByTestId('checkout-total')).toHaveText('$193.00');
  await expect(page.getByTestId('diff-status')).toContainText(/match/i);
});

test('export/import round-trip and untrusted JSON rejection preserve current trace', async ({
  page,
}) => {
  await openApp(page);
  await page.getByTestId('run-demo').click();
  const before = await page.getByTestId('checkout-total').innerText();
  const stepsBefore = await page.locator('[data-testid^="timeline-step-"]').count();
  await page.getByTestId('json-export').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const exported = await page.getByTestId('json-output').inputValue();
  const trace = JSON.parse(exported);
  expect(trace.schemaVersion).toBe(1);
  expect(trace.app).toBe('tracekit-demo');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('json-download').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  await page.getByTestId('json-close').click();
  await page.getByTestId('reset').click();
  await page.getByTestId('json-import').click();
  await page.getByTestId('json-input').fill(exported);
  await page.getByTestId('json-apply').click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByTestId('checkout-total')).toHaveText(before);
  await expect(page.locator('[data-testid^="timeline-step-"]')).toHaveCount(stepsBefore);
  await page.getByTestId('json-import').click();
  trace.entries[0].event.email = '<img src=x onerror="globalThis.tracekitInjected=true">';
  await page.getByTestId('json-input').fill(JSON.stringify(trace));
  await page.getByTestId('json-apply').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('import-error')).toBeVisible();
  expect(await page.evaluate(() => (globalThis as any).tracekitInjected)).toBeUndefined();
  await page.getByTestId('json-input').fill(' '.repeat(128 * 1024 + 1) + '{}');
  await page.getByTestId('json-apply').click();
  await expect(page.getByTestId('import-error')).toBeVisible();
  await page.getByTestId('json-close').click();
  await expect(page.getByTestId('checkout-total')).toHaveText(before);
  await expect(page.locator('[data-testid^="timeline-step-"]')).toHaveCount(stepsBefore);
});

test('keyboard dialog focus, Escape and bilingual interface', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('json-import').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByTestId('json-import')).toBeFocused();
  await page.getByTestId('language-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByTestId('run-demo')).toContainText(/демо|сценар|запуст|сек/i);
  await page.getByTestId('run-demo').click();
  await expect(page.getByTestId('diff-status')).toContainText(/расхожд|отлич/i);
  await page.getByTestId('logic-toggle').click();
  await expect(page.getByTestId('diff-status')).toContainText(/совпад|синхрон/i);
  await page.getByTestId('language-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('narrow mobile layout remains usable with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page);
  await page.getByTestId('run-demo').click();
  await expect(page.getByTestId('checkout-total')).toBeVisible();
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width + 1);
  await page.getByTestId('logic-toggle').click();
  await expect(page.getByTestId('diff-status')).toContainText(/match|sync|identical/i);
  await page.getByTestId('json-import').click();
  await expect(page.getByTestId('json-input')).toBeVisible();
  const dialogBox = await page.getByRole('dialog').boundingBox();
  expect(dialogBox?.width).toBeLessThanOrEqual(390);
});
