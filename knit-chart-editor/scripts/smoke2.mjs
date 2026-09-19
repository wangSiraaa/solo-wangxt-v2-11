/* 专项测试：母版编辑 → 影响预览 → 应用；花样放置 */
import { chromium } from 'playwright-core';

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

await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
await page.waitForSelector('.topbar');
await page.waitForTimeout(800);

console.log('1. 编辑母版并预览影响');
await page.click('.tab:has-text("花样母版")');
// 样例A 引用了菱格镂空花
check('样例A 引用菱格花', (await page.locator('.master-card').first().textContent())?.includes('引用'));
await page.locator('.master-card:has-text("菱格镂空花") button:has-text("编辑")').click();
await page.waitForSelector('.master-editor');
// 选空针符号，在母版 (1,1)（画布左下角）绘制
await page.click('.me-palette .sym[title*="空针"]');
const canvas = page.locator('.master-editor canvas');
const cb = await canvas.boundingBox();
await page.mouse.click(cb.x + 15, cb.y + cb.height - 15);
await page.click('.master-editor button:has-text("保存并预览影响")');
await page.waitForSelector('.modal:has-text("已修改")', { timeout: 3000 }).catch(() => null);
const impactVisible = await page.locator('.modal:has-text("已修改")').isVisible();
check('影响预览弹窗出现', impactVisible);
const impactText = await page.locator('.modal:has-text("已修改")').textContent();
check('影响 3 处循环的 3 个格子', impactText?.includes('3'));
await page.click('button:has-text("应用更改")');
await page.waitForTimeout(400);
// 应用后：第 21 行 3 个下针变空针 → 针数校验报警
await page.click('.tab:has-text("针数校验")');
check('应用后校验发现新冲突', (await page.locator('.check-summary').textContent())?.includes('不匹配'));
await page.keyboard.press('Control+z');
await page.waitForTimeout(300);
check('撤销应用后恢复合法', (await page.locator('.check-summary').textContent())?.includes('全部行针数匹配'));

console.log('2. 取消影响预览');
await page.click('.tab:has-text("花样母版")');
await page.locator('.master-card:has-text("菱格镂空花") button:has-text("编辑")').click();
await page.waitForSelector('.master-editor');
await page.click('.me-palette .sym[title*="上针"]');
const cb2 = await page.locator('.master-editor canvas').boundingBox();
await page.mouse.click(cb2.x + 45, cb2.y + cb2.height - 15);
await page.click('.master-editor button:has-text("保存并预览影响")');
await page.waitForSelector('.modal:has-text("已修改")');
await page.click('button:has-text("取消")');
await page.waitForTimeout(300);
await page.click('.tab:has-text("针数校验")');
check('取消后针数仍全部匹配', (await page.locator('.check-summary').textContent())?.includes('全部行针数匹配'));

console.log('3. 放置花样实例');
await page.click('.tab:has-text("花样母版")');
await page.locator('.master-card:has-text("斜纹镂空") button:has-text("放置")').click();
await page.waitForTimeout(200);
check('放置提示出现', await page.locator('.placing-badge').isVisible());
const grid = await page.locator('.grid-wrap').boundingBox();
// 点击网格中部偏下（行约 10，列约 10）
await page.mouse.click(grid.x + 300, grid.y + 550);
await page.waitForTimeout(300);
check('放置后可撤销', (await page.locator('.topbar button:has-text("撤销")').isEnabled()));
check('母版用量变为 1 处', (await page.locator('.master-card:has-text("斜纹镂空")').textContent())?.includes('1 处'));
// 斜纹母版行内守恒，放置后整体仍合法
await page.click('.tab:has-text("针数校验")');
check('放置守恒花样后针数仍匹配', (await page.locator('.check-summary').textContent())?.includes('全部行针数匹配'));
await page.keyboard.press('Control+z');
await page.waitForTimeout(200);

console.log('4. 复制粘贴');
await page.keyboard.press('Control+a');
await page.keyboard.press('Control+c');
await page.keyboard.press('Escape');
await page.keyboard.press('Control+v');
await page.waitForTimeout(200);
check('粘贴成功（生成选区）', (await page.locator('.statusbar').textContent())?.includes('选区'));

const realErrors = errors.filter((e) => !e.includes('favicon'));
check('无控制台错误', realErrors.length === 0);
if (realErrors.length) console.error(realErrors.slice(0, 5));

await browser.close();
console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
