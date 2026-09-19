import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useEditor } from './state/store';
import { db } from './lib/db';
import './styles.css';

// 调试/端到端测试钩子：可在控制台与自动化脚本中读取编辑器状态
declare global {
  interface Window {
    __knit?: typeof useEditor;
    __knitDB?: typeof db;
  }
}
window.__knit = useEditor;
window.__knitDB = db;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
