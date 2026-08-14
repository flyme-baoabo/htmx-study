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

  return app;
}