import { useMemo, useState } from 'react';
import type { ChartCell, KnitProject } from '../types';
import { STITCHES, STITCH_MAP, YARN_COLORS } from '../data/stitches';
import { indexCells, validateRows } from '../lib/grid';
import { useEditor } from '../state/store';

const PAGE_W = 794; // A4 @96dpi
const PAGE_H = 1123;
const MARGIN_X = 40;
const HEADER_H = 64;
const FOOTER_H = 120;

interface PageRect {
  c0: number;
  r0: number;
  c1: number;
  r1: number;
}

function paginate(p: KnitProject, cell: number): PageRect[] {
  const colsPerPage = Math.max(1, Math.floor((PAGE_W - MARGIN_X * 2) / cell));
  const rowsPerPage = Math.max(
    1,
    Math.floor((PAGE_H - HEADER_H - FOOTER_H) / cell),
  );
  const pages: PageRect[] = [];
  // 编织从下往上阅读：先底后顶（r 从小到大），同高度内从左到右
  for (let r0 = 0; r0 < p.settings.height; r0 += rowsPerPage) {
    for (let c0 = 0; c0 < p.settings.width; c0 += colsPerPage) {
      pages.push({
        c0,
        r0,
        c1: Math.min(c0 + colsPerPage - 1, p.settings.width - 1),
        r1: Math.min(r0 + rowsPerPage - 1, p.settings.height - 1),
      });
    }
  }
  return pages;
}

function PageSvg({
  project,
  page,
  cell,
  index,
  total,
  cellMap,
  badRows,
}: {
  project: KnitProject;
  page: PageRect;
  cell: number;
  index: number;
  total: number;
  cellMap: Map<string, ChartCell>;
  badRows: Set<number>;
}) {
  const cols = page.c1 - page.c0 + 1;
  const rows = page.r1 - page.r0 + 1;
  const gridW = cols * cell;
  const gridH = rows * cell;
  const yOf = (r: number) => (page.r1 - r) * cell;

  const used = new Set<string>();
  for (let r = page.r0; r <= page.r1; r++)
    for (let c = page.c0; c <= page.c1; c++) {
      const cellObj = cellMap.get(`${c},${r}`);
      if (cellObj) used.add(cellObj.stitchId);
    }
  const legend = STITCHES.filter((s) => used.has(s.id));

  return (
    <div className="print-page" style={{ width: PAGE_W, minHeight: PAGE_H }}>
      <h2>{project.name}</h2>
      <div className="pinfo">
        第 {index + 1} / {total} 页 · 列 {page.c0 + 1}–{page.c1 + 1} · 行 {page.r0 + 1}–{page.r1 + 1}
        （行号自起针行向上）· 起针 {project.settings.castOn}
      </div>
      <svg width={gridW} height={gridH} viewBox={`0 0 ${gridW} ${gridH}`}>
        {/* 冲突行底色 */}
        {Array.from(badRows)
          .filter((r) => r >= page.r0 && r <= page.r1)
          .map((r) => (
            <rect key={`bad-${r}`} x={0} y={yOf(r)} width={gridW} height={cell} fill="rgba(192,57,43,.12)" />
          ))}
        {/* 网格 */}
        {Array.from({ length: cols + 1 }).map((_, c) => (
          <line
            key={`v${c}`}
            x1={c * cell + 0.5}
            y1={0}
            x2={c * cell + 0.5}
            y2={gridH}
            stroke={c % 5 === 0 ? '#b4ad99' : '#e0dbd0'}
          />
        ))}
        {Array.from({ length: rows + 1 }).map((_, r) => (
          <line
            key={`h${r}`}
            x1={0}
            y1={r * cell + 0.5}
            x2={gridW}
            y2={r * cell + 0.5}
            stroke={r % 5 === 0 ? '#b4ad99' : '#e0dbd0'}
          />
        ))}
        {/* 单元格底色 + 符号 */}
        {Array.from({ length: rows }).map((_, ri) =>
          Array.from({ length: cols }).map((__, ci) => {
            const c = page.c0 + ci;
            const r = page.r1 - ri;
            const obj = cellMap.get(`${c},${r}`);
            if (!obj) return null;
            const def = STITCH_MAP[obj.stitchId];
            const yarn = YARN_COLORS.find((y) => y.id === obj.colorId);
            const x = ci * cell;
            const y = ri * cell;
            const sc = cell / 32;
            return (
              <g key={`${c}-${r}`} transform={`translate(${x},${y})`}>
                {yarn && <rect width={cell} height={cell} fill={yarn.fill} />}
                {def?.id === 'nost' && (
                  <>
                    <rect width={cell} height={cell} fill="#e8e3d7" />
                    <line x1="2" y1="2" x2={cell - 2} y2={cell - 2} stroke="#b0a892" strokeWidth="1.2" />
                  </>
                )}
                {def?.glyph && (
                  <path
                    d={def.glyph}
                    transform={`scale(${sc})`}
                    fill="none"
                    stroke={yarn?.stroke ?? '#33302a'}
                    strokeWidth={2.1 / sc}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </g>
            );
          }),
        )}
        {/* 行号 */}
        {Array.from({ length: rows }).map((_, ri) => {
          const r = page.r1 - ri;
          return (
            <text
              key={`rn${r}`}
              x={-8}
              y={ri * cell + cell / 2 + 3}
              textAnchor="end"
              fontSize={9}
              fill={badRows.has(r) ? '#c0392b' : '#999'}
            >
              {r + 1}
            </text>
          );
        })}
      </svg>
      <div className="print-legend">
        {legend.map((s) => (
          <span className="item" key={s.id}>
            <svg width="20" height="20" viewBox="0 0 32 32">
              {s.glyph && (
                <path d={s.glyph} fill="none" stroke="#33302a" strokeWidth="2.1" strokeLinecap="round" />
              )}
            </svg>
            {s.name}（吃{s.inStitches}/出{s.outStitches}）
          </span>
        ))}
        {legend.length === 0 && <span className="item">本页无针法</span>}
      </div>
    </div>
  );
}

export default function PrintOverlay({ onClose }: { onClose: () => void }) {
  const project = useEditor((s) => s.project)!;
  const [cell, setCell] = useState(26);
  const pages = useMemo(() => paginate(project, cell), [project, cell]);
  const validation = useMemo(
    () => validateRows(project.cells, project.settings.height, project.settings.castOn),
    [project],
  );
  const badRows = useMemo(() => new Set(validation.mismatchRows), [validation]);
  const cellMap = useMemo(() => indexCells(project.cells), [project.cells]);

  return (
    <div className="print-overlay">
      <div className="print-toolbar">
        <strong>分页打印预览</strong>
        <span className="hint">
          {pages.length} 页 · A4 · 编织从下往上阅读
          {badRows.size > 0 && <span style={{ color: 'var(--danger)' }}>（红色行存在针数冲突）</span>}
        </span>
        <label className="flex-row">
          每格 {cell}px
          <input
            type="range"
            min={14}
            max={40}
            value={cell}
            onChange={(e) => setCell(Number(e.target.value))}
          />
        </label>
        <button className="primary" onClick={() => window.print()}>
          打印 / 另存为 PDF
        </button>
        <button onClick={onClose}>关闭</button>
      </div>
      {pages.map((pg, i) => (
        <PageSvg
          key={i}
          project={project}
          page={pg}
          cell={cell}
          index={i}
          total={pages.length}
          cellMap={cellMap}
          badRows={badRows}
        />
      ))}
    </div>
  );
}
