import type { DrawKind } from '../types';

/**
 * 针法符号的矢量字形，统一定义在 24×24 坐标盒内。
 * 同一份 path 数据用于三处：
 *  1. Konva 画布（Path2D 描边）
 *  2. 花样母版编辑器（canvas）
 *  3. 打印视图（SVG <path>）
 */
export const GLYPHS: Record<DrawKind, string> = {
  knit:  '',
  purl:  'M5 12 H19',
  yo:    'M7 12 A5 5 0 1 0 17 12 A5 5 0 1 0 7 12 Z',
  k2tog: 'M7 18 L17 6',
  ssk:   'M7 6 L17 18',
  k3tog: 'M5 18 L12 6 M12 18 L19 6',
  sssk:  'M5 6 L12 18 M12 6 L19 18',
  cdd:   'M6 18 L12 6 L18 18',
  kfb:   'M6 7 L12 17 L18 7',
  m1l:   'M9 18 L15 6 M15 6 L10 8.5',
  m1r:   'M15 18 L9 6 M9 6 L14 8.5',
  nost:  'M6 6 L18 18 M18 6 L6 18',
};

const pathCache = new Map<string, Path2D>();

export function glyphPath2D(kind: DrawKind): Path2D | null {
  const d = GLYPHS[kind];
  if (!d) return null;
  let p = pathCache.get(kind);
  if (!p) {
    p = new Path2D(d);
    pathCache.set(kind, p);
  }
  return p;
}

/** 在 canvas 上绘制一个针法符号（x,y 为格子左上角，size 为边长） */
export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  kind: DrawKind,
  x: number,
  y: number,
  size: number,
  ink: string,
): void {
  const p = glyphPath2D(kind);
  if (!p) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(p);
  ctx.restore();
}
