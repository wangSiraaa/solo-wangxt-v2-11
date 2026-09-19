import { STITCH_MAP, YARN_COLORS, type YarnColor } from '../data/stitches';

interface GlyphProps {
  stitchId: string;
  size?: number;
  colorId?: string | null;
  stroke?: string;
}

/** 图例/缩略图/打印共用：所有符号来自本地针法数据的同一份 glyph path */
export default function Glyph({ stitchId, size = 30, colorId, stroke }: GlyphProps) {
  const def = STITCH_MAP[stitchId];
  const yarn: YarnColor | undefined = YARN_COLORS.find((c) => c.id === colorId) ?? undefined;
  const s = stroke ?? yarn?.stroke ?? '#33302a';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label={def?.name}>
      {yarn && <rect width="32" height="32" fill={yarn.fill} />}
      {def?.id === 'nost' && (
        <>
          <rect width="32" height="32" fill="#e8e3d7" />
          <line x1="3" y1="3" x2="29" y2="29" stroke="#b0a892" strokeWidth="2" />
        </>
      )}
      {def?.glyph && (
        <path
          d={def.glyph}
          fill="none"
          stroke={s}
          strokeWidth={2.1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
