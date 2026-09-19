import { useEffect, useState } from 'react';
import { nanoid } from 'nanoid';
import type { KnitProject } from '../types';
import { db, deleteProject, duplicateProject, loadAllProjects } from '../lib/db';
import { createConflictSample, createValidSample } from '../data/samples';
import { useEditor } from '../state/store';

function fmtTime(t: number) {
  return new Date(t).toLocaleString('zh-CN', { hour12: false });
}

function blankProject(): KnitProject {
  return {
    id: nanoid(10),
    name: '未命名针法图',
    updatedAt: Date.now(),
    settings: { width: 20, height: 20, castOn: 20, printCellPx: 26 },
    cells: [],
    masters: [],
    placements: [],
  };
}

export default function StartScreen() {
  const open = useEditor((s) => s.open);
  const [projects, setProjects] = useState<KnitProject[]>([]);

  const refresh = () => loadAllProjects().then(setProjects);
  useEffect(() => {
    void refresh();
  }, []);

  const createFrom = async (p: KnitProject) => {
    await db.projects.put(p);
    open(p);
  };

  return (
    <div className="start">
      <h1>针法图编辑器</h1>
      <div className="sub">离线运行 · 数据保存在本机 IndexedDB · React + Konva</div>

      <div className="start-cards">
        <button className="sample-card" onClick={() => createFrom(blankProject())}>
          <h3>＋ 空白工程</h3>
          <p>20×20 网格，打开即进入可编辑网格，选择针法即可落笔。</p>
        </button>
        <button className="sample-card" onClick={() => createFrom(createValidSample())}>
          <h3>
            样例：平针蕾丝
            <span className="badge ok">针数合法</span>
          </h3>
          <p>
            14×12，起针 14。每行进出针数平衡；内含「小菱纹」循环花样母版，被两处引用，
            可在右侧面板编辑母版并预览更新影响。
          </p>
        </button>
        <button className="sample-card" onClick={() => createFrom(createConflictSample())}>
          <h3>
            样例：加针练习
            <span className="badge bad">针数冲突</span>
          </h3>
          <p>
            12×10，起针 12。第 3 行起始缺 1 针、最后一行起始多 2 针，
            用于验证逐行进出针数计算与不匹配定位。
          </p>
        </button>
      </div>

      <h4 style={{ color: 'var(--ink-soft)' }}>本机工程</h4>
      <div className="project-list">
        {projects.length === 0 && <div className="hint">还没有保存过的工程。</div>}
        {projects.map((p) => (
          <div key={p.id} className="project-row">
            <div style={{ flex: 1 }}>
              <div className="name">{p.name}</div>
              <div className="meta">
                {p.settings.width}×{p.settings.height} · 起针 {p.settings.castOn} ·{' '}
                {p.cells.length} 格 · {p.masters.length} 个母版 · 更新于 {fmtTime(p.updatedAt)}
              </div>
            </div>
            <button onClick={() => open(p)}>打开</button>
            <button
              onClick={async () => {
                const copy = await duplicateProject(p, nanoid(10));
                await refresh();
                open(copy);
              }}
            >
              复制
            </button>
            <button
              className="danger"
              onClick={async () => {
                if (confirm(`删除工程「${p.name}」？此操作不可恢复。`)) {
                  await deleteProject(p.id);
                  await refresh();
                }
              }}
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
