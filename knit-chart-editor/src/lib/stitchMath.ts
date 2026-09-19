import type { CellMap, Project, RowInfo } from '../types';
import { SYMBOL_MAP } from '../data/symbols';

export const cellKey = (r: number, c: number) => `${r},${c}`;

/** 空白格视为下针（1 针进 1 针出） */
function consumesOf(cells: CellMap, r: number, c: number): number {
  const cell = cells[cellKey(r, c)];
  if (!cell) return 1;
  return SYMBOL_MAP[cell.s]?.consumes ?? 1;
}

function producesOf(cells: CellMap, r: number, c: number): number {
  const cell = cells[cellKey(r, c)];
  if (!cell) return 1;
  return SYMBOL_MAP[cell.s]?.produces ?? 1;
}

/**
 * 逐行计算针数（行 1 在织物最下方，自下而上）。
 * 规则：
 *  - 第 1 行行首针数 = 起针数 castOn
 *  - 第 N 行行首针数 = 第 N-1 行行末针数
 *  - 行末针数 = 行首 - 本行消耗 + 本行产生
 *  - 若本行符号需要的针数（consume）≠ 行首实有针数（start），
 *    说明下一行起始针数对不上 → 标记为冲突行
 */
export function computeRows(project: Pick<Project, 'rows' | 'cols' | 'castOn' | 'cells'>): RowInfo[] {
  const out: RowInfo[] = [];
  let start = project.castOn;
  for (let r = 1; r <= project.rows; r++) {
    let consume = 0;
    let produce = 0;
    for (let c = 1; c <= project.cols; c++) {
      consume += consumesOf(project.cells, r, c);
      produce += producesOf(project.cells, r, c);
    }
    const end = start - consume + produce;
    out.push({ row: r, start, consume, produce, end, ok: consume === start });
    start = end;
  }
  return out;
}

/** 所有行首针数不匹配的行 */
export function findConflicts(rows: RowInfo[]): RowInfo[] {
  return rows.filter((r) => !r.ok);
}
