import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { SYMBOLS, SYMBOL_MAP } from '../data/symbols';
import { GLYPHS, drawGlyph } from '../lib/glyphs';
import { cellKey } from '../lib/stitchMath';
import type { PatternMaster } from '../types';

const CELL = 30;
const uid = () => 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);

/**
 * 花样母版编辑器（模态）。
 * 母版格子：针法符号或「透明」（展开时不写入主图）。
 * 保存时若母版已被工程引用，由 store 进入「影响预览」流程。
 */
export function MasterEditor() {
  const masterEditor = useStore((s) => s.masterEditor);
  const masters = useStore((s) => s.masters);
  const st = useStore.getState();

  const editing = masterEditor.masterId
    ? masters.find((m) => m.id === masterEditor.masterId) ?? null
    : null;

  const [name, setName] = useState(editing?.name ?? '新花样');
  const [rows, setRows] = useState(editing?.rows ?? 6);
  const [cols, setCols] = useState(editing?.cols ?? 6);
  const [cells, setCells] = useState<Record<string, string>>(() => ({ ...(editing?.cells ?? {}) }));
  const [sym, setSym] = useState('knit'); // 'transparent' 表示透明
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintingRef = useRef(false);

  // 打开/切换母版时重置本地状态
  useEffect(() => {
    setName(editing?.name ?? '新花样');
    setRows(editing?.rows ?? 6);
    setCols(editing?.cols ?? 6);
    setCells({ ...(editing?.cells ?? {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterEditor.masterId, masterEditor.open]);

  /* 画布绘制 */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    cv.width = (cols * CELL + 1) * dpr;
    cv.height = (rows * CELL + 1) * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cols * CELL + 1, rows * CELL + 1);

    for (let mr = 1; mr <= rows; mr++) {
      for (let mc = 1; mc <= cols; mc++) {
        const x = (mc - 1) * CELL;
        const y = (rows - mr) * CELL;
        const s = cells[cellKey(mr, mc)];
        ctx.fillStyle = s ? '#ffffff' : '#f3f2ee';
        ctx.fillRect(x, y, CELL, CELL);
        if (!s) {
          // 透明格：淡点标记
          ctx.fillStyle = '#c9c9c9';
          ctx.beginPath();
          ctx.arc(x + CELL / 2, y + CELL / 2, 1.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const symDef = SYMBOL_MAP[s];
          if (symDef && symDef.draw !== 'knit') drawGlyph(ctx, symDef.draw, x, y, CELL, '#1f2937');
        }
      }
    }
    ctx.strokeStyle = '#d4d4d4';
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL + 0.5, 0); ctx.lineTo(c * CELL + 0.5, rows * CELL); ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CELL + 0.5); ctx.lineTo(cols * CELL, r * CELL + 0.5); ctx.stroke();
    }
    ctx.strokeStyle = '#888';
    ctx.strokeRect(0.5, 0.5, cols * CELL, rows * CELL);
  }, [cells, rows, cols]);

  if (!masterEditor.open) return null;

  const paintAt = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mc = Math.floor((e.clientX - rect.left) / CELL) + 1;
    const mr = rows - Math.floor((e.clientY - rect.top) / CELL);
    if (mr < 1 || mr > rows || mc < 1 || mc > cols) return;
    const k = cellKey(mr, mc);
    setCells((prev) => {
      const next = { ...prev };
      if (sym === 'transparent') delete next[k];
      else next[k] = sym;
      return next;
    });
  };

  const resize = (nr: number, nc: number) => {
    // 裁剪越界格子
    setCells((prev) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        const [r, c] = k.split(',').map(Number);
        if (r <= nr && c <= nc) next[k] = v;
      }
      return next;
    });
    setRows(nr);
    setCols(nc);
  };

  const save = () => {
    const m: PatternMaster = {
      id: editing?.id ?? uid(),
      name: name.trim() || '未命名花样',
      rows, cols, cells,
      updatedAt: Date.now(),
    };
    st.saveMasterDraft(m);
  };

  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && st.setModal({ masterEditor: { open: false, masterId: null } })}>
      <div className="modal master-editor">
        <h3>{editing ? `编辑花样母版「${editing.name}」` : '新建花样母版'}</h3>

        <div className="me-row">
          <label>名称 <input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>行数
            <input type="number" min={2} max={20} value={rows}
              onChange={(e) => resize(Math.max(2, Math.min(20, +e.target.value || 2)), cols)} />
          </label>
          <label>列数
            <input type="number" min={2} max={20} value={cols}
              onChange={(e) => resize(rows, Math.max(2, Math.min(20, +e.target.value || 2)))} />
          </label>
        </div>

        <div className="me-palette">
          <button
            className={sym === 'transparent' ? 'sym active' : 'sym'}
            title="透明：展开时不写入主图"
            onClick={() => setSym('transparent')}
          >
            <span className="transparent-box" />
            <span className="sym-delta">透明</span>
          </button>
          {SYMBOLS.map((s) => (
            <button
              key={s.id}
              className={sym === s.id ? 'sym active' : 'sym'}
              title={`${s.name} · ${s.consumes}针→${s.produces}针`}
              onClick={() => setSym(s.id)}
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                {s.draw === 'nost' && <rect x="1" y="1" width="22" height="22" fill="#d9d9d9" />}
                {GLYPHS[s.draw] && (
                  <path d={GLYPHS[s.draw]} fill="none"
                    stroke={s.draw === 'nost' ? '#8a8a8a' : '#1f2937'}
                    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
              <span className="sym-delta">{s.short}</span>
            </button>
          ))}
        </div>

        <div className="me-canvas-wrap">
          <canvas
            ref={canvasRef}
            style={{ width: cols * CELL + 1, height: rows * CELL + 1 }}
            onPointerDown={(e) => { paintingRef.current = true; paintAt(e); }}
            onPointerMove={(e) => paintingRef.current && paintAt(e)}
            onPointerUp={() => { paintingRef.current = false; }}
            onPointerLeave={() => { paintingRef.current = false; }}
          />
        </div>
        <div className="dim small">行 1 在底部。拖动连续绘制。</div>

        <div className="modal-actions">
          <button onClick={() => st.setModal({ masterEditor: { open: false, masterId: null } })}>取消</button>
          <button className="primary" onClick={save}>
            {editing ? '保存并预览影响' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}
