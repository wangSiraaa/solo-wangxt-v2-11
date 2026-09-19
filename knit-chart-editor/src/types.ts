/** 全局类型定义 */

/** 针法符号（本地图例数据） */
export interface StitchSymbol {
  id: string;
  /** 中文名 */
  name: string;
  /** 缩写 */
  short: string;
  /** 从棒针上消耗的针数 */
  consumes: number;
  /** 织完后产生的针数 */
  produces: number;
  /** 左右镜像时互换的符号 id（如 k2tog ↔ ssk）；无则镜像自身 */
  mirrorOf?: string;
  /** 绘制类型（glyph 键名） */
  draw: DrawKind;
  description: string;
}

export type DrawKind =
  | 'knit' | 'purl' | 'yo'
  | 'k2tog' | 'ssk' | 'k3tog' | 'sssk' | 'cdd'
  | 'kfb' | 'm1l' | 'm1r' | 'nost';

export interface YarnColor {
  id: string;
  name: string;
  hex: string;
}

/** 单元格数据。s=针法 c=颜色 src=花样母版引用（展开后保留） */
export interface CellData {
  s: string;
  c: string;
  src?: { m: string; i: string };
}

/** key 为 "行,列"（1 起始，行自下而上） */
export type CellMap = Record<string, CellData>;

/** 花样实例：母版在主图上的一次循环展开 */
export interface MasterInstance {
  id: string;
  masterId: string;
  /** 左下角锚点（1 起始） */
  originR: number;
  originC: number;
  repX: number;
  repY: number;
}

export interface Project {
  id: string;
  name: string;
  rows: number;
  cols: number;
  /** 起针数（第 1 行的行首针数） */
  castOn: number;
  cells: CellMap;
  instances: MasterInstance[];
  updatedAt: number;
}

/** 花样母版：cells 为稀疏表，缺省 = 透明（展开时不写入） */
export interface PatternMaster {
  id: string;
  name: string;
  rows: number;
  cols: number;
  cells: Record<string, string>;
  updatedAt: number;
}

export interface Rect {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

export interface Patch {
  key: string;
  prev?: CellData;
  next?: CellData;
}

/** 一组修改 = 一个撤销单元（分组撤销） */
export interface HistoryEntry {
  label: string;
  patches: Patch[];
  instPrev?: MasterInstance[];
  instNext?: MasterInstance[];
}

export interface ClipboardData {
  w: number;
  h: number;
  cells: Record<string, CellData>;
}

export type Tool = 'select' | 'symbol' | 'color' | 'erase';

/** 每一行的针数计算结果 */
export interface RowInfo {
  row: number;
  /** 行首应有针数（= 上一行行末针数） */
  start: number;
  /** 本行符号需要消耗的针数 */
  consume: number;
  /** 本行符号产生的针数 */
  produce: number;
  /** 行末针数 = start - consume + produce */
  end: number;
  /** 行首针数是否匹配（consume === start） */
  ok: boolean;
}
