import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const baseURL = process.argv[2] || 'http://127.0.0.1:4183/tracekit/';
const output = process.argv[3] || 'docs/screenshots';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const page = await desktop.newPage();
  await page.goto(baseURL);
  await page.getByTestId('run-demo').click();
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await page.locator('#workbench').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/workbench.png` });
  await page.getByTestId('logic-toggle').click();
  await page.screenshot({ path: `${output}/fixed.png` });
  await desktop.close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const phone = await mobile.newPage();
  await phone.goto(baseURL);
  await phone.getByTestId('language-toggle').click();
  await phone.getByTestId('run-demo').click();
  await phone.screenshot({ path: `${output}/mobile-ru.png`, fullPage: true });
  await mobile.close();
  console.log(`Real browser screenshots saved to ${output}; source ${baseURL}`);
} finally {
  await browser.close();
}
