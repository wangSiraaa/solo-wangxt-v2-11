/* 端到端冒烟测试：加载应用、校验样例工程、基本交互 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:4173';
const errors = [];
let failed = 0;

function check(name, cond) {
  if (cond) console.log(`  ✓ ${name}`);
  else { console.error(`  ✗ ${name}`); failed++; }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.topbar', { timeout: 10000 });
await page.waitForTimeout(800);

console.log('1. 初始加载');
check('顶栏渲染', await page.locator('.topbar').isVisible());
check('默认打开样例A', (await page.locator('.proj-name').textContent())?.includes('样例A'));
check('画布渲染', await page.locator('.grid-wrap canvas').first().isVisible());
check('针数校验通过', (await page.locator('.check-summary').textContent())?.includes('全部行针数匹配'));
check('针法图例渲染', (await page.locator('.symbol-palette .sym').count()) === 12);
check('颜色图例渲染', (await page.locator('.color-palette .swatch').count()) === 12);

console.log('2. 框选与镜像');
const grid = page.locator('.grid-wrap');
const box = await grid.boundingBox();
await page.mouse.move(box.x + 120, box.y + 500);
await page.mouse.down();
await page.mouse.move(box.x + 320, box.y + 300, { steps: 5 });
await page.mouse.up();
check('状态栏显示选区', (await page.locator('.statusbar').textContent())?.includes('选区'));
check('镜像按钮可用', await page.locator('button:has-text("左右镜像")').isEnabled());
await page.click('button:has-text("左右镜像")');
check('镜像后可撤销', await page.locator('button:has-text("撤销")').isEnabled());
await page.keyboard.press('Control+z');

console.log('3. 滚动不丢选区');
await page.keyboard.press('Control+a');
const selText = await page.locator('.statusbar').textContent();
await page.mouse.move(box.x + 600, box.y + 400);
await page.mouse.wheel(0, 800);
await page.mouse.wheel(300, 0);
await page.waitForTimeout(200);
check('滚动后选区仍在', (await page.locator('.statusbar').textContent()) === selText);

console.log('4. 绘制与撤销');
await page.keyboard.press('Escape');
await page.click('.sym[title*="空针"]');
await page.mouse.move(box.x + 200, box.y + 600);
await page.mouse.down();
await page.mouse.move(box.x + 260, box.y + 600, { steps: 3 });
await page.mouse.up();
const undoBtn = page.locator('button:has-text("撤销")');
check('绘制后可撤销', await undoBtn.isEnabled());
await page.keyboard.press('Control+z');

console.log('5. 打开冲突样例');
await page.click('button:has-text("打开")');
await page.waitForSelector('.proj-item');
check('工程列表有两套样例', (await page.locator('.proj-item').count()) === 2);
await page.click('.proj-item:has-text("样例B") .proj-info');
await page.waitForTimeout(500);
check('冲突摘要显示 3 处', (await page.locator('.check-summary').textContent())?.includes('3 处'));
check('冲突列表有 3 项', (await page.locator('.conflict-item').count()) === 3);
check('冲突详情含行号与针数', (await page.locator('.conflict-item').first().textContent())?.includes('需要'));
await page.locator('.conflict-item').first().click();
await page.waitForTimeout(300);

console.log('6. 花样母版');
await page.click('.tab:has-text("花样母版")');
check('母版列表渲染', (await page.locator('.master-card').count()) >= 2);
check('样例B 未引用母版', (await page.locator('.master-usage').first().textContent())?.includes('未引用'));
await page.click('button:has-text("新建花样母版")');
await page.waitForSelector('.master-editor');
check('母版编辑器打开', await page.locator('.master-editor canvas').isVisible());
await page.click('.master-editor button:has-text("创建")');
await page.waitForTimeout(300);
check('新母版出现在列表', (await page.locator('.master-card').count()) >= 3);

console.log('7. 打印预览');
await page.click('button:has-text("🖨 打印")');
await page.waitForSelector('.print-modal');
check('打印分页生成', (await page.locator('.preview-page').count()) >= 2);
check('图例页生成', (await page.locator('.legend-page').count()) >= 1);
await page.click('.print-modal button:has-text("关闭")');

console.log('8. 持久化');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.topbar');
await page.waitForTimeout(800);
check('刷新后记住上次工程（样例B）', (await page.locator('.proj-name').textContent())?.includes('样例B'));
check('刷新后冲突校验仍在', (await page.locator('.check-summary').textContent())?.includes('3 处'));

const realErrors = errors.filter((e) => !e.includes('favicon'));
check('无控制台错误', realErrors.length === 0);
if (realErrors.length) console.error(realErrors.slice(0, 5));

await browser.close();
console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
