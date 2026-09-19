import type { ChartCell, Rect, RowValidation, ValidationResult } from '../types';
import { STITCH_MAP } from '../data/stitches';

export const key = (col: number, row: number) => `${col},${row}`;

export function normalizeRect(r: Rect): Rect {
  return {
    c0: Math.min(r.c0, r.c1),
    r0: Math.min(r.r0, r.r1),
    c1: Math.max(r.c0, r.c1),
    r1: Math.max(r.r0, r.r1),
  };
}

export function rectSize(r: Rect) {
  const n = normalizeRect(r);
  return { width: n.c1 - n.c0 + 1, height: n.r1 - n.r0 + 1 };
}

export function pointInRect(col: number, row: number, r: Rect): boolean {
  const n = normalizeRect(r);
  return col >= n.c0 && col <= n.c1 && row >= n.r0 && row <= n.r1;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** 将单元格数组转为 col,row -> cell 映射 */
export function indexCells(cells: ChartCell[]): Map<string, ChartCell> {
  const m = new Map<string, ChartCell>();
  for (const c of cells) m.set(key(c.col, c.row), c);
  return m;
}

/**
 * 计算每行的进出针数与起始针数冲突。
 *
 * 约定：
 *  - 行从下往上编号（row 0 = 起针行）。
 *  - in  = 本行所有针法 inStitches 之和（本行消耗的针数，即上一行结束后应有的针数）。
 *  - out = 本行所有针法 outStitches 之和（织完本行产生、供下一行起始使用的针数）。
 *  - row r 的 startMismatch = in(row r) - (r === 0 ? castOn : out(row r-1))；
 *    非 0 即「下一行起始针数不匹配」。
 *
 * 注意：复合/跨列减针（如 k2tog 吃 2 针）会让「格数」与「针数」分离，
 * 这正是要校验的内容——光数格子无法发现冲突。
 */
export function validateRows(
  cells: ChartCell[],
  height: number,
  castOn: number,
): ValidationResult {
  const rows: RowValidation[] = [];
  const mismatchRows: number[] = [];

  for (let r = 0; r < height; r++) {
    let inCount = 0;
    let outCount = 0;
    for (const c of cells) {
      if (c.row !== r) continue;
      const def = STITCH_MAP[c.stitchId];
      if (!def) continue;
      inCount += def.inStitches;
      outCount += def.outStitches;
    }
    const expected = r === 0 ? castOn : rows[r - 1]!.outCount;
    const startMismatch = castOn > 0 || r > 0 ? inCount - expected : 0;
    rows.push({ row: r, inCount, outCount, startMismatch });
    if (startMismatch !== 0) mismatchRows.push(r);
  }

  return {
    rows,
    mismatchRows,
    totalInconsistent:
      mismatchRows.length > 0 || (castOn > 0 && height > 0 && rows[0]?.inCount !== castOn),
  };
}

/** 镜像针法 id：左右倾斜互换（k2tog ↔ ssk、M1R ↔ M1L、绞花等） */
export function mirrorStitchId(stitchId: string): string {
  return STITCH_MAP[stitchId]?.mirror ?? stitchId;
}

/** 在矩形内水平镜像单元格坐标（返回新单元格，不改原对象） */
export function mirrorCellsInRect(cells: ChartCell[], rect: Rect): ChartCell[] {
  const n = normalizeRect(rect);
  return cells.map((c) => {
    if (!pointInRect(c.col, c.row, n)) return c;
    return {
      ...c,
      id: c.id, // 编辑操作保持 id；调用方需要新 id 时自行处理（粘贴/展开场景）
      col: n.c0 + n.c1 - c.col,
      stitchId: mirrorStitchId(c.stitchId),
      // 镜像是显式派生变换，与母版单元格不再一一对应：解除花样引用。
      // 若整段镜像恰好对应某个镜像母版，设计师可重新放置母版获得引用。
      ref: undefined,
    };
  });
}
