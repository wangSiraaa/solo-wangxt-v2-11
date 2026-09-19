import type { CellMap, PatternMaster, Project } from '../types';
import { cellKey } from '../lib/stitchMath';

/** 内置样例：一套针数全部合法，一套包含典型的加減针冲突 */

function set(cells: CellMap, r: number, c: number, s: string, color = 'none') {
  cells[cellKey(r, c)] = { s, c: color };
}

function fillRow(cells: CellMap, r: number, cols: number, s: string, color = 'none', from = 1) {
  for (let c = from; c <= cols; c++) set(cells, r, c, s, color);
}

/* ---------- 花样母版 ---------- */

/** 6×6 菱格镂空：每行加针与并针相互抵消，行内针数守恒 */
function buildDiamondMaster(): PatternMaster {
  const cells: Record<string, string> = {};
  const put = (r: number, c: number, s: string) => { cells[cellKey(r, c)] = s; };
  for (let r = 1; r <= 6; r++) for (let c = 1; c <= 6; c++) put(r, c, 'knit');
  put(2, 3, 'yo');    put(2, 4, 'k2tog');
  put(4, 2, 'yo');    put(4, 3, 'k2tog');
  put(6, 4, 'yo');    put(6, 5, 'k2tog');
  return { id: 'm-diamond', name: '菱格镂空花', rows: 6, cols: 6, cells, updatedAt: Date.now() };
}

/** 8×4 斜纹镂空 */
function buildWaveMaster(): PatternMaster {
  const cells: Record<string, string> = {};
  const put = (r: number, c: number, s: string) => { cells[cellKey(r, c)] = s; };
  for (let r = 1; r <= 4; r++) for (let c = 1; c <= 8; c++) put(r, c, 'knit');
  put(2, 3, 'yo'); put(2, 4, 'k2tog');
  put(3, 4, 'yo'); put(3, 5, 'k2tog');
  return { id: 'm-wave', name: '斜纹镂空', rows: 4, cols: 8, cells, updatedAt: Date.now() };
}

/* ---------- 样例 A：针数合法 ---------- */

function buildValidProject(): Project {
  const cols = 30;
  const rows = 36;
  const cells: CellMap = {};

  // 1-4 行：全下针
  for (let r = 1; r <= 4; r++) fillRow(cells, r, cols, 'knit');

  // 5-8 行：镂空条（每 3 针一组，加针与并针抵消 → 行首恒为 30）
  for (let c = 1; c <= cols; c++) {
    const g = (c - 1) % 3;
    set(cells, 5, c, g === 0 ? 'knit' : g === 1 ? 'yo' : 'k2tog', 'blue');
    set(cells, 7, c, g === 0 ? 'k2tog' : g === 1 ? 'yo' : 'knit', 'blue');
  }
  fillRow(cells, 6, cols, 'knit', 'blue');
  fillRow(cells, 8, cols, 'knit', 'blue');

  // 9-12 行：上针横棱（绿色条纹）
  for (let r = 9; r <= 12; r++) fillRow(cells, r, cols, 'purl', 'green');

  // 13-20 行：下针，黄色条纹
  for (let r = 13; r <= 20; r++) fillRow(cells, r, cols, 'knit', r >= 15 && r <= 18 ? 'yellow' : 'none');

  // 21-26 行：菱格镂空花母版实例（7-24 列，横向循环 3 次），其余下针
  const master = buildDiamondMaster();
  const inst = { id: 'inst-diamond-1', masterId: master.id, originR: 21, originC: 7, repX: 3, repY: 1 };
  for (let r = 21; r <= 26; r++) {
    for (let c = 1; c <= cols; c++) {
      const inInst = c >= 7 && c < 7 + 3 * 6;
      if (!inInst) set(cells, r, c, 'knit');
    }
  }
  for (let ry = 0; ry < 1; ry++) {
    for (let rx = 0; rx < 3; rx++) {
      for (const [k, s] of Object.entries(master.cells)) {
        const [mr, mc] = k.split(',').map(Number);
        cells[cellKey(21 + mr - 1, 7 + rx * 6 + mc - 1)] = {
          s, c: 'purple', src: { m: master.id, i: inst.id },
        };
      }
    }
  }

  // 27-36 行：下针，粉色条纹
  for (let r = 27; r <= rows; r++) fillRow(cells, r, cols, 'knit', r >= 30 && r <= 32 ? 'pink' : 'none');

  return {
    id: 'p-valid',
    name: '样例A · 镂空围巾（针数正确）',
    rows, cols,
    castOn: 30,
    cells,
    instances: [inst],
    updatedAt: Date.now(),
  };
}

/* ---------- 样例 B：针数冲突（教学用） ---------- */

function buildConflictProject(): Project {
  const cols = 24;
  const rows = 20;
  const cells: CellMap = {};

  // 1-4 行：全下针（行首 24，正常）
  for (let r = 1; r <= 4; r++) fillRow(cells, r, cols, 'knit');

  // 第 5 行：18 下针 + 3 并针 + 3 无针目 → 消耗 24 = 行首 24 ✓，行末收窄为 21 针
  fillRow(cells, 5, 18, 'knit');
  set(cells, 5, 19, 'k2tog', 'red');
  set(cells, 5, 20, 'k2tog', 'red');
  set(cells, 5, 21, 'k2tog', 'red');
  set(cells, 5, 22, 'nost'); set(cells, 5, 23, 'nost'); set(cells, 5, 24, 'nost');

  // 第 6 行：仍然按 24 针织 → 需要 24 针，实际只有 21 针 ✗ 冲突
  fillRow(cells, 6, cols, 'knit', 'orange');

  // 第 7 行：用「无针目」补齐缺口（21 针 + 3 空位）→ 恢复正常
  fillRow(cells, 7, 21, 'knit');
  set(cells, 7, 22, 'nost'); set(cells, 7, 23, 'nost'); set(cells, 7, 24, 'nost');

  // 第 8 行：3 个空针把针数加回 24
  fillRow(cells, 8, 21, 'knit');
  set(cells, 8, 22, 'yo', 'teal'); set(cells, 8, 23, 'yo', 'teal'); set(cells, 8, 24, 'yo', 'teal');

  // 第 9 行：24 针，正常
  fillRow(cells, 9, cols, 'knit');

  // 第 10 行：2 处并针但没有补加针 → 需要 26 针，实际 24 针 ✗ 冲突
  fillRow(cells, 10, cols, 'knit', 'orange');
  set(cells, 10, 1, 'k2tog', 'red');
  set(cells, 10, 3, 'k2tog', 'red');

  // 第 11 行：仍按 24 针织 → 需要 24 针，实际 22 针 ✗ 冲突
  fillRow(cells, 11, cols, 'knit', 'orange');

  // 12-20 行：用「无针目」标记收窄后的空位（22 针 + 2 空位）→ 恢复正常
  for (let r = 12; r <= rows; r++) {
    fillRow(cells, r, 22, 'knit');
    set(cells, r, 23, 'nost');
    set(cells, r, 24, 'nost');
  }

  return {
    id: 'p-conflict',
    name: '样例B · 针数冲突（教学示例）',
    rows, cols,
    castOn: 24,
    cells,
    instances: [],
    updatedAt: Date.now(),
  };
}

export function buildSamples(): { projects: Project[]; masters: PatternMaster[] } {
  return {
    projects: [buildValidProject(), buildConflictProject()],
    masters: [buildDiamondMaster(), buildWaveMaster()],
  };
}
