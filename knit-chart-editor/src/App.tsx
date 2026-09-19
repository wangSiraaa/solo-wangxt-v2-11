import { useEffect, useState } from 'react';
import { reopenLastProject, useEditor } from './state/store';
import StartScreen from './components/StartScreen';
import Editor from './components/Editor';

export default function App() {
  const project = useEditor((s) => s.project);
  const open = useEditor((s) => s.open);
  const [booted, setBooted] = useState(false);

  // 「打开即进入可编辑网格」：有上次工程时直接恢复进入编辑器；否则停在起始页
  useEffect(() => {
    let alive = true;
    void reopenLastProject().then((last) => {
      if (alive && last) open(last);
      if (alive) setBooted(true);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  if (!booted && !project) {
    return <div className="start"><div className="hint">正在打开最近的工程…</div></div>;
  }
  return project ? <Editor /> : <StartScreen />;
}
