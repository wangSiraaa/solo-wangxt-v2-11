# 针法图编辑器（Knit Chart Editor）

面向手工编织设计师的**离线针法图编辑器**。所有数据与计算都在浏览器本地完成，
无后端、无网络请求；工程通过 Dexie 写入 IndexedDB。

## 快速开始

```bash
npm install
npm run dev        # 本地开发（默认 http://localhost:5173）
npm run build      # 类型检查 + 生产构建（dist/，相对路径可直接离线分发）
npm run preview    # 预览构建产物
npm test           # 纯逻辑单元测试（vitest，14 个）
```

启动后：
- 本机已有工程时，**打开即恢复最近工程并直接进入可编辑网格**；
- 否则在起始页选择：空白工程 / 针数合法样例 / 针数冲突样例。

## 功能与需求对照

| 需求 | 实现位置 |
| --- | --- |
| 打开即进入可编辑网格 | `src/App.tsx`（恢复最近工程）、`src/components/StitchCanvas.tsx` |
| React + TypeScript + Konva 选区与符号绘制 | `react-konva`，符号为本地 path 数据 |
| 针法/颜色图例使用本地数据 | `src/data/stitches.ts`（18 种针法、7 种纱线色） |
| Dexie → IndexedDB，全部操作在浏览器 | `src/lib/db.ts`；编辑后防抖自动保存，页面隐藏时强制落盘 |
| 逐行加针/减针后针数计算 | `validateRows`（`src/lib/grid.ts`）：按针法 in/out 针数求和，而非数格 |
| 指出下一行起始针数不匹配位置 | 行号栏红底、画布冲突行高亮、「校验」面板逐行列出 in/out/起始差并可点击定位 |
| 镜像选区时转换左右倾斜针法 | `mirrorRect`/`mirrorStitchId`：k2tog↔ssk、p2tog↔ssp、k3tog↔sssk、M1R↔M1L、C2R↔C2L |
| 循环花样展开后保持原花样引用 | `expandMaster`：每个展开格带 `ref{masterId,mcol,mrow,placementId}`，画布以蓝点标记 |
| 修改母版 → 预览影响 → 再应用 | 母版 gen 版本号；放置过期标记；`computeDiff` 给出增/删/改与冲突格；支持单处或全部应用 |
| 框选 | select 工具橡皮筋框选，选区保存在网格坐标系（滚动不丢） |
| 复制/剪切/粘贴 | 剪贴板含局部坐标，经 sessionStorage 可跨刷新；粘贴后自动选中新区域 |
| 分组撤销 | 一次拖笔 / 一串方向键移动 / 一批母版应用 = 一个撤销组；普通操作各自成组 |
| 分页打印 | `PrintOverlay`：A4 矢量 SVG 分页、行号、每页图例、冲突行标红、浏览器打印/PDF |
| 大网格滚动不丢选区 | 虚拟化渲染（只画可见格），选区独立于视口存在 |
| 合法 + 针数冲突两套样例 | `src/data/samples.ts`，起始页一键载入 |

### 针数模型（重要）

每种针法声明 `inStitches`（本行吃针）与 `outStitches`（下行产生针）：

- 行 `r` 的起始差 = `Σin(行r) − (r=0 ? 起针数 : Σout(行r-1))`；非 0 即不匹配。
- 减针（k2tog 吃 2 出 1）只占 1 格却消耗 2 针，加针（M1 吃 1 出 2、yo 吃 0 出 1）
  同理，因此**数格子不能替代针数校验**。

冲突样例特意构造两处：第 3 行起始缺 1 针（`-1`），末行起始多 2 针（`+2`）。

## 快捷键

- `V / E / S`：绘制 / 擦除 / 框选
- 鼠标拖动：拖笔连续绘制（一次撤销）
- `M`：镜像选区（左右倾斜针法自动互换）
- `方向键`：移动选区（`Shift` 每次 5 格）
- `Ctrl+C / X / V / A`：复制 / 剪切 / 粘贴 / 全选
- `Delete`：清除选区；`Ctrl+Z / Ctrl+Y`：撤销 / 重做

## 目录结构

```
src/
  types.ts               领域模型（工程、格、母版、放置、校验结果…）
  data/stitches.ts       本地针法 + 纱线色图例（含镜像映射与 SVG path）
  data/samples.ts        两套交付样例工程
  lib/grid.ts            网格几何、针数校验、镜像
  lib/ops.ts             工程纯函数变更（绘制/粘贴/镜像/母版应用…）
  lib/patterns.ts        母版提取、展开引用、差异预览
  lib/db.ts              Dexie / IndexedDB
  state/store.ts         zustand：选择、工具、分组撤销、自动保存
  components/            Konva 画布、面板、母版编辑、打印、起始页
e2e/                    Playwright 端到端冒烟（5 个场景）
```

## 端到端测试

```bash
# 需要 Chromium；CI 若无系统库，可用 LD_LIBRARY_PATH 指向解压的 deb 依赖
npx playwright test --config=e2e/playwright.config.mjs
```

覆盖：打开即编辑与持久化、冲突定位、框选/复制/粘贴/镜像针法转换、
母版两处引用→改母版→差异预览→应用、滚动保持选区、分页打印。

## 设计说明

- **镜像解除花样引用**：镜像是用户的显式派生，与母版不再逐格对应；
  若需要随母版联动，可对镜像母版重新「放置」。
- **母版更新不自动覆盖**：必须先看差异（含手改冲突警告）再应用，避免静默丢稿。
- **删除母版保留已展开的格**：仅去掉引用与放置记录。
- 行号自起针行（底边 row 0）向上计数，符合从下往上编织的阅读方向。
