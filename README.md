# htmx-study-express-vite

前后端不分离小型项目：**Node + Express** 服务端渲染，**htmx** 提供前端交互能力，**Vite + Tailwind CSS** 负责前端构建与 HMR。

> 💡 开发/提交/版本同步规范请看 [**docs/development-standards.md**](docs/development-standards.md)（GitHub 为主仓库、Gitee 为镜像的同步约定）。

本工程是 **Express + Vite** 的实践项目，完整串起「后端 Express 渲染视图 + 前端 Vite 构建/HMR」的典型开发链路。

## 技术栈选型

| 层 | 选型 | 说明 |
|---|---|---|
| 后端框架 | Express 5 | 服务端渲染 API，返回完整页面或局部片段 |
| 模板引擎 | EJS + express-ejs-layouts | 布局 / partial 拆分 |
| 前端交互 | htmx 2 | 通过 `hx-*` 属性做局部交换 |
| 样式 | Tailwind CSS | utility-first，按需生成，和模板类名兼容 |
| 构建 / HMR | Vite 8 | **middleware 模式**内嵌进 Express，同源单进程 |
| 国际化 | i18next + i18next-http-middleware | URL 参数 / Cookie / Accept-Language 三层语言探测 |

## 目录结构

```
htmx-study-express-vite/
├─ server/            # Express 后端（Node/TypeScript）
│  └─ src/
│     ├─ index.ts     # 入口：按 dev/prod 挂载 Vite middleware 或静态资源，并启动 server
│     ├─ app.ts       # createApp() 封装（含 i18next 初始化与中间件挂载）
│     ├─ routes.ts    # 路由汇总（pages / locale / list）
│     ├─ routes/      # 各业务路由（整页 / 语言切换 / 待办数据）
│     ├─ middleware/  # 渲染 & i18n 中间件（fragment / render / i18n）
│     ├─ i18n/        # i18next 初始化与语言加载
│     ├─ locales/     # 语言包（zh-CN.json / en-US.json）
│     ├─ runtime/     # 运行时装配（shutdownRuntime.ts）
│     ├─ utils/       # 运行时能力（gracefulShutdown / listenWithRetry）
│     ├─ views/       # EJS 视图（layouts + partials + pages）
│     └─ legacy/      # 历史中间件存档（render-fragment / render-page）
├─ client/            # 前端源码
│  └─ src/
│     ├─ main.ts      # 入口：导入 htmx + 样式
│     └─ main.scss
├─ dist-client/       # Vite 构建产物
├─ vite.config.mjs
├─ test/              # node:test + supertest
└─ package.json
```

## 启动方式（仅此一种，无需并行多进程）

开发模式使用 **Vite 中间件模式**：Vite 以 middleware 形式嵌入 Node 进程，两者**同一端口、同一进程**，天然同源，前端资源经 Vite 热更新，后端改造由 `node --watch` 重启。

```bash
npm install        # 首次安装依赖
npm run dev        # 同时启动后端(Express:3000) + 前端(Vite HMR)
npm run build      # 仅构建前端产物到 dist-client/
npm start          # 生产模式：服务 dist-client 静态资源
npm test           # 运行测试
```

> `npm run dev` = Node + Vite **一条命令同时启动**，无需 `vite` 与 `node` 分开启动。

### 开发态进程生命周期（退场 / 入场）

当前开发模式是**单进程**：Express、Vite middleware、Vite HMR 都挂在同一个 Node 进程和同一个 HTTP 端口上。

这意味着服务端文件变更时，不只是“旧进程退出、新进程启动”这么简单，还存在一个短暂交接窗口：

1. **退场**：旧进程收到 `SIGTERM`（watch 重启）或 `SIGINT`（用户 `Ctrl+C`）后，要尽快关闭 HTTP server、现有 socket 和 Vite 自身资源。
2. **入场**：新进程启动时，若旧进程还没完全释放端口，新的 `server.listen(port)` 可能先遇到 `EADDRINUSE`，此时需要短暂重试。

本项目把这两个阶段拆成两个独立 util：

| 阶段 | 文件 | 作用 |
|---|---|---|
| 退场 | `server/src/utils/gracefulShutdown.ts` | 关闭旧进程的 HTTP 监听、socket 和 Vite 资源，尽量缩短旧进程占端口时间 |
| 入场 | `server/src/utils/listenWithRetry.ts` | 新进程监听端口时若遇到 `EADDRINUSE`，稍等后重试，避免因为旧进程晚几百毫秒释放端口而直接崩掉 |

`server/src/runtime/shutdownRuntime.ts` 只负责把退场逻辑注册到进程信号；开发模式下的 Vite 创建仍直接保留在 `server/src/index.ts` 的 `if (!isProd)` 分支里，便于从入口一眼看出 dev / prod 差异。

可以把它理解为：

- `createGracefulShutdown` 负责让旧进程**尽快放手**
- `node --watch-path=server ...` 负责把新进程**重新拉起来**
- `listenWithRetry` 负责让新进程在旧进程还没完全放手时**先别崩**

注意：`listenWithRetry` 重试的是当前新进程里的 `server.listen(port)`，不是进程重启本身。真正结束旧进程并拉起新进程的，是 `node --watch-path=server ...` 这条启动链路。

其中 `SIGINT` 只代表“用户手动结束当前进程”，通常不会自动拉起新进程，所以一般不会进入 `listenWithRetry` 的重试链路；`SIGTERM` 则更常见于 watch 重启，后续才会有新进程入场。

## 国际化（i18n）方案

语言切换与翻译由 **i18next + i18next-http-middleware** 在服务端完成，模板里通过 `<%= t('key') %>` 取翻译，语言包放在 `server/locales/` 下的 JSON 文件。

### 语言探测优先级

`i18next-http-middleware` 的 LanguageDetector 按以下顺序探测当前语言（顺序可通过 `detection.order` 配置）：

1. **URL 查询参数** `?lang=`（如 `/?lang=en-US`）——最高优先级，来自语言切换链接
2. **Cookie**（`lang`）——探测到语言后自动写回 cookie，保证后续 htmx 局部刷新时语言一致
3. **请求头** `Accept-Language`——浏览器默认语言

以上都探测不到或语言包缺失时，回退到 `fallbackLng`（`zh-CN`）。

### 语言码归一化

浏览器发送的 `Accept-Language` 写法五花八门（小写、缺区域、乱序），通过 `supportedLngs` + `nonExplicitSupportedLngs` 把它们统一归一到应用支持的语言：

```js
supportedLngs: ['zh-CN', 'en-US'],  // 白名单：只允许这两种语言码，其余一律回退 fallbackLng
nonExplicitSupportedLngs: true,     // 允许“纯语言码”（如 zh / en）按前缀匹配到列表内的完整码
```

| 请求语言 | 匹配机制 | 结果 |
|---|---|---|
| `zh-CN` / `zh-cn` | 大小写不敏感精确匹配（默认行为） | `zh-CN` |
| `zh`（无区域） | `nonExplicitSupportedLngs` 前缀匹配 | `zh-CN` |
| `en` / `en-US` / `en-us` | 同上 | `en-US` |
| `zh-TW` / `ja-JP` 等 | 被 `supportedLngs` 白名单拦下 | 回退 `zh-CN` |

> ⚠️ 前缀匹配按数组顺序取「第一个以该码开头的完整码」。**如果将来同时加入 `zh-CN` 与 `zh-TW`，`supportedLngs` 里谁排在前，纯 `zh` 就归谁**，请把想作为默认中文的放前面。

### 语言切换如何工作

页头导航通过自定义语言下拉菜单（`src/language.ts`）切换语言，**全程无刷新、无页面跳转**：

1. 点击菜单项 → 拦截 `<a>` 默认跳转，SDK 层调用 `switchLanguage(lang)`；
2. **POST `/change-language`**：服务端把新的 `lang` 写入 cookie，并返回该语言的语言包 `{ i18nJson, isSuccess }`；前端同步更新 `window.I18n`；
3. **GET `/body`（htmx.ajax）**：利用 htmx 取回当前页面主体片段，以 `innerHTML` 整块换进 `#root`（不重载整页、不重新执行脚本，只替换页面内已翻译的文本）；
4. 同步 `<html lang>` 属性；
5. 重新绑定语言下拉菜单（`initLanguageSwitcher()`，因为 `#root` 已是新 DOM）。

### 页内结构约定

得益于 `layout.ejs` 的极简设计，**整站主体（header + main + footer）都放在 `index.ejs`**，并整体包在 `<div id="root">` 中。因此语言切换只需让服务端用对应语言包重渲染 `index.ejs`（`/body` 路由，`layout: false` 不套外层布局），取下整块 `#root` 内容替换即可，无需刷新浏览器。

> 语言包以 `window.I18n` 注入供前端使用；页面正文由 htmx 局部替换，其余脚本（htmx、样式）不重复加载。

### 传统跳转式（备选）

若不需要无感换语言，可退化为 URL query 方式：

- 选择语言后跳转到 `/?lang=...`，语言随 URL 参数请求发送到服务端；
- 服务端据此确定语言，并写入 `lang` cookie，同时用对应语言包渲染整页（此方式会整页刷新）。

### 模板中的用法

在任意视图（含 partials）中直接使用：

```ejs
<%- t('nav.home') %>
<%= t('todos.count', { count: 12 }) %>   <!-- 支持插值 -->
```

`res.locals.t` 与 `res.locals.currentLocale` 在中间件中按 `req.t / req.i18n.language` 注入，`html lang` 等场景直接取 `currentLocale`。

## 渲染与片段中间件

页面组装由安装于 `server/src/middleware/` 的渲染中间件完成，业务路由只关心「要整页还是片段」：

- **整页**：`res.renderPage(meta.view, { ... })` —— 内容 + `app-layout` 外壳 + 全局 `layout`。
- **片段（无刷新重绘，如语言切换）**：`res.renderPage(..., { pageLayout: false })` —— 保留 `app-layout` 外壳但不套全局 `layout`。
- **局部元素片段**（待办增删改）：`res.render('partials/…', ...)` —— 由 `fragment` 中间件**自动注入 `layout:false`**，无需手写。

相关文件与中间件：

| 文件 | 导出 | 作用 |
|---|---|---|
| `middleware/fragment.middleware.ts` | `injectFragmentFlagMiddleware` / `fragmentRenderMiddleware` / `protectPartialsRoute` | htmx 标记注入、`res.render` 片段重写、`/partials·` 防直访 |
| `middleware/render.middleware.ts` | `renderPageMiddleware` | 挂载 `res.renderPage` 多层布局组装 |
| `middleware/i18n.middleware.ts` | `i18nRequest` / `localeBridge` | i18n 语言解析与 `res.locals` 桥接 |

> ⚠️ **挂载顺序不可颠倒**：`injectFragmentFlag → fragmentRender → protectPartials('/partials/*') → renderPage`。详细约定见 [**docs/development-standards.md**](docs/development-standards.md)。

## HMR 说明

- **前端**：`client/src/main.ts` / `client/src/main.css` 改动 → Vite HMR 热更新，不刷新。
- **后端视图**：`server/src/views/*.ejs` 在开发模式（view cache 关闭）下每次请求重新读盘，保存后刷新页面即可看到变化；路由等 `.js` 改动由 `node --watch` 自动重启。