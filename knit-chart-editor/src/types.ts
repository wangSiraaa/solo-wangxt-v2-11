/**
 * 针法图编辑器核心领域模型
 *
 * 坐标系约定：
 *  - 网格坐标 col 向右递增；row=0 是底边（起针行），row 向上递增。
 *  - 编织从下往上，屏幕上以 0 为底部行。
 *  - 校验与打印均遵循此约定。
 */

/** 针法分类，用于图例分组 */
export type StitchCategory = '基础' | '减针' | '加针' | '绞花' | '其他';

/**
 * 针法定义（本地静态数据）。
 * inStitches  : 该针法在本行消耗（吃针）的针数
 * outStitches : 该针法在下一行产生的针数
 * glyph       : 32×32 viewBox 内的 SVG path 数据，null 表示空白无符号（如下针）
 * mirror      : 水平镜像后应转换成的针法 id；null 表示镜像后不变
 */
export interface StitchDef {
  id: string;
  name: string;
  short: string;
  category: StitchCategory;
  inStitches: number;
  outStitches: number;
  glyph: string | null;
  mirror: string | null;
  /** 绞花等复合针法占用多列时，额外消耗列宽（普通针法=0） */
  spanExtra?: number;
}

/** 单元格：一个针位。同一格只放一种针法，可带纱线底色与花样引用。 */
export interface ChartCell {
  id: string;
  col: number;
  row: number;
  stitchId: string;
  /** 纱线颜色 id；null 表示默认色（仅符号，无填充） */
  colorId: string | null;
  /** 由花样展开生成时，记录来源母版与母版内坐标 */
  ref?: {
    masterId: string;
    mcol: number;
    mrow: number;
    placementId: string;
  };
}

/** 花样母版：可重复引用的小图样 */
export interface KnitMaster {
  id: string;
  name: string;
  width: number;
  height: number;
  /** 母版单元格（键同 ChartCell，但不应再带 ref） */
  cells: ChartCell[];
  /** 每次内容修改自增；placement 记录其快照 gen 以判断是否过期 */
  gen: number;
}

/** 母版在主图上的放置（循环花样的引用记录） */
export interface Placement {
  id: string;
  masterId: string;
  col: number;
  row: number;
  /** 放置时母版的 gen；与当前母版 gen 不同则可预览更新 */
  gen: number;
  /** 展开时写入的单元格 id，用于撤销与应用更新 */
  cellIds: string[];
}

export interface ChartSettings {
  width: number;
  height: number;
  /** 起针针数；为 0 时忽略，不参与底部边界校验 */
  castOn: number;
  /** 打印预览每格像素；A4 每页行列据此自动分页 */
  printCellPx: number;
}

export interface KnitProject {
  id: string;
  name: string;
  updatedAt: number;
  settings: ChartSettings;
  cells: ChartCell[];
  masters: KnitMaster[];
  placements: Placement[];
}

/** 一行校验结果 */
export interface RowValidation {
  row: number;
  inCount: number;
  outCount: number;
  /** 与上一行（row-1 的 out，或起针数）之间的针数差；0 表示匹配 */
  startMismatch: number;
}

export interface ValidationResult {
  rows: RowValidation[];
  /** 冲突所在的边界行（row 与 row-1 之间；0 表示起针行边界） */
  mismatchRows: number[];
  totalInconsistent: boolean;
}

/** 矩形选区（含边界） */
export interface Rect {
  c0: number;
  r0: number;
  c1: number;
  r1: number;
}

/** 剪贴板/复制片段：带局部坐标的单元格 */
export interface ClipboardChunk {
  width: number;
  height: number;
  cells: ChartCell[];
}

/** 母版更新影响预览 */
export interface PlacementDiff {
  placement: Placement;
  masterName: string;
  currentGen: number;
  added: { col: number; row: number; stitchId: string; colorId: string | null }[];
  removed: { col: number; row: number }[];
  changed: { col: number; row: number; oldStitch: string; newStitch: string }[];
  /** 展开区域内存在无法安全覆盖的手改格时为 true，应用仍可强制覆盖 */
  hasConflicts: boolean;
}
