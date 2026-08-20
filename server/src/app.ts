import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import expressLayouts from 'express-ejs-layouts';
import { initI18n } from './i18n/config.js';
import { i18nRequest, localeBridge } from './middleware/i18n.js';
import fragmentRender from './middleware/render-fragment.js';
import renderPage from './middleware/render-page.js';
import type { Express } from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 创建 Express 应用（不含路由与前端中间件）。
 * 这样测试端可通过 createApp() + mountRoutes() 直接组合，
 * 生产端通过静态目录，开发端由 index.js 注入 Vite middleware。
 */
export async function createApp(): Promise<Express> {
    const app = express();

    // 视图引擎
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.set('layout', 'layouts/layout');
    app.use(expressLayouts);

    // 视图可见标志：开发(true) 由 Vite 提供前端资源；生产(false) 用 dist 静态资源
    app.locals.isDev = process.env.NODE_ENV !== 'production';

    // 请求体解析
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    await initI18n(); // i18next 初始化（语言包 / 语言探测规则），见 middleware/i18n.js

    app.use(i18nRequest()); // ① 每请求解析语言，挂 req.t() / req.i18n

    // ② 把 req.t 桥接到 res.locals，EJS 模板（含 partials）才能直接用 <%= t('...') %>
    app.use(localeBridge);

    // 局部片段渲染（partials 绕过 express-layouts）必须先于 render-page 挂载
    app.use(fragmentRender);
    // 页面组装渲染器（res.renderPage）：整页 / 片段 两层嵌套一次完成
    app.use(renderPage);

    return app;
}