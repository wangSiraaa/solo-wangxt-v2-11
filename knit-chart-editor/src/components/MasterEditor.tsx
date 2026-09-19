import { useMemo, useState } from 'react';
import type { Rect } from '../types';
import { useEditor } from '../state/store';
import StitchCanvas, { type CanvasMode } from './StitchCanvas';

/** 母版编辑器：与主图相同的绘制体验；保存的是母版本身（gen 自增），放置处先不动 */
export default function MasterEditor() {
  const project = useEditor((s) => s.project)!;
  const editingMasterId = useEditor((s) => s.editingMasterId);
  const editMaster = useEditor((s) => s.editMaster);
  const masterPaintAt = useEditor((s) => s.masterPaintAt);
  const masterEraseAt = useEditor((s) => s.masterEraseAt);
  const tool = useEditor((s) => s.tool);
  const [, force] = useState(0);

  const master = useMemo(
    () => project.masters.find((m) => m.id === editingMasterId),
    [project, editingMasterId],
  );
  if (!master) return null;

  const mode: CanvasMode = tool === 'erase' ? 'erase' : 'paint';

  return (
    <div className="modal-mask" onMouseDown={(e) => e.stopPropagation()}>
      <div className="modal" style={{ minWidth: 520 }}>
        <h3>编辑母版：{master.name}</h3>
        <div className="hint">
          在此修改会立刻提升母版版本号；主图上的放置不会被直接改动，而是标记为「可更新」，
          回到母版面版可预览影响并应用。当前 {project.placements.filter((p) => p.masterId === master.id).length} 处引用。
        </div>
        <div className="master-editor-body">
          <StitchCanvas
            width={master.width}
            height={master.height}
            cells={master.cells}
            cellSize={32}
            mode={mode}
            selection={null}
            mismatchRows={new Set()}
            onStrokeAt={(col, row) =>
              mode === 'erase' ? masterEraseAt(col, row) : masterPaintAt(col, row)
            }
            onSelectionDone={(_r: Rect) => {}}
            onGestureEnd={() => force((v) => v + 1)}
            onHover={() => {}}
          />
          <div style={{ maxWidth: 150 }}>
            <p className="hint">
              使用左侧「针法图例」中选中的符号绘制；切换擦除工具可删除格。
            </p>
            <p className="hint mt8">
              母版尺寸：{master.width} × {master.height}（超出母版边界的绘制会被忽略）
            </p>
          </div>
        </div>
        <div className="actions">
          <button onClick={() => editMaster(null)}>完成</button>
        </div>
      </div>
    </div>
  );
}
