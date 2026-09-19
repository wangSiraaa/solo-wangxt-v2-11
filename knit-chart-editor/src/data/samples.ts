import { nanoid } from 'nanoid';
import type { ChartCell, KnitMaster, KnitProject, Placement } from '../types';
import { expandMaster } from '../lib/patterns';

/**
 * 两套内置样例：
 *  1. 「平针蕾丝（针数合法）」——每行进出针数平衡，且包含一个被两处引用的循环花样母版。
 *  2. 「加针练习（针数冲突）」——包含加针/减针后起始针数不匹配的行，编辑器会标红定位。
 *
 * 用紧凑字符画描述：
 *  . 下针  p 上针  o 空加针  / 右上二并一(k2tog)  \ 左上二并一(ssk)
 *  < 右加针M1R  3 中上三并一(cdd)  L 左绞花  R 右绞花  # 无针
 */
const CHAR_MAP: Record<string, string> = {
  '.': 'knit',
  p: 'purl',
  o: 'yo',
  '/': 'k2tog',
  '\\': 'ssk',
  '<': 'm1r',
  '3': 'cdd',
  L: 'cblL',
  R: 'cblR',
  '#': 'nost',
};

function cellsFromRows(
  rows: string[],
  opts: { colorByChar?: Record<string, string>; baseCol?: number; baseRow?: number } = {},
): ChartCell[] {
  const cells: ChartCell[] = [];
  rows.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      const stitchId = CHAR_MAP[ch];
      if (!stitchId) return;
      cells.push({
        id: nanoid(10),
        col: c + (opts.baseCol ?? 0),
        row: r + (opts.baseRow ?? 0),
        stitchId,
        colorId: opts.colorByChar?.[ch] ?? null,
      });
    });
  });
  return cells;
}

function baseProject(name: string, width: number, height: number, castOn: number): KnitProject {
  return {
    id: nanoid(10),
    name,
    updatedAt: Date.now(),
    settings: {
      width,
      height,
      castOn,
      printCellPx: 26,
    },
    cells: [],
    masters: [],
    placements: [],
  };
}

/** 带母版引用的合法工程 */
export function createValidSample(): KnitProject {
  // 14 列 × 12 行，起针 14。
  const rows: string[] = [
    '..............', // r0  起针行：14 下针
    '..............', // r1
    '.../o....o\\...', // r2  k2tog+yo 与 yo+ssk：进出各 14
    '..............', // r3
    '..............', // r4  （下方放置母版 1）
    '..............', // r5
    '..............', // r6
    '...\\o....o/...', // r7  反向倾斜的一组（与 r2 镜像呼应）
    '..............', // r8  （下方放置母版 2）
    '..............', // r9
    '..............', // r10
    '..............', // r11
  ];
  const project = baseProject('平针蕾丝（针数合法）', 14, 12, 14);
  project.cells = cellsFromRows(rows, {
    colorByChar: { o: 'mustard' },
  });

  // 母版「小菱纹」6×4：每行均进 6 出 6，替换全下针区域不影响针数
  const masterRows = [
    '......',
    '/o..o\\',
    '.pppp.',
    '/o..o\\',
  ];
  const master: KnitMaster = {
    id: nanoid(8),
    name: '小菱纹',
    width: 6,
    height: 4,
    gen: 1,
    cells: cellsFromRows(masterRows).map((c) => ({ ...c, id: nanoid(10) })),
  };
  project.masters.push(master);

  // 循环花样展开两次：格内保留 masterId/母版坐标引用，母版改动能同时影响两处
  const placeAt = (col: number, row: number): Placement => {
    const placement: Placement = {
      id: nanoid(8),
      masterId: master.id,
      col,
      row,
      gen: 1,
      cellIds: [],
    };
    const expanded = expandMaster(master, col, row, placement.id);
    const occupied = new Set(expanded.map((c) => `${c.col},${c.row}`));
    project.cells = project.cells.filter((c) => !occupied.has(`${c.col},${c.row}`));
    project.cells.push(...expanded);
    placement.cellIds = expanded.map((c) => c.id);
    return placement;
  };
  // 放置在全下针行区间，避免与 r2/r7 的手工蕾丝行重叠
  project.placements.push(placeAt(4, 3));
  project.placements.push(placeAt(4, 8));

  return project;
}

/** 针数冲突工程：两处起始针数不匹配的边界 */
export function createConflictSample(): KnitProject {
  // 12 列 × 10 行，起针 12。
  const rows: string[] = [
    '............', // r0  in12 out12
    '...........<', // r1  11 下针 + 右加针：in12 out13（行末多出 1 针）
    '............', // r2  仍是 12 格下针 → 起始缺 1 针（mismatch -1）
    '........./.',  // r3  10 下针 + k2tog(吃2) 占 11 格：in12 ✓ out11（末列成形留空）
    '...........',  // r4  11 下针：in11 ✓ out11
    '...........o', // r5  11 下针 + 空加针：in11 ✓ out12
    '............', // r6  in12 ✓ out12
    'pppppppppppp', // r7  全上针：12/12
    '3.........',   // r8  中三三并一(吃3出1) + 9 下针：in12 out10
    '............', // r9  12 下针 vs 上一行结束 10 → 起始多 2 针（mismatch +2）
  ];
  const project = baseProject('加针练习（针数冲突）', 12, 10, 12);
  project.cells = cellsFromRows(rows, {
    colorByChar: { o: 'denim', '<': 'rose', 3: 'rose', p: 'cream' },
  });
  return project;
}
