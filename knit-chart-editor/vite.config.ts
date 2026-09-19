import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 相对 base：构建产物可从任意本地路径打开（离线分发）
export default defineConfig({
  plugins: [react()],
  base: './',
});
