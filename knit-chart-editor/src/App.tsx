import { useEffect } from 'react';
import { flushSaveNow, useStore } from './state/store';
import { TopBar } from './components/TopBar';
import { SideBarLeft } from './components/SideBarLeft';
import { SideBarRight } from './components/SideBarRight';
import { GridCanvas } from './components/GridCanvas';
import { StatusBar } from './components/StatusBar';
import { MasterEditor } from './components/MasterEditor';
import { PrintView } from './components/PrintView';
import { ImpactModal, NewProjectModal, OpenProjectModal, SettingsModal } from './components/Modals';

export default function App() {
  const ready = useStore((s) => s.ready);

  useEffect(() => {
    void useStore.getState().loadInitial();
  }, []);

  /* 全局快捷键 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const st = useStore.getState();
      // 模态框打开时不响应编辑快捷键
      if (st.newOpen || st.openListOpen || st.settingsOpen || st.printOpen ||
          st.masterEditor.open || st.impact) return;
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo(); else st.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault(); st.redo();
      } else if (mod && e.key.toLowerCase() === 'c') {
        st.copySelection();
      } else if (mod && e.key.toLowerCase() === 'x') {
        st.cutSelection();
      } else if (mod && e.key.toLowerCase() === 'v') {
        st.paste();
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault(); st.selectAll();
      } else if (mod && e.key.toLowerCase() === 'p') {
        e.preventDefault(); st.setModal({ printOpen: true });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        st.deleteSelection();
      } else if (e.key === 'Escape') {
        if (st.placing) st.cancelPlacing();
        else if (st.impact) st.cancelImpact();
        else st.setSelection(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* 关闭/隐藏页面前强制落盘 */
  useEffect(() => {
    const flush = () => flushSaveNow();
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, []);

  if (!ready) {
    return <div className="loading">正在打开本地工程库…</div>;
  }

  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <SideBarLeft />
        <GridCanvas />
        <SideBarRight />
      </div>
      <StatusBar />
      <NewProjectModal />
      <OpenProjectModal />
      <SettingsModal />
      <MasterEditor />
      <ImpactModal />
      <PrintView />
    </div>
  );
}
