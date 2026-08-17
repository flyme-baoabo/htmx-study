import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import expressLayouts from 'express-ejs-layouts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 创建 Express 应用（不含路由与前端中间件）。
 * 这样测试端可通过 createApp() + mountRoutes() 直接组合，
 * 生产端通过静态目录，开发端由 index.js 注入 Vite middleware。
 */
export function createApp() {
  const app = express();

  // 视图引擎
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.set('layout', 'layout');
  app.use(expressLayouts);

  // 视图可见标志：开发(true) 由 Vite 提供前端资源；生产(false) 用 dist 静态资源
  app.locals.isDev = process.env.NODE_ENV !== 'production';

  // 请求体解析
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 统一处理局部片段：凡是 partials 模板都走原始渲染（res.__render），
  // 彻底绕开 express-ejs-layouts 的布局包装，返回可被 htmx 替换的纯片段。
  // 这样路由里就不必每一处都写 layout: false 了。
  app.use((req, res, next) => {
    const layoutRender = res.render; // expressLayouts 包装后的 render

    res.render = function (view, options, callback) {
      // 判断依据是“视图名”而非 req.url：partials/ 开头的模板都是局部片段
      if (typeof view === 'string' && view.startsWith('partials/')) {
        // 直接调用库存原 render，不套任何布局，返回可被 htmx 替换的纯片段
        return res.__render.call(this, view, options, callback);
      }
      return layoutRender.call(this, view, options, callback);
    };

    next();
  });

  return app;
}