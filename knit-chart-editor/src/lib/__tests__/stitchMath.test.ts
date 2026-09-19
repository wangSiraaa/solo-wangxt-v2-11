import { describe, expect, it } from 'vitest';
import { cellKey, computeRows, findConflicts } from '../stitchMath';
import type { CellMap } from '../../types';

const proj = (rows: number, cols: number, castOn: number, cells: CellMap) =>
  ({ rows, cols, castOn, cells });

describe('computeRows 逐行针数', () => {
  it('空白格视为下针：矩形平针工程全部匹配', () => {
    const rows = computeRows(proj(5, 10, 10, {}));
    expect(rows.every((r) => r.ok)).toBe(true);
    expect(rows[0].start).toBe(10);
    expect(rows[4].end).toBe(10);
  });

  it('空针与并针相互抵消时行首针数不变', () => {
    // [下针, 空针, 右上二并一] × 2 = 消耗 1+0+2 ×2 = 6，产生 1+1+1 ×2 = 6
    const cells: CellMap = {
      [cellKey(1, 2)]: { s: 'yo', c: 'none' },
      [cellKey(1, 3)]: { s: 'k2tog', c: 'none' },
      [cellKey(1, 5)]: { s: 'yo', c: 'none' },
      [cellKey(1, 6)]: { s: 'k2tog', c: 'none' },
    };
    const rows = computeRows(proj(2, 6, 6, cells));
    expect(rows[0].ok).toBe(true);
    expect(rows[0].end).toBe(6);
    expect(rows[1].ok).toBe(true);
  });

  it('减针后下一行行首针数不匹配 → 标记冲突', () => {
    // 第 1 行：4 下针 + 1 并针 + 1 无针目 → 消耗 6 = 行首 6 ✓，行末收窄为 5 针
    // 第 2 行仍按 6 针织 → 需要 6 针，行首只有 5 针 ✗
    const cells: CellMap = {
      [cellKey(1, 5)]: { s: 'k2tog', c: 'none' },
      [cellKey(1, 6)]: { s: 'nost', c: 'none' },
    };
    const rows = computeRows(proj(2, 6, 6, cells));
    expect(rows[0].ok).toBe(true);
    expect(rows[0].end).toBe(5);
    expect(rows[1].ok).toBe(false);
    expect(rows[1].start).toBe(5);
    expect(rows[1].consume).toBe(6);
    expect(findConflicts(rows).map((r) => r.row)).toEqual([2]);
  });

  it('无针目占位可让收窄后的行恢复匹配', () => {
    const cells: CellMap = {
      [cellKey(1, 5)]: { s: 'k2tog', c: 'none' },
      [cellKey(1, 6)]: { s: 'nost', c: 'none' },
      // 第 2 行：5 下针 + 1 无针目 → 消耗 5 = 行首 5 ✓
      [cellKey(2, 6)]: { s: 'nost', c: 'none' },
    };
    const rows = computeRows(proj(2, 6, 6, cells));
    expect(rows.every((r) => r.ok)).toBe(true);
  });

  it('只加不减 → 下一行针数对不上，同样标记冲突', () => {
    // 第 1 行：3 下针 + 1 一针放两针 → 消耗 4 ✓，行末变成 5 针
    const cells: CellMap = {
      [cellKey(1, 4)]: { s: 'kfb', c: 'none' },
    };
    const rows = computeRows(proj(2, 4, 4, cells));
    expect(rows[0].ok).toBe(true);
    expect(rows[0].end).toBe(5);
    expect(rows[1].ok).toBe(false); // 需要 4 针，行首有 5 针
  });
});
