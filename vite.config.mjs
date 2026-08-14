import { defineConfig } from 'vite';
import UnoCSS from 'unocss/vite';

// 该项目的角色：为服务端渲染的 Express 应用编译前端资源（htmx 入口、CSS）
// - dev: 由 Express 通过 middleware 模式挂载，提供 HMR
// - build: 产出固定命名的 assets，供 EJS 布局直接引用
export default defineConfig({
  plugins: [UnoCSS()],
  appType: 'custom',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 关闭 css code-split，让样式汇总为单一 main.css，便于 EJS 布局 <link> 引用
    cssCodeSplit: false,
    rollupOptions: {
      // 把 src/main.ts 作为唯一构建入口
      input: 'src/main.ts',
      output: {
        entryFileNames: 'assets/main.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});