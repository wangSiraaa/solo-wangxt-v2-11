import { nanoid } from 'nanoid';
import type {
  ClipboardChunk,
  KnitMaster,
  KnitProject,
  Placement,
  Rect,
} from '../types';
import {
  clamp,
  key,
  mirrorStitchId,
  normalizeRect,
  pointInRect,
  rectSize,
} from './grid';
import { expandMaster, extractMasterCells } from './patterns';

const clone = (p: KnitProject): KnitProject => structuredClone(p);

function inBounds(col: number, row: number, p: KnitProject): boolean {
  return col >= 0 && col < p.settings.width && row >= 0 && row < p.settings.height;
}

/** 在某格落笔：返回新工程（无变化时返回原对象引用） */
export function paintCell(
  project: KnitProject,
  col: number,
  row: number,
  stitchId: string,
  colorId: string | null,
): KnitProject {
  if (!inBounds(col, row, project)) return project;
  const next = clone(project);
  const idx = next.cells.findIndex((c) => c.col === col && c.row === row);
  const existing = idx >= 0 ? next.cells[idx] : undefined;
  // 手画格脱离任何花样引用
  if (existing) {
    if (existing.stitchId === stitchId && existing.colorId === colorId) return project;
    next.cells[idx!] = { id: existing.id, col, row, stitchId, colorId };
  } else {
    next.cells.push({ id: nanoid(10), col, row, stitchId, colorId });
  }
  return next;
}

export function eraseRect(project: KnitProject, rect: Rect): KnitProject {
  const n = normalizeRect(rect);
  const remaining = project.cells.filter((c) => !pointInRect(c.col, c.row, n));
  if (remaining.length === project.cells.length) return project;
  const next = clone(project);
  next.cells = remaining;
  return next;
}

/** 整块平移选区内容（像素级移动；超出边界的格裁掉，花样引用保留） */
export function moveRect(project: KnitProject, rect: Rect, dc: number, dr: number): KnitProject {
  const n = normalizeRect(rect);
  const inside = project.cells.filter((c) => pointInRect(c.col, c.row, n));
  if (inside.length === 0) return project;
  const next = clone(project);
  const movedKeys = new Set(inside.map((c) => key(c.col, c.row)));
  // 未移动格；移动目标点上若有选区外内容，会被移动格覆盖
  const others = next.cells.filter((c) => !movedKeys.has(key(c.col, c.row)));
  const targetKeys = new Set(
    inside.map((c) =>
      key(
        clamp(c.col + dc, 0, next.settings.width - 1),
        clamp(c.row + dr, 0, next.settings.height - 1),
      ),
    ),
  );
  const kept = others.filter((c) => !targetKeys.has(key(c.col, c.row)));
  const moved = inside
    .map((c) => ({ ...c, col: c.col + dc, row: c.row + dr }))
    .filter((c) => inBounds(c.col, c.row, next));
  next.cells = [...kept, ...moved];
  return next;
}

/** 粘贴片段：超出右/上边界的格丢弃；作为用户操作解除花样引用 */
export function pasteChunk(
  project: KnitProject,
  chunk: ClipboardChunk,
  baseCol: number,
  baseRow: number,
  keepRefs: boolean,
): { project: KnitProject; placed: Rect } {
  const next = clone(project);
  const placed = chunk.cells
    .map((c) => ({ ...c, col: baseCol + c.col, row: baseRow + c.row }))
    .filter((c) => inBounds(c.col, c.row, next))
    .map((c) => ({
      id: nanoid(10),
      col: c.col,
      row: c.row,
      stitchId: c.stitchId,
      colorId: c.colorId,
      ref: keepRefs ? c.ref : undefined,
    }));
  const pk = new Set(placed.map((c) => key(c.col, c.row)));
  next.cells = next.cells.filter((c) => !pk.has(key(c.col, c.row)));
  next.cells.push(...placed);
  const rect: Rect = {
    c0: baseCol,
    r0: baseRow,
    c1: Math.min(baseCol + chunk.width - 1, next.settings.width - 1),
    r1: Math.min(baseRow + chunk.height - 1, next.settings.height - 1),
  };
  return { project: next, placed: rect };
}

/** 选区水平镜像：坐标围绕选区中轴翻转 + 左右倾斜针法互换 */
export function mirrorRect(project: KnitProject, rect: Rect): KnitProject {
  const n = normalizeRect(rect);
  const inSel = new Set(
    project.cells.filter((c) => pointInRect(c.col, c.row, n)).map((c) => c.id),
  );
  if (inSel.size === 0) return project;
  const next = clone(project);
  // 选区内列对合（c ↔ c0+c1−c），格集合不变，仅翻转坐标与倾斜针法
  next.cells = next.cells.map((c) =>
    inSel.has(c.id)
      ? {
          ...c,
          col: n.c0 + n.c1 - c.col,
          stitchId: mirrorStitchId(c.stitchId),
          // 镜像属显式派生：解除花样引用，避免母版更新覆盖用户的镜像设计
          ref: undefined,
        }
      : c,
  );
  return next;
}

/** 从选区创建母版（不改动主图；引用关系由 placeMaster 建立） */
export function createMaster(project: KnitProject, rect: Rect, name: string): { project: KnitProject; master: KnitMaster } {
  const n = normalizeRect(rect);
  const { width, height } = rectSize(n);
  const master: KnitMaster = {
    id: nanoid(8),
    name,
    width,
    height,
    cells: extractMasterCells(project.cells, n),
    gen: 1,
  };
  const next = clone(project);
  next.masters.push(master);
  return { project: next, master };
}

/** 在主图放置（展开）一个母版，建立 placement 与逐格引用 */
export function placeMaster(
  project: KnitProject,
  masterId: string,
  col: number,
  row: number,
): KnitProject {
  const master = project.masters.find((m) => m.id === masterId);
  if (!master) return project;
  const next = clone(project);
  const placement: Placement = {
    id: nanoid(8),
    masterId,
    col,
    row,
    gen: master.gen,
    cellIds: [],
  };
  const cells = expandMaster(master, col, row, placement.id).filter((c) =>
    inBounds(c.col, c.row, next),
  );
  // 覆盖同位置的旧内容（放置是显式动作）
  const occupied = new Set(cells.map((c) => key(c.col, c.row)));
  next.cells = next.cells.filter((c) => !occupied.has(key(c.col, c.row)));
  next.cells.push(...cells);
  placement.cellIds = cells.map((c) => c.id);
  next.placements.push(placement);
  return next;
}

/**
 * 应用母版更新到某个放置（已由 computeDiff 预览影响）。
 * 旧展开格全部移除，按最新母版重新展开；冲突位置强制覆盖并在 UI 中已提示。
 */
export function applyMasterUpdate(project: KnitProject, placementId: string): KnitProject {
  const pIndex = project.placements.findIndex((p) => p.id === placementId);
  if (pIndex < 0) return project;
  const placement = project.placements[pIndex]!;
  const master = project.masters.find((m) => m.id === placement.masterId);
  const next = clone(project);

  // 移除旧展开格
  const oldIds = new Set(placement.cellIds);
  next.cells = next.cells.filter((c) => !oldIds.has(c.id));

  if (!master) {
    // 母版已删除：连带移除放置记录
    next.placements = next.placements.filter((p) => p.id !== placementId);
    return next;
  }

  const fresh = expandMaster(master, placement.col, placement.row, placement.id).filter((c) =>
    inBounds(c.col, c.row, next),
  );
  const occupied = new Set(fresh.map((c) => key(c.col, c.row)));
  next.cells = next.cells.filter((c) => !occupied.has(key(c.col, c.row)));
  next.cells.push(...fresh);
  next.placements[pIndex] = {
    ...placement,
    gen: master.gen,
    cellIds: fresh.map((c) => c.id),
  };
  return next;
}

/** 母版单元格编辑（gen 自增，所有放置随即显示为「可更新」） */
export function paintMasterCell(
  project: KnitProject,
  masterId: string,
  col: number,
  row: number,
  stitchId: string,
  colorId: string | null,
): KnitProject {
  const next = clone(project);
  const master = next.masters.find((m) => m.id === masterId);
  if (!master) return project;
  const idx = master.cells.findIndex((c) => c.col === col && c.row === row);
  if (idx >= 0) master.cells[idx] = { ...master.cells[idx]!, stitchId, colorId };
  else master.cells.push({ id: nanoid(10), col, row, stitchId, colorId });
  master.gen += 1;
  return next;
}

export function eraseMasterCell(project: KnitProject, masterId: string, col: number, row: number): KnitProject {
  const next = clone(project);
  const master = next.masters.find((m) => m.id === masterId);
  if (!master) return project;
  const before = master.cells.length;
  master.cells = master.cells.filter((c) => !(c.col === col && c.row === row));
  if (master.cells.length === before) return project;
  master.gen += 1;
  return next;
}

export function resizeGrid(project: KnitProject, width: number, height: number): KnitProject {
  const next = clone(project);
  next.settings.width = Math.max(1, width);
  next.settings.height = Math.max(1, height);
  next.cells = next.cells.filter((c) => c.col < width && c.row < height);
  return next;
}

export function setCastOn(project: KnitProject, castOn: number): KnitProject {
  const next = clone(project);
  next.settings.castOn = Math.max(0, Math.floor(castOn));
  return next;
}

/** 删除母版：其展开格保留为普通格（去掉引用），放置记录移除 */
export function deleteMaster(project: KnitProject, masterId: string): KnitProject {
  const next = clone(project);
  for (const c of next.cells) {
    if (c.ref?.masterId === masterId) c.ref = undefined;
  }
  next.placements = next.placements.filter((p) => p.masterId !== masterId);
  next.masters = next.masters.filter((m) => m.id !== masterId);
  return next;
}
