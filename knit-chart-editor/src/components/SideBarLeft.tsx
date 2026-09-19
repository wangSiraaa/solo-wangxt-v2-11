import { useStore } from '../state/store';
import { COLORS, SYMBOLS } from '../data/symbols';
import { GLYPHS } from '../lib/glyphs';
import type { Tool } from '../types';

const TOOLS: { id: Tool; name: string; icon: string }[] = [
  { id: 'select', name: '框选', icon: '⬚' },
  { id: 'symbol', name: '针法', icon: '✏️' },
  { id: 'color',  name: '颜色', icon: '🎨' },
  { id: 'erase',  name: '橡皮', icon: '⌫' },
];

/** 左侧栏：工具 + 针法图例 + 颜色图例（均为本地数据） */
export function SideBarLeft() {
  const tool = useStore((s) => s.tool);
  const symbolId = useStore((s) => s.symbolId);
  const colorId = useStore((s) => s.colorId);
  const st = useStore.getState();

  return (
    <div className="sidebar-left">
      <div className="tool-row">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={tool === t.id ? 'tool active' : 'tool'}
            title={t.name}
            onClick={() => st.setTool(t.id)}
          >
            <span className="tool-icon">{t.icon}</span>
            <span className="tool-name">{t.name}</span>
          </button>
        ))}
      </div>

      <div className="palette-title">针法（消耗→产生）</div>
      <div className="symbol-palette">
        {SYMBOLS.map((s) => (
          <button
            key={s.id}
            className={symbolId === s.id && tool === 'symbol' ? 'sym active' : 'sym'}
            title={`${s.name} ${s.short} · ${s.consumes}针→${s.produces}针\n${s.description}`}
            onClick={() => { st.setSymbol(s.id); st.setTool('symbol'); }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22">
              {s.draw === 'nost' && <rect x="1" y="1" width="22" height="22" fill="#d9d9d9" />}
              {GLYPHS[s.draw] && (
                <path
                  d={GLYPHS[s.draw]}
                  fill="none"
                  stroke={s.draw === 'nost' ? '#8a8a8a' : '#1f2937'}
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
            <span className="sym-delta">
              {s.consumes === s.produces ? `${s.consumes}` : `${s.consumes}→${s.produces}`}
            </span>
          </button>
        ))}
      </div>

      <div className="palette-title">毛线颜色</div>
      <div className="color-palette">
        {COLORS.map((c) => (
          <button
            key={c.id}
            className={colorId === c.id && tool === 'color' ? 'swatch active' : 'swatch'}
            style={{ background: c.hex }}
            title={c.name}
            onClick={() => { st.setColor(c.id); st.setTool('color'); }}
          />
        ))}
      </div>

      <div className="sidebar-tip">
        行 1 在织物底部，自下而上编织。空白格 = 下针。
      </div>
    </div>
  );
}
