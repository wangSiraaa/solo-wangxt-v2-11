import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Layer, Line, Path, Rect, Shape, Stage } from 'react-konva';
import type Konva from 'konva';
import type { ChartCell, Rect as ChartRect } from '../types';
import { STITCH_MAP, YARN_MAP } from '../data/stitches';
import { key } from '../lib/grid';

export type CanvasMode = 'paint' | 'erase' | 'select' | 'place';

interface StitchCanvasProps {
  width: number;
  height: number;
  cells: ChartCell[];
  cellSize: number;
  mode: CanvasMode;
  selection: ChartRect | null;
  mismatchRows: Set<number>;
  placingSize?: { w: number; h: number } | null;

  onStrokeAt: (col: number, row: number) => void;
  onSelectionDone: (rect: ChartRect, additive: boolean) => void;
  onGestureEnd: () => void;
  onHover: (h: { col: number; row: number } | null) => void;
  onScroll?: (s: { x: number; y: number }) => void;
}

/** row=0 在底部：格行 → 屏幕 y（顶边） */
export const rowToY = (row: number, height: number, cell: number) =>
  (height - 1 - row) * cell;
const yToRow = (y: number, height: number, cell: number) =>
  height - 1 - Math.floor(y / cell);

interface DragState {
  kind: 'stroke' | 'rubber';
  start: { col: number; row: number };
  additive: boolean;
  moved: boolean;
}

export default function StitchCanvas(props: StitchCanvasProps) {
  const {
    width,
    height,
    cells,
    cellSize,
    mode,
    selection,
    mismatchRows,
    placingSize,
    onStrokeAt,
    onSelectionDone,
    onGestureEnd,
    onHover,
    onScroll,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [viewport, setViewport] = useState({ w: 800, h: 600 });
  const [scroll, setScroll] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<{ col: number; row: number } | null>(null);
  const [rubber, setRubber] = useState<ChartRect | null>(null);
  const drag = useRef<DragState | null>(null);

  const virtualW = width * cellSize;
  const virtualH = height * cellSize;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setViewport({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 选区存在网格坐标里；滚动只改变渲染视口，不触碰选区（大网格滚动不丢选区）
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const s = { x: el.scrollLeft, y: el.scrollTop };
    setScroll(s);
    onScroll?.(s);
  }, [onScroll]);

  const pointerCell = () => {
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition();
    if (!pos) return null;
    const col = Math.max(0, Math.min(width - 1, Math.floor(pos.x / cellSize)));
    const row = Math.max(0, Math.min(height - 1, yToRow(pos.y, height, cellSize)));
    return { col, row };
  };

  const handleDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pc = pointerCell();
    if (!pc) return;
    const native = e.evt as MouseEvent | TouchEvent;
    const additive = 'shiftKey' in native ? native.shiftKey : false;
    if (mode === 'select') {
      drag.current = { kind: 'rubber', start: pc, additive, moved: false };
      setRubber({ c0: pc.col, r0: pc.row, c1: pc.col, r1: pc.row });
    } else {
      drag.current = { kind: 'stroke', start: pc, additive, moved: false };
      onStrokeAt(pc.col, pc.row);
    }
  };

  const handleMove = () => {
    const pc = pointerCell();
    if (!pc) return;
    setHover(pc);
    onHover(pc);
    const d = drag.current;
    if (!d) return;
    if (pc.col !== d.start.col || pc.row !== d.start.row) d.moved = true;
    if (d.kind === 'stroke') {
      onStrokeAt(pc.col, pc.row);
    } else {
      setRubber({
        c0: Math.min(d.start.col, pc.col),
        r0: Math.min(d.start.row, pc.row),
        c1: Math.max(d.start.col, pc.col),
        r1: Math.max(d.start.row, pc.row),
      });
    }
  };

  const handleUp = () => {
    const d = drag.current;
    if (d?.kind === 'rubber') {
      const r = rubber;
      if (r) onSelectionDone(r, d.additive);
      setRubber(null);
    }
    drag.current = null;
    onGestureEnd();
  };

  // 虚拟化：只渲染可见窗口附近的格
  const visible = useMemo(() => {
    const c0 = Math.max(0, Math.floor(scroll.x / cellSize) - 1);
    const c1 = Math.min(width - 1, Math.ceil((scroll.x + viewport.w) / cellSize) + 1);
    const topRow = Math.min(height - 1, height - 1 - Math.floor(scroll.y / cellSize) + 1);
    const bottomRow = Math.max(
      0,
      height - 1 - Math.ceil((scroll.y + viewport.h) / cellSize) - 1,
    );
    return { c0, c1, r0: bottomRow, r1: topRow };
  }, [scroll.x, scroll.y, viewport.w, viewport.h, cellSize, width, height]);

  const cellMap = useMemo(() => {
    const m = new Map<string, ChartCell>();
    for (const c of cells) {
      if (c.col >= visible.c0 && c.col <= visible.c1 && c.row >= visible.r0 && c.row <= visible.r1) {
        m.set(key(c.col, c.row), c);
      }
    }
    return m;
  }, [cells, visible]);

  const positions = useMemo(() => {
    const out: { col: number; row: number }[] = [];
    for (let r = visible.r0; r <= visible.r1; r++)
      for (let c = visible.c0; c <= visible.c1; c++) out.push({ col: c, row: r });
    return out;
  }, [visible]);

  const gridScene = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ctx: any) => {
      ctx.beginPath();
      mismatchRows.forEach((r) => {
        ctx.rect(0, rowToY(r, height, cellSize), virtualW, cellSize);
      });
      ctx.fillStyle = 'rgba(214, 69, 65, 0.14)';
      ctx.fill();

      const drawLines = (step: number, color: string) => {
        ctx.beginPath();
        for (let c = 0; c <= width; c += step) {
          const x = c * cellSize + 0.5;
          ctx.moveTo(x, 0);
          ctx.lineTo(x, virtualH);
        }
        for (let r = 0; r <= height; r += step) {
          const y = r * cellSize + 0.5;
          ctx.moveTo(0, y);
          ctx.lineTo(virtualW, y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
      };
      drawLines(1, '#e0dbd0');
      drawLines(5, '#b4ad99');
    },
    [mismatchRows, width, height, cellSize, virtualW, virtualH],
  );

  const scale = cellSize / 32;
  const placingHover = mode === 'place' && placingSize && hover ? hover : null;

  return (
    <div ref={containerRef} className="canvas-scroll" onScroll={handleScroll}>
      <Stage
        ref={stageRef}
        width={virtualW}
        height={virtualH}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={() => {
          setHover(null);
          onHover(null);
          handleUp();
        }}
        onTouchStart={handleDown}
        onTouchMove={handleMove}
        onTouchEnd={handleUp}
      >
        <Layer listening={false}>
          <Shape
            sceneFunc={(ctx, shape) => {
              gridScene(ctx);
              ctx.fillStrokeShape(shape);
            }}
          />
        </Layer>
        <Layer>
          {positions.map(({ col, row }) => {
            const cell = cellMap.get(key(col, row));
            const def = cell ? STITCH_MAP[cell.stitchId] : undefined;
            const yarn = cell?.colorId ? YARN_MAP[cell.colorId] : undefined;
            return (
              <Group key={key(col, row)} x={col * cellSize} y={rowToY(row, height, cellSize)} listening={false}>
                {yarn && def?.id !== 'nost' && (
                  <Rect width={cellSize} height={cellSize} fill={yarn.fill} />
                )}
                {def?.id === 'nost' && (
                  <>
                    <Rect width={cellSize} height={cellSize} fill="#e8e3d7" />
                    <Line
                      points={[2, 2, cellSize - 2, cellSize - 2]}
                      stroke="#b0a892"
                      strokeWidth={1.4}
                    />
                  </>
                )}
                {cell && def?.glyph && (
                  <Path
                    data={def.glyph}
                    scaleX={scale}
                    scaleY={scale}
                    stroke={yarn?.stroke ?? '#33302a'}
                    strokeWidth={2.1 / scale}
                    lineCap="round"
                    lineJoin="round"
                  />
                )}
                {cell?.ref && (
                  <Circle x={cellSize - 3.5} y={cellSize - 3.5} radius={2.3} fill="#2f6fb0" />
                )}
              </Group>
            );
          })}

          {hover && mode !== 'select' && !placingHover && (
            <Rect
              x={hover.col * cellSize}
              y={rowToY(hover.row, height, cellSize)}
              width={cellSize}
              height={cellSize}
              stroke={mode === 'erase' ? '#d64541' : '#2f6fb0'}
              strokeWidth={1.5}
              listening={false}
            />
          )}
          {placingHover && placingSize && (
            <Rect
              x={placingHover.col * cellSize}
              y={rowToY(placingHover.row + placingSize.h - 1, height, cellSize)}
              width={placingSize.w * cellSize}
              height={placingSize.h * cellSize}
              fill="rgba(47,111,176,0.12)"
              stroke="#2f6fb0"
              dash={[4, 3]}
              listening={false}
            />
          )}

          {selection && (
            <Rect
              x={selection.c0 * cellSize - 1}
              y={rowToY(selection.r1, height, cellSize) - 1}
              width={(selection.c1 - selection.c0 + 1) * cellSize + 2}
              height={(selection.r1 - selection.r0 + 1) * cellSize + 2}
              fill="rgba(47,111,176,0.10)"
              stroke="#2f6fb0"
              strokeWidth={1.6}
              listening={false}
            />
          )}
          {rubber && (
            <Rect
              x={rubber.c0 * cellSize - 1}
              y={rowToY(rubber.r1, height, cellSize) - 1}
              width={(rubber.c1 - rubber.c0 + 1) * cellSize + 2}
              height={(rubber.r1 - rubber.r0 + 1) * cellSize + 2}
              fill="rgba(47,111,176,0.20)"
              stroke="#2f6fb0"
              dash={[5, 3]}
              listening={false}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}
