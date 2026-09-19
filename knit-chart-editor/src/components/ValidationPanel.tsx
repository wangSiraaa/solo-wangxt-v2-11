import { useMemo } from 'react';
import type { ValidationResult } from '../types';
import { useEditor } from '../state/store';

/** 针数校验面板：逐行进出针数 + 起始不匹配定位 */
export default function ValidationPanel({ validation }: { validation: ValidationResult }) {
  const setSelection = useEditor((s) => s.setSelection);
  const rows = useMemo(() => [...validation.rows].sort((a, b) => b.row - a.row), [validation]);
  const badCount = validation.mismatchRows.length;

  return (
    <div>
      {badCount === 0 ? (
        <div className="val-summary ok">✓ 各行起始针数匹配，针数平衡。</div>
      ) : (
        <div className="val-summary bad">
          发现 {badCount} 行起始针数不匹配（下方标红，点击可定位到该行）
        </div>
      )}
      <div className="val-row head">
        <span>行</span>
        <span>本行吃针 in</span>
        <span>本行出针 out</span>
        <span>起始差</span>
      </div>
      {rows.map((rv) => {
        const bad = rv.startMismatch !== 0;
        return (
          <button
            key={rv.row}
            className={`val-row${bad ? ' bad' : ''}`}
            style={{ width: '100%', textAlign: 'left' }}
            onClick={() =>
              setSelection({ c0: 0, r0: rv.row, c1: 0, r1: rv.row })
            }
            title="点击选中该行第 1 格进行定位"
          >
            <span>{rv.row + 1}</span>
            <span>{rv.inCount}</span>
            <span>{rv.outCount}</span>
            <span>{bad ? (rv.startMismatch > 0 ? `+${rv.startMismatch}` : rv.startMismatch) : '—'}</span>
          </button>
        );
      })}
      <p className="hint mt8">
        起始差 = 本行吃针数 − 上一行出针数（首行对比起针数）。
        复合减针（如 k2tog 吃 2 针出 1 针）会让「格数」与「针数」分离，需按针法进出针数核算。
      </p>
    </div>
  );
}
