# htmx-project

前后端不分离小型项目：**Node + Express** 服务端渲染，**htmx** 提供前端交互能力，**Vite + UnoCSS** 负责前端构建与 HMR。

## 技术栈选型

| 层 | 选型 | 说明 |
|---|---|---|
| 后端框架 | Express 5 | 服务端渲染 API，返回完整页面或局部片段 |
| 模板引擎 | EJS + express-ejs-layouts | 布局 / partial 拆分 |
| 前端交互 | htmx 2 | 通过 `hx-*` 属性做局部交换 |
| 样式 | UnoCSS | utility-first，按需生成，产物极轻 |
| 构建 / HMR | Vite 8 | **middleware 模式**内嵌进 Express，同源单进程 |

## 目录结构

```
htmx-project/
├─ server/            # Express 后端（Node）
│  ├─ index.js        # 入口：加载 Vite middleware / 静态资源
│  ├─ app.js          # createApp() 封装
│  ├─ routes/         # 路由 / 业务
│  └─ views/          # EJS 视图（布局 + partials + 页面）
├─ src/               # 前端（Vite 打包）
│  ├─ main.js         # 入口：导入 htmx + 样式
│  └─ main.css
├─ vite.config.mjs
├─ uno.config.ts
├─ test/              # node:test + supertest
└─ package.json
```

## 启动方式（仅此一种，无需并行多进程）

开发模式使用 **Vite 中间件模式**：Vite 以 middleware 形式嵌入 Node 进程，两者**同一端口、同一进程**，天然同源，前端资源经 Vite 热更新，后端改造由 `node --watch` 重启。

```bash
npm install        # 首次安装依赖
npm run dev        # 同时启动后端(Express:3000) + 前端(Vite HMR)
npm run build      # 仅构建前端产物到 dist/
npm start          # 生产模式：服务 dist 静态资源
npm test           # 运行测试
```

> `npm run dev` = Node + Vite **一条命令同时启动**，无需 `vite` 与 `node` 分开启动。

## HMR 说明

- **前端**：`src/main.js` / `src/main.css` 改动 → Vite HMR 热更新，不刷新。
- **后端视图**：`server/views/*.ejs` 在开发模式（view cache 关闭）下每次请求重新读盘，保存后刷新页面即可看到变化；路由等 `.js` 改动由 `node --watch` 自动重启。