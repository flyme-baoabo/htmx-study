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
├─ server/            # Express 后端（Node）
│  ├─ index.js        # 入口：加载 Vite middleware / 静态资源
│  ├─ app.js          # createApp() 封装（含 i18next 初始化）
│  ├─ routes/         # 路由 / 业务
│  ├─ locales/        # 语言包（zh-CN.json / en-US.json）
│  └─ views/          # EJS 视图（布局 + partials + 页面）
├─ src/               # 前端（Vite 打包）
│  ├─ main.ts         # 入口：导入 htmx + 样式
│  └─ main.scss
├─ vite.config.mjs
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

## HMR 说明

- **前端**：`src/main.ts` / `src/main.css` 改动 → Vite HMR 热更新，不刷新。
- **后端视图**：`server/views/*.ejs` 在开发模式（view cache 关闭）下每次请求重新读盘，保存后刷新页面即可看到变化；路由等 `.js` 改动由 `node --watch` 自动重启。