import { describe, expect, it } from 'vitest';
import { applyPatches, deleteRect, extractCells, invertPatches, mirrorRect, pasteCells } from '../ops';
import { cellKey } from '../stitchMath';
import type { CellMap } from '../../types';

describe('镜像选区', () => {
  it('左右镜像：位置翻转且倾斜针法互换', () => {
    const cells: CellMap = {
      [cellKey(1, 1)]: { s: 'k2tog', c: 'none' },
      [cellKey(1, 3)]: { s: 'm1l', c: 'red' },
    };
    const patches = mirrorRect(cells, { r0: 1, c0: 1, r1: 1, c1: 3 }, 'h');
    const next = applyPatches(cells, patches);
    // 列 1 的 k2tog 镜像到列 3 并变成 ssk；列 3 的 m1l 镜像到列 1 并变成 m1r
    expect(next[cellKey(1, 3)]).toEqual({ s: 'ssk', c: 'none' });
    expect(next[cellKey(1, 1)]).toEqual({ s: 'm1r', c: 'red' });
    // 镜像结果不保留花样引用
    expect(next[cellKey(1, 3)].src).toBeUndefined();
  });

  it('上下镜像：行位置翻转，符号不变', () => {
    const cells: CellMap = {
      [cellKey(1, 1)]: { s: 'k2tog', c: 'none' },
      [cellKey(3, 1)]: { s: 'yo', c: 'none' },
    };
    const next = applyPatches(cells, mirrorRect(cells, { r0: 1, c0: 1, r1: 3, c1: 1 }, 'v'));
    expect(next[cellKey(3, 1)].s).toBe('k2tog');
    expect(next[cellKey(1, 1)].s).toBe('yo');
  });

  it('无倾斜符号（空针/中上三并一）镜像后不变', () => {
    const cells: CellMap = { [cellKey(1, 1)]: { s: 'cdd', c: 'none' } };
    const next = applyPatches(cells, mirrorRect(cells, { r0: 1, c0: 1, r1: 1, c1: 2 }, 'h'));
    expect(next[cellKey(1, 2)].s).toBe('cdd');
  });
});

describe('复制 / 粘贴 / 删除', () => {
  it('粘贴越界裁剪，且不携带花样引用', () => {
    const cells: CellMap = {
      [cellKey(1, 1)]: { s: 'yo', c: 'blue', src: { m: 'm1', i: 'i1' } },
      [cellKey(2, 1)]: { s: 'k2tog', c: 'none' },
    };
    const clip = extractCells(cells, { r0: 1, c0: 1, r1: 2, c1: 1 });
    expect(clip.w).toBe(1);
    expect(clip.h).toBe(2);
    // 粘贴到最后一列：内容只有 1 列宽，不越界；再验证行越界
    const patches = pasteCells({}, clip, { r: 9, c: 5 }, 10, 10);
    const next = applyPatches({}, patches);
    expect(next[cellKey(9, 5)]).toEqual({ s: 'yo', c: 'blue' });
    expect(next[cellKey(9, 5)].src).toBeUndefined();
    expect(next[cellKey(10, 5)].s).toBe('k2tog');
    // 粘贴到底部之外 → 全部裁掉
    expect(pasteCells({}, clip, { r: 11, c: 1 }, 10, 10)).toHaveLength(0);
  });

  it('删除选区生成可逆补丁', () => {
    const cells: CellMap = { [cellKey(1, 1)]: { s: 'purl', c: 'none' } };
    const patches = deleteRect(cells, { r0: 1, c0: 1, r1: 1, c1: 2 });
    expect(patches).toHaveLength(1);
    const after = applyPatches(cells, patches);
    expect(after[cellKey(1, 1)]).toBeUndefined();
    // 撤销恢复
    const restored = applyPatches(after, invertPatches(patches));
    expect(restored[cellKey(1, 1)]).toEqual({ s: 'purl', c: 'none' });
  });
});
