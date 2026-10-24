// Ready to copy into tracekit/tests/ for the focused comparison journey.
import { test, expect } from '@playwright/test';

test('mobile demo focuses its result and fixing the replay keeps focus in that result', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByTestId('run-demo').focus();
  await page.keyboard.press('Enter');
  const comparison = page.getByRole('heading', { name: 'State comparison', exact: true });
  await expect(comparison).toBeFocused();
  await expect(page.getByTestId('diff-status')).toContainText('Divergence found');
  const fix = page.getByTestId('compare-fix');
  await fix.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('diff-status')).toContainText('States match');
  await expect(comparison).toBeFocused();
  await expect(fix).toHaveCount(0);
  await expect(page.getByTestId('actual-total')).toHaveText(
    await page.getByTestId('expected-total').innerText(),
  );
});

test('jump to first divergence moves keyboard focus to the selected event', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('run-demo').click();
  const jump = page.getByRole('button', { name: /^First divergence/ });
  await jump.focus();
  await page.keyboard.press('Enter');
  const selected = page.locator('.timeline-item[aria-current="step"]');
  await expect(selected).toBeFocused();
  await expect(selected).toHaveClass(/diverged/);
  await expect(page.getByTestId('diff-status')).toContainText('Divergence found');
});
