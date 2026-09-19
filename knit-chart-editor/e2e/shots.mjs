// 视觉核验截图脚本（非自动化套件）：node e2e/shots.mjs
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto('http://localhost:5199');
await page.evaluate(() => indexedDB.deleteDatabase('knit-chart-editor'));
await page.reload();
await page.waitForTimeout(400);
await page.screenshot({ path: 'e2e/shot-start.png' });

await page.getByText('加针练习').click();
await page.waitForSelector('.canvas-scroll canvas');
await page.waitForTimeout(400);
await page.screenshot({ path: 'e2e/shot-conflict.png' });
await page.getByRole('button', { name: /校验\(2\)/ }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: 'e2e/shot-validate.png' });

await browser.close();
console.log('shots done');
