/* 截图：主界面（样例A）与冲突样例 */
import { chromium } from 'playwright-core';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
await page.waitForSelector('.topbar');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/shot-valid.png' });

// 框选一段看看选区渲染
const box = await page.locator('.grid-wrap').boundingBox();
await page.mouse.move(box.x + 200, box.y + 550);
await page.mouse.down();
await page.mouse.move(box.x + 500, box.y + 250, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shot-selection.png' });

// 冲突样例
await page.click('button:has-text("打开")');
await page.click('.proj-item:has-text("样例B") .proj-info');
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/shot-conflict.png' });

// 打印预览
await page.click('button:has-text("🖨 打印")');
await page.waitForSelector('.print-modal');
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/shot-print.png' });

await browser.close();
console.log('done');
