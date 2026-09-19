import { STITCH_CATEGORIES, STITCHES, YARN_COLORS } from '../data/stitches';
import { useEditor } from '../state/store';
import Glyph from './Glyph';

/** 针法 + 纱线颜色图例（全部本地数据，离线可用） */
export default function LegendPanel() {
  const activeStitchId = useEditor((s) => s.activeStitchId);
  const activeColorId = useEditor((s) => s.activeColorId);
  const setActiveStitch = useEditor((s) => s.setActiveStitch);
  const setActiveColor = useEditor((s) => s.setActiveColor);

  return (
    <div>
      <h4>针法图例</h4>
      {STITCH_CATEGORIES.map((cat) => (
        <div key={cat}>
          <div className="hint" style={{ margin: '6px 0 2px' }}>
            {cat}
          </div>
          <div className="stitch-grid">
            {STITCHES.filter((s) => s.category === cat).map((s) => (
              <button
                key={s.id}
                className={`stitch-btn${activeStitchId === s.id ? ' active' : ''}`}
                onClick={() => setActiveStitch(s.id)}
                title={`${s.name}：吃 ${s.inStitches} 针 / 出 ${s.outStitches} 针${s.mirror ? `；镜像 → ${STITCHES.find((x) => x.id === s.mirror)?.name}` : ''}`}
              >
                <Glyph stitchId={s.id} />
                <span className="label">{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <h4>纱线底色</h4>
      <div className="color-row">
        <button
          className={`color-chip none${activeColorId === null ? ' active' : ''}`}
          onClick={() => setActiveColor(null)}
          title="无底色（仅符号）"
          aria-label="无底色"
        />
        {YARN_COLORS.map((c) => (
          <button
            key={c.id}
            className={`color-chip${activeColorId === c.id ? ' active' : ''}`}
            style={{ background: c.fill }}
            onClick={() => setActiveColor(c.id)}
            title={c.name}
            aria-label={c.name}
          />
        ))}
      </div>
      <p className="hint mt8">
        悬停针法可查看进出针数与镜像目标；底色只影响显示，不参与针数计算。
      </p>
    </div>
  );
}
