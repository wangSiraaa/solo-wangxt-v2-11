import { useState } from 'react';
import { useStore } from '../state/store';

/** 新建工程 */
export function NewProjectModal() {
  const open = useStore((s) => s.newOpen);
  const st = useStore.getState();
  const [name, setName] = useState('未命名工程');
  const [rows, setRows] = useState(40);
  const [cols, setCols] = useState(30);
  const [castOn, setCastOn] = useState(30);
  if (!open) return null;

  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && st.setModal({ newOpen: false })}>
      <div className="modal">
        <h3>新建工程</h3>
        <div className="form-grid">
          <label>名称 <input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>行数 <input type="number" min={1} max={400} value={rows} onChange={(e) => setRows(+e.target.value || 1)} /></label>
          <label>列数 <input type="number" min={1} max={400} value={cols} onChange={(e) => setCols(+e.target.value || 1)} /></label>
          <label>起针数 <input type="number" min={0} max={999} value={castOn} onChange={(e) => setCastOn(+e.target.value || 0)} /></label>
        </div>
        <div className="modal-actions">
          <button onClick={() => st.setModal({ newOpen: false })}>取消</button>
          <button className="primary" onClick={() => void st.newProject({ name: name.trim() || '未命名工程', rows, cols, castOn })}>
            创建
          </button>
        </div>
      </div>
    </div>
  );
}

/** 打开 / 管理工程 */
export function OpenProjectModal() {
  const open = useStore((s) => s.openListOpen);
  const projects = useStore((s) => s.projects);
  const current = useStore((s) => s.project);
  const st = useStore.getState();
  if (!open) return null;

  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && st.setModal({ openListOpen: false })}>
      <div className="modal">
        <h3>打开工程（保存在浏览器 IndexedDB，离线可用）</h3>
        <div className="proj-list">
          {projects.map((p) => (
            <div key={p.id} className={current?.id === p.id ? 'proj-item current' : 'proj-item'}>
              <div className="proj-info" onClick={() => void st.openProject(p.id)}>
                <b>{p.name}</b>
                <span className="dim">{new Date(p.updatedAt).toLocaleString()}</span>
              </div>
              <button
                className="danger"
                onClick={() => {
                  if (window.confirm(`删除工程「${p.name}」？此操作不可恢复。`))
                    void st.deleteProject(p.id);
                }}
              >
                删除
              </button>
            </div>
          ))}
          {projects.length === 0 && <div className="dim">暂无工程</div>}
        </div>
        <div className="modal-actions">
          <button onClick={() => st.setModal({ openListOpen: false })}>关闭</button>
        </div>
      </div>
    </div>
  );
}

/** 工程设置：名称 / 尺寸 / 起针数 */
export function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const project = useStore((s) => s.project);
  const st = useStore.getState();
  const [draft, setDraft] = useState<{ name: string; rows: number; cols: number; castOn: number } | null>(null);

  if (!open || !project) return null;
  const d = draft ?? { name: project.name, rows: project.rows, cols: project.cols, castOn: project.castOn };

  const close = () => { setDraft(null); st.setModal({ settingsOpen: false }); };

  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal">
        <h3>工程设置</h3>
        <div className="form-grid">
          <label>名称 <input value={d.name} onChange={(e) => setDraft({ ...d, name: e.target.value })} /></label>
          <label>行数 <input type="number" min={1} max={400} value={d.rows}
            onChange={(e) => setDraft({ ...d, rows: Math.max(1, +e.target.value || 1) })} /></label>
          <label>列数 <input type="number" min={1} max={400} value={d.cols}
            onChange={(e) => setDraft({ ...d, cols: Math.max(1, +e.target.value || 1) })} /></label>
          <label>起针数 <input type="number" min={0} max={999} value={d.castOn}
            onChange={(e) => setDraft({ ...d, castOn: Math.max(0, +e.target.value || 0) })} /></label>
        </div>
        {(d.rows < project.rows || d.cols < project.cols) && (
          <div className="warn">⚠ 缩小尺寸将裁剪掉越界的格子。</div>
        )}
        <div className="modal-actions">
          <button onClick={close}>取消</button>
          <button className="primary" onClick={() => { st.updateSettings({ ...d, name: d.name.trim() || project.name }); setDraft(null); }}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

/** 母版修改影响预览：确认后才应用 */
export function ImpactModal() {
  const impact = useStore((s) => s.impact);
  const project = useStore((s) => s.project);
  const st = useStore.getState();
  if (!impact || !project) return null;

  const instCount = project.instances.filter((i) => i.masterId === impact.master.id).length;

  return (
    <div className="modal-mask">
      <div className="modal">
        <h3>母版「{impact.master.name}」已修改</h3>
        <p>
          本工程共有 <b>{instCount}</b> 处引用，应用后将更新 <b className="impact-count">{impact.keys.length}</b> 个格子。
          <br />
          主图上已用 <span className="impact-demo">橙色框</span> 标出将变化的格子（用户手工改过的格子不受影响）。
        </p>
        <div className="modal-actions">
          <button onClick={st.cancelImpact}>取消（保留旧图）</button>
          <button className="primary" onClick={st.applyImpact}>应用更改</button>
        </div>
      </div>
    </div>
  );
}
