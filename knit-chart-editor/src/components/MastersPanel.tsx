import { useMemo, useState } from 'react';
import type { KnitMaster, Placement, PlacementDiff } from '../types';
import { computeDiff, stalePlacements } from '../lib/patterns';
import { STITCH_MAP } from '../data/stitches';
import { useEditor } from '../state/store';
import Glyph from './Glyph';

function MasterThumb({ master, px = 14 }: { master: KnitMaster; px?: number }) {
  return (
    <svg
      className="master-thumb"
      width={master.width * px}
      height={master.height * px}
      viewBox={`0 0 ${master.width * 32} ${master.height * 32}`}
    >
      {Array.from({ length: master.height }).map((_, r) =>
        Array.from({ length: master.width }).map((__, c) => {
          const cell = master.cells.find((cc) => cc.col === c && cc.row === r);
          const x = c * 32;
          // 母版自身行坐标也是底边为 0，缩略图顶边显示大行
          const y = (master.height - 1 - r) * 32;
          return (
            <g key={`${c}-${r}`} transform={`translate(${x},${y})`}>
              <rect width="32" height="32" fill="#fff" stroke="#e0dbd0" strokeWidth="1" />
              {cell && <Glyph stitchId={cell.stitchId} size={32} colorId={cell.colorId} />}
            </g>
          );
        }),
      )}
    </svg>
  );
}

function DiffView({ diff }: { diff: PlacementDiff }) {
  const { added, removed, changed, hasConflicts } = diff;
  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    return <div className="diff-list">内容无差异（仅版本标记过期）。</div>;
  }
  return (
    <div className="diff-list">
      {removed.length > 0 && (
        <div>− 将移除 {removed.length} 格（母版中已删除）</div>
      )}
      {changed.length > 0 && (
        <div>
          ≈ 将更新 {changed.length} 格
          （例：{STITCH_MAP[changed[0]!.newStitch]?.name ?? changed[0]!.newStitch}）
        </div>
      )}
      {added.length > 0 && <div>＋ 将新增/覆盖 {added.length} 格</div>}
      {hasConflicts && (
        <div className="conflict">
          ⚠ 展开区域内含手动修改或其他花样的格 {added.length} 个，应用后会被覆盖。
        </div>
      )}
    </div>
  );
}

export default function MastersPanel() {
  const project = useEditor((s) => s.project)!;
  const makeMaster = useEditor((s) => s.makeMaster);
  const startPlacing = useEditor((s) => s.startPlacing);
  const placingMasterId = useEditor((s) => s.placingMasterId);
  const applyPlacement = useEditor((s) => s.applyPlacement);
  const applyAllPlacements = useEditor((s) => s.applyAllPlacements);
  const editMaster = useEditor((s) => s.editMaster);
  const removeMaster = useEditor((s) => s.removeMaster);
  const setSelection = useEditor((s) => s.setSelection);
  const selection = useEditor((s) => s.selection);
  const [name, setName] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const stale = useMemo(() => new Set(stalePlacements(project).map((p) => p.id)), [project]);
  const diffsByPlacement = useMemo(() => {
    const m = new Map<string, PlacementDiff>();
    if (openId) {
      const pl = project.placements.find((p) => p.id === openId);
      if (pl) m.set(pl.id, computeDiff(project, pl));
    }
    return m;
  }, [openId, project]);

  const placementsByMaster = (mid: string): Placement[] =>
    project.placements.filter((p) => p.masterId === mid);

  return (
    <div>
      <h4>循环花样母版</h4>
      <p className="hint">
        先在主图框选一块，再输入名称创建母版。母版展开后每格保留来源引用；
        修改母版后，所有放置处会标记为「可更新」，可预览差异后再应用。
      </p>
      <div className="flex-row">
        <input
          type="text"
          placeholder="新母版名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!selection}
        />
        <button className="primary" disabled={!selection} onClick={() => { makeMaster(name); setName(''); }}>
          创建
        </button>
      </div>
      {!selection && <div className="hint mt8">（先用框选工具在主图选区）</div>}

      {stale.size > 0 && (
        <button className="primary mt8" style={{ width: '100%' }} onClick={applyAllPlacements}>
          应用全部更新（{stale.size} 处）
        </button>
      )}

      {project.masters.map((m: KnitMaster) => (
        <div key={m.id} className="master-item">
          <div className="row">
            <span className="name">{m.name}</span>
            <span className="tag">{m.width}×{m.height}</span>
          </div>
          <MasterThumb master={m} />
          <div className="flex-row" style={{ flexWrap: 'wrap' }}>
            <button
              className={placingMasterId === m.id ? 'active' : ''}
              onClick={() => startPlacing(placingMasterId === m.id ? null : m.id)}
            >
              {placingMasterId === m.id ? '取消放置' : '放置到主图'}
            </button>
            <button onClick={() => editMaster(m.id)}>编辑母版</button>
            <button
              className="danger"
              onClick={() => {
                if (confirm(`删除母版「${m.name}」？已展开的格会保留为普通格。`)) removeMaster(m.id);
              }}
            >
              删除
            </button>
          </div>
          {placementsByMaster(m.id).map((p) => {
            const isStale = stale.has(p.id);
            return (
              <div key={p.id} style={{ marginTop: 6, borderTop: '1px dashed #e4dece', paddingTop: 6 }}>
                <div className="flex-row">
                  <span className="hint" style={{ flex: 1 }}>
                    放置于 列{p.col + 1}·行{p.row + 1}
                  </span>
                  <span className={`tag ${isStale ? 'stale' : 'synced'}`}>
                    {isStale ? '可更新' : '已同步'}
                  </span>
                </div>
                <div className="flex-row mt8">
                  <button
                    onClick={() =>
                      setSelection({ c0: p.col, r0: p.row, c1: p.col + m.width - 1, r1: p.row + m.height - 1 })
                    }
                  >
                    定位
                  </button>
                  {isStale && (
                    <>
                      <button onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                        {openId === p.id ? '收起预览' : '预览影响'}
                      </button>
                      <button className="primary" onClick={() => applyPlacement(p.id)}>
                        应用
                      </button>
                    </>
                  )}
                </div>
                {openId === p.id && diffsByPlacement.get(p.id) && (
                  <DiffView diff={diffsByPlacement.get(p.id)!} />
                )}
              </div>
            );
          })}
        </div>
      ))}
      {project.masters.length === 0 && (
        <p className="hint mt8">尚无母版。蓝色小圆点表示该格由花样展开生成且保留引用。</p>
      )}
    </div>
  );
}
