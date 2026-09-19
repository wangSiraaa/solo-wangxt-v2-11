import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { computeRows } from '../lib/stitchMath';
import { SYMBOL_MAP } from '../data/symbols';
import { GLYPHS } from '../lib/glyphs';
import type { PatternMaster } from '../types';

/** 右侧栏：针数校验 + 花样母版 */
export function SideBarRight() {
  const tab = useStore((s) => s.rightTab);
  const setTab = useStore((s) => s.setRightTab);
  return (
    <div className="sidebar-right">
      <div className="tabs">
        <button className={tab === 'check' ? 'tab active' : 'tab'} onClick={() => setTab('check')}>
          针数校验
        </button>
        <button className={tab === 'master' ? 'tab active' : 'tab'} onClick={() => setTab('master')}>
          花样母版
        </button>
      </div>
      {tab === 'check' ? <CheckPanel /> : <MasterPanel />}
    </div>
  );
}

/* ---------------- 针数校验 ---------------- */

function CheckPanel() {
  const project = useStore((s) => s.project);
  const jumpTo = useStore((s) => s.jumpTo);
  const [showAll, setShowAll] = useState(false);

  const rowsInfo = useMemo(() => (project ? computeRows(project) : []), [project]);
  if (!project) return null;
  const conflicts = rowsInfo.filter((r) => !r.ok);

  return (
    <div className="check-panel">
      <div className={conflicts.length ? 'check-summary bad' : 'check-summary ok'}>
        {conflicts.length
          ? `⚠ ${conflicts.length} 处行首针数不匹配`
          : '✓ 全部行针数匹配'}
      </div>
      <div className="check-meta">
        起针 {project.castOn} 针 · 共 {project.rows} 行 · 行末 {rowsInfo[rowsInfo.length - 1]?.end ?? 0} 针
      </div>

      {conflicts.length > 0 && (
        <div className="conflict-list">
          {conflicts.map((r) => (
            <button key={r.row} className="conflict-item" onClick={() => jumpTo(r.row, 1)}>
              <b>第 {r.row} 行</b>
              <span>
                需要 {r.consume} 针，行首实际 {r.start} 针
                （{r.consume > r.start ? `多 ${r.consume - r.start}` : `少 ${r.start - r.consume}`} 针）
              </span>
            </button>
          ))}
        </div>
      )}

      <button className="link" onClick={() => setShowAll(!showAll)}>
        {showAll ? '收起行数据 ▲' : '查看全部行数据 ▼'}
      </button>
      {showAll && (
        <table className="row-table">
          <thead>
            <tr><th>行</th><th>行首</th><th>消耗</th><th>产生</th><th>行末</th></tr>
          </thead>
          <tbody>
            {[...rowsInfo].reverse().map((r) => (
              <tr
                key={r.row}
                className={r.ok ? '' : 'bad'}
                onClick={() => jumpTo(r.row, 1)}
                title="点击定位到该行"
              >
                <td>{r.row}</td><td>{r.start}</td><td>{r.consume}</td>
                <td>{r.produce}</td><td>{r.end}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---------------- 花样母版 ---------------- */

export function MasterThumb({ master, cell = 7 }: { master: PatternMaster; cell?: number }) {
  const w = master.cols * cell;
  const h = master.rows * cell;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="master-thumb">
      <rect width={w} height={h} fill="#fff" />
      {Object.entries(master.cells).map(([k, s]) => {
        const [mr, mc] = k.split(',').map(Number);
        const x = (mc - 1) * cell;
        const y = (master.rows - mr) * cell;
        const sym = SYMBOL_MAP[s];
        return (
          <g key={k}>
            <rect x={x} y={y} width={cell} height={cell} fill="none" stroke="#e5e5e5" strokeWidth="0.5" />
            {sym && GLYPHS[sym.draw] && (
              <path
                d={GLYPHS[sym.draw]}
                transform={`translate(${x},${y}) scale(${cell / 24})`}
                fill="none" stroke="#1f2937" strokeWidth="1.7"
                strokeLinecap="round" strokeLinejoin="round"
              />
            )}
          </g>
        );
      })}
      <rect width={w} height={h} fill="none" stroke="#999" strokeWidth="1" />
    </svg>
  );
}

function MasterPanel() {
  const masters = useStore((s) => s.masters);
  const project = useStore((s) => s.project);
  const placing = useStore((s) => s.placing);
  const placeRep = useStore((s) => s.placeRep);
  const st = useStore.getState();

  const usageOf = (id: string) =>
    project?.instances.filter((i) => i.masterId === id).length ?? 0;

  return (
    <div className="master-panel">
      <div className="rep-row">
        循环次数
        <label>横向
          <input
            type="number" min={1} max={20} value={placeRep.x}
            onChange={(e) => st.setPlaceRep(Math.max(1, +e.target.value || 1), placeRep.y)}
          />
        </label>
        <label>纵向
          <input
            type="number" min={1} max={20} value={placeRep.y}
            onChange={(e) => st.setPlaceRep(placeRep.x, Math.max(1, +e.target.value || 1))}
          />
        </label>
      </div>

      <button
        className="primary block"
        onClick={() => st.setModal({ masterEditor: { open: true, masterId: null } })}
      >
        ＋ 新建花样母版
      </button>

      {masters.map((m) => (
        <div key={m.id} className="master-card">
          <div className="master-head">
            <b>{m.name}</b>
            <span className="dim">{m.cols}×{m.rows}</span>
          </div>
          <MasterThumb master={m} />
          <div className="master-usage">
            {usageOf(m.id) > 0 ? `本工程引用 ${usageOf(m.id)} 处` : '本工程未引用'}
          </div>
          <div className="master-actions">
            <button
              className={placing?.masterId === m.id ? 'active' : ''}
              onClick={() => (placing ? st.cancelPlacing() : st.startPlacing(m.id))}
            >
              {placing?.masterId === m.id ? '取消放置' : '放置'}
            </button>
            <button onClick={() => st.setModal({ masterEditor: { open: true, masterId: m.id } })}>
              编辑
            </button>
            <button
              className="danger"
              onClick={() => {
                if (window.confirm(`删除母版「${m.name}」？已展开的格子会保留，但失去联动。`))
                  void st.deleteMaster(m.id);
              }}
            >
              删除
            </button>
          </div>
        </div>
      ))}

      <div className="sidebar-tip">
        放置后格子保留母版引用（紫色角标）；编辑母版后可预览影响再应用。
      </div>
    </div>
  );
}
