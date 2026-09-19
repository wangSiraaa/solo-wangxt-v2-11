import { useStore } from '../state/store';
import { computeRows } from '../lib/stitchMath';
import { useMemo } from 'react';

/** 底部状态栏：选区、缩放、保存状态 */
export function StatusBar() {
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.selection);
  const view = useStore((s) => s.view);
  const dirty = useStore((s) => s.dirty);
  const savedAt = useStore((s) => s.savedAt);
  const setView = useStore((s) => s.setView);

  const rowsInfo = useMemo(() => (project ? computeRows(project) : []), [project]);
  if (!project) return null;
  const conflicts = rowsInfo.filter((r) => !r.ok).length;

  return (
    <div className="statusbar">
      <span>{project.rows} 行 × {project.cols} 列 · 起针 {project.castOn}</span>
      <span className="sep" />
      {selection ? (
        <span>
          选区 {selection.c1 - selection.c0 + 1}×{selection.r1 - selection.r0 + 1}
          （行 {selection.r0}–{selection.r1}，列 {selection.c0}–{selection.c1}）
        </span>
      ) : (
        <span className="dim">未选择（选择工具拖拽框选，Ctrl+A 全选）</span>
      )}
      <span className="sep" />
      <span className={conflicts ? 'bad' : 'ok'}>
        {conflicts ? `⚠ ${conflicts} 处针数冲突` : '✓ 针数正常'}
      </span>
      <span className="spacer" />
      <label className="zoom">
        缩放
        <input
          type="range" min={14} max={48} value={view.cell}
          onChange={(e) => setView({ cell: +e.target.value })}
        />
        {view.cell}px
      </label>
      <span className="sep" />
      <span className="dim">
        {dirty ? '保存中…' : savedAt ? `已保存到本地 ${new Date(savedAt).toLocaleTimeString()}` : ''}
      </span>
    </div>
  );
}
