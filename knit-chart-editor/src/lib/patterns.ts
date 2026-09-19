import { nanoid } from 'nanoid';
import type {
  ChartCell,
  ClipboardChunk,
  KnitMaster,
  KnitProject,
  Placement,
  PlacementDiff,
  Rect,
} from '../types';
import { indexCells, normalizeRect, pointInRect, rectSize } from './grid';

/** 将主图选区中的格抽出为母版局部坐标单元格（去除旧引用） */
export function extractMasterCells(cells: ChartCell[], rect: Rect): ChartCell[] {
  const n = normalizeRect(rect);
  return cells
    .filter((c) => pointInRect(c.col, c.row, n))
    .map((c) => ({
      id: nanoid(10),
      col: c.col - n.c0,
      row: c.row - n.r0,
      stitchId: c.stitchId,
      colorId: c.colorId,
    }));
}

/**
 * 展开母版：在 (baseCol, baseRow) 生成一批带引用的单元格。
 * 循环花样无论展开/重复多少次，每个格都保留 masterId + 母版内坐标，
 * 母版日后修改时可据此定位并预览影响。
 */
export function expandMaster(
  master: KnitMaster,
  baseCol: number,
  baseRow: number,
  placementId: string,
): ChartCell[] {
  return master.cells.map((mc) => ({
    id: nanoid(10),
    col: baseCol + mc.col,
    row: baseRow + mc.row,
    stitchId: mc.stitchId,
    colorId: mc.colorId,
    ref: {
      masterId: master.id,
      mcol: mc.col,
      mrow: mc.row,
      placementId,
    },
  }));
}

/** 复制选区为剪贴板片段（保留花样来源信息，粘贴时仍可追溯） */
export function copyRect(cells: ChartCell[], rect: Rect): ClipboardChunk {
  const n = normalizeRect(rect);
  const { width, height } = rectSize(n);
  return {
    width,
    height,
    cells: cells
      .filter((c) => pointInRect(c.col, c.row, n))
      .map((c) => ({ ...c, id: nanoid(10), col: c.col - n.c0, row: c.row - n.r0 })),
  };
}

/** 统计母版每行进出针数，用于母版编辑器提示（复用主图校验思路的简化版） */
export function masterCellMap(master: KnitMaster): Map<string, ChartCell> {
  return indexCells(master.cells);
}

/** 计算单个放置相对于最新母版的差异 */
export function computeDiff(project: KnitProject, placement: Placement): PlacementDiff {
  const master = project.masters.find((m) => m.id === placement.masterId);
  const added: PlacementDiff['added'] = [];
  const removed: PlacementDiff['removed'] = [];
  const changed: PlacementDiff['changed'] = [];
  let hasConflicts = false;

  const grid = indexCells(project.cells);
  const masterCells = master ? masterCellMap(master) : new Map<string, ChartCell>();

  // 1) 旧展开格：消失 / 改变
  for (const cid of placement.cellIds) {
    const old = project.cells.find((c) => c.id === cid);
    if (!old) continue;
    const m = masterCells.get(`${old.ref?.mcol},${old.ref?.mrow}`);
    if (!master || !m) {
      removed.push({ col: old.col, row: old.row });
    } else if (m.stitchId !== old.stitchId || m.colorId !== old.colorId) {
      changed.push({ col: old.col, row: old.row, oldStitch: old.stitchId, newStitch: m.stitchId });
    }
  }

  // 2) 新母版格：新增 / 与手改或其他花样冲突
  if (master) {
    for (const mc of master.cells) {
      const gcol = placement.col + mc.col;
      const grow = placement.row + mc.row;
      const g = grid.get(`${gcol},${grow}`);
      if (!g) {
        added.push({ col: gcol, row: grow, stitchId: mc.stitchId, colorId: mc.colorId });
      } else if (g.ref?.placementId !== placement.id) {
        hasConflicts = true;
        added.push({ col: gcol, row: grow, stitchId: mc.stitchId, colorId: mc.colorId });
      }
    }
  }

  return {
    placement,
    masterName: master?.name ?? '（已删除母版）',
    currentGen: master?.gen ?? 0,
    added,
    removed,
    changed,
    hasConflicts,
  };
}

/** 所有过期放置（母版 gen 新于放置 gen，或母版已删） */
export function stalePlacements(project: KnitProject): Placement[] {
  return project.placements.filter((p) => {
    const m = project.masters.find((mm) => mm.id === p.masterId);
    return !m || m.gen !== p.gen;
  });
}
