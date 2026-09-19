import { describe, expect, it } from 'vitest';
import type { ChartCell, KnitProject } from '../../types';
import { validateRows, mirrorStitchId, normalizeRect } from '../grid';
import {
  applyMasterUpdate,
  createMaster,
  eraseRect,
  mirrorRect,
  moveRect,
  paintCell,
  pasteChunk,
  placeMaster,
  paintMasterCell,
  resizeGrid,
} from '../ops';
import { copyRect, computeDiff, expandMaster, stalePlacements } from '../patterns';
import { createConflictSample, createValidSample } from '../../data/samples';

function blankProject(width = 6, height = 4, castOn = 6): KnitProject {
  return {
    id: 'p1',
    name: 't',
    updatedAt: 0,
    settings: { width, height, castOn, printCellPx: 26 },
    cells: [],
    masters: [],
    placements: [],
  };
}
const c = (id: string, col: number, row: number, stitchId: string): ChartCell => ({
  id,
  col,
  row,
  stitchId,
  colorId: null,
});

describe('逐行针数校验', () => {
  it('全下针行与起针数匹配', () => {
    let p = blankProject(4, 2, 4);
    for (let r = 0; r < 2; r++)
      for (let col = 0; col < 4; col++) p = paintCell(p, col, r, 'knit', null);
    const v = validateRows(p.cells, 2, 4);
    expect(v.mismatchRows).toEqual([]);
    expect(v.rows.map((r) => [r.inCount, r.outCount])).toEqual([
      [4, 4],
      [4, 4],
    ]);
  });

  it('yo+k2tog 同组保持进出平衡', () => {
    let p = blankProject(4, 1, 4);
    // k2tog(吃2出1) + yo(吃0出1) + knit + knit = 吃4出4
    p = paintCell(p, 0, 0, 'k2tog', null);
    p = paintCell(p, 1, 0, 'yo', null);
    p = paintCell(p, 2, 0, 'knit', null);
    p = paintCell(p, 3, 0, 'knit', null);
    const v = validateRows(p.cells, 1, 4);
    expect(v.rows[0]!.inCount).toBe(4);
    expect(v.rows[0]!.outCount).toBe(4);
    expect(v.mismatchRows).toEqual([]);
  });

  it('M1R 多出一针后，下一行起始不匹配被定位', () => {
    let p = blankProject(4, 2, 4);
    for (let col = 0; col < 4; col++) p = paintCell(p, col, 0, 'knit', null);
    // row1: 3 knit + m1r(吃1出2) => 吃4 出5
    for (let col = 0; col < 3; col++) p = paintCell(p, col, 1, 'knit', null);
    p = paintCell(p, 3, 1, 'm1r', null);
    // row2... 不存在；再造 row2 只有 4 格 knit => 吃4 vs 上一行出5 => -1
    p = resizeGrid(p, 4, 3);
    for (let col = 0; col < 4; col++) p = paintCell(p, col, 2, 'knit', null);
    const v = validateRows(p.cells, 3, 4);
    expect(v.rows[1]!.startMismatch).toBe(0);
    expect(v.rows[2]!.startMismatch).toBe(-1);
    expect(v.mismatchRows).toEqual([2]);
  });

  it('起针数与首行不符时首行报冲突', () => {
    let p = blankProject(5, 1, 6);
    for (let col = 0; col < 5; col++) p = paintCell(p, col, 0, 'knit', null);
    const v = validateRows(p.cells, 1, 6);
    expect(v.mismatchRows).toEqual([0]);
    expect(v.rows[0]!.startMismatch).toBe(-1);
  });
});

describe('左右倾斜针法镜像', () => {
  it('镜像 id 互换且对称', () => {
    expect(mirrorStitchId('k2tog')).toBe('ssk');
    expect(mirrorStitchId('ssk')).toBe('k2tog');
    expect(mirrorStitchId('m1r')).toBe('m1l');
    expect(mirrorStitchId('m1l')).toBe('m1r');
    expect(mirrorStitchId('cblR')).toBe('cblL');
    expect(mirrorStitchId('cdd')).toBe('cdd');
    expect(mirrorStitchId('knit')).toBe('knit');
  });

  it('镜像选区：列坐标围绕选区中轴翻转，针法转换，引用解除', () => {
    let p = blankProject(5, 1, 0);
    const { project: withMaster, master } = createMaster(p, { c0: 0, r0: 0, c1: 1, r1: 0 }, 'm');
    void withMaster;
    p = placeMaster(p, master.id, 0, 0);
    // 放置的母版只有 2 格宽但无内容；直接构造带引用场景：手画 + 镜像
    p = paintCell(p, 0, 0, 'k2tog', null);
    p = paintCell(p, 4, 0, 'm1l', null);
    const rect = normalizeRect({ c0: 0, r0: 0, c1: 4, r1: 0 });
    const mirrored = mirrorRect(p, rect);
    const at = (col: number) => mirrored.cells.find((x) => x.col === col && x.row === 0)!;
    expect(at(4).stitchId).toBe('ssk'); // 原 col0 k2tog 翻到 col4
    expect(at(0).stitchId).toBe('m1r'); // 原 col4 m1l 翻到 col0
    // 花样引用格在镜像后被解除
    for (const cell of mirrored.cells) expect(cell.ref).toBeUndefined();
  });
});

describe('循环花样展开与母版引用', () => {
  it('从选区创建母版：母版格为局部坐标且不含引用', () => {
    let p = blankProject(4, 4, 0);
    p = paintCell(p, 1, 2, 'purl', null);
    p = paintCell(p, 2, 2, 'yo', null);
    const made = createMaster(p, { c0: 1, r0: 2, c1: 2, r1: 3 }, 'm');
    expect(made.master.width).toBe(2);
    expect(made.master.height).toBe(2);
    expect(made.master.cells.map((x) => [x.col, x.row, x.stitchId])).toEqual([
      [0, 0, 'purl'],
      [1, 0, 'yo'],
    ]);
    expect(made.project.cells.length).toBe(p.cells.length); // 创建母版不改动主图
  });

  it('放置母版两处后修改母版：放置过期、diff 正确、应用后同步', () => {
    let p = blankProject(8, 6, 0);
    // 先画一个 2×2 内容作为母版来源
    p = paintCell(p, 0, 0, 'knit', null);
    p = paintCell(p, 1, 0, 'purl', null);
    p = paintCell(p, 0, 1, 'yo', null);
    p = paintCell(p, 1, 1, 'ssk', null);
    const made = createMaster(p, { c0: 0, r0: 0, c1: 1, r1: 1 }, '方块');
    p = made.project;
    p = placeMaster(p, made.master.id, 2, 0);
    p = placeMaster(p, made.master.id, 2, 3);
    expect(p.placements).toHaveLength(2);
    // 展开格均带引用
    expect(p.cells.filter((x) => x.ref?.masterId === made.master.id)).toHaveLength(8);

    // 改母版一格：两处放置都应过期
    p = paintMasterCell(p, made.master.id, 1, 1, 'k2tog', null);
    const stale = stalePlacements(p);
    expect(stale).toHaveLength(2);

    for (const placement of p.placements) {
      const diff = computeDiff(p, placement);
      const changedPositions = diff.changed.map((d) => `${d.col},${d.row}`).sort();
      expect(changedPositions).toContain(`${placement.col + 1},${placement.row + 1}`);
      expect(diff.changed[0]!.newStitch).toBe('k2tog');
      expect(diff.hasConflicts).toBe(false);
    }

    // 应用第一个放置：它同步，另一个仍过期
    p = applyMasterUpdate(p, p.placements[0]!.id);
    expect(stalePlacements(p)).toHaveLength(1);
    const updated = p.cells.find(
      (x) => x.col === p.placements[0]!.col + 1 && x.row === p.placements[0]!.row + 1,
    )!;
    expect(updated.stitchId).toBe('k2tog');
    expect(updated.ref?.masterId).toBe(made.master.id); // 应用后仍是引用格

    // 应用全部剩余
    p = p.placements
      .filter((pl) => pl.gen !== p.masters[0]!.gen)
      .reduce((acc, pl) => applyMasterUpdate(acc, pl.id), p);
    expect(stalePlacements(p)).toHaveLength(0);
    expect(p.cells.filter((x) => x.stitchId === 'k2tog')).toHaveLength(2);
  });

  it('展开单元函数直接校验引用坐标', () => {
    const master = {
      id: 'mm',
      name: 'x',
      width: 2,
      height: 2,
      gen: 1,
      cells: [c('a', 0, 0, 'knit'), c('b', 1, 1, 'yo')],
    };
    const out = expandMaster(master, 3, 5, 'pl1');
    expect(out.map((x) => [x.col, x.row, x.ref!.mcol, x.ref!.mrow, x.ref!.placementId])).toEqual([
      [3, 5, 0, 0, 'pl1'],
      [4, 6, 1, 1, 'pl1'],
    ]);
  });
});

describe('框选复制 / 粘贴 / 移动 / 擦除', () => {
  it('复制粘贴片段到新位置且覆盖目标格', () => {
    let p = blankProject(6, 2, 0);
    p = paintCell(p, 0, 0, 'purl', null);
    p = paintCell(p, 1, 0, 'yo', null);
    const chunk = copyRect(p.cells, { c0: 0, r0: 0, c1: 1, r1: 0 });
    expect(chunk.cells.map((x) => x.stitchId).sort()).toEqual(['purl', 'yo']);
    p = paintCell(p, 4, 0, 'knit', null);
    const res = pasteChunk(p, chunk, 4, 0, false);
    const stitches = res.project.cells
      .filter((x) => x.row === 0 && x.col >= 4)
      .map((x) => x.stitchId)
      .sort();
    expect(stitches).toEqual(['purl', 'yo']); // knit 被 purl 覆盖
    expect(res.placed.c0).toBe(4);
  });

  it('方向平移选区一格', () => {
    let p = blankProject(6, 2, 0);
    p = paintCell(p, 0, 0, 'purl', null);
    p = paintCell(p, 2, 0, 'knit', null);
    p = moveRect(p, { c0: 0, r0: 0, c1: 0, r1: 0 }, 1, 0);
    expect(p.cells.find((x) => x.stitchId === 'purl')!.col).toBe(1);
    expect(p.cells.find((x) => x.stitchId === 'knit')!.col).toBe(2);
  });

  it('擦除选区', () => {
    let p = blankProject(4, 1, 0);
    p = paintCell(p, 0, 0, 'purl', null);
    p = paintCell(p, 1, 0, 'yo', null);
    p = eraseRect(p, { c0: 0, r0: 0, c1: 0, r1: 0 });
    expect(p.cells).toHaveLength(1);
    expect(p.cells[0]!.stitchId).toBe('yo');
  });
});

describe('交付样例工程', () => {
  it('合法样例：无针数冲突，且两处母版引用存在', () => {
    const p = createValidSample();
    const v = validateRows(p.cells, p.settings.height, p.settings.castOn);
    for (const rv of v.rows) {
      expect(rv.startMismatch, `第 ${rv.row + 1} 行不应冲突`).toBe(0);
    }
    expect(p.masters).toHaveLength(1);
    expect(p.placements).toHaveLength(2);
    const refCount = p.cells.filter((x) => x.ref?.masterId === p.masters[0]!.id).length;
    // 两处放置（各 4 格非空、母版实际含 4 格）共 8 格应带引用
    expect(refCount, '两处放置的格应带引用').toBe(p.masters[0]!.cells.length * 2);
  });

  it('冲突样例：恰好两处不匹配，差值为 -1 与 +2', () => {
    const p = createConflictSample();
    const v = validateRows(p.cells, p.settings.height, p.settings.castOn);
    const bad = v.rows.filter((r) => r.startMismatch !== 0);
    expect(bad.map((r) => [r.row, r.startMismatch])).toEqual([
      [2, -1],
      [9, 2],
    ]);
  });
});
