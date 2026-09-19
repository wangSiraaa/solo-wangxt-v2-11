import { createPortal } from 'react-dom';
import { useStore } from '../state/store';
import { computeRows, cellKey } from '../lib/stitchMath';
import { COLORS, COLOR_MAP, SYMBOLS, SYMBOL_MAP } from '../data/symbols';
import { GLYPHS } from '../lib/glyphs';
import type { Project } from '../types';

/* A4 纵向分页参数（SVG 单位 ≈ px） */
const CELL = 14;
const PAGE_COLS = 40;
const PAGE_ROWS = 50;
const GL = 26;   // 左：行号
const GB = 18;   // 下：列号
const GH = 24;   // 上：页眉

interface PageSlice { r0: number; r1: number; c0: number; c1: number; px: number; py: number; }

function pageSlices(project: Project): PageSlice[] {
  const pagesX = Math.ceil(project.cols / PAGE_COLS);
  const pagesY = Math.ceil(project.rows / PAGE_ROWS);
  const out: PageSlice[] = [];
  for (let py = 0; py < pagesY; py++) {
    for (let px = 0; px < pagesX; px++) {
      out.push({
        r0: py * PAGE_ROWS + 1,
        r1: Math.min(project.rows, (py + 1) * PAGE_ROWS),
        c0: px * PAGE_COLS + 1,
        c1: Math.min(project.cols, (px + 1) * PAGE_COLS),
        px, py,
      });
    }
  }
  return out;
}

function ChartPage({ project, slice }: { project: Project; slice: PageSlice }) {
  const nCols = slice.c1 - slice.c0 + 1;
  const nRows = slice.r1 - slice.r0 + 1;
  const W = GL + nCols * CELL;
  const H = GH + nRows * CELL + GB;
  const rowsInfo = computeRows(project);
  const conflicts = new Set(rowsInfo.filter((r) => !r.ok).map((r) => r.row));

  const cells = [];
  for (let r = slice.r0; r <= slice.r1; r++) {
    for (let c = slice.c0; c <= slice.c1; c++) {
      const data = project.cells[cellKey(r, c)];
      const x = GL + (c - slice.c0) * CELL;
      const y = GH + (slice.r1 - r) * CELL;
      const fill =
        data?.s === 'nost' ? '#d9d9d9'
        : data && data.c !== 'none' ? COLOR_MAP[data.c]?.hex ?? '#ffffff'
        : '#ffffff';
      cells.push(
        <g key={`${r},${c}`}>
          <rect x={x} y={y} width={CELL} height={CELL} fill={fill} stroke="#dddddd" strokeWidth="0.5" />
          {data && SYMBOL_MAP[data.s] && GLYPHS[SYMBOL_MAP[data.s].draw] && (
            <path
              d={GLYPHS[SYMBOL_MAP[data.s].draw]}
              transform={`translate(${x},${y}) scale(${CELL / 24})`}
              fill="none" stroke="#111" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round"
            />
          )}
        </g>,
      );
    }
  }

  const rowLabels = [];
  for (let r = slice.r0; r <= slice.r1; r++) {
    const y = GH + (slice.r1 - r) * CELL + CELL / 2;
    rowLabels.push(
      <text key={r} x={GL - 4} y={y} textAnchor="end" dominantBaseline="central"
        fontSize="8" fill={conflicts.has(r) ? '#dc2626' : '#666'}
        fontWeight={conflicts.has(r) ? 700 : 400}>
        {r}
      </text>,
    );
  }
  const colLabels = [];
  for (let c = slice.c0; c <= slice.c1; c++) {
    colLabels.push(
      <text key={c} x={GL + (c - slice.c0) * CELL + CELL / 2} y={GH + nRows * CELL + 11}
        textAnchor="middle" fontSize="8" fill="#666">
        {c}
      </text>,
    );
  }

  return (
    <div className="print-page">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <text x={0} y={14} fontSize="11" fontWeight={600} fill="#111">
          {project.name}　·　行 {slice.r0}–{slice.r1}，列 {slice.c0}–{slice.c1}
          （第 {slice.py + 1}-{slice.px + 1} 页）
        </text>
        {cells}
        {rowLabels}
        {colLabels}
        <rect x={GL} y={GH} width={nCols * CELL} height={nRows * CELL} fill="none" stroke="#333" strokeWidth="1" />
      </svg>
    </div>
  );
}

function LegendPage({ project }: { project: Project }) {
  const rowsInfo = computeRows(project);
  const conflicts = rowsInfo.filter((r) => !r.ok);
  return (
    <div className="print-page legend-page">
      <h3>{project.name} · 图例</h3>
      <div className="legend-cols">
        <table className="legend-table">
          <thead>
            <tr><th>符号</th><th>名称</th><th>缩写</th><th>针数</th><th>说明</th></tr>
          </thead>
          <tbody>
            {SYMBOLS.map((s) => (
              <tr key={s.id}>
                <td>
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    {s.draw === 'nost' && <rect x="1" y="1" width="22" height="22" fill="#d9d9d9" />}
                    {GLYPHS[s.draw] && (
                      <path d={GLYPHS[s.draw]} fill="none" stroke="#111" strokeWidth="1.7"
                        strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </svg>
                </td>
                <td>{s.name}</td>
                <td>{s.short}</td>
                <td>{s.consumes}→{s.produces}</td>
                <td>{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <h4>颜色</h4>
          <ul className="legend-colors">
            {COLORS.map((c) => (
              <li key={c.id}>
                <span className="swatch-sm" style={{ background: c.hex }} />
                {c.name}
              </li>
            ))}
          </ul>
          <h4>针数校验</h4>
          <p>
            起针 {project.castOn} 针 · 共 {project.rows} 行 · 行末 {rowsInfo[rowsInfo.length - 1]?.end ?? 0} 针
          </p>
          {conflicts.length === 0 ? (
            <p>✓ 全部行针数匹配</p>
          ) : (
            <ul className="legend-conflicts">
              {conflicts.map((r) => (
                <li key={r.row}>第 {r.row} 行：需要 {r.consume} 针，行首实际 {r.start} 针</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** 打印预览模态框 + 实际打印 DOM（portal 到 body，仅打印时可见） */
export function PrintView() {
  const printOpen = useStore((s) => s.printOpen);
  const project = useStore((s) => s.project);
  const setModal = useStore((s) => s.setModal);

  if (!printOpen || !project) return null;
  const slices = pageSlices(project);

  return (
    <>
      <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && setModal({ printOpen: false })}>
        <div className="modal print-modal">
          <h3>打印预览 · 共 {slices.length} 页图表 + 1 页图例（A4 纵向）</h3>
          <div className="print-preview">
            {slices.map((s, i) => (
              <div className="preview-page" key={i}>
                <ChartPage project={project} slice={s} />
              </div>
            ))}
            <div className="preview-page">
              <LegendPage project={project} />
            </div>
          </div>
          <div className="modal-actions">
            <button onClick={() => setModal({ printOpen: false })}>关闭</button>
            <button className="primary" onClick={() => window.print()}>🖨 打印</button>
          </div>
        </div>
      </div>

      {createPortal(
        <div id="print-root">
          {slices.map((s, i) => (
            <ChartPage key={i} project={project} slice={s} />
          ))}
          <LegendPage project={project} />
        </div>,
        document.body,
      )}
    </>
  );
}
