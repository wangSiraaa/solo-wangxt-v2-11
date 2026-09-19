/**
 * 端到端冒烟测试（Playwright，不进入自动化套件，仅手工/CI 显式运行）：
 *   npx playwright test e2e/smoke.mjs --config=e2e/playwright.config.mjs
 *
 * 覆盖：打开即编辑、绘制、框选/复制/粘贴/镜像、针数校验定位、
 *       母版创建→放置→编辑→预览→应用、撤销分组、滚动保持选区、打印页生成、持久化。
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5199',
    ...devices['Desktop Chrome'],
  },
});
