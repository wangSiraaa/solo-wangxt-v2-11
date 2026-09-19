import { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Rect as KRect, Shape, Stage } from 'react-konva';
import { useStore } from '../state/store';
import { cellKey, computeRows } from '../lib/stitchMath';
import { COLOR_MAP, SYMBOL_MAP, inkFor } from '../data/symbols';
import { drawGlyph } from '../lib/glyphs';
import { normalizeRect } from '../lib/ops';

const GUTTER_L = 46;   // 左侧行号栏宽
const GUTTER_B = 26;   // 底部列号栏高
const SB = 12;         // 滚动条厚度
const MIN_CELL = 14;
const MAX_CELL = 48;

/**
 * 主网格画布。
 * - Konva 负责选区与符号绘制；可见区域外的格子不渲染（大网格虚拟化）
 * - 选区保存在「模型坐标」（行/列）中，滚动只改视图偏移，选区永不丢失
 */
export function GridCanvas() {
  const project = useStore((s) => s.project);
  const view = useStore((s) => s.view);
  const selection = useStore((s) => s.selection);
  const tool = useStore((s) => s.tool);
  const placing = useStore((s) => s.placing);
  const masters = useStore((s) => s.masters);
  const impact = useStore((s) => s.impact);
  const jump = useStore((s) => s.jump);
  const setView = useStore((s) => s.setView);
  const setSelection = useStore((s) => s.setSelection);

  const wrapRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 600, h: 400 });
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const selectingRef = useRef<{ r: number; c: number } | null>(null);
  const strokingRef = useRef(false);

  const rows = project?.rows ?? 0;
  const cols = project?.cols ?? 0;
  const cell = view.cell;

  const rowsInfo = useMemo(
    () => (project ? computeRows(project) : []),
    [project],
  );
  const conflictRows = useMemo(
    () => new Set(rowsInfo.filter((r) => !r.ok).map((r) => r.row)),
    [rowsInfo],
  );
  const impactSet = useMemo(() => new Set(impact?.keys ?? []), [impact]);

  /* 视口尺寸跟踪 */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({ w: Math.max(100, rect.width - SB), h: Math.max(100, rect.height - SB) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* 把视口尺寸同步进 store（粘贴定位用） */
  useEffect(() => {
    if (size.w !== view.vw || size.h !== view.vh) setView({ vw: size.w, vh: size.h });
  }, [size, view.vw, view.vh, setView]);

  const contentW = cols * cell;
  const contentH = rows * cell;
  const maxX = Math.max(0, contentW - (size.w - GUTTER_L));
  const maxY = Math.max(0, contentH - (size.h - GUTTER_B));

  const clampScroll = (x: number, y: number) => ({
    x: Math.max(0, Math.min(maxX, x)),
    y: Math.max(0, Math.min(maxY, y)),
  });

  /* 工程切换 / 缩放 / 窗口变化后，把滚动位置收敛到合法范围 */
  const projectId = project?.id;
  useEffect(() => {
    const clamped = clampScroll(view.x, view.y);
    if (clamped.x !== view.x || clamped.y !== view.y) setView(clamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, view.cell, size.w, size.h]);

  /* 跳转到指定行列（校验面板点击） */
  useEffect(() => {
    if (!jump || !project) return;
    const tx = (jump.c - 1) * cell - (size.w - GUTTER_L) / 2 + cell / 2;
    const ty = (rows - jump.r) * cell - (size.h - GUTTER_B) / 2 + cell / 2;
    setView(clampScroll(tx, ty));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump]);

  /* 每次渲染后重绘 Konva 层 */
  useEffect(() => {
    layerRef.current?.getLayer()?.batchDraw();
  });

  /* 指针 → 模型坐标 */
  const toCell = (clientX: number, clientY: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const gx = px - GUTTER_L + view.x;
    const gy = py + view.y;
    const c = Math.floor(gx / cell) + 1;
    const r = rows - Math.floor(gy / cell);
    return { r, c, px, py };
  };

  const inGrid = (r: number, c: number) => r >= 1 && r <= rows && c >= 1 && c <= cols;

  /* 拖动到边缘时自动滚动（选区以模型坐标保存，滚动不丢选区） */
  const autoScroll = (px: number, py: number) => {
    let dx = 0, dy = 0;
    if (px < GUTTER_L + 20) dx = -cell;
    else if (px > size.w - 20) dx = cell;
    if (py < 20) dy = -cell;
    else if (py > size.h - GUTTER_B - 20) dy = cell;
    if (dx || dy) setView(clampScroll(view.x + dx, view.y + dy));
  };

  const onMouseDown = (e: any) => {
    if (!project || e.evt.button !== 0) return;
    const { r, c } = toCell(e.evt.clientX, e.evt.clientY);
    const st = useStore.getState();
    if (placing) {
      if (inGrid(r, c)) st.placeAt(r, c);
      return;
    }
    if (!inGrid(r, c)) return;
    if (tool === 'select') {
      selectingRef.current = { r, c };
      setSelection({ r0: r, c0: c, r1: r, c1: c });
    } else {
      strokingRef.current = true;
      st.beginStroke();
      st.strokeCell(r, c);
    }
  };

  const onMouseMove = (e: any) => {
    if (!project) return;
    const { r, c, px, py } = toCell(e.evt.clientX, e.evt.clientY);
    setHover(inGrid(r, c) ? { r, c } : null);
    if (selectingRef.current) {
      autoScroll(px, py);
      const cr = Math.max(1, Math.min(rows, r));
      const cc = Math.max(1, Math.min(cols, c));
      setSelection(normalizeRect(selectingRef.current, { r: cr, c: cc }));
    } else if (strokingRef.current) {
      autoScroll(px, py);
      useStore.getState().strokeCell(r, c);
    }
  };

  useEffect(() => {
    const up = () => {
      if (strokingRef.current) {
        strokingRef.current = false;
        useStore.getState().endStroke();
      }
      selectingRef.current = null;
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  const onWheel = (e: any) => {
    e.evt.preventDefault();
    if (!project) return;
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const dir = e.evt.deltaY < 0 ? 1.12 : 0.89;
      const next = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.round(cell * dir)));
      if (next === cell) return;
      const rect = wrapRef.current!.getBoundingClientRect();
      const px = e.evt.clientX - rect.left - GUTTER_L;
      const py = e.evt.clientY - rect.top;
      const cx = px + view.x;
      const cy = py + view.y;
      const k = next / cell;
      setView({ cell: next, ...clampScroll(cx * k - px, cy * k - py) });
    } else {
      setView(clampScroll(view.x + e.evt.deltaX, view.y + e.evt.deltaY));
    }
  };

  /* ---------- 场景绘制（单次 sceneFunc 画完所有可见格子） ---------- */
  const drawScene = (konvaCtx: any) => {
    const ctx: CanvasRenderingContext2D = konvaCtx._context;
    if (!project) return;
    const { w: vw, h: vh } = size;

    ctx.clearRect(0, 0, vw, vh);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, vw, vh);

    const c0 = Math.max(1, Math.floor(view.x / cell) + 1);
    const c1 = Math.min(cols, Math.ceil((view.x + vw - GUTTER_L) / cell));
    const t0 = Math.max(0, Math.floor(view.y / cell));
    const t1 = Math.min(rows - 1, Math.floor((view.y + vh - GUTTER_B) / cell));

    const sx = (c: number) => GUTTER_L + (c - 1) * cell - view.x;
    const sy = (r: number) => (rows - r) * cell - view.y;

    /* 行带状底色 + 单元格颜色 */
    for (let t = t0; t <= t1; t++) {
      const r = rows - t;
      const y = t * cell - view.y;
      if (r % 2 === 0) {
        ctx.fillStyle = '#f6f5f1';
        ctx.fillRect(sx(c0), y, (c1 - c0 + 1) * cell, cell);
      }
      for (let c = c0; c <= c1; c++) {
        const data = project.cells[cellKey(r, c)];
        if (!data) continue;
        const x = sx(c);
        if (data.s === 'nost') {
          ctx.fillStyle = '#d9d9d9';
          ctx.fillRect(x, y, cell, cell);
        } else if (data.c !== 'none') {
          ctx.fillStyle = COLOR_MAP[data.c]?.hex ?? '#ffffff';
          ctx.fillRect(x, y, cell, cell);
        }
      }
    }

    /* 网格线（每 5 格加粗） */
    ctx.lineWidth = 1;
    for (let c = c0 - 1; c <= c1; c++) {
      const x = GUTTER_L + c * cell - view.x + 0.5;
      ctx.strokeStyle = c % 5 === 0 ? '#b5b5b5' : '#e4e4e4';
      ctx.beginPath();
      ctx.moveTo(x, t0 * cell - view.y);
      ctx.lineTo(x, (t1 + 1) * cell - view.y);
      ctx.stroke();
    }
    for (let t = t0; t <= t1 + 1; t++) {
      const r = rows - t; // 该水平线以下的模型行
      const y = t * cell - view.y + 0.5;
      ctx.strokeStyle = r % 5 === 0 ? '#b5b5b5' : '#e4e4e4';
      ctx.beginPath();
      ctx.moveTo(sx(c0), y);
      ctx.lineTo(sx(c1) + cell, y);
      ctx.stroke();
    }

    /* 针法符号 + 花样引用角标 */
    for (let t = t0; t <= t1; t++) {
      const r = rows - t;
      for (let c = c0; c <= c1; c++) {
        const data = project.cells[cellKey(r, c)];
        if (!data) continue;
        const x = sx(c);
        const y = t * cell - view.y;
        const sym = SYMBOL_MAP[data.s];
        if (sym && sym.draw !== 'knit') {
          const hex = data.c !== 'none' ? COLOR_MAP[data.c]?.hex ?? '#fff' : '#ffffff';
          drawGlyph(ctx, sym.draw, x, y, cell, data.s === 'nost' ? '#8a8a8a' : inkFor(hex));
        }
        if (data.src) {
          ctx.fillStyle = 'rgba(124,58,237,0.55)';
          ctx.beginPath();
          ctx.moveTo(x + cell, y);
          ctx.lineTo(x + cell - 6, y);
          ctx.lineTo(x + cell, y + 6);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    /* 母版修改影响预览（橙色高亮） */
    if (impactSet.size > 0) {
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      for (let t = t0; t <= t1; t++) {
        const r = rows - t;
        for (let c = c0; c <= c1; c++) {
          if (!impactSet.has(cellKey(r, c))) continue;
          ctx.strokeRect(sx(c) + 1, t * cell - view.y + 1, cell - 2, cell - 2);
        }
      }
    }

    /* 内容外框 */
    ctx.strokeStyle = '#9a9a9a';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx(1) + 0.5, -view.y + 0.5, contentW, contentH);

    /* 左侧行号栏（行 1 在底部；冲突行红色标记） */
    ctx.fillStyle = '#efeee9';
    ctx.fillRect(0, 0, GUTTER_L, vh - GUTTER_B);
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const labelEvery = cell >= 18 ? 1 : 5;
    for (let t = t0; t <= t1; t++) {
      const r = rows - t;
      const y = t * cell - view.y + cell / 2;
      const conflict = conflictRows.has(r);
      if (conflict) {
        ctx.fillStyle = '#fee2e2';
        ctx.fillRect(0, t * cell - view.y, GUTTER_L - 2, cell);
      }
      if (r % labelEvery === 0 || conflict) {
        ctx.fillStyle = conflict ? '#dc2626' : '#6b6b6b';
        ctx.fillText(String(r), GUTTER_L - 8, y);
      }
      if (conflict) {
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(GUTTER_L - 5, y - 4);
        ctx.lineTo(GUTTER_L - 1, y);
        ctx.lineTo(GUTTER_L - 5, y + 4);
        ctx.closePath();
        ctx.fill();
      }
    }

    /* 底部列号栏 */
    ctx.fillStyle = '#efeee9';
    ctx.fillRect(0, vh - GUTTER_B, vw, GUTTER_B);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6b6b6b';
    for (let c = c0; c <= c1; c++) {
      if (c % labelEvery !== 0) continue;
      ctx.fillText(String(c), sx(c) + cell / 2, vh - GUTTER_B / 2);
    }

    /* 分隔线 */
    ctx.strokeStyle = '#c9c9c9';
    ctx.beginPath();
    ctx.moveTo(GUTTER_L + 0.5, 0);
    ctx.lineTo(GUTTER_L + 0.5, vh - GUTTER_B);
    ctx.moveTo(0, vh - GUTTER_B + 0.5);
    ctx.lineTo(vw, vh - GUTTER_B + 0.5);
    ctx.stroke();
  };

  /* ---------- 选区 / 放置预览（模型坐标 → 屏幕坐标） ---------- */
  const selRect = selection
    ? {
        x: GUTTER_L + (selection.c0 - 1) * cell - view.x,
        y: (rows - selection.r1) * cell - view.y,
        w: (selection.c1 - selection.c0 + 1) * cell,
        h: (selection.r1 - selection.r0 + 1) * cell,
      }
    : null;

  const placingMaster = placing ? masters.find((m) => m.id === placing.masterId) : null;
  const ghostRect =
    placing && placingMaster && hover
      ? {
          x: GUTTER_L + (hover.c - 1) * cell - view.x,
          y: (rows - (hover.r + placingMaster.rows * placing.repY - 1)) * cell - view.y,
          w: placingMaster.cols * placing.repX * cell,
          h: placingMaster.rows * placing.repY * cell,
        }
      : null;

  const hoverRow = hover ? rowsInfo[hover.r - 1] : null;

  if (!project) return <div className="grid-wrap" ref={wrapRef} />;

  return (
    <div className="grid-wrap" ref={wrapRef}>
      <Stage
        width={size.w}
        height={size.h}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onWheel={onWheel}
        onContextMenu={(e: any) => e.evt.preventDefault()}
      >
        <Layer listening={false}>
          <Shape ref={layerRef} sceneFunc={drawScene} />
        </Layer>
        <Layer listening={false}>
          {selRect && (
            <KRect
              x={selRect.x} y={selRect.y} width={selRect.w} height={selRect.h}
              fill="rgba(37,99,235,0.12)" stroke="#2563eb" strokeWidth={1.5}
              dash={[5, 3]}
            />
          )}
          {ghostRect && (
            <KRect
              x={ghostRect.x} y={ghostRect.y} width={ghostRect.w} height={ghostRect.h}
              fill="rgba(22,163,74,0.10)" stroke="#16a34a" strokeWidth={1.5}
              dash={[6, 4]}
            />
          )}
        </Layer>
      </Stage>

      <ScrollBar
        vertical
        track={size.h}
        viewport={size.h - GUTTER_B}
        content={contentH}
        scroll={view.y}
        onScroll={(y) => setView(clampScroll(view.x, y))}
      />
      <ScrollBar
        track={size.w}
        viewport={size.w - GUTTER_L}
        content={contentW}
        scroll={view.x}
        onScroll={(x) => setView(clampScroll(x, view.y))}
      />

      {hover && (
        <div className="hover-badge">
          行 {hover.r} · 列 {hover.c}
          {hoverRow && (
            <span className={hoverRow.ok ? '' : 'bad'}>
              {'　'}行首 {hoverRow.start} 针 → 行末 {hoverRow.end} 针
              {!hoverRow.ok && '（针数不符）'}
            </span>
          )}
        </div>
      )}
      {placing && placingMaster && (
        <div className="placing-badge">
          点击网格放置「{placingMaster.name}」（{placing.repX}×{placing.repY} 循环）· Esc 取消
        </div>
      )}
    </div>
  );
}

/** 自定义滚动条（选区保存在模型坐标中，滚动不影响选区） */
function ScrollBar(props: {
  vertical?: boolean;
  track: number;
  viewport: number;
  content: number;
  scroll: number;
  onScroll: (v: number) => void;
}) {
  const { vertical, track, viewport, content, scroll, onScroll } = props;
  const max = Math.max(0, content - viewport);
  const thumbLen = content <= 0 ? track : Math.max(24, (track * viewport) / Math.max(content, viewport));
  const pos = max <= 0 ? 0 : (scroll / max) * (track - thumbLen);
  const dragRef = useRef<{ start: number; scroll: number } | null>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || max <= 0) return;
      const delta = (vertical ? e.clientY : e.clientX) - d.start;
      onScroll(Math.max(0, Math.min(max, d.scroll + (delta * max) / (track - thumbLen))));
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [max, track, thumbLen, vertical, onScroll]);

  if (max <= 0) return null;

  return (
    <div
      className={vertical ? 'sb sb-v' : 'sb sb-h'}
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return;
        const ratio = vertical
          ? (e.nativeEvent.offsetY - thumbLen / 2) / (track - thumbLen)
          : (e.nativeEvent.offsetX - thumbLen / 2) / (track - thumbLen);
        onScroll(Math.max(0, Math.min(max, ratio * max)));
      }}
    >
      <div
        className="sb-thumb"
        style={vertical ? { height: thumbLen, top: pos } : { width: thumbLen, left: pos }}
        onPointerDown={(e) => {
          dragRef.current = { start: vertical ? e.clientY : e.clientX, scroll };
          e.preventDefault();
        }}
      />
    </div>
  );
}
