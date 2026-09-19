import { describe, expect, it } from 'vitest';
import { buildSamples } from '../../data/samples';
import { SYMBOL_MAP } from '../../data/symbols';
import { computeRows, findConflicts } from '../stitchMath';

describe('交付样例工程', () => {
  const { projects, masters } = buildSamples();

  it('包含一套合法样例与一套冲突样例', () => {
    expect(projects).toHaveLength(2);
    expect(masters.length).toBeGreaterThanOrEqual(2);
  });

  it('样例A（合法）：全部行针数匹配', () => {
    const valid = projects.find((p) => p.id === 'p-valid')!;
    const conflicts = findConflicts(computeRows(valid));
    expect(conflicts).toEqual([]);
  });

  it('样例A 包含带母版引用的展开花样', () => {
    const valid = projects.find((p) => p.id === 'p-valid')!;
    expect(valid.instances.length).toBeGreaterThan(0);
    const referenced = Object.values(valid.cells).filter((c) => c.src);
    expect(referenced.length).toBeGreaterThan(0);
    expect(referenced[0].src!.m).toBe(valid.instances[0].masterId);
  });

  it('样例B（冲突）：冲突出现在预期的行', () => {
    const conflict = projects.find((p) => p.id === 'p-conflict')!;
    const rows = computeRows(conflict);
    const bad = findConflicts(rows).map((r) => r.row);
    // 第 6 行：上一行并针后行首只剩 21 针，但仍按 24 针织
    // 第 10 行：并针超出可用针数；第 11 行：连锁不匹配
    expect(bad).toEqual([6, 10, 11]);
    // 修复段（无针目占位 / 空针补回）不再报冲突
    expect(rows[6].ok).toBe(true);  // 第 7 行
    expect(rows[8].ok).toBe(true);  // 第 9 行
    expect(rows[11].ok).toBe(true); // 第 12 行
  });

  it('母版自身行内针数守恒', () => {
    for (const m of masters) {
      for (let r = 1; r <= m.rows; r++) {
        let consume = 0;
        let produce = 0;
        for (let c = 1; c <= m.cols; c++) {
          const def = SYMBOL_MAP[m.cells[`${r},${c}`]];
          if (!def) continue;
          consume += def.consumes;
          produce += def.produces;
        }
        expect(consume, `${m.name} 第${r}行`).toBe(produce);
      }
    }
  });
});
