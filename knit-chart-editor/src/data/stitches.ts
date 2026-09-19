import type { StitchDef, StitchCategory } from '../types';

/**
 * 本地针法图例。所有数据内置、离线可用。
 * 符号 path 均在 32×32 viewBox 中；Konva Path 与打印 SVG 共用同一数据。
 */
export const STITCHES: StitchDef[] = [
  {
    id: 'knit',
    name: '下针',
    short: 'K',
    category: '基础',
    inStitches: 1,
    outStitches: 1,
    glyph: null, // 蕾丝图惯例：下针留白
    mirror: null,
  },
  {
    id: 'purl',
    name: '上针',
    short: 'P',
    category: '基础',
    inStitches: 1,
    outStitches: 1,
    glyph: 'M16 7 a9 9 0 1 0 0 18 a9 9 0 1 0 0 -18 Z',
    mirror: null,
  },
  {
    id: 'nost',
    name: '无针（成形空格）',
    short: '∅',
    category: '基础',
    inStitches: 0,
    outStitches: 0,
    glyph: null, // 以灰色底块绘制
    mirror: null,
  },
  {
    id: 'k2tog',
    name: '右上二并一',
    short: 'k2tog',
    category: '减针',
    inStitches: 2,
    outStitches: 1,
    glyph: 'M6 27 L26 5 M21 5 L26 5 L26 10',
    mirror: 'ssk',
  },
  {
    id: 'ssk',
    name: '左上二并一',
    short: 'ssk',
    category: '减针',
    inStitches: 2,
    outStitches: 1,
    glyph: 'M6 5 L26 27 M21 27 L26 27 L26 22',
    mirror: 'k2tog',
  },
  {
    id: 'p2tog',
    name: '右上上针二并一',
    short: 'p2tog',
    category: '减针',
    inStitches: 2,
    outStitches: 1,
    glyph: 'M6 27 L26 5 M13 16 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z',
    mirror: 'ssp',
  },
  {
    id: 'ssp',
    name: '左上上针二并一',
    short: 'ssp',
    category: '减针',
    inStitches: 2,
    outStitches: 1,
    glyph: 'M6 5 L26 27 M13 16 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z',
    mirror: 'p2tog',
  },
  {
    id: 'k3tog',
    name: '右上三并一',
    short: 'k3tog',
    category: '减针',
    inStitches: 3,
    outStitches: 1,
    glyph: 'M4 27 L18 5 M12 27 L28 8',
    mirror: 'sssk',
  },
  {
    id: 'sssk',
    name: '左上三并一',
    short: 'sssk',
    category: '减针',
    inStitches: 3,
    outStitches: 1,
    glyph: 'M28 27 L14 5 M20 27 L4 8',
    mirror: 'k3tog',
  },
  {
    id: 'cdd',
    name: '中上三并一',
    short: 'cdd',
    category: '减针',
    inStitches: 3,
    outStitches: 1,
    glyph: 'M6 5 L16 27 L26 5 M16 2 L16 12',
    mirror: null,
  },
  {
    id: 'yo',
    name: '空加针（绕线）',
    short: 'yo',
    category: '加针',
    inStitches: 0,
    outStitches: 1,
    glyph: 'M16 7 a9 9 0 1 0 0 18 a9 9 0 1 0 0 -18 Z',
    mirror: null,
  },
  {
    id: 'm1r',
    name: '右加针',
    short: 'M1R',
    category: '加针',
    inStitches: 1,
    outStitches: 2,
    glyph: 'M7 27 L25 5 M19 5 L25 5 L25 11 M12 27 L7 27 L7 21',
    mirror: 'm1l',
  },
  {
    id: 'm1l',
    name: '左加针',
    short: 'M1L',
    category: '加针',
    inStitches: 1,
    outStitches: 2,
    glyph: 'M25 27 L7 5 M13 5 L7 5 L7 11 M20 27 L25 27 L25 21',
    mirror: 'm1r',
  },
  {
    id: 'kfb',
    name: '一加一（针内加减）',
    short: 'kfb',
    category: '加针',
    inStitches: 1,
    outStitches: 2,
    glyph: 'M16 28 L16 15 M16 15 L6 5 M16 15 L26 5 M12 8 L6 5 L10 3 M20 8 L26 5 L22 3',
    mirror: null,
  },
  {
    id: 'cblR',
    name: '右倾绞花（2 针交叉）',
    short: 'C2R',
    category: '绞花',
    inStitches: 2,
    outStitches: 2,
    glyph: 'M8 4 C8 14 24 18 24 28 M24 4 C24 14 8 18 8 28',
    mirror: 'cblL',
  },
  {
    id: 'cblL',
    name: '左倾绞花（2 针交叉）',
    short: 'C2L',
    category: '绞花',
    inStitches: 2,
    outStitches: 2,
    glyph: 'M8 4 C8 14 24 18 24 28 M24 4 C24 14 8 18 8 28',
    mirror: 'cblR',
  },
  {
    id: 'slip',
    name: '滑针',
    short: 'sl',
    category: '其他',
    inStitches: 1,
    outStitches: 1,
    glyph: 'M6 12 L26 12 L21 7 M26 12 L21 17 M6 22 L26 22',
    mirror: null,
  },
  {
    id: 'bobble',
    name: '豆豆针（5 针球）',
    short: 'mb',
    category: '其他',
    inStitches: 1,
    outStitches: 1,
    glyph: 'M16 7 a9 9 0 1 0 0 18 a9 9 0 1 0 0 -18 Z M16 12 a4 4 0 1 0 0 8 a4 4 0 1 0 0 -8 Z',
    mirror: null,
  },
];

export const STITCH_MAP: Record<string, StitchDef> = Object.fromEntries(
  STITCHES.map((s) => [s.id, s]),
);

export const STITCH_CATEGORIES: StitchCategory[] = ['基础', '减针', '加针', '绞花', '其他'];

/** 纱线颜色图例（本地色板）；null 表示不上底色 */
export interface YarnColor {
  id: string;
  name: string;
  /** 单元格底色 */
  fill: string;
  /** 该底色下符号描边色 */
  stroke: string;
}

export const YARN_COLORS: YarnColor[] = [
  { id: 'cream', name: '奶白', fill: '#f6efdf', stroke: '#3d3830' },
  { id: 'gray', name: '中灰', fill: '#bdbdbd', stroke: '#2e2e2e' },
  { id: 'rose', name: '玫瑰红', fill: '#e0858a', stroke: '#4a1f22' },
  { id: 'denim', name: '牛仔蓝', fill: '#7ea7d0', stroke: '#17304d' },
  { id: 'moss', name: '苔绿', fill: '#9cbb86', stroke: '#24381a' },
  { id: 'mustard', name: '芥黄', fill: '#e3c463', stroke: '#4a3c0d' },
  { id: 'plum', name: '梅紫', fill: '#b48ac7', stroke: '#381c48' },
];

export const YARN_MAP: Record<string, YarnColor> = Object.fromEntries(
  YARN_COLORS.map((c) => [c.id, c]),
);
