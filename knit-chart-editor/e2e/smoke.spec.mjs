// @ts-nocheck
import { test, expect, chromium } from '@playwright/test';

async function freshContext() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // 清空 IndexedDB：保证不被上次运行自动恢复的工程影响
  const page = await ctx.newPage();
  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('knit-chart-editor'));
  await page.reload();
  await page.waitForTimeout(300);
  return { browser, ctx, page };
}

const state = () => window.__knit.getState();
const cellSize = 24;
// 画布内部坐标（col, row；row=0 为底边）→ 画布容器视口坐标
async function cellPoint(page, col, row, height) {
  const box = await page.locator('.canvas-scroll').boundingBox();
  return { x: box.x + col * cellSize + cellSize / 2, y: box.y + (height - 1 - row) * cellSize + cellSize / 2 };
}

test.describe.configure({ mode: 'serial' });

test('1. 打开即进入网格 + 绘制持久化 + 撤销', async () => {
  const { browser, page } = await freshContext();

  // 起始页：创建空白工程即进入可编辑网格
  await expect(page.getByText('＋ 空白工程')).toBeVisible();
  await page.getByText('＋ 空白工程').click();
  await page.waitForSelector('.canvas-scroll canvas');
  expect(await page.evaluate(() => window.__knit.getState().project)).toBeTruthy();

  const p = await page.evaluate(() => window.__knit.getState().project);
  const h = p.settings.height;

  // 选择「空加针」并点三格
  await page.getByTitle('空加针（绕线）').click();
  for (const [c, r] of [[2, 0], [3, 0], [2, 1]]) {
    const pt = await cellPoint(page, c, r, h);
    await page.mouse.click(pt.x, pt.y);
  }
  const cells = await page.evaluate(() => window.__knit.getState().project.cells);
  expect(cells.length).toBe(3);
  expect(cells.every((c) => c.stitchId === 'yo')).toBe(true);

  // 三次独立落笔应是三个撤销组
  const pastBefore = await page.evaluate(() => window.__knit.getState().past.length);
  expect(pastBefore).toBe(3);
  await page.keyboard.press('Control+z');
  const afterUndo = await page.evaluate(() => window.__knit.getState().project.cells.length);
  expect(afterUndo).toBe(2);

  // IndexedDB 持久化：等待防抖保存后 reload，工程仍在
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForTimeout(600);
  const reopened = await page.evaluate(() => window.__knit.getState().project);
  expect(reopened.cells.length).toBe(2);

  await browser.close();
});

test('2. 冲突样例：行不匹配被标红并定位', async () => {
  const { browser, page } = await freshContext();
  await page.getByText('加针练习').click();
  await page.waitForSelector('.canvas-scroll canvas');
  const mismatch = await page.evaluate(() => {
    const s = window.__knit.getState();
    return s.validation === undefined ? null : null;
  });
  void mismatch;
  // 校验标签页上出现冲突计数 (2)
  await expect(page.getByRole('button', { name: /校验\(2\)/ })).toBeVisible();
  await page.getByRole('button', { name: /校验\(2\)/ }).click();
  await expect(page.getByText('发现 2 行起始针数不匹配')).toBeVisible();
  // 两行差值：-1 与 +2
  await expect(page.locator('.val-row.bad').first()).toContainText('+2');

  // 画布上有两个冲突红色行
  const badGutters = await page.locator('.gutter-cell.bad').count();
  expect(badGutters).toBe(2);

  await browser.close();
});

test('3. 框选→复制→粘贴→镜像（倾斜针法转换）', async () => {
  const { browser, page } = await freshContext();
  await page.getByText('加针练习').click();
  await page.waitForSelector('.canvas-scroll canvas');
  const h = await page.evaluate(() => window.__knit.getState().project.settings.height);

  // 框选 row1 的 m1r（col11）：切换框选工具，拖出小矩形
  await page.getByTitle('框选 (S)').click();
  let p0 = await cellPoint(page, 11, 1, h);
  let p1 = await cellPoint(page, 11, 1, h);
  await page.mouse.move(p0.x - 8, p0.y - 8);
  await page.mouse.down();
  await page.mouse.move(p1.x + 8, p1.y + 8, { steps: 4 });
  await page.mouse.up();
  const sel = await page.evaluate(() => window.__knit.getState().selection);
  expect(sel).toMatchObject({ c0: 11, r0: 1, c1: 11, r1: 1 });

  // 复制并粘贴到 col0,row1（用悬停 + Ctrl+V）
  await page.keyboard.press('Control+c');
  const tgt = await cellPoint(page, 0, 1, h);
  await page.mouse.move(tgt.x, tgt.y);
  await page.keyboard.press('Control+v');
  const pasted = await page.evaluate(() =>
    window.__knit.getState().project.cells.find((c) => c.col === 0 && c.row === 1),
  );
  expect(pasted.stitchId).toBe('m1r');

  // 框选 col0 区域后镜像：m1r 应变 m1l
  p0 = await cellPoint(page, 0, 1, h);
  p1 = await cellPoint(page, 0, 1, h);
  await page.mouse.move(p0.x - 8, p0.y - 8);
  await page.mouse.down();
  await page.mouse.move(p1.x + 8, p1.y + 8, { steps: 4 });
  await page.mouse.up();
  await page.getByTitle('镜像选区并互换左右倾斜针法 (M)').click();
  const mirrored = await page.evaluate(() =>
    window.__knit.getState().project.cells.find((c) => c.col === 0 && c.row === 1),
  );
  expect(mirrored.stitchId).toBe('m1l');

  // 大网格滚动不丢选区：当前选区仍在
  const scroll = page.locator('.canvas-scroll');
  await scroll.evaluate((el) => (el.scrollTop = 300));
  await page.waitForTimeout(200);
  const selAfterScroll = await page.evaluate(() => window.__knit.getState().selection);
  expect(selAfterScroll).toMatchObject({ c0: 0, r0: 1, c1: 0, r1: 1 });

  await browser.close();
});

test('4. 母版：创建→两处放置→改母版→预览影响→应用', async () => {
  const { browser, page } = await freshContext();
  await page.getByText('＋ 空白工程').click();
  await page.waitForSelector('.canvas-scroll canvas');
  const h = await page.evaluate(() => window.__knit.getState().project.settings.height);

  // 在 (2,0)(3,0) 画上针，框选后创建母版
  await page.locator('.stitch-btn[title="上针：吃 1 针 / 出 1 针"]').click();
  let pt = await cellPoint(page, 2, 0, h);
  await page.mouse.click(pt.x, pt.y);
  pt = await cellPoint(page, 3, 0, h);
  await page.mouse.click(pt.x, pt.y);
  await page.getByTitle('框选 (S)').click();
  const a = await cellPoint(page, 2, 0, h);
  const b = await cellPoint(page, 3, 0, h);
  await page.mouse.move(a.x - 8, a.y - 8);
  await page.mouse.down();
  await page.mouse.move(b.x + 8, b.y + 8, { steps: 4 });
  await page.mouse.up();

  await page.getByRole('button', { name: '花样' }).click();
  await page.getByPlaceholder('新母版名称').fill('测试罗纹');
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await expect(page.getByText('测试罗纹')).toBeVisible();

  // 放置两次
  await page.getByRole('button', { name: '放置到主图', exact: true }).click();
  pt = await cellPoint(page, 5, 2, h);
  await page.mouse.click(pt.x, pt.y);
  await page.getByRole('button', { name: '放置到主图', exact: true }).click();
  pt = await cellPoint(page, 5, 4, h);
  await page.mouse.click(pt.x, pt.y);

  const placed = await page.evaluate(() => {
    const s = window.__knit.getState();
    return {
      placements: s.project.placements.length,
      refs: s.project.cells.filter((c) => c.ref).length,
    };
  });
  expect(placed.placements).toBe(2);
  expect(placed.refs).toBe(4);

  // 编辑母版：切到图例选空加针，再切回花样打开母版编辑器（弹窗遮罩会盖住侧栏）
  await page.getByRole('button', { name: '图例' }).click();
  await page.locator('.stitch-btn[title="空加针（绕线）：吃 0 针 / 出 1 针"]').click();
  await page.getByRole('button', { name: '花样' }).click();
  await page.getByRole('button', { name: '编辑母版', exact: true }).click();
  await page.waitForSelector('.modal .canvas-scroll canvas');
  // 母版 2×1，row=0 在底部；点击左格
  const mbox = await page.locator('.modal .canvas-scroll').boundingBox();
  await page.mouse.click(mbox.x + 16, mbox.y + 16);
  const masterChanged = await page.evaluate(() => {
    const m = window.__knit.getState().project.masters[0];
    const cell = m.cells.find((c) => c.col === 0 && c.row === 0);
    return { gen: m.gen, stitch: cell.stitchId };
  });
  expect(masterChanged.gen).toBe(2);
  expect(masterChanged.stitch).toBe('yo');
  await page.getByRole('button', { name: '完成' }).click();

  // 两处都显示「可更新」，预览影响
  await expect(page.locator('.tag.stale')).toHaveCount(2);
  await page.getByRole('button', { name: '预览影响', exact: true }).first().click();
  await expect(page.locator('.diff-list')).toContainText('将更新 1 格');

  // 应用全部
  await page.getByRole('button', { name: /应用全部更新/ }).click();
  const synced = await page.evaluate(() => {
    const s = window.__knit.getState();
    const yoRefs = s.project.cells.filter((c) => c.stitchId === 'yo' && c.ref).length;
    const staleTags = s.project.placements.filter((pl) => {
      const m = s.project.masters.find((mm) => mm.id === pl.masterId);
      return m.gen !== pl.gen;
    }).length;
    return { yoRefs, staleTags };
  });
  expect(synced.yoRefs).toBe(2);
  expect(synced.staleTags).toBe(0);

  await browser.close();
});

test('5. 合法样例：校验通过、打印分页生成', async () => {
  const { browser, page } = await freshContext();
  await page.getByText('平针蕾丝').click();
  await page.waitForSelector('.canvas-scroll canvas');
  await page.getByRole('button', { name: '校验' }).click();
  await expect(page.getByText('✓ 各行起始针数匹配')).toBeVisible();

  await page.getByRole('button', { name: /分页打印/ }).click();
  await page.waitForSelector('.print-page');
  const pages = await page.locator('.print-page').count();
  expect(pages).toBeGreaterThan(0);
  // 每页带图例
  await expect(page.locator('.print-legend .item').first()).toBeVisible();
  await page.getByRole('button', { name: '关闭' }).click();
  await expect(page.locator('.print-page')).toHaveCount(0);

  await browser.close();
});
