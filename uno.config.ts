import { defineConfig, presetAttributify, presetWind3, transformerDirectives } from 'unocss';

export default defineConfig({
  // presetWind 已废弃，改用 presetWind3；attributify 是官方命名（attribute + -ify），非拼写错误
  presets: [presetWind3(), presetAttributify()],
  // 启用 SCSS/CSS 中的 @apply / @screen 等指令展开
  transformers: [transformerDirectives()],
  content: {
    pipeline: {
      include: [/\.(html|ejs|js|ts|jsx|tsx|vue|svelte|astro|elm|php|phtml|mdx?)($|\?)/],
    },
    filesystem: [
      'src/**/*.{js,css,scss,html,ejs}',
      'server/**/*.ejs',
      'index.html',
    ],
  },
  // 若在 JS 里动态拼接 class（如 htmx 事件），把常用组合列进 safelist 以保证被生成
  safelist: ['line-through'],
});