import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Rect } from '../types';
import { useEditor, breakCoalesce } from '../state/store';
import { validateRows } from '../lib/grid';
import StitchCanvas, { type CanvasMode } from './StitchCanvas';
import LegendPanel from './LegendPanel';
import ValidationPanel from './ValidationPanel';
import MastersPanel from './MastersPanel';
import MasterEditor from './MasterEditor';
import PrintOverlay from './PrintOverlay';
import { STITCH_MAP } from '../data/stitches';

type Tab = 'legend' | 'validate' | 'masters' | 'settings';

const ROW_GUTTER_W = 64;

export default function Editor() {
  const project = useEditor((s) => s.project)!;
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const placingMasterId = useEditor((s) => s.placingMasterId);
  const startPlacing = useEditor((s) => s.startPlacing);
  const selection = useEditor((s) => s.selection);
  const setSelection = useEditor((s) => s.setSelection);
  const setHover = useEditor((s) => s.setHover);
  const paintAt = useEditor((s) => s.paintAt);
  const eraseAt = useEditor((s) => s.eraseAt);
  const placeAt = useEditor((s) => s.placeAt);
  const eraseSelection = useEditor((s) => s.eraseSelection);
  const mirrorSelection = useEditor((s) => s.mirrorSelection);
  const nudgeSelection = useEditor((s) => s.nudgeSelection);
  const copy = useEditor((s) => s.copy);
  const cut = useEditor((s) => s.cut);
  const paste = useEditor((s) => s.paste);
  const selectAll = useEditor((s) => s.selectAll);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const clipboard = useEditor((s) => s.clipboard);
  const activeStitchId = useEditor((s) => s.activeStitchId);
  const close = useEditor((s) => s.close);
  const resize = useEditor((s) => s.resize);
  const changeCastOn = useEditor((s) => s.changeCastOn);
  const rename = useEditor((s) => s.rename);
  const editingMasterId = useEditor((s) => s.editingMasterId);

  const [tab, setTab] = useState<Tab>('legend');
  const [cellSize, setCellSize] = useState(24);
  const [showPrint, setShowPrint] = useState(false);
  const [scroll, setScroll] = useState({ x: 0, y: 0 });

  const validation = useMemo(
    () => validateRows(project.cells, project.settings.height, project.settings.castOn),
    [project],
  );
  const mismatchSet = useMemo(() => new Set(validation.mismatchRows), [validation]);

  const master = placingMasterId ? project.masters.find((m) => m.id === placingMasterId) : null;

  const mode: CanvasMode = placingMasterId
    ? 'place'
    : tool === 'erase'
      ? 'erase'
      : tool === 'select'
        ? 'select'
        : 'paint';

  const strokeAt = useCallback(
    (col: number, row: number) => {
      if (placingMasterId) {
        placeAt(col, row);
        return;
      }
      if (tool === 'erase') eraseAt(col, row);
      else paintAt(col, row);
    },
    [placingMasterId, placeAt, tool, eraseAt, paintAt],
  );

  const selectionDone = useCallback((r: Rect) => setSelection(r), [setSelection]);

  // 键盘快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copy();
      } else if (mod && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        cut();
      } else if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        paste();
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAll();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (useEditor.getState().selection) {
          e.preventDefault();
          eraseSelection();
        }
      } else if (e.key === 'm' || e.key === 'M') {
        if (useEditor.getState().selection) mirrorSelection();
      } else {
        const sel = useEditor.getState().selection;
        if (sel && e.key.startsWith('Arrow')) {
          e.preventDefault();
          const step = e.shiftKey ? 5 : 1;
          if (e.key === 'ArrowLeft') nudgeSelection(-step, 0);
          if (e.key === 'ArrowRight') nudgeSelection(step, 0);
          if (e.key === 'ArrowUp') nudgeSelection(0, step);
          if (e.key === 'ArrowDown') nudgeSelection(0, -step);
        } else if (e.key === 'v') setTool('paint');
        else if (e.key === 'e') setTool('erase');
        else if (e.key === 's') setTool('select');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    undo, redo, copy, cut, paste, selectAll, eraseSelection,
    mirrorSelection, nudgeSelection, setTool,
  ]);

  // 工具切换终止拖笔合并
  useEffect(() => breakCoalesce, [tool, placingMasterId]);

  const onCanvasScroll = useCallback((s: { x: number; y: number }) => setScroll(s), []);

  const rowItems = useMemo(
    () => Array.from({ length: project.settings.height }, (_, i) => i).sort((a, b) => b - a),
    [project.settings.height],
  );
  const virtualW = project.settings.width * cellSize;

  return (
    <div className="editor">
      <div className="toolbar">
        <button onClick={close} title="返回工程列表">← 列表</button>
        <input
          className="title-input"
          value={project.name}
          onChange={(e) => rename(e.target.value)}
          aria-label="工程名称"
        />
        <span className="divider" />
        <div className="group">
          <button className={mode === 'paint' ? 'active' : ''} onClick={() => { startPlacing(null); setTool('paint'); }} title="绘制 (V)">
            ✏️ 绘制
          </button>
          <button className={tool === 'erase' ? 'active' : ''} onClick={() => { startPlacing(null); setTool('erase'); }} title="擦除 (E)">
            🧽 擦除
          </button>
          <button className={tool === 'select' ? 'active' : ''} onClick={() => { startPlacing(null); setTool('select'); }} title="框选 (S)">
            ▱ 框选
          </button>
        </div>
        <span className="divider" />
        <div className="group">
          <button onClick={undo} disabled={!canUndo} title="撤销 Ctrl+Z">↶ 撤销</button>
          <button onClick={redo} disabled={!canRedo} title="重做 Ctrl+Y">↷ 重做</button>
        </div>
        <span className="divider" />
        <div className="group">
          <button onClick={copy} disabled={!selection}>复制</button>
          <button onClick={cut} disabled={!selection}>剪切</button>
          <button onClick={paste} disabled={!clipboard}>粘贴</button>
          <button className="danger" onClick={eraseSelection} disabled={!selection}>清除</button>
          <button onClick={mirrorSelection} disabled={!selection} title="镜像选区并互换左右倾斜针法 (M)">
            ⇋ 镜像
          </button>
        </div>
        <span className="divider" />
        <div className="group">
          <label className="hint">缩放</label>
          <input
            type="range" min={14} max={44} value={cellSize}
            onChange={(e) => setCellSize(Number(e.target.value))}
          />
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowPrint(true)}>🖨 分页打印</button>
      </div>

      {placingMasterId && (
        <div className="toolbar" style={{ background: '#fdf0d5', borderBottom: '1px solid #e6d49a' }}>
          <span>
            正在放置母版「{master?.name}」（{master?.width}×{master?.height}）：在网格上点击选择放置位置
          </span>
          <button onClick={() => startPlacing(null)}>取消</button>
        </div>
      )}

      <div className="workspace">
        <aside className="panel" style={{ width: 248, flex: 'none' }}>
          <div className="flex-row" style={{ gap: 2, marginBottom: 8 }}>
            {(['legend', 'validate', 'masters', 'settings'] as Tab[]).map((t) => (
              <button
                key={t}
                className={tab === t ? 'active' : ''}
                onClick={() => setTab(t)}
                style={{ flex: 1, padding: '4px 2px', fontSize: 12 }}
              >
                {t === 'legend' ? '图例' : t === 'validate' ? `校验${mismatchSet.size ? `(${mismatchSet.size})` : ''}` : t === 'masters' ? '花样' : '网格'}
              </button>
            ))}
          </div>
          {tab === 'legend' && <LegendPanel />}
          {tab === 'validate' && <ValidationPanel validation={validation} />}
          {tab === 'masters' && <MastersPanel />}
          {tab === 'settings' && (
            <div>
              <h4>网格与起针</h4>
              <div className="flex-row" style={{ marginBottom: 8 }}>
                宽
                <input
                  type="number" min={1} max={200}
                  defaultValue={project.settings.width}
                  onChange={(e) => resize(Number(e.target.value) || 1, project.settings.height)}
                />
                高
                <input
                  type="number" min={1} max={200}
                  defaultValue={project.settings.height}
                  onChange={(e) => resize(project.settings.width, Number(e.target.value) || 1)}
                />
              </div>
              <div className="flex-row" style={{ marginBottom: 8 }}>
                起针针数
                <input
                  type="number" min={0} max={1000}
                  defaultValue={project.settings.castOn}
                  onChange={(e) => changeCastOn(Number(e.target.value) || 0)}
                />
              </div>
              <p className="hint">
                缩小网格会丢弃越界的格（进入撤销历史）。起针数为 0 时不校验首行边界。
              </p>
              <h4>快捷操作</h4>
              <div className="hint" style={{ lineHeight: 2 }}>
                <div><span className="kbd">V</span>/<span className="kbd">E</span>/<span className="kbd">S</span> 绘制 / 擦除 / 框选</div>
                <div><span className="kbd">拖动</span> 拖笔连续绘制；<span className="kbd">M</span> 镜像选区</div>
                <div><span className="kbd">方向键</span> 移动选区（Shift ×5）</div>
                <div><span className="kbd">Ctrl</span>+<span className="kbd">C/X/V</span> 复制 / 剪切 / 粘贴</div>
                <div><span className="kbd">Del</span> 清除选区</div>
              </div>
            </div>
          )}
        </aside>

        <main className="canvas-wrap">
          <div className="canvas-area">
            {/* 行号 + 进出针数栏：内容按画布滚动量平移 */}
            <div className="gutter-left" style={{ width: ROW_GUTTER_W }}>
              <div style={{ transform: `translateY(${-scroll.y}px)`, width: '100%' }}>
                {rowItems.map((r) => {
                  const rv = validation.rows[r]!;
                  const bad = rv.startMismatch !== 0;
                  const expected = r === 0 ? project.settings.castOn : validation.rows[r - 1]!.outCount;
                  return (
                    <div
                      key={r}
                      className={`gutter-cell${bad ? ' bad' : ''}`}
                      style={{ height: cellSize }}
                      title={
                        bad
                          ? `第 ${r + 1} 行起始针数不匹配：本行吃 ${rv.inCount}，上一行出 ${expected}`
                          : `第 ${r + 1} 行：吃 ${rv.inCount} / 出 ${rv.outCount}`
                      }
                    >
                      <span className="rn">{r + 1}</span>
                      <span className="cnt">{rv.inCount}/{rv.outCount}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {/* 列号栏 */}
              <div style={{ height: 22, flex: 'none', overflow: 'hidden', background: 'var(--panel)', borderBottom: '1px solid var(--panel-border)' }}>
                <div style={{ position: 'relative', width: virtualW, height: 22, transform: `translateX(${-scroll.x}px)` }}>
                  {Array.from({ length: project.settings.width }, (_, c) => (
                    <div
                      key={c}
                      style={{
                        position: 'absolute',
                        left: c * cellSize,
                        top: 0,
                        width: cellSize,
                        textAlign: 'center',
                        fontSize: 10,
                        lineHeight: '22px',
                        color: c % 5 === 0 ? '#555' : '#aaa',
                      }}
                    >
                      {c % 5 === 0 ? c + 1 : ''}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                <StitchCanvas
                  width={project.settings.width}
                  height={project.settings.height}
                  cells={project.cells}
                  cellSize={cellSize}
                  mode={mode}
                  selection={selection}
                  mismatchRows={mismatchSet}
                  placingSize={master ? { w: master.width, h: master.height } : null}
                  onStrokeAt={strokeAt}
                  onSelectionDone={selectionDone}
                  onGestureEnd={breakCoalesce}
                  onHover={setHover}
                  onScroll={onCanvasScroll}
                />
              </div>
            </div>
          </div>
        </main>
      </div>

      <div className="statusbar">
        <span>
          {selection
            ? `选区 列${selection.c0 + 1}-${selection.c1 + 1} · 行${selection.r0 + 1}-${selection.r1 + 1}（${selection.c1 - selection.c0 + 1}×${selection.r1 - selection.r0 + 1}）`
            : '未选区'}
        </span>
        <span>针法：{STITCH_MAP[activeStitchId]?.name}</span>
        <span style={{ color: mismatchSet.size ? 'var(--danger)' : 'var(--ok)' }}>
          {mismatchSet.size ? `⚠ ${mismatchSet.size} 行针数不匹配` : '✓ 针数平衡'}
        </span>
        <span style={{ flex: 1 }} />
        <span>{project.cells.length} 格 · {project.masters.length} 母版 · {project.placements.length} 引用</span>
        <span className="hint">全部数据仅保存在本机浏览器</span>
      </div>

      {editingMasterId && <MasterEditor />}
      {showPrint && <PrintOverlay onClose={() => setShowPrint(false)} />}
    </div>
  );
}
