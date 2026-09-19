import type { StitchSymbol, YarnColor } from '../types';

/**
 * 本地针法图例。
 * consumes/produces 是针数计算的核心：
 *  - 下针/上针：1 针进 1 针出
 *  - 并针（k2tog 等）：多针进 1 针出（减针）
 *  - 空针/加针：0 针进 1 针出（加针）
 *  - 无针目：占位，不进不出（用于织物变窄后的图表空格）
 * mirrorOf 用于左右镜像选区时互换倾斜方向。
 */
export const SYMBOLS: StitchSymbol[] = [
  { id: 'knit',  name: '下针',           short: 'K',    consumes: 1, produces: 1, draw: 'knit',  description: '正针，空白格表示' },
  { id: 'purl',  name: '上针',           short: 'P',    consumes: 1, produces: 1, draw: 'purl',  description: '反针' },
  { id: 'yo',    name: '空针（挂针）',    short: 'YO',   consumes: 0, produces: 1, draw: 'yo',    description: '加 1 针，形成镂空' },
  { id: 'k2tog', name: '右上二并一',      short: 'K2tog', consumes: 2, produces: 1, mirrorOf: 'ssk',  draw: 'k2tog', description: '右倾减针' },
  { id: 'ssk',   name: '左上二并一',      short: 'SSK',   consumes: 2, produces: 1, mirrorOf: 'k2tog', draw: 'ssk',   description: '左倾减针' },
  { id: 'k3tog', name: '右上三并一',      short: 'K3tog', consumes: 3, produces: 1, mirrorOf: 'sssk', draw: 'k3tog', description: '右倾减 2 针' },
  { id: 'sssk',  name: '左上三并一',      short: 'SSSK',  consumes: 3, produces: 1, mirrorOf: 'k3tog', draw: 'sssk', description: '左倾减 2 针' },
  { id: 'cdd',   name: '中上三并一',      short: 'CDD',   consumes: 3, produces: 1, draw: 'cdd',   description: '居中减 2 针，镜像不变' },
  { id: 'kfb',   name: '一针放两针',      short: 'KFB',   consumes: 1, produces: 2, draw: 'kfb',   description: '在同一针里织两针' },
  { id: 'm1l',   name: '左扭加针',        short: 'M1L',   consumes: 0, produces: 1, mirrorOf: 'm1r', draw: 'm1l', description: '左倾加 1 针' },
  { id: 'm1r',   name: '右扭加针',        short: 'M1R',   consumes: 0, produces: 1, mirrorOf: 'm1l', draw: 'm1r', description: '右倾加 1 针' },
  { id: 'nost',  name: '无针目',          short: '—',     consumes: 0, produces: 0, draw: 'nost',  description: '此处没有针（织物已收窄）' },
];

export const SYMBOL_MAP: Record<string, StitchSymbol> = Object.fromEntries(
  SYMBOLS.map((s) => [s.id, s]),
);

/** 左右镜像时使用的符号（倾斜方向互换） */
export function mirrorSymbolId(id: string): string {
  const s = SYMBOL_MAP[id];
  return s?.mirrorOf ?? id;
}

/** 本地颜色图例 */
export const COLORS: YarnColor[] = [
  { id: 'none',   name: '本白', hex: '#ffffff' },
  { id: 'gray',   name: '浅灰', hex: '#c9c9c9' },
  { id: 'black',  name: '墨黑', hex: '#26262b' },
  { id: 'red',    name: '朱红', hex: '#d92638' },
  { id: 'orange', name: '橘橙', hex: '#f27316' },
  { id: 'yellow', name: '明黄', hex: '#f5c518' },
  { id: 'green',  name: '草绿', hex: '#2e9e4f' },
  { id: 'teal',   name: '青碧', hex: '#0f9488' },
  { id: 'blue',   name: '靛蓝', hex: '#2f5fd0' },
  { id: 'purple', name: '紫藤', hex: '#8b3fd9' },
  { id: 'pink',   name: '樱粉', hex: '#ef6fae' },
  { id: 'brown',  name: '栗棕', hex: '#8a5a2b' },
];

export const COLOR_MAP: Record<string, YarnColor> = Object.fromEntries(
  COLORS.map((c) => [c.id, c]),
);

/** 根据底色亮度选择符号墨色 */
export function inkFor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#1f2937';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum < 130 ? '#f4f4f5' : '#1f2937';
}
