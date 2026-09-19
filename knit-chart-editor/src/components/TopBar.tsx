import { useStore } from '../state/store';

/** 顶部工具栏：工程管理 + 编辑操作 */
export function TopBar() {
  const project = useStore((s) => s.project);
  const selection = useStore((s) => s.selection);
  const clipboard = useStore((s) => s.clipboard);
  const past = useStore((s) => s.past);
  const future = useStore((s) => s.future);
  const st = useStore.getState();

  if (!project) {
    return (
      <div className="topbar">
        <span className="brand">🧶 织图</span>
        <span className="dim">没有工程</span>
        <span className="sep" />
        <button onClick={() => st.setModal({ newOpen: true })}>新建</button>
        <button onClick={() => st.setModal({ openListOpen: true })}>打开</button>
      </div>
    );
  }
  const hasSel = !!selection;

  return (
    <div className="topbar">
      <span className="brand">🧶 织图</span>
      <span className="proj-name" title="在「设置」中重命名">{project.name}</span>
      <span className="sep" />

      <button onClick={() => st.setModal({ newOpen: true })}>新建</button>
      <button onClick={() => st.setModal({ openListOpen: true })}>打开</button>
      <button onClick={() => st.setModal({ settingsOpen: true })}>设置</button>
      <span className="sep" />

      <button disabled={past.length === 0} onClick={st.undo} title="撤销 (Ctrl+Z)">
        ↶ 撤销{past.length > 0 && <em className="hint">{past[past.length - 1].label}</em>}
      </button>
      <button disabled={future.length === 0} onClick={st.redo} title="重做 (Ctrl+Y)">↷ 重做</button>
      <span className="sep" />

      <button disabled={!hasSel} onClick={st.copySelection} title="复制选区 (Ctrl+C)">复制</button>
      <button disabled={!hasSel} onClick={st.cutSelection} title="剪切选区 (Ctrl+X)">剪切</button>
      <button disabled={!clipboard} onClick={st.paste} title="粘贴到选区左上角或视野中心 (Ctrl+V)">粘贴</button>
      <button disabled={!hasSel} onClick={st.deleteSelection} title="删除选区内容 (Delete)">删除</button>
      <span className="sep" />

      <button
        disabled={!hasSel}
        onClick={() => st.mirrorSelection('h')}
        title="左右镜像：列位置翻转，倾斜针法自动互换（K2tog↔SSK、M1L↔M1R）"
      >⇋ 左右镜像</button>
      <button
        disabled={!hasSel}
        onClick={() => st.mirrorSelection('v')}
        title="上下镜像：行位置翻转"
      >⇅ 上下镜像</button>
      <span className="sep" />

      <button onClick={() => st.setModal({ printOpen: true })} title="分页打印 (Ctrl+P)">🖨 打印</button>
    </div>
  );
}
