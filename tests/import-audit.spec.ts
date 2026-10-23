import { expect, test, type Page } from '@playwright/test';

type Gate = { started: boolean; done: boolean; release?: () => void };
async function gateFile(page: Page) {
  await page.addInitScript(() => {
    const original = File.prototype.text;
    const gate: Gate = { started: false, done: false };
    (window as unknown as { importGate: Gate }).importGate = gate;
    File.prototype.text = async function () {
      if (this.name !== 'slow.json') return original.call(this);
      gate.started = true;
      await new Promise<void>((resolve) => {
        gate.release = resolve;
      });
      const text = await original.call(this);
      gate.done = true;
      return text;
    };
  });
}
async function finishFile(page: Page) {
  await page.evaluate(() => (window as unknown as { importGate: Gate }).importGate.release?.());
  await page.waitForFunction(() => (window as unknown as { importGate: Gate }).importGate.done);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

test('closed import discards an old file completion and preserves the newer draft', async ({
  page,
}) => {
  await gateFile(page);
  await page.goto('./');
  await page.getByTestId('json-import').click();
  await page.locator('dialog input[type=file]').setInputFiles({
    name: 'slow.json',
    mimeType: 'application/json',
    buffer: Buffer.from('old draft'),
  });
  await page.waitForFunction(() => (window as unknown as { importGate: Gate }).importGate.started);
  await page.keyboard.press('Escape');
  await page.getByTestId('json-import').click();
  await page.getByTestId('json-input').fill('new draft');
  await finishFile(page);
  await expect(page.getByTestId('json-input')).toHaveValue('new draft');
  await expect(page.getByTestId('json-apply')).toBeEnabled();
});

test('newer file wins over an older pending file read', async ({ page }) => {
  await gateFile(page);
  await page.goto('./');
  await page.getByTestId('json-import').click();
  const input = page.locator('dialog input[type=file]');
  await input.setInputFiles({
    name: 'slow.json',
    mimeType: 'application/json',
    buffer: Buffer.from('old file'),
  });
  await page.waitForFunction(() => (window as unknown as { importGate: Gate }).importGate.started);
  await input.setInputFiles({
    name: 'new.json',
    mimeType: 'application/json',
    buffer: Buffer.from('new file'),
  });
  await expect(page.getByTestId('json-input')).toHaveValue('new file');
  await finishFile(page);
  await expect(page.getByTestId('json-input')).toHaveValue('new file');
});

test('mobile reset has a localized visible and accessible label', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('./');
  await expect(page.getByTestId('reset')).toHaveAccessibleName('Reset');
  await expect(page.getByTestId('reset').locator('span')).toBeVisible();
  await page.getByRole('button', { name: 'Switch to Russian' }).click();
  await expect(page.getByTestId('reset')).not.toHaveAccessibleName('');
  await expect(page.getByTestId('reset').locator('span')).toBeVisible();
});
