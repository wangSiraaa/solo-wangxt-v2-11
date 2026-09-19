import type { CellData, MasterInstance, Patch, PatternMaster, Project } from '../types';
import { cellKey } from './stitchMath';

/**
 * 花样母版相关纯函数。
 * 展开后的格子带 src={m: 母版id, i: 实例id} 引用；
 * 用户手工覆盖过的格子会丢失 src，母版更新时不会被波及。
 */

export interface ExpandedCell {
  r: number;
  c: number;
  s: string;
}

/** 展开一个实例：按 repX/repY 循环平铺母版，裁剪到网格外 */
export function expandInstance(
  master: PatternMaster,
  inst: MasterInstance,
  rows: number,
  cols: number,
): ExpandedCell[] {
  const out: ExpandedCell[] = [];
  for (let ry = 0; ry < inst.repY; ry++) {
    for (let rx = 0; rx < inst.repX; rx++) {
      for (const [k, s] of Object.entries(master.cells)) {
        const [mr, mc] = k.split(',').map(Number);
        const r = inst.originR + ry * master.rows + (mr - 1);
        const c = inst.originC + rx * master.cols + (mc - 1);
        if (r < 1 || r > rows || c < 1 || c > cols) continue;
        out.push({ r, c, s });
      }
    }
  }
  return out;
}

/** 反查某格在实例中的母版局部坐标；不在实例范围内返回 null */
export function locateInInstance(
  master: PatternMaster,
  inst: MasterInstance,
  r: number,
  c: number,
): { mr: number; mc: number } | null {
  const dr = r - inst.originR;
  const dc = c - inst.originC;
  if (dr < 0 || dc < 0) return null;
  if (dr >= inst.repY * master.rows || dc >= inst.repX * master.cols) return null;
  return { mr: (dr % master.rows) + 1, mc: (dc % master.cols) + 1 };
}

/** 放置实例：生成写入补丁（保留原格颜色，打上引用） */
export function placeInstancePatches(
  project: Project,
  master: PatternMaster,
  inst: MasterInstance,
): Patch[] {
  const patches: Patch[] = [];
  for (const pos of expandInstance(master, inst, project.rows, project.cols)) {
    const key = cellKey(pos.r, pos.c);
    const prev = project.cells[key];
    const next: CellData = { s: pos.s, c: prev?.c ?? 'none', src: { m: master.id, i: inst.id } };
    if (prev && prev.s === next.s && prev.src?.i === inst.id) continue;
    patches.push({ key, prev, next });
  }
  return patches;
}

/**
 * 母版被修改后，计算「应用」所需的补丁：
 *  - 实例覆盖范围内：空格或仍归属该实例的格子 → 更新为新符号
 *  - 母版中已删除（变透明）的位置 → 清除仍归属该实例的格子
 *  - 用户手工改过（src 已丢失）的格子 → 不动
 */
export function applyMasterPatches(project: Project, master: PatternMaster): Patch[] {
  const patches: Patch[] = [];
  const insts = project.instances.filter((i) => i.masterId === master.id);
  const seen = new Set<string>();

  for (const inst of insts) {
    for (const pos of expandInstance(master, inst, project.rows, project.cols)) {
      const key = cellKey(pos.r, pos.c);
      seen.add(key);
      const cur = project.cells[key];
      if (cur && cur.src?.i !== inst.id) continue; // 用户改过的格子不动
      const next: CellData = { s: pos.s, c: cur?.c ?? 'none', src: { m: master.id, i: inst.id } };
      if (cur?.s === next.s && cur.src?.i === inst.id) continue;
      patches.push({ key, prev: cur, next });
    }
  }

  // 仍归属该母版、但新母版对应位置已透明的格子 → 清除
  for (const [key, cell] of Object.entries(project.cells)) {
    if (!cell.src || cell.src.m !== master.id || seen.has(key)) continue;
    const inst = insts.find((i) => i.id === cell.src!.i);
    if (!inst) continue;
    const [r, c] = key.split(',').map(Number);
    const local = locateInInstance(master, inst, r, c);
    const sym = local ? master.cells[cellKey(local.mr, local.mc)] : undefined;
    if (!sym) patches.push({ key, prev: cell, next: undefined });
  }
  return patches;
}

/** 预览影响：返回应用后会发生变化的格子 key 列表（去重） */
export function impactKeys(project: Project, master: PatternMaster): string[] {
  return [...new Set(applyMasterPatches(project, master).map((p) => p.key))];
}
