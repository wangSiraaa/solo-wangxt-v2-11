import type { CellData, CellMap, ClipboardData, Patch, Rect } from '../types';
import { mirrorSymbolId } from '../data/symbols';
import { cellKey } from './stitchMath';

export function normalizeRect(a: { r: number; c: number }, b: { r: number; c: number }): Rect {
  return {
    r0: Math.min(a.r, b.r),
    c0: Math.min(a.c, b.c),
    r1: Math.max(a.r, b.r),
    c1: Math.max(a.c, b.c),
  };
}

export function clampRect(rect: Rect, rows: number, cols: number): Rect {
  return {
    r0: Math.max(1, Math.min(rows, rect.r0)),
    c0: Math.max(1, Math.min(cols, rect.c0)),
    r1: Math.max(1, Math.min(rows, rect.r1)),
    c1: Math.max(1, Math.min(cols, rect.c1)),
  };
}

/** 提取选区内容（相对坐标），供复制使用 */
export function extractCells(cells: CellMap, rect: Rect): ClipboardData {
  const out: Record<string, CellData> = {};
  for (let r = rect.r0; r <= rect.r1; r++) {
    for (let c = rect.c0; c <= rect.c1; c++) {
      const cell = cells[cellKey(r, c)];
      if (cell) out[cellKey(r - rect.r0, c - rect.c0)] = { ...cell };
    }
  }
  return { w: rect.c1 - rect.c0 + 1, h: rect.r1 - rect.r0 + 1, cells: out };
}

/**
 * 粘贴：写入剪贴板内容，越界部分裁剪。
 * 粘贴的格子不带花样引用（src），避免脱离母版上下文后引用失效。
 */
export function pasteCells(
  cells: CellMap,
  clip: ClipboardData,
  at: { r: number; c: number },
  rows: number,
  cols: number,
): Patch[] {
  const patches: Patch[] = [];
  for (const [k, data] of Object.entries(clip.cells)) {
    const [dr, dc] = k.split(',').map(Number);
    const r = at.r + dr;
    const c = at.c + dc;
    if (r < 1 || r > rows || c < 1 || c > cols) continue;
    const key = cellKey(r, c);
    const next: CellData = { s: data.s, c: data.c };
    const prev = cells[key];
    if (prev && prev.s === next.s && prev.c === next.c && !prev.src) continue;
    patches.push({ key, prev, next });
  }
  return patches;
}

/**
 * 镜像选区。
 * 左右镜像（h）：列位置翻转，且倾斜针法互换（k2tog↔ssk、m1l↔m1r、k3tog↔sssk）。
 * 上下镜像（v）：行位置翻转，符号不变。
 * 镜像后的格子不再保留花样引用。
 */
export function mirrorRect(cells: CellMap, rect: Rect, dir: 'h' | 'v'): Patch[] {
  const patches: Patch[] = [];
  for (let r = rect.r0; r <= rect.r1; r++) {
    for (let c = rect.c0; c <= rect.c1; c++) {
      const srcR = dir === 'v' ? rect.r0 + (rect.r1 - r) : r;
      const srcC = dir === 'h' ? rect.c0 + (rect.c1 - c) : c;
      const src = cells[cellKey(srcR, srcC)];
      const key = cellKey(r, c);
      const prev = cells[key];
      let next: CellData | undefined;
      if (src) {
        next = { s: dir === 'h' ? mirrorSymbolId(src.s) : src.s, c: src.c };
      }
      if (prev?.s === next?.s && (prev?.c ?? 'none') === (next?.c ?? 'none') && !prev?.src) continue;
      patches.push({ key, prev, next });
    }
  }
  return patches;
}

/** 删除选区（清空格子 → 回到下针空白） */
export function deleteRect(cells: CellMap, rect: Rect): Patch[] {
  const patches: Patch[] = [];
  for (let r = rect.r0; r <= rect.r1; r++) {
    for (let c = rect.c0; c <= rect.c1; c++) {
      const key = cellKey(r, c);
      const prev = cells[key];
      if (prev) patches.push({ key, prev, next: undefined });
    }
  }
  return patches;
}

/** 应用一组补丁，返回新的 CellMap（不可变更新） */
export function applyPatches(cells: CellMap, patches: Patch[]): CellMap {
  const next: CellMap = { ...cells };
  for (const p of patches) {
    if (p.next === undefined) delete next[p.key];
    else next[p.key] = p.next;
  }
  return next;
}

/** 反转一组补丁（撤销用） */
export function invertPatches(patches: Patch[]): Patch[] {
  return patches
    .slice()
    .reverse()
    .map((p) => ({ key: p.key, prev: p.next, next: p.prev }));
}
