import { describe, expect, it } from 'vitest';
import { applyMasterPatches, expandInstance, impactKeys, locateInInstance, placeInstancePatches } from '../master';
import { applyPatches } from '../ops';
import { cellKey } from '../stitchMath';
import type { MasterInstance, PatternMaster, Project } from '../../types';

const master: PatternMaster = {
  id: 'm1', name: '测试花', rows: 2, cols: 2,
  cells: {
    [cellKey(1, 1)]: 'knit', [cellKey(1, 2)]: 'yo',
    [cellKey(2, 1)]: 'k2tog', [cellKey(2, 2)]: 'knit',
  },
  updatedAt: 0,
};

const inst: MasterInstance = { id: 'i1', masterId: 'm1', originR: 3, originC: 4, repX: 2, repY: 1 };

function makeProject(cells: Project['cells'] = {}): Project {
  return { id: 'p', name: 'p', rows: 20, cols: 20, castOn: 20, cells, instances: [inst], updatedAt: 0 };
}

describe('花样母版展开', () => {
  it('按循环次数平铺并保留母版坐标映射', () => {
    const cells = expandInstance(master, inst, 20, 20);
    expect(cells).toHaveLength(8); // 2×2 母版 × 横向 2 次
    // 第一次循环的 yo 在 (3,5)，第二次在 (3,7)
    expect(cells.find((c) => c.s === 'yo' && c.r === 3 && c.c === 5)).toBeTruthy();
    expect(cells.find((c) => c.s === 'yo' && c.r === 3 && c.c === 7)).toBeTruthy();
    expect(locateInInstance(master, inst, 3, 7)).toEqual({ mr: 1, mc: 2 });
    expect(locateInInstance(master, inst, 1, 1)).toBeNull();
  });

  it('放置补丁给格子打上母版引用', () => {
    const p = makeProject();
    const patches = placeInstancePatches(p, master, inst);
    const next = applyPatches(p.cells, patches);
    expect(next[cellKey(3, 5)]).toEqual({ s: 'yo', c: 'none', src: { m: 'm1', i: 'i1' } });
  });
});

describe('母版修改后应用', () => {
  it('更新仍归属实例的格子，保留用户手工修改', () => {
    const p0 = makeProject();
    const placed = applyPatches(p0.cells, placeInstancePatches(p0, master, inst));
    // 用户把 (3,5) 手工改成 purl → 引用丢失
    const userEdited = {
      ...placed,
      [cellKey(3, 5)]: { s: 'purl', c: 'none' },
    };
    const p = { ...p0, cells: userEdited };

    // 母版改动：(1,2) yo → ssk；(2,1) k2tog 删除（变透明）
    const edited: PatternMaster = {
      ...master,
      cells: {
        [cellKey(1, 1)]: 'knit', [cellKey(1, 2)]: 'ssk',
        [cellKey(2, 2)]: 'knit',
      },
    };
    const patches = applyMasterPatches(p, edited);
    const next = applyPatches(p.cells, patches);

    // 实例覆盖的 (3,7)（第二次循环的 (1,2)）更新为 ssk
    expect(next[cellKey(3, 7)]).toEqual({ s: 'ssk', c: 'none', src: { m: 'm1', i: 'i1' } });
    // 用户改过的 (3,5) 不动
    expect(next[cellKey(3, 5)]).toEqual({ s: 'purl', c: 'none' });
    // 母版中删掉的 (2,1) → 主图 (4,4) 被清除
    expect(next[cellKey(4, 4)]).toBeUndefined();
  });

  it('impactKeys 与 applyMasterPatches 覆盖一致', () => {
    const p0 = makeProject();
    const placed = applyPatches(p0.cells, placeInstancePatches(p0, master, inst));
    const p = { ...p0, cells: placed };
    const edited: PatternMaster = { ...master, cells: { ...master.cells, [cellKey(1, 2)]: 'ssk' } };
    const keys = impactKeys(p, edited);
    // 两处循环的 (1,2) 都会变化
    expect(keys.sort()).toEqual([cellKey(3, 5), cellKey(3, 7)].sort());
  });
});
